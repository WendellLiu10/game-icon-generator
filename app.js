/**
 * 图标生成器主应用逻辑 v2.0
 */

import { generateIconGrid, generateIconGridWithReference } from './api/gemini.js';
import { fileToBase64, getDataUrl, isImageFile, sliceImageGrid, createThumbnail, resizeToIcon } from './core/image-utils.js';
import { checkForUpdates, updateApp, saveCurrentVersion, getCurrentVersion, getLocalVersion } from './core/update-checker.js';
import { initDB, saveHistoryItem, getAllHistory, clearAllHistory, trimHistory } from './core/history-db.js';

// ============================================================================
// 常量
// ============================================================================

// 批量下载时每次下载之间的延迟时间（毫秒）
const BATCH_DOWNLOAD_DELAY_MS = 300;

// 允许的下载尺寸选项
const ALLOWED_DOWNLOAD_SIZES = ['original', '128', '256', '512'];

// 允许的网格大小选项
const ALLOWED_GRID_SIZES = [1, 3, 5];

// 默认网格大小
const DEFAULT_GRID_SIZE = 3;

// 历史记录存储相关常量
const HISTORY_STORAGE_KEY = 'icon_history';
const MAX_HISTORY = 8;

// ============================================================================
// 应用状态
// ============================================================================

const state = {
  apiKey: '',
  baseUrl: '',
  mode: 'text',              // 'text' | 'style'
  subject: 'icon',           // 生成主体: 'icon' | 'character' | 'equipment' | 'scene' | 'custom'
  style: '',                 // 当前选中的风格描述
  customStyle: '',           // 自定义风格
  referenceImage: null,      // Base64
  prompt: '',
  resultImage: null,         // 生成的网格图 Base64
  slices: [],                // 切片后的图标 Base64 数组
  isGenerating: false,
  history: [],               // { id, timestamp, resultImage, slices, prompt, style, gridSize }
  downloadSize: 'original',  // 下载尺寸设置
  generateResolution: 1024,  // 生成分辨率 (1024/2048/4096)
  gridSize: DEFAULT_GRID_SIZE, // 网格大小 (1, 3 或 5)
};

// ============================================================================
// DOM 元素引用
// ============================================================================

let elements = {};

