/**
 * 探索方案存储模块
 * 负责探索方案的保存、加载和导出
 */

import { createDBConnection, createCRUD, generateId } from './db-utils.js';

// ============================================================================
// 常量定义
// ============================================================================

const DB_NAME = 'GameStyleExplorer';
const DB_VERSION = 2;
const EXPLORATIONS_STORE = 'explorations';

// ============================================================================
// 数据库初始化
// ============================================================================

const getDB = createDBConnection(DB_NAME, DB_VERSION, (database) => {
    // 创建素材存储（如果不存在）
    if (!database.objectStoreNames.contains('assets')) {
        const assetsStore = database.createObjectStore('assets', { keyPath: 'id' });
        assetsStore.createIndex('category', 'category', { unique: false });
        assetsStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // 创建探索方案存储
    if (!database.objectStoreNames.contains(EXPLORATIONS_STORE)) {
        const store = database.createObjectStore(EXPLORATIONS_STORE, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
    }
});

const crud = createCRUD(getDB, EXPLORATIONS_STORE);

/**
 * 初始化 IndexedDB 数据库
 * @returns {Promise<IDBDatabase>}
 */
export async function initExplorationDB() {
    return getDB();
}

// ============================================================================
// 探索方案 CRUD
// ============================================================================

/**
 * 创建新的探索方案
 * @param {Object} data - 方案数据
 * @returns {Promise<Object>}
 */
export async function createExploration(data) {
    await initExplorationDB();

    const exploration = {
        id: generateId('exp'),
        name: data.name || `探索方案 ${new Date().toLocaleDateString()}`,
        description: data.description || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assetIds: data.assetIds || [],
        styleIds: data.styleIds || [],
        generationType: data.generationType || 'icon',
        customPrompt: data.customPrompt || '',
        results: data.results || [],
        notes: data.notes || '',
        tags: data.tags || []
    };

    await crud.add(exploration);
    return exploration;
}

/**
 * 获取所有探索方案（摘要，不含完整结果图片）
 * @returns {Promise<Array>}
 */
export async function getAllExplorations() {
    await initExplorationDB();

    const all = await crud.getAll();
    return all
        .map(exp => ({
            id: exp.id,
            name: exp.name,
            description: exp.description,
            createdAt: exp.createdAt,
            updatedAt: exp.updatedAt,
            assetCount: exp.assetIds?.length || 0,
            styleCount: exp.styleIds?.length || 0,
            generationType: exp.generationType,
            tags: exp.tags,
            preview: exp.results?.[0]?.[0]?.imageBase64 || null
        }))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/**
 * 根据 ID 获取完整探索方案
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getExplorationById(id) {
    await initExplorationDB();
    return crud.get(id) || null;
}

/**
 * 更新探索方案
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateExploration(id, updates) {
    await initExplorationDB();

    const existing = await getExplorationById(id);
    if (!existing) {
        throw new Error(`Exploration not found: ${id}`);
    }

    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await crud.put(updated);
    return updated;
}

/**
 * 删除探索方案
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteExploration(id) {
    await initExplorationDB();
    return crud.delete(id);
}

// ============================================================================
// 迭代功能
// ============================================================================

/**
 * 基于现有方案创建迭代版本
 * @param {string} baseId - 基础方案 ID
 * @param {Object} changes - 变更内容
 * @returns {Promise<Object>}
 */
export async function createIteration(baseId, changes = {}) {
    const base = await getExplorationById(baseId);
    if (!base) {
        throw new Error(`Base exploration not found: ${baseId}`);
    }

    // 生成新版本名称
    const versionMatch = base.name.match(/v(\d+)$/);
    const newName = versionMatch
        ? base.name.replace(/v\d+$/, `v${parseInt(versionMatch[1]) + 1}`)
        : `${base.name} v2`;

    return createExploration({
        name: changes.name || newName,
        description: changes.description || base.description,
        assetIds: changes.assetIds || base.assetIds,
        styleIds: changes.styleIds || base.styleIds,
        generationType: changes.generationType || base.generationType,
        customPrompt: changes.customPrompt || base.customPrompt,
        results: [],
        notes: `基于 "${base.name}" 迭代`,
        tags: [...(base.tags || []), 'iteration']
    });
}

// ============================================================================
// 导出功能
// ============================================================================

/**
 * 导出探索方案为 HTML 报告
 * @param {string} id - 方案 ID
 * @returns {Promise<string>} HTML 字符串
 */
export async function exportToHTML(id) {
    const exploration = await getExplorationById(id);
    if (!exploration) {
        throw new Error(`Exploration not found: ${id}`);
    }
    return generateHTMLReport(exploration);
}

/**
 * 生成 HTML 报告
 */
function generateHTMLReport(exploration) {
    const { name, description, createdAt, results, styleIds, notes } = exploration;

    const resultsHTML = results?.length > 0
        ? `<div class="matrix">${results.map((row, rowIdx) => `
        <div class="matrix-row">
          <div class="matrix-label">${styleIds[rowIdx] || ''}</div>
          ${row.map((cell, colIdx) => cell?.imageBase64
            ? `<div class="matrix-cell"><img src="data:image/png;base64,${cell.imageBase64}" alt="Result ${rowIdx}-${colIdx}"></div>`
            : `<div class="matrix-cell empty">-</div>`
        ).join('')}
        </div>`).join('')}</div>`
        : '';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${name} - 风格探索报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 20px rgba(0,0,0,0.1); }
    h1 { font-size: 2rem; margin-bottom: 8px; }
    .meta { color: #666; margin-bottom: 24px; }
    .description { margin-bottom: 24px; padding: 16px; background: #f8f9fa; border-radius: 8px; }
    .matrix { display: flex; flex-direction: column; gap: 8px; margin: 24px 0; }
    .matrix-row { display: flex; gap: 8px; align-items: center; }
    .matrix-label { width: 120px; font-weight: 500; text-align: right; padding-right: 12px; }
    .matrix-cell { width: 200px; height: 200px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
    .matrix-cell img { width: 100%; height: 100%; object-fit: cover; }
    .matrix-cell.empty { display: flex; align-items: center; justify-content: center; color: #999; }
    .notes { margin-top: 24px; padding: 16px; background: #fff3cd; border-radius: 8px; }
    .footer { margin-top: 40px; text-align: center; color: #999; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${name}</h1>
    <p class="meta">创建于 ${new Date(createdAt).toLocaleString()}</p>
    ${description ? `<div class="description">${description}</div>` : ''}
    <h2>风格矩阵结果</h2>
    ${resultsHTML}
    ${notes ? `<div class="notes"><strong>备注：</strong>${notes}</div>` : ''}
    <p class="footer">由 AI 制图工坊生成</p>
  </div>
</body>
</html>`;
}

/**
 * 下载 HTML 报告
 * @param {string} id
 */
export async function downloadHTMLReport(id) {
    const html = await exportToHTML(id);
    const exploration = await getExplorationById(id);

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${exploration.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_报告.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
