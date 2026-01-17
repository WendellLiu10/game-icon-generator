/**
 * 图片处理工具模块
 */

/**
 * 文件转 Base64（不含 data:image 前缀）
 * @param {File} file
 * @returns {Promise<string>}
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // 移除 data:image/xxx;base64, 前缀
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * Base64 转 Image 对象
 * @param {string} base64 - Base64 字符串（不含前缀）
 * @param {string} mimeType - MIME 类型
 * @returns {Promise<HTMLImageElement>}
 */
export function base64ToImage(base64, mimeType = 'image/png') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

/**
 * Data URL 转 Image 对象
 * @param {string} dataUrl - 完整的 data URL
 * @returns {Promise<HTMLImageElement>}
 */
export function dataUrlToImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = dataUrl;
  });
}

/**
 * 调整图片尺寸到指定大小（居中裁剪）
 * @param {string|HTMLImageElement} imageSource - Base64 或 Image 对象
 * @param {number} size - 目标尺寸（正方形）
 * @returns {Promise<string>} - 调整后的 Base64
 */
export async function resizeToIcon(imageSource, size = 256) {
  const img = typeof imageSource === 'string'
    ? await base64ToImage(imageSource)
    : imageSource;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 计算缩放和位置（居中裁剪）
  const scale = Math.max(size / img.width, size / img.height);
  const scaledWidth = img.width * scale;
  const scaledHeight = img.height * scale;
  const x = (size - scaledWidth) / 2;
  const y = (size - scaledHeight) / 2;

  // 清除画布并绘制
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

  // 返回不含前缀的 Base64
  return canvas.toDataURL('image/png').split(',')[1];
}

/**
 * 创建预览缩略图
 * @param {string} base64 - 原始 Base64
 * @param {number} maxSize - 最大边长
 * @returns {Promise<string>} - 缩略图 Data URL
 */
export async function createThumbnail(base64, maxSize = 128) {
  const img = await base64ToImage(base64);

  const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL('image/png');
}

/**
 * 创建缩略图（返回纯 Base64，不含前缀）
 * @param {string} base64 - 原始 Base64（不含前缀）
 * @param {number} maxSize - 最大边长
 * @returns {Promise<string>} - 缩略图 Base64（不含前缀）
 */
export async function createThumbnailFromBase64(base64, maxSize = 150) {
  const img = await base64ToImage(base64);

  let { width, height } = img;
  if (width > height) {
    if (width > maxSize) {
      height = (height * maxSize) / width;
      width = maxSize;
    }
  } else {
    if (height > maxSize) {
      width = (width * maxSize) / height;
      height = maxSize;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
}

/**
 * 获取图片的 Data URL
 * @param {string} base64 - Base64 字符串
 * @param {string} mimeType - MIME 类型
 * @returns {string}
 */
export function getDataUrl(base64, mimeType = 'image/png') {
  return `data:${mimeType};base64,${base64}`;
}

/**
 * 验证文件是否为图片
 * @param {File} file
 * @returns {boolean}
 */
export function isImageFile(file) {
  return file && file.type.startsWith('image/');
}

/**
 * 获取图片尺寸
 * @param {string} base64
 * @returns {Promise<{width: number, height: number}>}
 */
export async function getImageSize(base64) {
  const img = await base64ToImage(base64);
  return {
    width: img.width,
    height: img.height,
  };
}

/**
 * 压缩图片到指定大小以下
 * @param {string} base64 - 原始 Base64（不含前缀）
 * @param {number} maxSizeBytes - 最大字节数（默认 3MB）
 * @param {number} initialQuality - 初始质量（0-1）
 * @returns {Promise<string>} - 压缩后的 Base64（不含前缀）
 */
export async function compressImageToSize(base64, maxSizeBytes = 3 * 1024 * 1024, initialQuality = 0.9) {
  // 计算当前大小（Base64 编码约增加 33% 体积）
  const currentSize = Math.ceil(base64.length * 0.75);
  if (currentSize <= maxSizeBytes) {
    return base64;
  }

  console.log(`  🗜️ [图片压缩] 原始大小: ${(currentSize / 1024 / 1024).toFixed(2)} MB，开始压缩...`);

  const img = await base64ToImage(base64);
  let quality = initialQuality;
  let scale = 1;
  let result = base64;

  // 如果图片尺寸过大，先缩小尺寸
  const maxDimension = 2048;
  if (img.width > maxDimension || img.height > maxDimension) {
    scale = Math.min(maxDimension / img.width, maxDimension / img.height);
  }

  // 循环压缩直到满足大小要求
  while (true) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 使用 JPEG 格式压缩（压缩率更高）
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    result = dataUrl.split(',')[1];
    const resultSize = Math.ceil(result.length * 0.75);

    if (resultSize <= maxSizeBytes) {
      console.log(`  ✅ [图片压缩] 压缩完成: ${(resultSize / 1024 / 1024).toFixed(2)} MB (质量: ${(quality * 100).toFixed(0)}%, 缩放: ${(scale * 100).toFixed(0)}%)`);
      return result;
    }

    // 降低质量或缩小尺寸
    if (quality > 0.3) {
      quality -= 0.1;
    } else if (scale > 0.3) {
      scale -= 0.1;
      quality = 0.8; // 重置质量
    } else {
      // 无法继续压缩，返回当前结果
      console.warn(`  ⚠️ [图片压缩] 已达到最小压缩限制，当前大小: ${(resultSize / 1024 / 1024).toFixed(2)} MB`);
      return result;
    }
  }
}

/**
 * 将网格图切割成独立图标
 * @param {string} base64Image - 原图 Base64
 * @param {number} rows - 行数 (默认 3)
 * @param {number} cols - 列数 (默认 3)
 * @returns {Promise<string[]>} - 切割后的图标 Base64 数组
 */
export async function sliceImageGrid(base64Image, rows = 3, cols = 3) {
  const img = await base64ToImage(base64Image);
  const { width, height } = img;

  // 假设网格是均匀分布的，不考虑边距裁剪（让提示词控制边距）
  // 或者：如果提示词生成的图有外边框，这里可能需要切掉一点
  // 目前策略：简单的均分切割

  const cellWidth = Math.floor(width / cols);
  const cellHeight = Math.floor(height / rows);

  const slicedImages = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const canvas = document.createElement('canvas');
      canvas.width = cellWidth;
      canvas.height = cellHeight;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        img,
        c * cellWidth, r * cellHeight, cellWidth, cellHeight, // Source
        0, 0, cellWidth, cellHeight // Destination
      );

      // 导出为 Base64 (不含前缀)
      const dataUrl = canvas.toDataURL('image/png');
      slicedImages.push(dataUrl.split(',')[1]);
    }
  }

  return slicedImages;
}