function cacheDOM() {
  elements = {
    // 版本显示
    versionDisplay: document.getElementById('versionDisplay'),

    // 导航与设置
    btnSettings: document.getElementById('btnSettings'),
    btnCheckUpdate: document.getElementById('btnCheckUpdate'),
    apiKeyDialog: document.getElementById('apiKeyDialog'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    baseUrlInput: document.getElementById('baseUrlInput'),
    btnSaveKey: document.getElementById('btnSaveKey'),
    btnCancelKey: document.getElementById('btnCancelKey'),

    // 更新对话框
    updateDialog: document.getElementById('updateDialog'),
    currentVersion: document.getElementById('currentVersion'),
    latestVersion: document.getElementById('latestVersion'),
    updateMessage: document.getElementById('updateMessage'),
    updateDate: document.getElementById('updateDate'),
    btnConfirmUpdate: document.getElementById('btnConfirmUpdate'),
    btnCancelUpdate: document.getElementById('btnCancelUpdate'),

    // 控制面板
    tabs: document.querySelectorAll('.tab'),
    subjectSelect: document.getElementById('subjectSelect'),
    styleSelect: document.getElementById('styleSelect'),
    customStyleInput: document.getElementById('customStyleInput'),
    referenceSection: document.getElementById('referenceSection'),

    // 上传
    uploadZone: document.getElementById('uploadZone'),
    fileInput: document.getElementById('fileInput'),
    uploadPlaceholder: document.getElementById('uploadPlaceholder'),
    uploadPreview: document.getElementById('uploadPreview'),

    // 输入与操作
    promptInput: document.getElementById('promptInput'),
    btnGenerate: document.getElementById('btnGenerate'),

    // 下载尺寸选择
    downloadSizeSelect: document.getElementById('downloadSizeSelect'),

    // 生成分辨率选择
    generateResolutionSelect: document.getElementById('generateResolutionSelect'),

    // 网格大小选择
    gridSizeSelect: document.getElementById('gridSizeSelect'),

    // 历史记录
    historyList: document.getElementById('historyList'),
    btnClearHistory: document.getElementById('btnClearHistory'),

    // 展示区域
    previewArea: document.getElementById('previewArea'),
    resultImage: document.getElementById('resultImage'),
    loader: document.getElementById('loader'),
    placeholderContent: document.querySelector('.placeholder-content'),
    btnDownloadFull: document.getElementById('btnDownloadFull'),

    // 切片区域
    slicedSection: document.getElementById('slicedSection'),
    slicedGrid: document.getElementById('slicedGrid'),
    btnDownloadAllSlices: document.getElementById('btnDownloadAllSlices'),

    // 反馈
    toast: document.getElementById('toast'),
  };
}

// ============================================================================
// 初始化
// ============================================================================

async function init() {
  cacheDOM();
  await loadHistory();  // 等待 IndexedDB 历史加载完成
  bindEvents();
  loadAndDisplayVersion(); // 加载并显示版本

  // 从 localStorage 恢复状态
  state.apiKey = localStorage.getItem('gemini_api_key') || '';
  state.baseUrl = localStorage.getItem('gemini_base_url') || '';

  // 恢复下载尺寸设置，并验证是否为有效值
  const savedDownloadSize = localStorage.getItem('download_size');
  if (savedDownloadSize && ALLOWED_DOWNLOAD_SIZES.includes(savedDownloadSize)) {
    state.downloadSize = savedDownloadSize;
  } else {
    // 如果保存的值无效，使用默认值并清除无效的存储
    state.downloadSize = 'original';
    localStorage.removeItem('download_size');
  }

  // 恢复上次提示词
  const savedPrompt = localStorage.getItem('last_prompt');
  if (savedPrompt && elements.promptInput) elements.promptInput.value = savedPrompt;
  state.prompt = savedPrompt || '';

  // 恢复主体选择
  const savedSubject = localStorage.getItem('subject_type');
  if (savedSubject && ['icon', 'character', 'equipment', 'scene', 'custom'].includes(savedSubject)) {
    state.subject = savedSubject;
    if (elements.subjectSelect) {
      elements.subjectSelect.value = state.subject;
    }
  }

  // 默认风格
  if (elements.styleSelect && elements.customStyleInput) {
    // 初始化：如果输入框为空，则填入默认下拉菜单的值
    if (!elements.customStyleInput.value) {
      elements.customStyleInput.value = elements.styleSelect.value;
    }
    state.style = elements.customStyleInput.value;
  }

  // 恢复下载尺寸设置到 UI
  if (elements.downloadSizeSelect) {
    elements.downloadSizeSelect.value = state.downloadSize;
  }

  // 恢复生成分辨率设置
  const savedResolution = localStorage.getItem('generate_resolution');
  if (savedResolution) {
    const resolution = parseInt(savedResolution, 10);
    if ([1024, 2048, 4096].includes(resolution)) {
      state.generateResolution = resolution;
    } else {
      localStorage.removeItem('generate_resolution');
    }
  }

  // 恢复生成分辨率设置到 UI
  if (elements.generateResolutionSelect) {
    elements.generateResolutionSelect.value = state.generateResolution.toString();
  }

  // 恢复网格大小设置
  const savedGridSize = localStorage.getItem('grid_size');
  if (savedGridSize) {
    const gridSize = parseInt(savedGridSize, 10);
    if (ALLOWED_GRID_SIZES.includes(gridSize)) {
      state.gridSize = gridSize;
    } else {
      // 只在存在无效值时清理
      localStorage.removeItem('grid_size');
    }
  }

  // 恢复网格大小设置到 UI
  if (elements.gridSizeSelect) {
    elements.gridSizeSelect.value = state.gridSize.toString();
  }

  // 更新 UI 状态，确保按钮状态正确
  updateUI();
}

function bindEvents() {
  // API Key Modal
  if (elements.btnSettings) elements.btnSettings.addEventListener('click', openSettingsDialog);
  if (elements.btnCancelKey) elements.btnCancelKey.addEventListener('click', () => elements.apiKeyDialog.close());
  if (elements.btnSaveKey) elements.btnSaveKey.addEventListener('click', saveApiSettings);

  // 检查更新
  if (elements.btnCheckUpdate) elements.btnCheckUpdate.addEventListener('click', handleCheckUpdate);
  if (elements.btnCancelUpdate) elements.btnCancelUpdate.addEventListener('click', () => elements.updateDialog.close());
  if (elements.btnConfirmUpdate) elements.btnConfirmUpdate.addEventListener('click', handleConfirmUpdate);

  // 清理历史记录
  if (elements.btnClearHistory) elements.btnClearHistory.addEventListener('click', handleClearHistory);

  // Tab 切换
  if (elements.tabs) {
    elements.tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        switchToMode(e.target.dataset.mode);
      });
    });
  }

  // 主体选择
  if (elements.subjectSelect) {
    elements.subjectSelect.addEventListener('change', (e) => {
      state.subject = e.target.value;
      localStorage.setItem('subject_type', state.subject);
    });
  }

  // 风格选择：下拉菜单变化时，填充到输入框
  if (elements.styleSelect) {
    elements.styleSelect.addEventListener('change', () => {
      const val = elements.styleSelect.value;
      if (val) { // 只有非空才覆盖，允许用户选“自定义”保留原样
        elements.customStyleInput.value = val;
        state.style = val;
      }
    });
  }

  // 风格输入：手动输入时更新 state
  if (elements.customStyleInput) {
    elements.customStyleInput.addEventListener('input', (e) => {
      state.style = e.target.value;
      // 如果手动修改了，可以将下拉菜单置为“自定义”（即空值），这只是视觉优化
      if (elements.styleSelect) elements.styleSelect.value = '';
    });
  }

  // 上传
  if (elements.uploadZone) {
    elements.uploadZone.addEventListener('click', () => elements.fileInput.click());
    elements.uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      elements.uploadZone.style.borderColor = 'var(--accent-color)';
    });
    elements.uploadZone.addEventListener('dragleave', () => {
      elements.uploadZone.style.borderColor = '';
    });
    elements.uploadZone.addEventListener('drop', handleFileDrop);
  }

  if (elements.fileInput) elements.fileInput.addEventListener('change', handleFileSelect);

  // 生成
  if (elements.btnGenerate) elements.btnGenerate.addEventListener('click', handleGenerate);
  if (elements.promptInput) {
    elements.promptInput.addEventListener('input', (e) => {
      state.prompt = e.target.value;
      localStorage.setItem('last_prompt', state.prompt);
      updateUI();
    });
  }

  // 下载尺寸选择
  if (elements.downloadSizeSelect) {
    elements.downloadSizeSelect.addEventListener('change', (e) => {
      const newSize = e.target.value;
      // 验证选择的值是否有效
      if (ALLOWED_DOWNLOAD_SIZES.includes(newSize)) {
        state.downloadSize = newSize;
        localStorage.setItem('download_size', newSize);
      } else {
        // 如果选择了无效值，恢复之前的值
        console.warn('无效的下载尺寸选择:', newSize);
        elements.downloadSizeSelect.value = state.downloadSize;
      }
    });
  }

  // 生成分辨率选择
  if (elements.generateResolutionSelect) {
    elements.generateResolutionSelect.addEventListener('change', (e) => {
      const newResolution = parseInt(e.target.value, 10);
      // 验证选择的值是否有效
      if ([1024, 2048, 4096].includes(newResolution)) {
        state.generateResolution = newResolution;
        localStorage.setItem('generate_resolution', newResolution.toString());
      } else {
        // 如果选择了无效值，恢复之前的值
        console.warn('无效的生成分辨率选择:', newResolution);
        elements.generateResolutionSelect.value = state.generateResolution.toString();
      }
    });
  }

  // 网格大小选择
  if (elements.gridSizeSelect) {
    elements.gridSizeSelect.addEventListener('change', (e) => {
      const newGridSize = parseInt(e.target.value, 10);
      // 验证选择的值是否有效
      if (ALLOWED_GRID_SIZES.includes(newGridSize)) {
        state.gridSize = newGridSize;
        localStorage.setItem('grid_size', newGridSize.toString());
        updateUI();
      } else {
        // 如果选择了无效值，恢复之前的值
        console.warn('无效的网格大小选择:', newGridSize);
        elements.gridSizeSelect.value = state.gridSize.toString();
      }
    });
  }

  // 下载
  if (elements.btnDownloadFull) {
    elements.btnDownloadFull.addEventListener('click', async () => {
      if (state.resultImage) await downloadImage(state.resultImage, 'icon-grid-full.png');
    });
  }

  if (elements.btnDownloadAllSlices) {
    elements.btnDownloadAllSlices.addEventListener('click', async () => {
      try {
        await handleDownloadAllSlices();
      } catch (error) {
        console.error('批量下载失败:', error);
        showToast('批量下载失败', true);
      }
    });
  }
}

