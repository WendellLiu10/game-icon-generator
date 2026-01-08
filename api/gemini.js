/**
 * Gemini API 封装模块
 * 一次生成一张包含 3x3 排布的图标图片
 *
 * 提示词模板见: prompts.md
 */

// API 配置
const CONFIG = {
  baseUrl: 'http://47.108.80.236:8317/v1beta',
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
  // 文字生成模式
  textMode: `Create a single image containing a 3x3 grid of 9 game icons.

Requirements:
- The image should have a pure WHITE background
- Arrange exactly 9 icons in a 3 rows x 3 columns grid layout
- Each icon should be centered in its grid cell with equal spacing
- Leave safe margins around each icon (about 10% padding)
- All 9 icons should follow the same visual style: {STYLE}
- Each icon should be a variation of the theme: {USER_PROMPT}
- The icons should be distinct but cohesive in style
- Make sure all icons are properly aligned and evenly spaced

Output a single square image with this 3x3 icon grid.`,

  // 风格迁移模式
  styleMode: `Create a single image containing a 3x3 grid of 9 game icons, matching the EXACT visual style of the reference image.

Requirements:
- The image should have a pure WHITE background
- Arrange exactly 9 icons in a 3 rows x 3 columns grid layout
- Each icon should be centered in its grid cell with equal spacing
- Leave safe margins around each icon (about 10% padding)
- Match the art style, color palette, line work, and level of detail from the reference image PRECISELY
- Each icon should be a variation of the theme: {USER_PROMPT}
- The icons should be distinct but cohesive in style
- Make sure all icons are properly aligned and evenly spaced

Output a single square image with this 3x3 icon grid.`,
};

/**
 * 构建 3x3 图标网格 Prompt（文字模式）
 */
function buildGridPrompt(userPrompt, style = 'game asset style') {
  return PROMPT_TEMPLATES.textMode
    .replace('{USER_PROMPT}', userPrompt)
    .replace('{STYLE}', style);
}

/**
 * 构建风格迁移的 3x3 网格 Prompt
 */
function buildStyleGridPrompt(userPrompt) {
  return PROMPT_TEMPLATES.styleMode.replace('{USER_PROMPT}', userPrompt);
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
 * 生成 3x3 图标网格图片（纯文字模式）
 * @param {string} apiKey - Gemini API Key
 * @param {string} prompt - 用户描述
 * @param {string} style - 视觉风格描述
 * @returns {Promise<string>} - Base64 图像数据
 */
export async function generateIconGrid(apiKey, prompt, style) {
  const response = await fetch(
    `${CONFIG.baseUrl}/models/${CONFIG.imageModel}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: buildGridPrompt(prompt, style) }
          ]
        }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        }
      }),
    }
  );

  if (!response.ok) {
    await handleApiError(response);
  }

  const text = await response.text();
  if (!text) {
    throw new Error('API 返回空响应');
  }

  const data = JSON.parse(text);
  return extractImageFromResponse(data);
}

/**
 * 生成 3x3 图标网格图片（风格迁移模式）
 * @param {string} apiKey - Gemini API Key
 * @param {string} referenceImageBase64 - 参考图的 Base64 数据
 * @param {string} prompt - 用户描述
 * @returns {Promise<string>} - Base64 图像数据
 */
export async function generateIconGridWithReference(apiKey, referenceImageBase64, prompt) {
  const response = await fetch(
    `${CONFIG.baseUrl}/models/${CONFIG.imageModel}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: referenceImageBase64,
              },
            },
            { text: buildStyleGridPrompt(prompt) }
          ]
        }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        }
      }),
    }
  );

  if (!response.ok) {
    await handleApiError(response);
  }

  const text = await response.text();
  if (!text) {
    throw new Error('API 返回空响应');
  }

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
 * @returns {Promise<boolean>}
 */
export async function testApiKey(apiKey) {
  try {
    const response = await fetch(
      `${CONFIG.baseUrl}/models`,
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
