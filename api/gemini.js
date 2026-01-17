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

Output a single square image of the {SUBJECT} at {RESOLUTION}x{RESOLUTION} resolution.`,

  // ============================================================================
  // 扩展生成类型模板
  // ============================================================================

  // 角色立绘 (Character Portrait)
  characterPortrait: `Create a game character portrait illustration.

Requirements:
- The output image resolution should be {RESOLUTION}x{RESOLUTION} pixels
- Create a {POSE_TYPE} character portrait
- The character should follow the visual style: {STYLE}
- Character description: {USER_PROMPT}
- Background: {BACKGROUND}
- Ensure high quality illustration suitable for a game character card or profile
- The character should have clear details, expressive features, and professional quality

Output a single character portrait at {RESOLUTION}x{RESOLUTION} resolution.`,

  // 角色立绘 (风格迁移)
  characterPortraitStyle: `Create a game character portrait illustration, matching the EXACT visual style of the reference image.

Requirements:
- The output image resolution should be {RESOLUTION}x{RESOLUTION} pixels
- Create a {POSE_TYPE} character portrait
- Match the art style, color palette, line work, and level of detail from the reference image PRECISELY
- Character description: {USER_PROMPT}
- Background: {BACKGROUND}
- Ensure the character matches the reference style while being a unique design

Output a single character portrait at {RESOLUTION}x{RESOLUTION} resolution.`,

  // 游戏场景 (Game Scene)
  gameScene: `Create a game scene or background illustration.

Requirements:
- The output image resolution should be {RESOLUTION}x{RESOLUTION} pixels
- The scene should follow the visual style: {STYLE}
- Scene description: {USER_PROMPT}
- The scene should be suitable for a game background or environment
- Include appropriate lighting, atmosphere, and depth
- Ensure high quality suitable for game art

Output a single game scene at {RESOLUTION}x{RESOLUTION} resolution.`,

  // 游戏场景 (风格迁移)
  gameSceneStyle: `Create a game scene or background illustration, matching the EXACT visual style of the reference image.

Requirements:
- The output image resolution should be {RESOLUTION}x{RESOLUTION} pixels
- Match the art style, color palette, lighting, and atmosphere from the reference image PRECISELY
- Scene description: {USER_PROMPT}
- The scene should be suitable for a game background or environment
- Ensure consistent style with the reference

Output a single game scene at {RESOLUTION}x{RESOLUTION} resolution.`,

  // UI 模板 (UI Template)
  uiTemplate: `Create a game UI template design.

Requirements:
- The output image resolution should be {RESOLUTION}x{RESOLUTION} pixels
- The UI should follow the visual style: {STYLE}
- UI elements to include: {USER_PROMPT}
- Include a cohesive set of UI elements: buttons, panels, frames, icons
- Ensure clear visual hierarchy and professional game UI design
- Background should be neutral to showcase the UI elements clearly

Output a single UI template at {RESOLUTION}x{RESOLUTION} resolution.`,

  // UI 模板 (风格迁移)
  uiTemplateStyle: `Create a game UI template design, matching the EXACT visual style of the reference image.

Requirements:
- The output image resolution should be {RESOLUTION}x{RESOLUTION} pixels
- Match the art style, color scheme, and design language from the reference image PRECISELY
- UI elements to include: {USER_PROMPT}
- Include a cohesive set of UI elements: buttons, panels, frames, icons
- Ensure the UI matches the reference style perfectly

Output a single UI template at {RESOLUTION}x{RESOLUTION} resolution.`,

  // 配色方案 (Color Palette)
  colorPalette: `Create a color palette for a game project.

Requirements:
- The output image resolution should be {RESOLUTION}x{RESOLUTION} pixels
- Visual theme/mood: {STYLE}
- Color scheme purpose: {USER_PROMPT}
- Display 5-7 harmonious colors as clear swatches in a row
- Include: primary color, secondary colors, accent color, neutral tones
- Each color swatch should be clearly visible and labeled with hex codes if possible
- The palette should be cohesive and suitable for game UI and assets

Output a single color palette image at {RESOLUTION}x{RESOLUTION} resolution.`,

  // 配色方案 (风格迁移)
  colorPaletteStyle: `Extract and create a color palette based on the reference image.

