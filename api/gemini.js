/**
 * Gemini API 封装模块
 * 一次生成一张包含网格排布的图标图片（支持 3x3 或 5x5）
 *
 * 提示词模板见: prompts.md
 */

// API 配置
const CONFIG = {
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  // 图像生成模型
  imageModel: 'gemini-3-pro-image-preview',
};

// 错误消息映射
const ERROR_MESSAGES = {
  401: 'API Key 无效，请检查设置',
  403: 'API Key 权限不足',
  429: '请求过于频繁，请稍后重试',
  400: '请求参数错误',
  500: 'Gemini 服务暂时不可用',
};

// ============================================================================
// 提示词模板（可在 prompts.md 中查看完整说明）
// ============================================================================

const PROMPT_TEMPLATES = {
  // 文字生成模式 (Grid)
  textModeGrid: `Create a single image containing a {GRID_SIZE}x{GRID_SIZE} grid of {ICON_COUNT} game {SUBJECT}s.

Requirements:
- The output image resolution should be {RESOLUTION}x{RESOLUTION} pixels
- The image should have a pure WHITE background
- Arrange exactly {ICON_COUNT} {SUBJECT}s in a {GRID_SIZE} rows x {GRID_SIZE} columns grid layout
- Each {SUBJECT} should be centered in its grid cell with equal spacing
- Leave safe margins around each {SUBJECT} (about 10% padding)
- All {ICON_COUNT} {SUBJECT}s should follow the same visual style: {STYLE}
- Each {SUBJECT} should be a variation of the theme: {USER_PROMPT}
- The {SUBJECT}s should be distinct but cohesive in style
- Make sure all {SUBJECT}s are properly aligned and evenly spaced

Output a single square image with this {GRID_SIZE}x{GRID_SIZE} {SUBJECT} grid at {RESOLUTION}x{RESOLUTION} resolution.`,

  // 文字生成模式 (Single 1x1)
  textModeSingle: `Create a single game {SUBJECT} image.

Requirements:
- The output image resolution should be {RESOLUTION}x{RESOLUTION} pixels
- The image should have a pure WHITE background
- The {SUBJECT} should be centered in the image
- Leave safe margins around the {SUBJECT} (about 10% padding)
- The {SUBJECT} should follow the visual style: {STYLE}
- The {SUBJECT} should match the theme: {USER_PROMPT}
- Ensure high quality and detail suitable for a game asset

Output a single square image of the {SUBJECT} at {RESOLUTION}x{RESOLUTION} resolution.`,

  // 风格迁移模式 (Grid)
  styleModeGrid: `Create a single image containing a {GRID_SIZE}x{GRID_SIZE} grid of {ICON_COUNT} game {SUBJECT}s, matching the EXACT visual style of the reference image.

Requirements:
- The output image resolution should be {RESOLUTION}x{RESOLUTION} pixels
- The image should have a pure WHITE background
- Arrange exactly {ICON_COUNT} {SUBJECT}s in a {GRID_SIZE} rows x {GRID_SIZE} columns grid layout
- Each {SUBJECT} should be centered in its grid cell with equal spacing
- Leave safe margins around each {SUBJECT} (about 10% padding)
- Match the art style, color palette, line work, and level of detail from the reference image PRECISELY
- Each {SUBJECT} should be a variation of the theme: {USER_PROMPT}
- The {SUBJECT}s should be distinct but cohesive in style
- Make sure all {SUBJECT}s are properly aligned and evenly spaced

Output a single square image with this {GRID_SIZE}x{GRID_SIZE} {SUBJECT} grid at {RESOLUTION}x{RESOLUTION} resolution.`,

  // 风格迁移模式 (Single 1x1)
  styleModeSingle: `Create a single game {SUBJECT} image, matching the EXACT visual style of the reference image.

Requirements:
- The output image resolution should be {RESOLUTION}x{RESOLUTION} pixels
- The image should have a pure WHITE background
- The {SUBJECT} should be centered in the image
- Leave safe margins around the {SUBJECT} (about 10% padding)
- Match the art style, color palette, line work, and level of detail from the reference image PRECISELY
- The {SUBJECT} should match the theme: {USER_PROMPT}
- Ensure high quality and detail suitable for a game asset

Output a single square image of the {SUBJECT} at {RESOLUTION}x{RESOLUTION} resolution.`
};

/**
 * 构建图标网格 Prompt（文字模式）
 * @param {string} userPrompt - 用户描述
 * @param {string} style - 风格描述
 * @param {string} subject - 生成主体 (icon, character, etc.)
 * @param {number} resolution - 分辨率 (1024/2048/4096)
 * @param {number} gridSize - 网格大小 (1, 3 或 5)
 */
