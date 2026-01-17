/**
 * 风格矩阵应用模块
 * 负责风格矩阵页面的 UI 逻辑和交互
 */

import {
    initAssetsDB,
    getAllAssets,
    createAssetFromFile,
    deleteAsset,
    ASSET_CATEGORIES
} from './core/assets-manager.js';

import {
    MatrixGenerator,
    PRESET_STYLES,
    GENERATION_TYPES
} from './core/matrix-generator.js';

import {
    initExplorationDB,
    createExploration,
    getAllExplorations,
    getExplorationById,
    updateExploration,
    deleteExploration,
    createIteration,
    downloadHTMLReport
} from './core/exploration-db.js';

import { generateIconGridWithReference } from './api/gemini.js';

// ============================================================================
// 状态管理
// ============================================================================

const matrixState = {
    // API 设置
    apiKey: '',
    baseUrl: '',

    // 素材相关
    assets: [],
    selectedAssetIds: [],
    currentCategory: 'all',

    // 风格相关
    selectedStyleIds: [],

    // 生成配置
    generationType: 'icon',
    customPrompt: '',
    resolution: 1024,
    concurrent: false,

    // 生成状态
    isGenerating: false,
    progress: { completed: 0, total: 0, percent: 0 },
    results: null,

    // 探索方案
    explorations: [],
    currentExplorationId: null
};

// ============================================================================
// DOM 元素引用
// ============================================================================

let matrixElements = {};

function cacheMatrixDOM() {
    matrixElements = {
        // 素材管理
        assetsGrid: document.getElementById('matrixAssetsGrid'),
        assetUploadInput: document.getElementById('matrixAssetUpload'),
        categoryTabs: document.querySelectorAll('.matrix-category-tab'),
        selectedAssetsCount: document.getElementById('selectedAssetsCount'),

        // 风格选择
        styleChips: document.getElementById('styleChipsContainer'),
        selectedStylesCount: document.getElementById('selectedStylesCount'),

        // 生成配置
        generationTypeSelect: document.getElementById('matrixGenerationType'),
        customPromptInput: document.getElementById('matrixCustomPrompt'),
        resolutionSelect: document.getElementById('matrixResolution'),
        concurrentSwitch: document.getElementById('concurrentSwitch'),

        // 控制按钮
        generateBtn: document.getElementById('btnGenerateMatrix'),
        abortBtn: document.getElementById('btnAbortMatrix'),
        saveExplorationBtn: document.getElementById('btnSaveExploration'),

        // 进度
        progressContainer: document.getElementById('matrixProgressContainer'),
        progressBar: document.getElementById('matrixProgressBar'),
        progressText: document.getElementById('matrixProgressText'),

        // 结果
        matrixResultContainer: document.getElementById('matrixResultContainer'),
        matrixGrid: document.getElementById('matrixGrid'),

        // 探索方案
        explorationsList: document.getElementById('explorationsList')
    };
}

// ============================================================================
// 初始化
// ============================================================================

let generator = null;

export async function initMatrixApp() {
    cacheMatrixDOM();

    // 从 localStorage 加载 API Key
    matrixState.apiKey = localStorage.getItem('gemini_api_key') || '';
    matrixState.baseUrl = localStorage.getItem('gemini_base_url') || '';

    // 初始化数据库
    await initAssetsDB();
    await initExplorationDB();

    // 加载数据
    await loadAssets();
    await loadExplorations();

    // 渲染预设风格
    renderStyleChips();

    // 绑定事件
    bindMatrixEvents();
}