// ============================================================================
// 版本显示
// ============================================================================

/**
 * 加载并显示版本号
 */
async function loadAndDisplayVersion() {
  try {
    const versionInfo = await getLocalVersion();
    if (elements.versionDisplay) {
      elements.versionDisplay.textContent = `v${versionInfo.version}`;
      elements.versionDisplay.title = `版本: ${versionInfo.version}\n日期: ${versionInfo.date}\n${versionInfo.description}`;
    }
  } catch (error) {
    console.error('加载版本信息失败:', error);
    if (elements.versionDisplay) {
      elements.versionDisplay.textContent = 'v未知';
    }
  }
}

// ============================================================================
// 逻辑处理
// ============================================================================

/**
 * 切换生成模式
 * @param {string} mode - 'text' | 'style'
 */
function switchToMode(mode) {
  state.mode = mode;

  // 更新标签页UI
  elements.tabs.forEach(t => t.classList.remove('active'));
  const targetTab = Array.from(elements.tabs).find(t => t.dataset.mode === mode);
  if (targetTab) targetTab.classList.add('active');

  updateUI();
}

function updateUI() {
  // 模式切换
  if (state.mode === 'style') {
    elements.referenceSection.style.display = 'block';
  } else {
    elements.referenceSection.style.display = 'none';
  }

  // 生成按钮状态
  const isValid = state.prompt.trim() && (state.mode === 'text' || state.referenceImage);
  if (elements.btnGenerate) {
    elements.btnGenerate.disabled = state.isGenerating || !isValid;
    const span = elements.btnGenerate.querySelector('span');
    if (span) span.textContent = state.isGenerating ? '正在生成...' : `✨ 开始生成 (${state.gridSize}x${state.gridSize})`;
  }
}