function buildGridPrompt(userPrompt, style = 'game asset style', subject = 'icon', resolution = 1024, gridSize = 3) {
  // 确保 subject 不为空
  const safeSubject = subject || 'icon';

  if (gridSize === 1) {
    return PROMPT_TEMPLATES.textModeSingle
      .replace(/{SUBJECT}/g, safeSubject)
      .replace('{USER_PROMPT}', userPrompt)
      .replace('{STYLE}', style)
      .replace(/{RESOLUTION}/g, resolution.toString());
  } else {
    const iconCount = gridSize * gridSize;
    return PROMPT_TEMPLATES.textModeGrid
      .replace(/{GRID_SIZE}/g, gridSize.toString())
      .replace(/{ICON_COUNT}/g, iconCount.toString())
      .replace(/{SUBJECT}/g, safeSubject)
      .replace('{USER_PROMPT}', userPrompt)
      .replace('{STYLE}', style)
      .replace(/{RESOLUTION}/g, resolution.toString());
  }
}

/**
 * 构建风格迁移的网格 Prompt
 * @param {string} userPrompt - 用户描述
 * @param {string} subject - 生成主体 (icon, character, etc.)
 * @param {number} resolution - 分辨率 (1024/2048/4096)
 * @param {number} gridSize - 网格大小 (1, 3 或 5)
 */
function buildStyleGridPrompt(userPrompt, subject = 'icon', resolution = 1024, gridSize = 3) {
  // 确保 subject 不为空
  const safeSubject = subject || 'icon';

  if (gridSize === 1) {
    return PROMPT_TEMPLATES.styleModeSingle
      .replace(/{SUBJECT}/g, safeSubject)
      .replace('{USER_PROMPT}', userPrompt)
      .replace(/{RESOLUTION}/g, resolution.toString());
  } else {
    const iconCount = gridSize * gridSize;
    return PROMPT_TEMPLATES.styleModeGrid
      .replace(/{GRID_SIZE}/g, gridSize.toString())
      .replace(/{ICON_COUNT}/g, iconCount.toString())
      .replace(/{SUBJECT}/g, safeSubject)
      .replace('{USER_PROMPT}', userPrompt)
      .replace(/{RESOLUTION}/g, resolution.toString());
  }
}

/**
 * 处理 API 错误响应
 */
async function handleApiError(response) {
  const message = ERROR_MESSAGES[response.status];
  if (message) {
    throw new Error(message);
  }

  try {
    const text = await response.text();
    if (!text) {
      throw new Error(`请求失败 (${response.status}): 空响应`);
    }
    const error = JSON.parse(text);
    throw new Error(error.error?.message || `请求失败 (${response.status})`);
  } catch (e) {
    if (e.message.includes('请求失败')) {
      throw e;
    }
    throw new Error(`请求失败 (${response.status})`);
  }
}

/**
 * 将分辨率数值转换为 imageSize 格式
 * @param {number} resolution - 分辨率 (1024/2048/4096)
 * @returns {string} - imageSize 格式 ("1K"/"2K"/"4K")
 */
function getImageSize(resolution) {
  const sizeMap = {
    1024: '1K',
    2048: '2K',
    4096: '4K'
  };
  return sizeMap[resolution] || '1K';
}

/**
 * 生成图标网格图片（纯文字模式）
 * @param {string} apiKey - Gemini API Key
 * @param {string} prompt - 用户描述
 * @param {string} style - 视觉风格描述
 * @param {string} subject - 生成主体
 * @param {string} [baseUrl] - 可选的自定义 API Base URL
 * @param {number} [resolution=1024] - 生成分辨率 (1024/2048/4096)
 * @param {number} [gridSize=3] - 网格大小 (1, 3 或 5)
 * @returns {Promise<string>} - Base64 图像数据
 */
export async function generateIconGrid(apiKey, prompt, style, subject, baseUrl, resolution = 1024, gridSize = 3) {
  const url = baseUrl || CONFIG.baseUrl;
  const endpoint = `${url}/models/${CONFIG.imageModel}:generateContent`;
  
  console.log('  🔗 [Gemini API] 请求 URL:', endpoint);
  console.log('  📐 [Gemini API] 模式: 文字生成，分辨率:', resolution, '网格:', `${gridSize}x${gridSize}`, '主体:', subject);
  
  const requestBody = JSON.stringify({
    contents: [{
      parts: [
        { text: buildGridPrompt(prompt, style, subject, resolution, gridSize) }
      ]
    }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      imageConfig: {
        imageSize: getImageSize(resolution)
      }
    }
  });

  console.log('  📤 [Gemini API] 请求体大小:', (requestBody.length / 1024).toFixed(2), 'KB');
  console.log('  ⏳ [Gemini API] 发送请求中...（如果长时间无响应请检查网络）');

  const fetchStartTime = Date.now();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: requestBody,
  });
  const fetchEndTime = Date.now();
  
  console.log(`  📥 [Gemini API] 收到响应，状态: ${response.status}，网络请求耗时: ${((fetchEndTime - fetchStartTime) / 1000).toFixed(2)}s`);

  if (!response.ok) {
    console.error('  ❌ [Gemini API] 请求失败，状态码:', response.status);
    await handleApiError(response);
  }

  console.log('  📝 [Gemini API] 正在读取响应数据...');
  const text = await response.text();
  if (!text) {
    console.error('  ❌ [Gemini API] 响应为空');
    throw new Error('API 返回空响应');
  }
  
  console.log('  ✅ [Gemini API] 响应数据大小:', (text.length / 1024).toFixed(2), 'KB');

  const data = JSON.parse(text);
  return extractImageFromResponse(data);
}