function bindMatrixEvents() {
    // 素材上传
    if (matrixElements.assetUploadInput) {
        matrixElements.assetUploadInput.addEventListener('change', handleAssetUpload);
    }

    // 分类切换
    document.querySelectorAll('.matrix-category-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            switchCategory(category);
        });
    });

    // 生成类型
    if (matrixElements.generationTypeSelect) {
        matrixElements.generationTypeSelect.addEventListener('change', (e) => {
            matrixState.generationType = e.target.value;
        });
    }

    // 分辨率
    if (matrixElements.resolutionSelect) {
        matrixElements.resolutionSelect.addEventListener('change', (e) => {
            matrixState.resolution = parseInt(e.target.value);
        });
    }

    // 并发开关
    if (matrixElements.concurrentSwitch) {
        matrixElements.concurrentSwitch.addEventListener('change', (e) => {
            matrixState.concurrent = e.target.checked;
        });
    }

    // 自定义提示词
    if (matrixElements.customPromptInput) {
        matrixElements.customPromptInput.addEventListener('input', (e) => {
            matrixState.customPrompt = e.target.value;
        });
    }

    // 生成按钮
    if (matrixElements.generateBtn) {
        matrixElements.generateBtn.addEventListener('click', handleGenerateMatrix);
    }

    // 中止按钮
    if (matrixElements.abortBtn) {
        matrixElements.abortBtn.addEventListener('click', handleAbortGeneration);
    }

    // 保存方案
    if (matrixElements.saveExplorationBtn) {
        matrixElements.saveExplorationBtn.addEventListener('click', handleSaveExploration);
    }
}

// ============================================================================
// 素材管理
// ============================================================================

async function loadAssets() {
    const category = matrixState.currentCategory === 'all' ? null : matrixState.currentCategory;
    matrixState.assets = await getAllAssets(category);
    renderAssetsGrid();
}

function renderAssetsGrid() {
    if (!matrixElements.assetsGrid) return;

    const assets = matrixState.assets;

    // 上传按钮
    let html = `
    <div class="asset-upload-zone" onclick="document.getElementById('matrixAssetUpload').click()">
      <div class="upload-icon">➕</div>
      <span>添加素材</span>
    </div>
  `;

    // 素材卡片
    assets.forEach(asset => {
        const isSelected = matrixState.selectedAssetIds.includes(asset.id);
        html += `
      <div class="asset-card ${isSelected ? 'selected' : ''}" 
           data-id="${asset.id}"
           onclick="window.matrixApp.toggleAssetSelection('${asset.id}')">
        <img src="data:image/jpeg;base64,${asset.thumbnailBase64}" alt="${asset.name}">
        <div class="select-indicator">✓</div>
        <button class="delete-btn" onclick="event.stopPropagation(); window.matrixApp.deleteAsset('${asset.id}')">✕</button>
      </div>
    `;
    });

    matrixElements.assetsGrid.innerHTML = html;
    updateSelectionCounts();
}

async function handleAssetUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        try {
            await createAssetFromFile(file, matrixState.currentCategory === 'all' ? 'reference' : matrixState.currentCategory);
        } catch (err) {
            console.error('上传素材失败:', err);
        }
    }

    await loadAssets();
    e.target.value = ''; // 重置 input
}

export function toggleAssetSelection(assetId) {
    const idx = matrixState.selectedAssetIds.indexOf(assetId);
    if (idx === -1) {
        matrixState.selectedAssetIds.push(assetId);
    } else {
        matrixState.selectedAssetIds.splice(idx, 1);
    }
    renderAssetsGrid();
}

export async function deleteAssetById(assetId) {
    if (!confirm('确定删除这个素材吗？')) return;

    await deleteAsset(assetId);
    matrixState.selectedAssetIds = matrixState.selectedAssetIds.filter(id => id !== assetId);
    await loadAssets();
}

function switchCategory(category) {
    matrixState.currentCategory = category;

    // 更新 Tab 激活状态
    document.querySelectorAll('.matrix-category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.category === category);
    });

    loadAssets();
}

// ============================================================================
// 风格选择
// ============================================================================

function renderStyleChips() {
    if (!matrixElements.styleChips) return;

    let html = '';
    PRESET_STYLES.forEach(style => {
        const isSelected = matrixState.selectedStyleIds.includes(style.id);
        html += `
      <div class="style-chip ${isSelected ? 'selected' : ''}"
           data-id="${style.id}"
           onclick="window.matrixApp.toggleStyleSelection('${style.id}')">
        ${style.name}
      </div>
    `;
    });

    matrixElements.styleChips.innerHTML = html;
    updateSelectionCounts();
}

export function toggleStyleSelection(styleId) {
    const idx = matrixState.selectedStyleIds.indexOf(styleId);
    if (idx === -1) {
        matrixState.selectedStyleIds.push(styleId);
    } else {
        matrixState.selectedStyleIds.splice(idx, 1);
    }
    renderStyleChips();
}

