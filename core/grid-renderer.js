/**
 * 3x3 网格渲染模块
 */

import { base64ToImage, getDataUrl } from './image-utils.js';

// 网格配置
const ICON_SIZE = 256;    // 单个图标尺寸
const GRID_GAP = 32;      // 图标间距
const GRID_PADDING = 48;  // 外边距

// 计算总尺寸: 256*3 + 32*2 + 48*2 = 912
const TOTAL_SIZE = ICON_SIZE * 3 + GRID_GAP * 2 + GRID_PADDING * 2;

/**
 * 渲染 3x3 网格到 Canvas
 * @param {(string|null)[]} images - 9 个图标的 Base64 数组（可包含 null）
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderGrid(images) {
  const canvas = document.createElement('canvas');
  canvas.width = TOTAL_SIZE;
  canvas.height = TOTAL_SIZE;

  const ctx = canvas.getContext('2d');

  // 白色背景
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 绘制每个图标
  const loadPromises = images.slice(0, 9).map(async (base64, index) => {
    if (!base64) return;

    const row = Math.floor(index / 3);
    const col = index % 3;
    const x = GRID_PADDING + col * (ICON_SIZE + GRID_GAP);
    const y = GRID_PADDING + row * (ICON_SIZE + GRID_GAP);

    try {
      const img = await base64ToImage(base64);
      ctx.drawImage(img, x, y, ICON_SIZE, ICON_SIZE);
    } catch (error) {
      console.error(`Failed to draw icon at position ${index}:`, error);
      // 绘制占位框
      ctx.strokeStyle = '#E0E0E0';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, ICON_SIZE, ICON_SIZE);
    }
  });

  await Promise.all(loadPromises);
  return canvas;
}

/**
 * 渲染带占位框的网格（用于预览空位）
 * @param {(string|null)[]} images
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderGridWithPlaceholders(images) {
  const canvas = document.createElement('canvas');
  canvas.width = TOTAL_SIZE;
  canvas.height = TOTAL_SIZE;

  const ctx = canvas.getContext('2d');

  // 白色背景
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 绘制所有 9 个位置
  for (let index = 0; index < 9; index++) {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const x = GRID_PADDING + col * (ICON_SIZE + GRID_GAP);
    const y = GRID_PADDING + row * (ICON_SIZE + GRID_GAP);

    const base64 = images[index];

    if (base64) {
      try {
        const img = await base64ToImage(base64);
        ctx.drawImage(img, x, y, ICON_SIZE, ICON_SIZE);
      } catch {
        drawPlaceholder(ctx, x, y, index);
      }
    } else {
      drawPlaceholder(ctx, x, y, index);
    }
  }

  return canvas;
}

/**
 * 绘制占位框
 */
function drawPlaceholder(ctx, x, y, index) {
  ctx.strokeStyle = '#E0E0E0';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.strokeRect(x, y, ICON_SIZE, ICON_SIZE);
  ctx.setLineDash([]);

  // 绘制序号
  ctx.fillStyle = '#CCCCCC';
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index + 1), x + ICON_SIZE / 2, y + ICON_SIZE / 2);
}

/**
 * 导出 Canvas 为 PNG 文件
 * @param {HTMLCanvasElement} canvas
 * @param {string} filename - 文件名
 */
export function exportAsPNG(canvas, filename = 'icons-grid.png') {
  canvas.toBlob((blob) => {
    if (!blob) {
      console.error('Failed to create blob');
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();

    // 清理
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

/**
 * 导出单个图标
 * @param {string} base64 - 图标 Base64
 * @param {string} filename - 文件名
 */
export function exportSingleIcon(base64, filename = 'icon.png') {
  const link = document.createElement('a');
  link.download = filename;
  link.href = getDataUrl(base64);
  link.click();
}

/**
 * 获取 Canvas 的 Data URL
 * @param {HTMLCanvasElement} canvas
 * @returns {string}
 */
export function canvasToDataUrl(canvas) {
  return canvas.toDataURL('image/png');
}

/**
 * 获取单个图标在网格中的位置
 * @param {number} index - 图标索引 (0-8)
 * @returns {{x: number, y: number}}
 */
export function getIconPosition(index) {
  const row = Math.floor(index / 3);
  const col = index % 3;
  return {
    x: GRID_PADDING + col * (ICON_SIZE + GRID_GAP),
    y: GRID_PADDING + row * (ICON_SIZE + GRID_GAP),
  };
}

// 导出配置常量
export { ICON_SIZE, GRID_GAP, GRID_PADDING, TOTAL_SIZE };