/**
 * 生成图标网格图片（风格迁移模式）
 * @param {string} apiKey - Gemini API Key
 * @param {string} referenceImageBase64 - 参考图的 Base64 数据
 * @param {string} prompt - 用户描述
 * @param {string} subject - 生成主体
 * @param {string} [baseUrl] - 可选的自定义 API Base URL
 * @param {number} [resolution=1024] - 生成分辨率 (1024/2048/4096)
 * @param {number} [gridSize=3] - 网格大小 (1, 3 或 5)
 * @returns {Promise<string>} - Base64 图像数据
 */
export async function generateIconGridWithReference(apiKey, referenceImageBase64, prompt, subject, baseUrl, resolution = 1024, gridSize = 3) {
  const url = baseUrl || CONFIG.baseUrl;
  const endpoint = `${url}/models/${CONFIG.imageModel}:generateContent`;
  
  console.log('  🔗 [Gemini API] 请求 URL:', endpoint);
  console.log('  📐 [Gemini API] 模式: 风格迁移，分辨率:', resolution, '网格:', `${gridSize}x${gridSize}`, '主体:', subject);
  console.log('  🖼️ [Gemini API] 参考图大小:', (referenceImageBase64.length / 1024).toFixed(2), 'KB (Base64)');
  
  const requestBody = JSON.stringify({
    contents: [{
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: referenceImageBase64,
          },
        },
        { text: buildStyleGridPrompt(prompt, subject, resolution, gridSize) }
      ]
    }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      imageConfig: {
        imageSize: getImageSize(resolution)
      }
    }
  });

  console.log('  📤 [Gemini API] 请求体大小:', (requestBody.length / 1024).toFixed(2), 'KB');
  console.log('  ⏳ [Gemini API] 发送请求中...（如果长时间无响应请检查网络）');

  const fetchStartTime = Date.now();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: requestBody,
  });
  const fetchEndTime = Date.now();
  
  console.log(`  📥 [Gemini API] 收到响应，状态: ${response.status}，网络请求耗时: ${((fetchEndTime - fetchStartTime) / 1000).toFixed(2)}s`);

  if (!response.ok) {
    console.error('  ❌ [Gemini API] 请求失败，状态码:', response.status);
    await handleApiError(response);
  }

  console.log('  📝 [Gemini API] 正在读取响应数据...');
  const text = await response.text();
  if (!text) {
    console.error('  ❌ [Gemini API] 响应为空');
    throw new Error('API 返回空响应');
  }
  
  console.log('  ✅ [Gemini API] 响应数据大小:', (text.length / 1024).toFixed(2), 'KB');

  const data = JSON.parse(text);
  return extractImageFromResponse(data);
}

/**
 * 从 API 响应中提取图像数据
 * @param {object} data - API 响应
 * @returns {string} - Base64 图像数据
 */
function extractImageFromResponse(data) {
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error('未能生成图像：无响应候选');
  }

  const parts = candidate.content?.parts || [];

  // 查找图像部分
  const imagePart = parts.find(p => p.inlineData);
  if (imagePart) {
    return imagePart.inlineData.data;
  }

  // 如果没有图像，检查是否有文本错误信息
  const textPart = parts.find(p => p.text);
  if (textPart) {
    throw new Error(`生成失败: ${textPart.text.slice(0, 200)}`);
  }

  throw new Error('未能生成图像：响应中无图像数据');
}

/**
 * 测试 API Key 是否有效
 * @param {string} apiKey
 * @param {string} [baseUrl] - 可选的自定义 API Base URL
 * @returns {Promise<boolean>}
 */
export async function testApiKey(apiKey, baseUrl) {
  try {
    const url = baseUrl || CONFIG.baseUrl;
    const response = await fetch(
      `${url}/models`,
      {
        headers: {
          'x-goog-api-key': apiKey,
        },
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

export { CONFIG };
