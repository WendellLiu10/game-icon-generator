/**
 * IndexedDB 历史记录存储模块
 * 使用 db-utils.js 简化操作
 */

import { createDBConnection, createCRUD, generateId } from './db-utils.js';

const DB_NAME = 'IconGeneratorDB';
const DB_VERSION = 1;
const STORE_NAME = 'history';

// 创建数据库连接
const getDB = createDBConnection(DB_NAME, DB_VERSION, (database) => {
  if (!database.objectStoreNames.contains(STORE_NAME)) {
    const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
    store.createIndex('timestamp', 'timestamp', { unique: false });
  }
});

// 创建 CRUD 操作
const crud = createCRUD(getDB, STORE_NAME);

/**
 * 初始化数据库连接
 */
export async function initDB() {
  return getDB();
}

/**
 * 保存历史记录项
 */
export async function saveHistoryItem(item) {
  return crud.put(item);
}

/**
 * 获取所有历史记录（按时间倒序）
 */
export async function getAllHistory() {
  const items = await crud.getAll();
  return items.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * 删除指定历史记录
 */
export async function deleteHistoryItem(id) {
  return crud.delete(id);
}

/**
 * 清空所有历史记录
 */
export async function clearAllHistory() {
  return crud.clear();
}

/**
 * 获取历史记录数量
 */
export async function getHistoryCount() {
  return crud.count();
}

/**
 * 清理多余的历史记录，只保留最近 maxCount 条
 */
export async function trimHistory(maxCount) {
  const items = await getAllHistory();

  if (items.length <= maxCount) return;

  const itemsToDelete = items.slice(maxCount);
  for (const item of itemsToDelete) {
    await deleteHistoryItem(item.id);
  }
}