async function handleFileSelect(e) {
  const file = e.target.files?.[0];
  if (file) await processFile(file);
}

async function handleFileDrop(e) {
  e.preventDefault();
  elements.uploadZone.style.borderColor = '';
  const file = e.dataTransfer?.files?.[0];
  if (file) await processFile(file);
}

async function processFile(file) {
  if (!isImageFile(file)) {
    showToast('请上传图片文件', true);
    return;
  }
  try {
    const base64 = await fileToBase64(file);
    state.referenceImage = base64;
    elements.uploadPreview.src = getDataUrl(base64);
    elements.uploadPreview.style.display = 'block';
    elements.uploadPlaceholder.style.display = 'none';
    updateUI();
  } catch (err) {
    console.error(err);
    showToast('图片读取失败', true);
  }
}

async function handleGenerate() {
  if (!state.apiKey) {
    elements.apiKeyDialog.showModal();
    return;
  }

  // ========== 生成开始 - 输出当前状态 ==========
  const generateStartTime = Date.now();
  console.group('🎨 [图标生成] 开始生成');
  console.log('⏰ 开始时间:', new Date(generateStartTime).toLocaleTimeString());
  console.log('📋 当前状态:', {
    mode: state.mode,
    prompt: state.prompt,
    style: state.style,
    gridSize: `${state.gridSize}x${state.gridSize}`,
    resolution: state.generateResolution,
    hasReferenceImage: !!state.referenceImage,
    baseUrl: state.baseUrl || '默认 API'
  });

  state.isGenerating = true;
  updateUI();

  // 重置预览区
  elements.resultImage.style.display = 'none';
  elements.placeholderContent.style.display = 'none';
  elements.loader.style.display = 'block';
  elements.previewArea.classList.remove('empty');
  elements.slicedSection.style.display = 'none';

  try {
    let image;
    const apiStartTime = Date.now();
    console.log('🌐 [API 调用] 开始请求 Gemini API...');

    if (state.mode === 'text') {
      image = await generateIconGrid(state.apiKey, state.prompt, state.style, state.subject, state.baseUrl || undefined, state.generateResolution, state.gridSize);
    } else {
      image = await generateIconGridWithReference(state.apiKey, state.referenceImage, state.prompt, state.subject, state.baseUrl || undefined, state.generateResolution, state.gridSize);
    }

    const apiEndTime = Date.now();
    console.log(`✅ [API 调用] 完成，耗时: ${((apiEndTime - apiStartTime) / 1000).toFixed(2)}s`);
    console.log(`📦 [API 调用] 返回图片大小: ${(image.length / 1024).toFixed(2)} KB (Base64)`);

    state.resultImage = image;

    // 自动切片
    const sliceStartTime = Date.now();
    console.log('✂️ [切片] 开始切片处理...');
    showToast('生成成功，正在切片...', false);

    let slices = [];
    if (state.gridSize === 1) {
      // 1x1 模式，直接把整张图作为唯一的切片
      slices = [image];
    } else {
      slices = await sliceImageGrid(image, state.gridSize, state.gridSize);
    }

    state.slices = slices;
    const sliceEndTime = Date.now();
    console.log(`✅ [切片] 完成，耗时: ${((sliceEndTime - sliceStartTime) / 1000).toFixed(2)}s，共 ${slices.length} 个切片`);

    // 保存到历史
    const historyStartTime = Date.now();
    console.log('💾 [历史记录] 开始保存...');
    await addToHistory({
      resultImage: image,
      slices: slices,
      prompt: state.prompt,
      style: state.style,
      subject: state.subject,
      mode: state.mode,
      gridSize: state.gridSize
    });
    const historyEndTime = Date.now();
    console.log(`✅ [历史记录] 保存完成，耗时: ${((historyEndTime - historyStartTime) / 1000).toFixed(2)}s`);

    displayResult(image, slices);

    const totalTime = (Date.now() - generateStartTime) / 1000;
    console.log(`🎉 [图标生成] 全部完成！总耗时: ${totalTime.toFixed(2)}s`);
    console.groupEnd();

  } catch (error) {
    const errorTime = (Date.now() - generateStartTime) / 1000;
    console.error(`❌ [图标生成] 失败，已用时: ${errorTime.toFixed(2)}s`);
    console.error('❌ [错误详情]:', error);
    console.groupEnd();
    showToast(error.message, true);
    elements.placeholderContent.style.display = 'block';
    elements.previewArea.classList.add('empty');
  } finally {
    state.isGenerating = false;
    elements.loader.style.display = 'none';
    updateUI();
  }
}

