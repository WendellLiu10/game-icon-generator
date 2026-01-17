/**
 * 矩阵生成模块
 * 负责风格矩阵的批量生成和进度管理
 */

import { generateIconGridWithReference } from '../api/gemini.js';
import { getAssetsByIds } from './assets-manager.js';

// ============================================================================
// 常量定义
// ============================================================================

// 预设风格列表
export const PRESET_STYLES = [
    { id: 'universal', name: '通用游戏', prompt: 'game asset style, high quality, detailed' },
    { id: 'wuxia', name: '武侠仙侠', prompt: 'Chinese wuxia/xianxia style, ink painting, ethereal' },
    { id: 'cyberpunk', name: '赛博朋克', prompt: 'cyberpunk style, neon lights, high tech, futuristic' },
    { id: 'pixel', name: '像素风', prompt: 'pixel art style, 8-bit, retro game' },
    { id: 'casual', name: '卡通休闲', prompt: 'cartoon style, casual game, bright colors, cute' },
    { id: 'dark-fantasy', name: '暗黑奇幻', prompt: 'dark fantasy style, grim, gothic, detailed' },
    { id: 'realistic', name: '写实 3D', prompt: 'realistic 3D render, unreal engine 5, 4k' },
    { id: 'anime', name: '日系动漫', prompt: 'anime style, cel shading, vibrant colors, Japanese illustration' },
    { id: 'watercolor', name: '水彩手绘', prompt: 'watercolor painting style, soft edges, artistic, hand-painted' },
    { id: 'minimalist', name: '极简扁平', prompt: 'minimalist flat design, clean lines, simple shapes, modern' }
];

// 生成类型
export const GENERATION_TYPES = {
    icon: { name: '图标', gridSize: 3, prompt: 'game icons' },
    character: { name: '角色立绘', gridSize: 1, prompt: 'character portrait, half body or full body' },
    scene: { name: '游戏画面', gridSize: 1, prompt: 'game scene, background art' },
    uiTemplate: { name: 'UI 模板', gridSize: 1, prompt: 'game UI template, interface design, buttons and panels' },
    colorPalette: { name: '配色方案', gridSize: 1, prompt: 'color palette with 5-7 harmonious colors, swatches displayed in a row' }
};

// ============================================================================
// 矩阵生成器类
// ============================================================================

export class MatrixGenerator {
    constructor(options = {}) {
        this.apiKey = options.apiKey || '';
        this.baseUrl = options.baseUrl || '';
        this.concurrent = options.concurrent || false; // 是否并发
        this.maxConcurrent = options.maxConcurrent || 3; // 最大并发数
        this.onProgress = options.onProgress || (() => { });
        this.onCellComplete = options.onCellComplete || (() => { });
        this.onError = options.onError || (() => { });

        this.aborted = false;
        this.results = [];
    }

