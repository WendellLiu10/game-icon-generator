/**
 * 素材管理模块
 * 负责素材的上传、存储、分类和管理
 */

import { fileToBase64, createThumbnailFromBase64 } from './image-utils.js';
import { createDBConnection, createCRUD, generateId } from './db-utils.js';

// ============================================================================
// 常量定义
// ============================================================================

const DB_NAME = 'GameStyleExplorer';
const DB_VERSION = 1;
const ASSETS_STORE = 'assets';

// 素材分类
export const ASSET_CATEGORIES = {
  reference: { name: '参考图', icon: '🎨' },
  character: { name: '角色', icon: '👤' },
  ui: { name: 'UI 界面', icon: '📱' },
  scene: { name: '场景', icon: '🏞️' },
  other: { name: '其他', icon: '📁' }
};

// ============================================================================
// 数据库初始化
// ============================================================================

const getDB = createDBConnection(DB_NAME, DB_VERSION, (database) => {
  if (!database.objectStoreNames.contains(ASSETS_STORE)) {
    const store = database.createObjectStore(ASSETS_STORE, { keyPath: 'id' });
    store.createIndex('category', 'category', { unique: false });
    store.createIndex('createdAt', 'createdAt', { unique: false });
    store.createIndex('name', 'name', { unique: false });
  }
});

const crud = createCRUD(getDB, ASSETS_STORE);

/**
 * 初始化 IndexedDB 数据库
 * @returns {Promise<IDBDatabase>}
 */
export async function initAssetsDB() {
  return getDB();
}

// ============================================================================
// 素材 CRUD 操作
// ============================================================================

/**
 * 添加素材
 * @param {Object} assetData - 素材数据
 * @returns {Promise<Object>} 添加的素材对象
 */
export async function addAsset(assetData) {
  await initAssetsDB();

  const asset = {
    id: generateId('asset'),
    name: assetData.name || '未命名素材',
    category: assetData.category || 'other',
    imageBase64: assetData.imageBase64,
    thumbnailBase64: assetData.thumbnailBase64 || assetData.imageBase64,
    createdAt: new Date().toISOString(),
    tags: assetData.tags || []
  };

  await crud.add(asset);
  return asset;
}

/**
 * 获取所有素材
 * @param {string} [category] - 可选的分类过滤
 * @returns {Promise<Array>}
 */
export async function getAllAssets(category = null) {
  await initAssetsDB();

  let assets;
  if (category) {
    assets = await crud.getAllByIndex('category', category);
  } else {
    assets = await crud.getAll();
  }

  // 按创建时间倒序
  return assets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * 根据 ID 获取素材
 * @param {string} id - 素材 ID
 * @returns {Promise<Object|null>}
 */
export async function getAssetById(id) {
  await initAssetsDB();
  return crud.get(id) || null;
}

/**
 * 根据 ID 列表批量获取素材
 * @param {Array<string>} ids - 素材 ID 列表
 * @returns {Promise<Array>}
 */
export async function getAssetsByIds(ids) {
  const assets = await Promise.all(ids.map(id => getAssetById(id)));
  return assets.filter(a => a !== null);
}

/**
 * 更新素材
 * @param {string} id - 素材 ID
 * @param {Object} updates - 更新的字段
 * @returns {Promise<Object>}
 */
export async function updateAsset(id, updates) {
  await initAssetsDB();

  const existing = await getAssetById(id);
  if (!existing) {
    throw new Error(`Asset not found: ${id}`);
  }

  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  await crud.put(updated);
  return updated;
}

/**
 * 删除素材
 * @param {string} id - 素材 ID
 * @returns {Promise<void>}
 */
export async function deleteAsset(id) {
  await initAssetsDB();
  return crud.delete(id);
}

/**
 * 清空所有素材
 * @returns {Promise<void>}
 */
export async function clearAllAssets() {
  await initAssetsDB();
  return crud.clear();
}

// ============================================================================
// 素材导入辅助函数
// ============================================================================

/**
 * 从文件创建素材
 * @param {File} file - 文件对象
 * @param {string} category - 分类
 * @returns {Promise<Object>}
 */
export async function createAssetFromFile(file, category = 'reference') {
  const imageBase64 = await fileToBase64(file);
  const thumbnailBase64 = await createThumbnailFromBase64(imageBase64, 150);

  return addAsset({
    name: file.name.replace(/\.[^/.]+$/, ''), // 移除扩展名
    category,
    imageBase64,
    thumbnailBase64
  });
}

// ============================================================================
// 统计与查询
// ============================================================================

/**
 * 获取各分类的素材数量
 * @returns {Promise<Object>}
 */
export async function getAssetCountByCategory() {
  const assets = await getAllAssets();
  const counts = {};

  Object.keys(ASSET_CATEGORIES).forEach(cat => {
    counts[cat] = 0;
  });

  assets.forEach(asset => {
    if (counts[asset.category] !== undefined) {
      counts[asset.category]++;
    } else {
      counts.other++;
    }
  });

  return counts;
}
