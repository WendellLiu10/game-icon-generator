/**
 * 图标生成器主应用逻辑 v2.0
 */

import { generateIconGrid, generateIconGridWithReference } from './api/gemini.js';
import { fileToBase64, getDataUrl, isImageFile, sliceImageGrid, createThumbnail } from './core/image-utils.js';

// ============================================================================
// 应用状态
// ============================================================================

const state = {
  apiKey: localStorage.getItem('gemini_api_key') || '',
  mode: 'text',              // 'text' | 'style'
  style: '',                 // 当前选中的风格描述
  customStyle: '',           // 自定义风格
  referenceImage: null,      // Base64
  prompt: '',
  resultImage: null,         // 生成的 3x3 网格图 Base64
  slices: [],                // 切片后的 9 张图 Base64 数组
  isGenerating: false,
  history: [],               // { id, timestamp, resultImage, slices, prompt, style }
};

// ============================================================================
// DOM 元素引用
// ============================================================================

let elements = {};

function cacheDOM() {
  elements = {
    // 导航与设置
    btnSettings: document.getElementById('btnSettings'),
    apiKeyDialog: document.getElementById('apiKeyDialog'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    btnSaveKey: document.getElementById('btnSaveKey'),
    btnCancelKey: document.getElementById('btnCancelKey'),

    // 控制面板
    tabs: document.querySelectorAll('.tab'),
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
    
    // 历史记录
    historyList: document.getElementById('historyList'),

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

function init() {
  cacheDOM();
  loadHistory();
  bindEvents();
  
  // 恢复上次状态
  const savedPrompt = localStorage.getItem('last_prompt');
  if (savedPrompt && elements.promptInput) elements.promptInput.value = savedPrompt;
  state.prompt = savedPrompt || '';

  // 默认风格
  if (elements.styleSelect && elements.customStyleInput) {
    // 初始化：如果输入框为空，则填入默认下拉菜单的值
    if (!elements.customStyleInput.value) {
      elements.customStyleInput.value = elements.styleSelect.value;
    }
    state.style = elements.customStyleInput.value;
  }
}

function bindEvents() {
  // API Key Modal
  if (elements.btnSettings) elements.btnSettings.addEventListener('click', () => elements.apiKeyDialog.showModal());
  if (elements.btnCancelKey) elements.btnCancelKey.addEventListener('click', () => elements.apiKeyDialog.close());
  if (elements.btnSaveKey) elements.btnSaveKey.addEventListener('click', saveApiKey);

  // Tab 切换
  if (elements.tabs) {
    elements.tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        elements.tabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        state.mode = e.target.dataset.mode;
        updateUI();
      });
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
    });
  }

  // 下载
  if (elements.btnDownloadFull) {
    elements.btnDownloadFull.addEventListener('click', () => {
      if (state.resultImage) downloadImage(state.resultImage, 'icon-grid-full.png');
    });
  }

  if (elements.btnDownloadAllSlices) elements.btnDownloadAllSlices.addEventListener('click', handleDownloadAllSlices);
}

// ============================================================================
// 逻辑处理
// ============================================================================

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
    if (span) span.textContent = state.isGenerating ? '正在生成...' : '✨ 开始生成';
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
    if (state.mode === 'text') {
      image = await generateIconGrid(state.apiKey, state.prompt, state.style);
    } else {
      image = await generateIconGridWithReference(state.apiKey, state.referenceImage, state.prompt);
    }

    state.resultImage = image;
    
    // 自动切片
    showToast('生成成功，正在切片...', false);
    const slices = await sliceImageGrid(image, 3, 3);
    state.slices = slices;

    // 保存到历史
    await addToHistory({
      resultImage: image,
      slices: slices,
      prompt: state.prompt,
      style: state.style,
      mode: state.mode
    });

    displayResult(image, slices);
    
  } catch (error) {
    console.error(error);
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
  
  slices.forEach((sliceBase64, index) => {
    const item = document.createElement('div');
    item.className = 'slice-item';
    
    item.innerHTML = `
      <img src="${getDataUrl(sliceBase64)}" loading="lazy">
      <div class="slice-actions">
        <button class="icon-btn" title="下载此图标">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
      </div>
    `;

    item.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      downloadImage(sliceBase64, `icon-${index + 1}.png`);
    });

    elements.slicedGrid.appendChild(item);
  });
}

function handleDownloadAllSlices() {
  if (!state.slices.length) return;
  
  // 简单的连续下载
  let delay = 0;
  state.slices.forEach((slice, index) => {
    setTimeout(() => {
      downloadImage(slice, `icon-${index + 1}.png`);
    }, delay);
    delay += 300; // 间隔 300ms 防止浏览器拦截
  });
  showToast('正在开始批量下载...', false);
}

// ============================================================================
// 历史记录
// ============================================================================

const MAX_HISTORY = 8;

async function addToHistory(item) {
  const thumbnail = await createThumbnail(item.resultImage, 100);
  
  const historyItem = {
    id: Date.now(),
    thumbnail,
    ...item
  };

  try {
    state.history.unshift(historyItem);
    if (state.history.length > MAX_HISTORY) state.history.pop();
    saveHistoryToStorage();
    renderHistoryUI();
  } catch (e) {
    console.warn('Storage full, clearing old history');
    state.history = [historyItem]; 
    saveHistoryToStorage();
    renderHistoryUI();
  }
}

function saveHistoryToStorage() {
  try {
    localStorage.setItem('history_meta', JSON.stringify(state.history.map(h => ({
      id: h.id,
      prompt: h.prompt,
      thumbnail: h.thumbnail,
      mode: h.mode
    }))));
  } catch (e) {
    console.error(e);
  }
}

function loadHistory() {
  try {
    state.history = []; 
    renderHistoryUI();
  } catch (e) {}
}

function renderHistoryUI() {
  if (!elements.historyList) return;
  
  elements.historyList.innerHTML = '';
  state.history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    if (state.resultImage === item.resultImage) div.classList.add('active');
    
    div.innerHTML = `<img src="${item.thumbnail}" title="${item.prompt}">`;
    div.addEventListener('click', () => {
      state.resultImage = item.resultImage;
      state.slices = item.slices;
      state.prompt = item.prompt;
      state.mode = item.mode;
      elements.promptInput.value = item.prompt;
      
      displayResult(item.resultImage, item.slices);
      
      document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
      div.classList.add('active');
    });
    
    elements.historyList.appendChild(div);
  });
}


// ============================================================================
// 通用工具
// ============================================================================

function saveApiKey() {
  const key = elements.apiKeyInput.value.trim();
  if (key) {
    state.apiKey = key;
    localStorage.setItem('gemini_api_key', key);
    elements.apiKeyDialog.close();
    showToast('API Key 已保存');
  }
}

function downloadImage(base64, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = getDataUrl(base64);
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