function updateSelectionCounts() {
    if (matrixElements.selectedAssetsCount) {
        matrixElements.selectedAssetsCount.textContent = matrixState.selectedAssetIds.length;
    }
    if (matrixElements.selectedStylesCount) {
        matrixElements.selectedStylesCount.textContent = matrixState.selectedStyleIds.length;
    }
}

// ============================================================================
// 矩阵生成
// ============================================================================

async function handleGenerateMatrix() {
    // 验证
    if (matrixState.selectedAssetIds.length === 0) {
        alert('请至少选择一个素材');
        return;
    }
    if (matrixState.selectedStyleIds.length === 0) {
        alert('请至少选择一个风格');
        return;
    }
    if (!matrixState.apiKey) {
        alert('请先设置 API Key');
        return;
    }

    matrixState.isGenerating = true;
    updateGeneratingUI(true);

    // 创建矩阵生成器
    generator = new MatrixGenerator({
        apiKey: matrixState.apiKey,
        baseUrl: matrixState.baseUrl,
        concurrent: matrixState.concurrent,
        maxConcurrent: 3,

        onProgress: (progress) => {
            matrixState.progress = progress;
            updateProgress(progress);
        },

        onCellComplete: ({ row, col, result }) => {
            updateMatrixCell(row, col, result);
        },

        onError: ({ row, col, error }) => {
            updateMatrixCellError(row, col, error.message);
        }
    });

    try {
        // 初始化空矩阵 UI
        initEmptyMatrix();

        // 开始生成
        const result = await generator.generate({
            assetIds: matrixState.selectedAssetIds,
            styleIds: matrixState.selectedStyleIds,
            generationType: matrixState.generationType,
            customPrompt: matrixState.customPrompt,
            resolution: matrixState.resolution
        });

        matrixState.results = result;

    } catch (err) {
        console.error('矩阵生成失败:', err);
        alert('生成失败: ' + err.message);
    } finally {
        matrixState.isGenerating = false;
        updateGeneratingUI(false);
        generator = null;
    }
}

function handleAbortGeneration() {
    if (generator) {
        generator.abort();
    }
}

function initEmptyMatrix() {
    if (!matrixElements.matrixGrid) return;

    const numAssets = matrixState.selectedAssetIds.length;
    const numStyles = matrixState.selectedStyleIds.length;

    // 设置 grid 列数 (第一列是风格名，后面是素材)
    matrixElements.matrixGrid.style.gridTemplateColumns = `120px repeat(${numAssets}, 1fr)`;

    let html = '';

    // 表头行：角落 + 素材缩略图
    html += '<div class="matrix-cell header corner">风格 \\ 素材</div>';
    for (let col = 0; col < numAssets; col++) {
        const asset = matrixState.assets.find(a => a.id === matrixState.selectedAssetIds[col]);
        html += `
      <div class="matrix-cell header">
        <img src="data:image/jpeg;base64,${asset?.thumbnailBase64 || ''}" 
             style="width:40px;height:40px;border-radius:4px;object-fit:cover;">
      </div>
    `;
    }

    // 数据行
    for (let row = 0; row < numStyles; row++) {
        const style = PRESET_STYLES.find(s => s.id === matrixState.selectedStyleIds[row]);

        // 风格名称列
        html += `<div class="matrix-cell header">${style?.name || ''}</div>`;

        // 结果格子
        for (let col = 0; col < numAssets; col++) {
            html += `
        <div class="matrix-cell" id="cell-${row}-${col}">
          <div class="loading"><div class="loader"></div></div>
        </div>
      `;
        }
    }

    matrixElements.matrixGrid.innerHTML = html;

    if (matrixElements.matrixResultContainer) {
        matrixElements.matrixResultContainer.style.display = 'block';
    }
}

function updateMatrixCell(row, col, result) {
    const cell = document.getElementById(`cell-${row}-${col}`);
    if (!cell) return;

    if (result.imageBase64) {
        cell.innerHTML = `<img src="data:image/png;base64,${result.imageBase64}" alt="Result">`;
    }
}

function updateMatrixCellError(row, col, errorMsg) {
    const cell = document.getElementById(`cell-${row}-${col}`);
    if (!cell) return;

    cell.innerHTML = `<div class="error">❌ ${errorMsg}</div>`;
}

