/**
 * 画风迁移批量转换引擎
 * 管理批量转换任务，支持进度回调和错误处理
 */

import { generateStyleTransfer, generateStyleTransferGrid } from '../api/gemini.js';
import { createThumbnail, sliceImageGrid } from './image-utils.js';

export class StyleTransferEngine {
  constructor(apiKey, baseUrl = '') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.isRunning = false;
  }

  /**
   * 批量转换图片
   * @param {string} styleImageBase64 - A图（风格源）
   * @param {Array} targetImages - B图列表
   * @param {Object} params - 转换参数
   * @param {Function} onProgress - 进度回调 (current, total)
   * @returns {Promise<Array>} 转换结果列表
   */
  async batchTransfer(styleImageBase64, targetImages, params, onProgress) {
    this.isRunning = true;
    const results = [];
    const total = targetImages.length;

    for (let i = 0; i < total; i++) {
      if (!this.isRunning) {
        console.log('  ⏸️ [转换引擎] 用户中断转换');
        break;
      }

      const target = targetImages[i];
      console.log(`  🎨 [转换引擎] 正在转换第 ${i + 1}/${total} 张图片...`);

      try {
        // 根据是否为网格图选择不同的 API
        const resultBase64 = target.gridSize > 1
          ? await generateStyleTransferGrid(
              this.apiKey,
              styleImageBase64,
              target.base64,
              target.gridSize,
              { ...params, baseUrl: this.baseUrl }
            )
          : await generateStyleTransfer(
              this.apiKey,
              styleImageBase64,
              target.base64,
              { ...params, baseUrl: this.baseUrl }
            );

        // 生成缩略图
        const thumbnail = await createThumbnail(resultBase64, 200);

        // 如果是网格图，进行切片
        const slices = target.gridSize > 1
          ? await sliceImageGrid(resultBase64, target.gridSize, target.gridSize)
          : [];

        results.push({
          targetId: target.id,
          resultBase64,
          thumbnail,
          slices,
          status: 'success',
          error: null
        });

        console.log(`  ✅ [转换引擎] 第 ${i + 1}/${total} 张转换成功`);
        onProgress?.(i + 1, total);

      } catch (error) {
        console.error(`  ❌ [转换引擎] 第 ${i + 1}/${total} 张转换失败:`, error.message);
        results.push({
          targetId: target.id,
          resultBase64: null,
          thumbnail: null,
          slices: [],
          status: 'error',
          error: error.message
        });
        onProgress?.(i + 1, total);
      }
    }

    this.isRunning = false;
    return results;
  }

  /**
   * 停止批量转换
   */
  stop() {
    this.isRunning = false;
    console.log('  🛑 [转换引擎] 停止转换请求已发送');
  }
}
