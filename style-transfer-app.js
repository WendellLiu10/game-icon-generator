/**
 * 画风迁移主应用逻辑
 * 管理状态、UI 交互、图片处理和批量转换
 */

import { StyleTransferEngine } from './core/style-transfer-engine.js';
import { saveTransferRecord, getAllTransferRecords, deleteTransferRecord } from './core/style-transfer-db.js';
import { compressImageToSize, createThumbnail, getDataUrl } from './core/image-utils.js';
import { getAllHistory } from './core/history-db.js';

// ============================================================================
// 状态管理
// ============================================================================

const state = {
  apiKey: '',
  baseUrl: '',
  styleImage: null,           // {base64, thumbnail, source, sourceId}
  targetImages: [],            // [{id, base64, thumbnail, gridSize, source, sourceId}]
  params: {
    styleStrength: 80,
    preserveStructure: true,
    enhancePrompt: '',
    resolution: 1024
  },
  isTransferring: false,
  currentResults: null,
  engine: null
};

// ============================================================================
// DOM 元素引用
// ============================================================================

const elements = {
  // A图相关
  styleImageInput: null,
  styleImageUploadZone: null,
  styleImagePreview: null,
  styleImageDisplay: null,
  btnRemoveStyleImage: null,
  btnSelectStyleFromHistory: null,

  // B图相关
  btnUploadTargets: null,
  targetImagesInput: null,
  btnAddFromHistory: null,
  btnClearTargets: null,
  targetGrid: null,
  targetCount: null,

  // 参数控制
  strengthSlider: null,
  strengthValue: null,
  preserveCheck: null,
  enhanceInput: null,
  transferResolutionSelect: null,

  // 转换控制
  btnStartTransfer: null,
  btnStopTransfer: null,
  transferProgress: null,
  transferProgressBar: null,
  transferProgressText: null,

  // 结果展示
  resultsSection: null,
  resultsGrid: null,
  btnSaveToHistory: null,
  btnDownloadAll: null,

  // 历史记录弹窗
  transferHistoryDialog: null,
  transferHistoryList: null,
  btnCancelTransferHistory: null
};

// ============================================================================
// 初始化
// ============================================================================

export function initStyleTransferApp() {
  console.log('🎨 [画风迁移] 初始化应用...');

  // 获取 DOM 元素
  initElements();

  // 加载配置
  loadConfig();

  // 绑定事件
  bindEvents();

  console.log('✅ [画风迁移] 应用初始化完成');
}

function initElements() {
  // A图相关
  elements.styleImageInput = document.getElementById('styleImageInput');
  elements.styleImageUploadZone = document.getElementById('styleImageUploadZone');
  elements.styleImagePreview = document.getElementById('styleImagePreview');
  elements.styleImageDisplay = document.getElementById('styleImageDisplay');
  elements.btnRemoveStyleImage = document.getElementById('btnRemoveStyleImage');
  elements.btnSelectStyleFromHistory = document.getElementById('btnSelectStyleFromHistory');

  // B图相关
  elements.btnUploadTargets = document.getElementById('btnUploadTargets');
  elements.targetImagesInput = document.getElementById('targetImagesInput');
  elements.btnAddFromHistory = document.getElementById('btnAddFromHistory');
  elements.btnClearTargets = document.getElementById('btnClearTargets');
  elements.targetGrid = document.getElementById('targetGrid');
  elements.targetCount = document.getElementById('targetCount');

  // 参数控制
  elements.strengthSlider = document.getElementById('strengthSlider');
  elements.strengthValue = document.getElementById('strengthValue');
  elements.preserveCheck = document.getElementById('preserveCheck');
  elements.enhanceInput = document.getElementById('enhanceInput');
  elements.transferResolutionSelect = document.getElementById('transferResolutionSelect');

  // 转换控制
  elements.btnStartTransfer = document.getElementById('btnStartTransfer');
  elements.btnStopTransfer = document.getElementById('btnStopTransfer');
  elements.transferProgress = document.getElementById('transferProgress');
  elements.transferProgressBar = document.getElementById('transferProgressBar');
  elements.transferProgressText = document.getElementById('transferProgressText');

  // 结果展示
  elements.resultsSection = document.getElementById('resultsSection');
  elements.resultsGrid = document.getElementById('resultsGrid');
  elements.btnSaveToHistory = document.getElementById('btnSaveToHistory');
  elements.btnDownloadAll = document.getElementById('btnDownloadAll');

  // 历史记录弹窗
  elements.transferHistoryDialog = document.getElementById('transferHistoryDialog');
  elements.transferHistoryList = document.getElementById('transferHistoryList');
  elements.btnCancelTransferHistory = document.getElementById('btnCancelTransferHistory');
}