Requirements:
- The output image resolution should be {RESOLUTION}x{RESOLUTION} pixels
- Extract the main colors from the reference image
- Additional requirements: {USER_PROMPT}
- Display 5-7 colors as clear swatches in a row
- Include the dominant colors, supporting colors, and accent colors from the reference
- Each color swatch should be clearly visible

Output a single color palette image at {RESOLUTION}x{RESOLUTION} resolution.`
};

// 生成类型配置
export const GENERATION_TYPE_CONFIG = {
  icon: {
    name: '图标',
    defaultGrid: 3,
    textTemplate: 'textModeGrid',
    styleTemplate: 'styleModeGrid',
    singleTextTemplate: 'textModeSingle',
    singleStyleTemplate: 'styleModeSingle'
  },
  character: {
    name: '角色立绘',
    defaultGrid: 1,
    textTemplate: 'characterPortrait',
    styleTemplate: 'characterPortraitStyle',
    defaults: { poseType: 'half-body', background: 'simple gradient or transparent' }
  },
  scene: {
    name: '游戏画面',
    defaultGrid: 1,
    textTemplate: 'gameScene',
    styleTemplate: 'gameSceneStyle'
  },
  uiTemplate: {
    name: 'UI 模板',
    defaultGrid: 1,
    textTemplate: 'uiTemplate',
    styleTemplate: 'uiTemplateStyle'
  },
  colorPalette: {
    name: '配色方案',
    defaultGrid: 1,
    textTemplate: 'colorPalette',
    styleTemplate: 'colorPaletteStyle'
  }
};

/**
 * 构建扩展类型的 Prompt
 * @param {string} type - 生成类型 (character, scene, uiTemplate, colorPalette)
 * @param {string} userPrompt - 用户描述
 * @param {string} style - 风格描述
 * @param {number} resolution - 分辨率
 * @param {boolean} hasReference - 是否有参考图
 * @param {Object} options - 额外选项
 */
export function buildExtendedPrompt(type, userPrompt, style, resolution, hasReference = false, options = {}) {
  const config = GENERATION_TYPE_CONFIG[type];
  if (!config) {
    throw new Error(`Unknown generation type: ${type}`);
  }

  const templateKey = hasReference ? config.styleTemplate : config.textTemplate;
  let template = PROMPT_TEMPLATES[templateKey];

  if (!template) {
    throw new Error(`Template not found: ${templateKey}`);
  }

  // 替换变量
  template = template
    .replace(/{RESOLUTION}/g, resolution.toString())
    .replace(/{STYLE}/g, style || 'game asset style')
    .replace(/{USER_PROMPT}/g, userPrompt)
    .replace(/{POSE_TYPE}/g, options.poseType || config.defaults?.poseType || 'full-body')
    .replace(/{BACKGROUND}/g, options.background || config.defaults?.background || 'simple background');

  return template;
}

/**
 * 根据宽高比和基础分辨率计算实际尺寸
 * @param {number} resolution - 基础分辨率
 * @param {string} aspectRatio - 宽高比 (如 "16:9", "1:1")
 * @returns {{width: number, height: number}}
 */
function calculateDimensions(resolution, aspectRatio = '1:1') {
  const [w, h] = aspectRatio.split(':').map(Number);
  if (w === h) {
    return { width: resolution, height: resolution };
  }
  // 保持较长边为 resolution
  if (w > h) {
    return { width: resolution, height: Math.round(resolution * h / w) };
  } else {
    return { width: Math.round(resolution * w / h), height: resolution };
  }
}

/**
 * 构建图标网格 Prompt（文字模式）- 导出版本，用于预览
 * @param {string} userPrompt - 用户描述
 * @param {string} style - 风格描述
 * @param {string} subject - 生成主体 (icon, character, etc.)
 * @param {number} resolution - 分辨率 (1024/2048/4096)
 * @param {number} gridSize - 网格大小 (1, 3 或 5)
 */
export function buildGridPrompt(userPrompt, style = 'game asset style', subject = 'icon', resolution = 1024, gridSize = 3) {
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
 * 构建风格迁移的网格 Prompt - 导出版本，用于预览
 * @param {string} userPrompt - 用户描述
 * @param {string} subject - 生成主体 (icon, character, etc.)
 * @param {number} resolution - 分辨率 (1024/2048/4096)
 * @param {number} gridSize - 网格大小 (1, 3 或 5)
 * @param {string} aspectRatio - 宽高比
 */
export function buildStyleGridPrompt(userPrompt, subject = 'icon', resolution = 1024, gridSize = 3, aspectRatio = '1:1') {
  // 确保 subject 不为空
  const safeSubject = subject || 'icon';
  const { width, height } = calculateDimensions(resolution, aspectRatio);
  const resolutionStr = width === height ? `${resolution}x${resolution}` : `${width}x${height}`;

  if (gridSize === 1) {
    return PROMPT_TEMPLATES.styleModeSingle
      .replace(/{SUBJECT}/g, safeSubject)
      .replace('{USER_PROMPT}', userPrompt)
      .replace(/{RESOLUTION}/g, resolutionStr);
  } else {
    const iconCount = gridSize * gridSize;
    return PROMPT_TEMPLATES.styleModeGrid
      .replace(/{GRID_SIZE}/g, gridSize.toString())
      .replace(/{ICON_COUNT}/g, iconCount.toString())
      .replace(/{SUBJECT}/g, safeSubject)
      .replace('{USER_PROMPT}', userPrompt)
      .replace(/{RESOLUTION}/g, resolutionStr);
  }
}

/**
 * 处理 API 错误响应
 */
async function handleApiError(response) {
  try {
    const text = await response.text();
    console.error('  ❌ [Gemini API] 错误响应:', text);
    if (!text) {
      throw new Error(`请求失败 (${response.status}): 空响应`);
    }
    const error = JSON.parse(text);
    const errorMsg = error.error?.message || `请求失败 (${response.status})`;
    throw new Error(errorMsg);
  } catch (e) {
    if (e.message.includes('请求失败') || e.message.includes('Invalid')) {
      throw e;
    }
    const message = ERROR_MESSAGES[response.status];
    throw new Error(message || `请求失败 (${response.status})`);
  }
}

/**
 * 将分辨率数值转换为 imageSize 格式
 * @param {number} resolution - 分辨率 (1024/2048/4096)
 * @returns {string} - imageSize 格式 ("1K"/"2K"/"4K")
 */
function getImageSize(resolution) {
  const sizeMap = { 1024: '1K', 2048: '2K', 4096: '4K' };
  return sizeMap[resolution] || '1K';
}

/**
 * 发送生成请求到 Gemini API
 * @param {string} apiKey - API Key
 * @param {string} baseUrl - API Base URL
 * @param {Array} parts - 请求内容 parts 数组
 * @param {number} resolution - 生成分辨率
 * @param {string} aspectRatio - 宽高比
 * @param {string} logPrefix - 日志前缀描述
 * @returns {Promise<string>} - Base64 图像数据
 */
async function sendGenerateRequest(apiKey, baseUrl, parts, resolution, aspectRatio, logPrefix) {
  const url = baseUrl || CONFIG.baseUrl;
  const endpoint = `${url}/models/${CONFIG.imageModel}:generateContent`;

  console.log('  🔗 [Gemini API] 请求 URL:', endpoint);
  console.log('  📐 [Gemini API]', logPrefix);

  // 构建 imageConfig
  const imageConfig = { imageSize: getImageSize(resolution) };
  if (aspectRatio && aspectRatio !== '1:1') {
    imageConfig.aspectRatio = aspectRatio;
  }

  const requestBody = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      imageConfig
    }
  });

  console.log('  📤 [Gemini API] 请求体大小:', (requestBody.length / 1024).toFixed(2), 'KB');

  // 根据请求大小给出预估时间提示
  const requestSizeMB = requestBody.length / 1024 / 1024;
  const estimatedTime = Math.max(30, Math.ceil(requestSizeMB * 15)); // 估算：每 MB 约 15 秒
  console.log(`  ⏳ [Gemini API] 发送请求中...（预计需要 ${estimatedTime} 秒，请求大小: ${requestSizeMB.toFixed(2)} MB）`);

  if (requestSizeMB > 3) {
    console.warn('  ⚠️ [Gemini API] 请求体较大，建议压缩参考图以提升响应速度');
  }

  const fetchStartTime = Date.now();
  const TIMEOUT_MS = 120000; // 120 秒超时

  // 创建超时 Promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`请求超时（${TIMEOUT_MS / 1000} 秒）。参考图可能过大，请尝试：\n1. 压缩参考图到 2MB 以内\n2. 检查网络连接\n3. 稍后重试`));
    }, TIMEOUT_MS);
  });

  // 带超时的 fetch
  const response = await Promise.race([
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: requestBody,
    }),
    timeoutPromise
  ]);
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
  const parts = [{ text: buildGridPrompt(prompt, style, subject, resolution, gridSize) }];
  const logPrefix = `模式: 文字生成，分辨率: ${resolution}，网格: ${gridSize}x${gridSize}，主体: ${subject}`;
  return sendGenerateRequest(apiKey, baseUrl, parts, resolution, '1:1', logPrefix);
}

/**
 * 使用自定义提示词生成图片（纯文字模式）
 * @param {string} apiKey - Gemini API Key
 * @param {string} customPrompt - 自定义提示词
 * @param {string} [baseUrl] - 可选的自定义 API Base URL
 * @param {number} [resolution=1024] - 生成分辨率 (1024/2048/4096)
 * @returns {Promise<string>} - Base64 图像数据
 */
export async function generateWithCustomPrompt(apiKey, customPrompt, baseUrl, resolution = 1024) {
  const parts = [{ text: customPrompt }];
  const logPrefix = `模式: 自定义提示词，分辨率: ${resolution}`;
  return sendGenerateRequest(apiKey, baseUrl, parts, resolution, '1:1', logPrefix);
}

/**
 * 使用自定义提示词和参考图生成图片（风格迁移模式）
 * @param {string} apiKey - Gemini API Key
 * @param {string} referenceImageBase64 - 参考图的 Base64 数据
 * @param {string} customPrompt - 自定义提示词
 * @param {string} [baseUrl] - 可选的自定义 API Base URL
 * @param {number} [resolution=1024] - 生成分辨率 (1024/2048/4096)
 * @param {string} [aspectRatio='1:1'] - 宽高比
 * @returns {Promise<string>} - Base64 图像数据
 */
export async function generateWithCustomPromptAndReference(apiKey, referenceImageBase64, customPrompt, baseUrl, resolution = 1024, aspectRatio = '1:1') {
  if (!referenceImageBase64) {
    throw new Error('参考图数据为空，请先上传参考图片');
  }

  console.log('  🖼️ [Gemini API] 参考图大小:', (referenceImageBase64.length / 1024).toFixed(2), 'KB (Base64)');

  const parts = [
    { inlineData: { mimeType: 'image/png', data: referenceImageBase64 } },
    { text: customPrompt }
  ];
  const logPrefix = `模式: 自定义提示词(风格迁移)，分辨率: ${resolution}，宽高比: ${aspectRatio}`;
  return sendGenerateRequest(apiKey, baseUrl, parts, resolution, aspectRatio, logPrefix);
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
 * @param {string} [aspectRatio='1:1'] - 宽高比
 * @returns {Promise<string>} - Base64 图像数据
 */
export async function generateIconGridWithReference(apiKey, referenceImageBase64, prompt, subject, baseUrl, resolution = 1024, gridSize = 3, aspectRatio = '1:1') {
  if (!referenceImageBase64) {
    throw new Error('参考图数据为空，请先上传参考图片');
  }

  console.log('  🖼️ [Gemini API] 参考图大小:', (referenceImageBase64.length / 1024).toFixed(2), 'KB (Base64)');

  const parts = [
    { inlineData: { mimeType: 'image/png', data: referenceImageBase64 } },
    { text: buildStyleGridPrompt(prompt, subject, resolution, gridSize, aspectRatio) }
  ];
  const logPrefix = `模式: 风格迁移，分辨率: ${resolution}，网格: ${gridSize}x${gridSize}，宽高比: ${aspectRatio}，主体: ${subject}`;
  return sendGenerateRequest(apiKey, baseUrl, parts, resolution, aspectRatio, logPrefix);
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