function updateProgress(progress) {
    if (matrixElements.progressBar) {
        matrixElements.progressBar.style.width = `${progress.percent}%`;
    }
    if (matrixElements.progressText) {
        matrixElements.progressText.textContent = `${progress.completed} / ${progress.total}`;
    }
}

function updateGeneratingUI(isGenerating) {
    if (matrixElements.generateBtn) {
        matrixElements.generateBtn.disabled = isGenerating;
        matrixElements.generateBtn.textContent = isGenerating ? '⏳ 生成中...' : '✨ 生成矩阵';
    }
    if (matrixElements.abortBtn) {
        matrixElements.abortBtn.style.display = isGenerating ? 'inline-flex' : 'none';
    }
    if (matrixElements.progressContainer) {
        matrixElements.progressContainer.style.display = isGenerating ? 'block' : 'none';
    }
}

// ============================================================================
// 探索方案
// ============================================================================

async function loadExplorations() {
    matrixState.explorations = await getAllExplorations();
    renderExplorationsList();
}

function renderExplorationsList() {
    if (!matrixElements.explorationsList) return;

    if (matrixState.explorations.length === 0) {
        matrixElements.explorationsList.innerHTML = `
      <div class="empty-state">
        <div class="icon">📁</div>
        <div class="title">暂无探索方案</div>
        <div class="desc">生成风格矩阵后可以保存为探索方案</div>
      </div>
    `;
        return;
    }

    let html = '';
    matrixState.explorations.forEach(exp => {
        html += `
      <div class="exploration-card" onclick="window.matrixApp.loadExploration('${exp.id}')">
        <div class="preview">
          ${exp.preview ? `<img src="data:image/png;base64,${exp.preview}">` : '<div class="empty-state"><div class="icon">🖼️</div></div>'}
        </div>
        <div class="title">${exp.name}</div>
        <div class="meta">${exp.assetCount} 素材 × ${exp.styleCount} 风格</div>
        <div class="meta">${new Date(exp.updatedAt).toLocaleDateString()}</div>
        <div class="tags">
          ${exp.tags?.map(t => `<span class="tag">${t}</span>`).join('') || ''}
        </div>
      </div>
    `;
    });

    matrixElements.explorationsList.innerHTML = html;
}

async function handleSaveExploration() {
    if (!matrixState.results) {
        alert('请先生成矩阵结果');
        return;
    }

    const name = prompt('请输入方案名称:', `探索方案 ${new Date().toLocaleDateString()}`);
    if (!name) return;

    try {
        await createExploration({
            name,
            assetIds: matrixState.selectedAssetIds,
            styleIds: matrixState.selectedStyleIds,
            generationType: matrixState.generationType,
            customPrompt: matrixState.customPrompt,
            results: matrixState.results.results
        });

        await loadExplorations();
        alert('方案保存成功！');
    } catch (err) {
        console.error('保存方案失败:', err);
        alert('保存失败: ' + err.message);
    }
}

export async function loadExploration(id) {
    try {
        const exp = await getExplorationById(id);
        if (!exp) return;

        // 恢复选择状态
        matrixState.selectedAssetIds = exp.assetIds || [];
        matrixState.selectedStyleIds = exp.styleIds || [];
        matrixState.generationType = exp.generationType || 'icon';
        matrixState.customPrompt = exp.customPrompt || '';
        matrixState.currentExplorationId = id;

        // 更新 UI
        await loadAssets();
        renderStyleChips();

        // 如果有结果，渲染结果
        if (exp.results && exp.results.length > 0) {
            matrixState.results = { results: exp.results };
            // TODO: 渲染已有结果
        }

        alert(`已加载方案: ${exp.name}`);
    } catch (err) {
        console.error('加载方案失败:', err);
    }
}

export async function exportExploration(id) {
    try {
        await downloadHTMLReport(id);
    } catch (err) {
        console.error('导出失败:', err);
        alert('导出失败: ' + err.message);
    }
}

// ============================================================================
// 暴露给全局
// ============================================================================

window.matrixApp = {
    toggleAssetSelection,
    deleteAsset: deleteAssetById,
    toggleStyleSelection,
    loadExploration,
    exportExploration
};

export { matrixState };