function loadConfig() {
  // 从 localStorage 加载 API Key
  state.apiKey = localStorage.getItem('gemini_api_key') || '';
  state.baseUrl = localStorage.getItem('gemini_base_url') || '';

  if (!state.apiKey) {
    console.warn('⚠️ [画风迁移] 未设置 API Key');
  }
}

// ============================================================================
// 事件绑定
// ============================================================================

function bindEvents() {
  // A图上传
  elements.styleImageUploadZone.addEventListener('click', () => {
    elements.styleImageInput.click();
  });
  elements.styleImageInput.addEventListener('change', handleStyleImageUpload);
  elements.btnRemoveStyleImage.addEventListener('click', removeStyleImage);
  elements.btnSelectStyleFromHistory.addEventListener('click', selectStyleFromHistory);

  // 拖拽上传 A图
  elements.styleImageUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.styleImageUploadZone.style.borderColor = 'var(--primary)';
  });
  elements.styleImageUploadZone.addEventListener('dragleave', () => {
    elements.styleImageUploadZone.style.borderColor = '';
  });
  elements.styleImageUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.styleImageUploadZone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleStyleImageFile(file);
    }
  });

  // B图上传
  elements.btnUploadTargets.addEventListener('click', () => {
    elements.targetImagesInput.click();
  });
  elements.targetImagesInput.addEventListener('change', handleTargetImagesUpload);
  elements.btnAddFromHistory.addEventListener('click', addTargetFromHistory);
  elements.btnClearTargets.addEventListener('click', clearAllTargets);

  // 参数控制
  elements.strengthSlider.addEventListener('input', (e) => {
    state.params.styleStrength = parseInt(e.target.value);
    elements.strengthValue.textContent = state.params.styleStrength;
  });
  elements.preserveCheck.addEventListener('change', (e) => {
    state.params.preserveStructure = e.target.checked;
  });
  elements.enhanceInput.addEventListener('input', (e) => {
    state.params.enhancePrompt = e.target.value;
  });
  elements.transferResolutionSelect.addEventListener('change', (e) => {
    state.params.resolution = parseInt(e.target.value);
  });

  // 转换控制
  elements.btnStartTransfer.addEventListener('click', startTransfer);
  elements.btnStopTransfer.addEventListener('click', stopTransfer);

  // 结果操作
  elements.btnSaveToHistory.addEventListener('click', saveToHistory);
  elements.btnDownloadAll.addEventListener('click', downloadAllResults);

  // 历史记录弹窗
  elements.btnCancelTransferHistory.addEventListener('click', () => {
    elements.transferHistoryDialog.close();
  });

  // 监听跨页面事件（从其他页面添加目标图）
  window.addEventListener('addTargetImage', (e) => {
    const { base64, source, sourceId, gridSize } = e.detail;
    addTargetImage({ base64, source, sourceId, gridSize: gridSize || 1 });
  });
}

// ============================================================================
// A图（风格源）处理
// ============================================================================

async function handleStyleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  await handleStyleImageFile(file);
}

async function handleStyleImageFile(file) {
  try {
    console.log('📤 [画风迁移] 上传风格源图片:', file.name);

    // 读取文件
    const base64 = await readFileAsBase64(file);

    // 压缩图片
    const compressed = await compressImageToSize(base64, 3 * 1024 * 1024);
    const thumbnail = await createThumbnail(compressed, 200);

    // 保存到状态
    state.styleImage = {
      base64: compressed,
      thumbnail,
      source: 'upload',
      sourceId: null
    };

    // 更新 UI
    updateStyleImageUI();
    updateTransferButton();

    console.log('✅ [画风迁移] 风格源图片已加载');
  } catch (error) {
    console.error('❌ [画风迁移] 加载风格源图片失败:', error);
    showToast('加载图片失败: ' + error.message, 'error');
  }
}

