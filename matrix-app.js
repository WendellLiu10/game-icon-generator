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
// Toast 提示函数
// ============================================================================

function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast show ${isError ? 'error' : ''}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

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
    console.log('[Matrix] initMatrixApp 开始初始化');

    cacheMatrixDOM();
    console.log('[Matrix] DOM 缓存完成, styleChips:', matrixElements.styleChips);

    // 从 localStorage 加载 API Key
    matrixState.apiKey = localStorage.getItem('gemini_api_key') || '';
    matrixState.baseUrl = localStorage.getItem('gemini_base_url') || '';

    // 先绑定事件（确保 UI 可交互）
    bindMatrixEvents();
    console.log('[Matrix] 事件绑定完成');

    // 先渲染预设风格（不依赖数据库）
    console.log('[Matrix] 准备渲染风格标签, PRESET_STYLES:', PRESET_STYLES);
    console.log('[Matrix] PRESET_STYLES 数量:', PRESET_STYLES?.length);
    renderStyleChips();
    console.log('[Matrix] 风格标签渲染完成');

    // 初始化数据库（可能失败，但不应阻止 UI 交互）
    try {
        console.log('[Matrix] 开始初始化 Assets 数据库...');
        await initAssetsDB();
        console.log('[Matrix] Assets 数据库初始化完成');
    } catch (err) {
        console.error('[Matrix] Assets 数据库初始化失败:', err);
        showToast('素材数据库初始化失败', true);
    }

    try {
        console.log('[Matrix] 开始初始化 Exploration 数据库...');
        await initExplorationDB();
        console.log('[Matrix] Exploration 数据库初始化完成');
    } catch (err) {
        console.error('[Matrix] Exploration 数据库初始化失败:', err);
    }

    // 加载数据
    try {
        await loadAssets();
        await loadExplorations();
        console.log('[Matrix] 数据加载完成');
    } catch (err) {
        console.error('[Matrix] 数据加载失败:', err);
    }

    console.log('[Matrix] initMatrixApp 初始化完成');
}

function bindMatrixEvents() {
    console.log('[Matrix] bindMatrixEvents 开始绑定事件');

    // 素材上传
    const uploadInput = matrixElements.assetUploadInput;
    console.log('[Matrix] assetUploadInput 元素:', uploadInput);

    if (uploadInput) {
        uploadInput.addEventListener('change', (e) => {
            console.log('[Matrix] change 事件触发!');
            handleAssetUpload(e);
        });
        console.log('[Matrix] 已绑定 change 事件到 assetUploadInput');
    } else {
        console.error('[Matrix] 错误: assetUploadInput 元素不存在!');
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
    console.log('[素材上传] handleAssetUpload 被调用');

    try {
        const files = Array.from(e.target.files);
        console.log('[素材上传] 选择的文件数:', files.length);

        if (files.length === 0) return;

        // 过滤出图片文件
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        console.log('[素材上传] 图片文件数:', imageFiles.length);

        if (imageFiles.length === 0) {
            showToast('请选择图片文件', true);
            e.target.value = '';
            return;
        }

        showToast(`正在上传 ${imageFiles.length} 个素材...`);

        let successCount = 0;
        let failCount = 0;

        for (const file of imageFiles) {
            try {
                console.log('[素材上传] 正在处理文件:', file.name);
                await createAssetFromFile(file, matrixState.currentCategory === 'all' ? 'reference' : matrixState.currentCategory);
                successCount++;
                console.log('[素材上传] 文件处理成功:', file.name);
            } catch (err) {
                console.error('[素材上传] 上传素材失败:', err);
                failCount++;
            }
        }

        console.log('[素材上传] 刷新素材列表...');
        await loadAssets();
        e.target.value = ''; // 重置 input

        // 显示结果
        if (failCount === 0) {
            showToast(`成功添加 ${successCount} 个素材`);
        } else if (successCount === 0) {
            showToast(`上传失败，请重试`, true);
        } else {
            showToast(`添加 ${successCount} 个成功，${failCount} 个失败`, true);
        }
    } catch (err) {
        console.error('[素材上传] 意外错误:', err);
        showToast(`上传出错: ${err.message}`, true);
        e.target.value = '';
    }
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

let isDeleting = false; // 防止重复删除

export async function deleteAssetById(assetId) {
    // 防止重复调用
    if (isDeleting) return;

    if (!confirm('确定删除这个素材吗？')) return;

    isDeleting = true;
    try {
        await deleteAsset(assetId);
        matrixState.selectedAssetIds = matrixState.selectedAssetIds.filter(id => id !== assetId);
        await loadAssets();
    } finally {
        isDeleting = false;
    }
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
    console.log('[Matrix] renderStyleChips 被调用');
    console.log('[Matrix] styleChips 容器:', matrixElements.styleChips);
    console.log('[Matrix] PRESET_STYLES:', PRESET_STYLES);

    if (!matrixElements.styleChips) {
        console.error('[Matrix] styleChips 容器不存在!');
        return;
    }

    if (!PRESET_STYLES || PRESET_STYLES.length === 0) {
        console.error('[Matrix] PRESET_STYLES 为空!');
        return;
    }

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

    console.log('[Matrix] 生成的 HTML:', html.substring(0, 200) + '...');
    matrixElements.styleChips.innerHTML = html;
    console.log('[Matrix] styleChips 子元素数量:', matrixElements.styleChips.children.length);
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

// 清理所有数据库的全局函数
async function clearAllDatabases() {
    console.log('[Matrix] 开始清理所有数据库...');
    try {
        // 删除所有可能的数据库
        const dbNames = ['GameStyleExplorer', 'GameExplorations', 'GameIconHistory'];
        for (const name of dbNames) {
            try {
                await new Promise((resolve, reject) => {
                    const req = indexedDB.deleteDatabase(name);
                    req.onsuccess = () => {
                        console.log(`[Matrix] 数据库 ${name} 已删除`);
                        resolve();
                    };
                    req.onerror = () => reject(req.error);
                    req.onblocked = () => {
                        console.warn(`[Matrix] 数据库 ${name} 删除被阻塞，正在等待...`);
                    };
                });
            } catch (e) {
                console.log(`[Matrix] 数据库 ${name} 不存在或删除失败:`, e);
            }
        }
        console.log('[Matrix] 所有数据库清理完成，请刷新页面');
        alert('数据库清理完成，请刷新页面');
    } catch (err) {
        console.error('[Matrix] 清理数据库失败:', err);
    }
}

/**
 * 刷新 API 设置 - 用于页面切换时同步最新设置
 */
export function refreshApiSettings() {
    const newApiKey = localStorage.getItem('gemini_api_key') || '';
    const newBaseUrl = localStorage.getItem('gemini_base_url') || '';

    if (newApiKey !== matrixState.apiKey || newBaseUrl !== matrixState.baseUrl) {
        matrixState.apiKey = newApiKey;
        matrixState.baseUrl = newBaseUrl;
        console.log('[Matrix] API 设置已同步更新');
    }
}

window.matrixApp = {
    toggleAssetSelection,
    deleteAsset: deleteAssetById,
    toggleStyleSelection,
    loadExploration,
    exportExploration,
    clearAllDatabases  // 暴露清理函数
};

export { matrixState };