function displayResult(fullImageBase64, slices) {
  // 显示大图
  elements.resultImage.src = getDataUrl(fullImageBase64);
  elements.resultImage.style.display = 'block';
  elements.placeholderContent.style.display = 'none';
  elements.previewArea.classList.remove('empty');
  elements.btnDownloadFull.disabled = false;

  // 显示切片
  elements.slicedSection.style.display = 'block';
  elements.slicedGrid.innerHTML = '';
  
  // 根据当前网格大小设置CSS类
  elements.slicedGrid.className = 'sliced-grid';
  if (state.gridSize === 3) {
    elements.slicedGrid.classList.add('grid-3x3');
  } else if (state.gridSize === 5) {
    elements.slicedGrid.classList.add('grid-5x5');
  }

  slices.forEach((sliceBase64, index) => {
    const item = document.createElement('div');
    item.className = 'slice-item';

    item.innerHTML = `
      <img src="${getDataUrl(sliceBase64)}" loading="lazy">
      <div class="slice-actions">
        <button class="icon-btn download-btn" title="下载此图标">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
        <button class="icon-btn reference-btn" title="设为参考图">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
            <path d="M2 2l7.586 7.586"></path>
            <circle cx="11" cy="11" r="2"></circle>
          </svg>
        </button>
      </div>
    `;

    // 下载按钮
    item.querySelector('.download-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await downloadImage(sliceBase64, `icon-${index + 1}.png`);
    });

    // 设为参考图按钮
    item.querySelector('.reference-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      setImageAsReference(sliceBase64);
    });

    elements.slicedGrid.appendChild(item);
  });
}

async function handleDownloadAllSlices() {
  if (!state.slices.length) return;

  showToast('正在开始批量下载...', false);

  // 使用顺序下载以避免浏览器阻止
  for (let index = 0; index < state.slices.length; index++) {
    await downloadImage(state.slices[index], `icon-${index + 1}.png`);
    // 在下载之间添加延迟以防止浏览器拦截
    if (index < state.slices.length - 1) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DOWNLOAD_DELAY_MS));
    }
  }
}