function removeStyleImage() {
  state.styleImage = null;
  updateStyleImageUI();
  updateTransferButton();
}

function updateStyleImageUI() {
  if (state.styleImage) {
    // 检查是否已经包含 data URL 前缀
    const imgUrl = state.styleImage.base64.startsWith('data:')
      ? state.styleImage.base64
      : `data:image/png;base64,${state.styleImage.base64}`;
    elements.styleImageDisplay.src = imgUrl;
    elements.styleImagePreview.style.display = 'block';
    elements.styleImageUploadZone.style.display = 'none';
  } else {
    elements.styleImagePreview.style.display = 'none';
    elements.styleImageUploadZone.style.display = 'flex';
  }
}

async function selectStyleFromHistory() {
  await openHistoryDialog('style');
}

async function addTargetFromHistory() {
  await openHistoryDialog('target');
}

async function handleTargetImagesUpload(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  console.log(`📤 [画风迁移] 上传 ${files.length} 张目标图片`);

  for (const file of files) {
    await addTargetImageFromFile(file);
  }

  // 清空 input
  e.target.value = '';
}

async function addTargetImageFromFile(file) {
  try {
    const base64 = await readFileAsBase64(file);
    const compressed = await compressImageToSize(base64, 3 * 1024 * 1024);
    const thumbnail = await createThumbnail(compressed, 200);

    addTargetImage({
      base64: compressed,
      thumbnail,
      source: 'upload',
      sourceId: null,
      gridSize: 1
    });
  } catch (error) {
    console.error('❌ [画风迁移] 加载目标图片失败:', error);
    showToast('加载图片失败: ' + error.message, 'error');
  }
}