    /**
     * 生成风格矩阵
     * @param {Object} config - 生成配置
     * @param {Array<string>} config.assetIds - 素材 ID 列表（横轴）
     * @param {Array<string>} config.styleIds - 风格 ID 列表（纵轴）
     * @param {string} config.generationType - 生成类型
     * @param {string} config.customPrompt - 自定义提示词
     * @param {number} config.resolution - 生成分辨率
     * @returns {Promise<Array>} 矩阵结果
     */
    async generate(config) {
        const { assetIds, styleIds, generationType = 'icon', customPrompt = '', resolution = 1024 } = config;

        this.aborted = false;
        this.results = [];

        // 获取素材数据
        const assets = await getAssetsByIds(assetIds);
        if (assets.length === 0) {
            throw new Error('没有找到有效的素材');
        }

        // 获取风格配置
        const styles = styleIds.map(id => {
            const preset = PRESET_STYLES.find(s => s.id === id);
            return preset || { id, name: id, prompt: id };
        });

        // 构建任务队列
        const tasks = [];
        for (let row = 0; row < styles.length; row++) {
            for (let col = 0; col < assets.length; col++) {
                tasks.push({
                    row,
                    col,
                    asset: assets[col],
                    style: styles[row],
                    generationType,
                    customPrompt,
                    resolution
                });
            }
        }

        const total = tasks.length;
        let completed = 0;

        // 初始化结果矩阵
        this.results = styles.map(() => assets.map(() => null));

        if (this.concurrent) {
            // 并发生成
            await this.generateConcurrent(tasks, total, () => {
                completed++;
                this.onProgress({ completed, total, percent: Math.round((completed / total) * 100) });
            });
        } else {
            // 串行生成
            for (const task of tasks) {
                if (this.aborted) break;

                try {
                    const result = await this.generateSingle(task);
                    this.results[task.row][task.col] = result;
                    this.onCellComplete({ row: task.row, col: task.col, result });
                } catch (error) {
                    this.results[task.row][task.col] = { error: error.message };
                    this.onError({ row: task.row, col: task.col, error });
                }

                completed++;
                this.onProgress({ completed, total, percent: Math.round((completed / total) * 100) });
            }
        }

        return {
            assets,
            styles,
            results: this.results,
            generationType
        };
    }

    /**
     * 并发生成
     */
    async generateConcurrent(tasks, total, onComplete) {
        const executing = new Set();

        for (const task of tasks) {
            if (this.aborted) break;

            const promise = this.generateSingle(task)
                .then(result => {
                    this.results[task.row][task.col] = result;
                    this.onCellComplete({ row: task.row, col: task.col, result });
                    onComplete();
                })
                .catch(error => {
                    this.results[task.row][task.col] = { error: error.message };
                    this.onError({ row: task.row, col: task.col, error });
                    onComplete();
                })
                .finally(() => {
                    executing.delete(promise);
                });

            executing.add(promise);

            if (executing.size >= this.maxConcurrent) {
                await Promise.race(executing);
            }
        }

        await Promise.all(executing);
    }

    /**
     * 生成单个单元格
     */
    async generateSingle(task) {
        const { asset, style, generationType, customPrompt, resolution } = task;
        const typeConfig = GENERATION_TYPES[generationType] || GENERATION_TYPES.icon;

        // 构建提示词
        const prompt = this.buildPrompt(typeConfig, style, customPrompt);

        // 调用 API - 注意参数顺序: (apiKey, image, prompt, subject, baseUrl, resolution, gridSize)
        const imageBase64 = await generateIconGridWithReference(
            this.apiKey,
            asset.imageBase64,
            prompt,
            generationType,           // subject - 生成类型作为主体类型
            this.baseUrl || undefined, // baseUrl - 空字符串时传 undefined 使用默认值
            resolution,                // resolution
            typeConfig.gridSize        // gridSize
        );

        return {
            imageBase64,
            prompt,
            assetId: asset.id,
            styleId: style.id,
            generationType,
            createdAt: new Date().toISOString()
        };
    }

    /**
     * 构建提示词
     */
    buildPrompt(typeConfig, style, customPrompt) {
        const parts = [typeConfig.prompt, style.prompt];
        if (customPrompt) {
            parts.push(customPrompt);
        }
        return parts.join(', ');
    }

    /**
     * 中止生成
     */
    abort() {
        this.aborted = true;
    }

    /**
     * 获取当前结果
     */
    getResults() {
        return this.results;
    }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取所有预设风格
 * @returns {Array}
 */
export function getPresetStyles() {
    return PRESET_STYLES;
}

/**
 * 获取所有生成类型
 * @returns {Object}
 */
export function getGenerationTypes() {
    return GENERATION_TYPES;
}

/**
 * 根据 ID 获取风格
 * @param {string} id
 * @returns {Object|null}
 */
export function getStyleById(id) {
    return PRESET_STYLES.find(s => s.id === id) || null;
}