/**
 * 设置图像为风格迁移参考图（通用函数）
 * @param {string} imageBase64 - 要设置的图像 Base64 数据
 */
function setImageAsReference(imageBase64) {
  if (!imageBase64) return;

  // 设置为参考图
  state.referenceImage = imageBase64;

  // 切换到风格迁移模式
  switchToMode('style');

  // 显示参考图预览
  elements.uploadPreview.src = getDataUrl(imageBase64);
  elements.uploadPreview.style.display = 'block';
  elements.uploadPlaceholder.style.display = 'none';

  showToast('已设置为参考图，当前模式：风格迁移', false);
}

// ============================================================================
// 历史记录
// ============================================================================

/**
 * 添加到历史记录（使用 IndexedDB 存储完整图片数据）
 */
async function addToHistory(item) {
  const thumbnail = await createThumbnail(item.resultImage, 100);

  const historyItem = {
    id: Date.now(),
    timestamp: Date.now(),
    thumbnail,
    prompt: item.prompt,
    style: item.style,
    mode: item.mode,
    subject: item.subject || 'icon',
    gridSize: item.gridSize,
    resultImage: item.resultImage,
    slices: item.slices
  };

  // 添加到内存中的历史记录
  state.history.unshift(historyItem);
  if (state.history.length > MAX_HISTORY) {
    state.history.pop();
  }

  // 保存到 IndexedDB
  try {
    await saveHistoryItem(historyItem);
    await trimHistory(MAX_HISTORY);
  } catch (e) {
    console.warn('保存历史记录到 IndexedDB 失败:', e);
  }

  renderHistoryUI();
}

/**
 * 从 IndexedDB 加载历史记录
 */
async function loadHistory() {
  try {
    // 初始化 IndexedDB
    await initDB();
    
    // 尝试从 IndexedDB 加载
    const items = await getAllHistory();
    
    if (items.length > 0) {
      state.history = items;
      // 清理旧的 localStorage 数据（如果有的话）
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } else {
      // 检查是否有旧的 localStorage 数据需要迁移
      const oldData = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (oldData) {
        try {
          const oldItems = JSON.parse(oldData);
          state.history = oldItems;
          // 迁移到 IndexedDB
          for (const item of oldItems) {
            await saveHistoryItem(item);
          }
          // 迁移完成后清理 localStorage
          localStorage.removeItem(HISTORY_STORAGE_KEY);
          console.log('历史记录已从 localStorage 迁移到 IndexedDB');
        } catch (e) {
          console.warn('迁移旧历史记录失败:', e);
          state.history = [];
        }
      } else {
        state.history = [];
      }
    }
  } catch (e) {
    console.error('加载历史记录失败:', e);
    state.history = [];
  }
  
  renderHistoryUI();
}

/**
 * 清理历史记录
 */
async function handleClearHistory() {
  if (!confirm('确定要清除所有历史记录吗？此操作不可恢复。')) {
    return;
  }

  try {
    // 清除 IndexedDB
    await clearAllHistory();
    // 清除 localStorage（如果有旧数据）
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    
    state.history = [];
    renderHistoryUI();

    // 清除当前显示的结果
    state.resultImage = null;
    state.slices = [];
    elements.resultImage.style.display = 'none';
    elements.placeholderContent.style.display = 'block';
    elements.previewArea.classList.add('empty');
    elements.slicedSection.style.display = 'none';
    elements.btnDownloadFull.disabled = true;

    showToast('历史记录已清除', false);
  } catch (e) {
    console.error('清除历史记录失败:', e);
    showToast('清除失败', true);
  }
}