function addTargetImage(imageData) {
  const id = `target_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const targetImage = {
    id,
    base64: imageData.base64,
    thumbnail: imageData.thumbnail || imageData.base64,
    source: imageData.source || 'upload',
    sourceId: imageData.sourceId || null,
    gridSize: imageData.gridSize || 1
  };

  state.targetImages.push(targetImage);
  updateTargetGridUI();
  updateTransferButton();

  console.log(`✅ [画风迁移] 添加目标图片: ${id}`);
}

function removeTargetImage(id) {
  state.targetImages = state.targetImages.filter(img => img.id !== id);
  updateTargetGridUI();
  updateTransferButton();
}

function clearAllTargets() {
  state.targetImages = [];
  updateTargetGridUI();
  updateTransferButton();
}

function updateTargetGridUI() {
  elements.targetCount.textContent = state.targetImages.length;

  if (state.targetImages.length === 0) {
    elements.targetGrid.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 24px;">暂无目标图片</p>';
    return;
  }

  elements.targetGrid.innerHTML = state.targetImages.map(img => {
    // 检查是否已经包含 data URL 前缀
    const imgDataUrl = img.thumbnail.startsWith('data:') ? img.thumbnail : `data:image/png;base64,${img.thumbnail}`;
    return `
      <div class="target-item" data-id="${img.id}">
        <img src="${imgDataUrl}" alt="目标图">
        ${img.gridSize > 1 ? `<span class="grid-badge">${img.gridSize}×${img.gridSize}</span>` : ''}
        <button class="btn-remove-target" onclick="window.removeTargetImage('${img.id}')">✕</button>
      </div>
    `;
  }).join('');
}

// ============================================================================
// 历史记录选择
// ============================================================================

async function openHistoryDialog(mode) {
  try {
    const history = await getAllHistory();

    if (!history || history.length === 0) {
      showToast('暂无历史记录', 'info');
      return;
    }

    renderHistoryList(history, mode);
    elements.transferHistoryDialog.showModal();
  } catch (error) {
    console.error('❌ [画风迁移] 加载历史记录失败:', error);
    showToast('加载历史记录失败', 'error');
  }
}

function renderHistoryList(history, mode) {
  const title = mode === 'style' ? '选择风格源图片' : '选择目标图片';
  elements.transferHistoryDialog.querySelector('.dialog-title').textContent = `📁 ${title}`;

  elements.transferHistoryList.innerHTML = history.map(item => {
    const base64Data = item.thumbnail || item.resultImage;
    // 检查是否已经包含 data URL 前缀
    const imgUrl = base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`;
    const date = new Date(item.timestamp).toLocaleString('zh-CN');

    return `
      <div class="history-select-item" onclick="window.selectHistoryItem('${item.id}', '${mode}')">
        <img src="${imgUrl}" alt="历史记录">
        <div class="history-info">
          <p class="history-prompt">${item.prompt || '无描述'}</p>
          <p class="history-meta">${date} ${item.gridSize > 1 ? `· ${item.gridSize}×${item.gridSize}` : ''}</p>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// 转换控制
// ============================================================================

function updateTransferButton() {
  const canTransfer = state.styleImage && state.targetImages.length > 0 && !state.isTransferring;
  elements.btnStartTransfer.disabled = !canTransfer;
}

async function startTransfer() {
  if (!state.apiKey) {
    showToast('请先设置 API Key', 'error');
    return;
  }

  if (!state.styleImage || state.targetImages.length === 0) {
    showToast('请先上传风格源图片和目标图片', 'error');
    return;
  }

  state.isTransferring = true;
  updateTransferButton();

  // 显示进度
  elements.transferProgress.style.display = 'block';
  elements.resultsSection.style.display = 'none';

  // 创建转换引擎
  state.engine = new StyleTransferEngine(state.apiKey, state.baseUrl);

  const startTime = Date.now();

  try {
    console.log('🎨 [画风迁移] 开始批量转换...');

    const results = await state.engine.batchTransfer(
      state.styleImage.base64,
      state.targetImages,
      state.params,
      onTransferProgress
    );

    const duration = Date.now() - startTime;
    console.log(`✅ [画风迁移] 转换完成，耗时: ${(duration / 1000).toFixed(2)}s`);

    // 保存结果
    state.currentResults = results;

    // 显示结果
    displayResults(results);

    // 统计成功/失败
    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'error').length;

    showToast(`转换完成！成功: ${successCount}，失败: ${failedCount}`, 'success');

  } catch (error) {
    console.error('❌ [画风迁移] 转换失败:', error);
    showToast('转换失败: ' + error.message, 'error');
  } finally {
    state.isTransferring = false;
    updateTransferButton();
    elements.transferProgress.style.display = 'none';
  }
}

function stopTransfer() {
  if (state.engine) {
    state.engine.stop();
    showToast('正在停止转换...', 'info');
  }
}

function onTransferProgress(current, total) {
  const percent = Math.round((current / total) * 100);
  elements.transferProgressBar.style.width = `${percent}%`;
  elements.transferProgressText.textContent = `正在转换 ${current}/${total}...`;
}

// ============================================================================
// 结果展示
// ============================================================================

function displayResults(results) {
  elements.resultsSection.style.display = 'block';

  elements.resultsGrid.innerHTML = results.map((result, index) => {
    const targetImage = state.targetImages[index];
    // 检查是否已经包含 data URL 前缀
    const targetImgUrl = targetImage.thumbnail.startsWith('data:')
      ? targetImage.thumbnail
      : `data:image/png;base64,${targetImage.thumbnail}`;

    if (result.status === 'error') {
      return `
        <div class="result-item error">
          <img src="${targetImgUrl}" alt="原图">
          <div class="error-overlay">
            <p>❌ 转换失败</p>
            <p style="font-size: 0.8rem;">${result.error}</p>
          </div>
        </div>
      `;
    }

    const resultImgUrl = result.thumbnail.startsWith('data:')
      ? result.thumbnail
      : `data:image/png;base64,${result.thumbnail}`;
    return `
      <div class="result-item">
        <div class="result-comparison">
          <div class="result-before">
            <img src="${targetImgUrl}" alt="原图">
            <span class="result-label">原图</span>
          </div>
          <div class="result-after">
            <img src="${resultImgUrl}" alt="转换后">
            <span class="result-label">转换后</span>
          </div>
        </div>
        <div class="result-actions">
          <button class="btn btn-secondary" onclick="window.downloadResult(${index})">下载</button>
          ${result.slices.length > 0 ? `<button class="btn btn-secondary" onclick="window.downloadSlices(${index})">下载切片</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function saveToHistory() {
  if (!state.currentResults) {
    showToast('没有可保存的结果', 'error');
    return;
  }

  try {
    const record = {
      styleImage: state.styleImage,
      targetImages: state.targetImages.map(img => ({
        id: img.id,
        base64: img.base64,
        thumbnail: img.thumbnail,
        source: img.source,
        sourceId: img.sourceId,
        gridSize: img.gridSize
      })),
      params: { ...state.params },
      results: state.currentResults,
      metadata: {
        totalCount: state.targetImages.length,
        successCount: state.currentResults.filter(r => r.status === 'success').length,
        failedCount: state.currentResults.filter(r => r.status === 'error').length,
        duration: 0
      }
    };

    await saveTransferRecord(record);
    showToast('已保存到历史记录', 'success');
  } catch (error) {
    console.error('❌ [画风迁移] 保存失败:', error);
    showToast('保存失败: ' + error.message, 'error');
  }
}

async function downloadAllResults() {
  if (!state.currentResults) return;

  const successResults = state.currentResults.filter(r => r.status === 'success');
  if (successResults.length === 0) {
    showToast('没有可下载的结果', 'error');
    return;
  }

  for (let i = 0; i < successResults.length; i++) {
    const result = successResults[i];
    const link = document.createElement('a');
    link.href = getDataUrl(result.resultBase64);
    link.download = `style_transfer_${i + 1}.png`;
    link.click();
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  showToast(`已下载 ${successResults.length} 张图片`, 'success');
}

// ============================================================================
// 工具函数
// ============================================================================

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showToast(message, type = 'info') {
  // 使用全局 toast 函数（假设在 app.js 中定义）
  if (window.showToast) {
    window.showToast(message, type);
  } else {
    console.log(`[Toast ${type}] ${message}`);
  }
}

// ============================================================================
// 全局导出（供 HTML onclick 调用）
// ============================================================================

window.removeTargetImage = removeTargetImage;

window.selectHistoryItem = async function(itemId, mode) {
  try {
    const history = await getAllHistory();
    const item = history.find(h => h.id === itemId);

    if (!item) {
      showToast('历史记录不存在', 'error');
      return;
    }

    const base64 = item.resultImage;
    const thumbnail = item.thumbnail || base64;

    if (mode === 'style') {
      // 设置为风格源图片
      state.styleImage = {
        base64,
        thumbnail,
        source: 'history',
        sourceId: itemId
      };
      updateStyleImageUI();
      updateTransferButton();
      showToast('已设置为风格源图片', 'success');
    } else {
      // 添加为目标图片
      addTargetImage({
        base64,
        thumbnail,
        source: 'history',
        sourceId: itemId,
        gridSize: item.gridSize || 1
      });
      showToast('已添加到目标图片', 'success');
    }

    elements.transferHistoryDialog.close();
  } catch (error) {
    console.error('❌ [画风迁移] 选择历史记录失败:', error);
    showToast('选择失败', 'error');
  }
};

window.downloadResult = function(index) {
  if (!state.currentResults || !state.currentResults[index]) return;
  const result = state.currentResults[index];
  if (result.status !== 'success') return;

  const link = document.createElement('a');
  link.href = getDataUrl(result.resultBase64);
  link.download = `style_transfer_${index + 1}.png`;
  link.click();
};

window.downloadSlices = function(index) {
  if (!state.currentResults || !state.currentResults[index]) return;
  const result = state.currentResults[index];
  if (result.status !== 'success' || result.slices.length === 0) return;

  result.slices.forEach((slice, i) => {
    const link = document.createElement('a');
    link.href = getDataUrl(slice);
    link.download = `style_transfer_${index + 1}_slice_${i + 1}.png`;
    link.click();
  });
};