function renderHistoryUI() {
  if (!elements.historyList) return;

  elements.historyList.innerHTML = '';
  state.history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    if (state.resultImage && state.resultImage === item.resultImage) div.classList.add('active');

    // 检查是否有完整图片数据（刷新页面后从 localStorage 加载的记录没有）
    const hasFullImage = !!item.resultImage;

    div.innerHTML = `
      <img src="${item.thumbnail}" title="${item.prompt}">
      <div class="history-actions">
        ${hasFullImage ? `
          <button class="history-btn view-btn">查看</button>
          <button class="history-btn ref-btn">设为参考</button>
        ` : `
          <span class="history-hint" title="刷新页面后图片数据已丢失">仅缩略图</span>
        `}
      </div>
    `;

    if (hasFullImage) {
      // 查看按钮
      div.querySelector('.view-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        state.resultImage = item.resultImage;
        state.slices = item.slices;
        state.prompt = item.prompt;
        state.mode = item.mode;
        state.subject = item.subject || 'icon';

        // 兼容旧记录，确保网格大小有效
        const itemGridSize = item.gridSize || DEFAULT_GRID_SIZE;
        state.gridSize = ALLOWED_GRID_SIZES.includes(itemGridSize) ? itemGridSize : DEFAULT_GRID_SIZE;

        elements.promptInput.value = item.prompt;
        if (elements.gridSizeSelect) {
          elements.gridSizeSelect.value = state.gridSize.toString();
        }
        if (elements.subjectSelect) {
          elements.subjectSelect.value = state.subject;
        }

        displayResult(item.resultImage, item.slices);

        document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
        div.classList.add('active');
      });

      // 设为参考图按钮
      div.querySelector('.ref-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        setImageAsReference(item.resultImage);
      });
    }

    elements.historyList.appendChild(div);
  });
}


// ============================================================================
// 更新检查
// ============================================================================

let pendingUpdateVersion = null;

async function handleCheckUpdate() {
  const btn = elements.btnCheckUpdate;
  const originalText = btn.textContent;

  try {
    btn.disabled = true;
    btn.textContent = '🔄 检查中...';

    const result = await checkForUpdates();

    if (result.hasUpdate) {
      // 有更新可用 - 显示更新对话框
      pendingUpdateVersion = result.latest.hash;
      elements.currentVersion.textContent = result.current || '未知';
      elements.latestVersion.textContent = result.latest.hash;
      elements.updateMessage.textContent = result.latest.message;
      elements.updateDate.textContent = result.latest.date;
      elements.updateDialog.showModal();
    } else {
      // 没有更新
      const currentVer = getCurrentVersion();
      if (!currentVer) {
        // 首次使用，保存当前版本
        saveCurrentVersion(result.latest.hash);
        showToast(`已记录当前版本: ${result.latest.hash}`, false);
      } else {
        showToast('已是最新版本！', false);
      }
    }
  } catch (error) {
    console.error('检查更新失败:', error);
    showToast('检查更新失败，请检查网络连接', true);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function handleConfirmUpdate() {
  if (pendingUpdateVersion) {
    elements.updateDialog.close();
    showToast('正在更新...', false);
    setTimeout(() => {
      updateApp(pendingUpdateVersion);
    }, 500);
  }
}

// ============================================================================
// 通用工具
// ============================================================================

function openSettingsDialog() {
  // 打开对话框时填充当前值
  if (elements.apiKeyInput) elements.apiKeyInput.value = state.apiKey;
  if (elements.baseUrlInput) elements.baseUrlInput.value = state.baseUrl;
  elements.apiKeyDialog.showModal();
}

function saveApiSettings() {
  const key = elements.apiKeyInput.value.trim();
  const baseUrl = elements.baseUrlInput ? elements.baseUrlInput.value.trim() : '';

  if (key) {
    state.apiKey = key;
    localStorage.setItem('gemini_api_key', key);
  }

  state.baseUrl = baseUrl;
  localStorage.setItem('gemini_base_url', baseUrl);

  elements.apiKeyDialog.close();
  showToast('设置已保存');
}

async function downloadImage(base64, filename) {
  let imageToDownload = base64;

  // 如果选择了特定尺寸（非原始尺寸），则调整图片大小
  if (state.downloadSize !== 'original') {
    const size = parseInt(state.downloadSize, 10);
    try {
      imageToDownload = await resizeToIcon(base64, size);
    } catch (error) {
      console.error('调整图片尺寸失败:', error);
      showToast('调整尺寸失败，将下载原始尺寸', true);
      // 出错时使用原始图片
      imageToDownload = base64;
    }
  }

  const link = document.createElement('a');
  link.download = filename;
  link.href = getDataUrl(imageToDownload);
  link.click();
}

function showToast(msg, isError = false) {
  if (!elements.toast) return;
  elements.toast.textContent = msg;
  elements.toast.className = `toast show ${isError ? 'error' : ''}`;
  setTimeout(() => {
    elements.toast.className = 'toast';
  }, 3000);
}

// 启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
