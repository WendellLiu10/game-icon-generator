/**
 * 画风迁移记录存储模块
 * 使用 IndexedDB 存储转换记录（A图 + B图 + 结果 + 参数）
 */

const DB_NAME = 'StyleTransferDB';
const DB_VERSION = 1;
const STORE_NAME = 'style_transfer_records';

let db = null;

/**
 * 初始化数据库
 */
export async function initTransferDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // 创建对象存储
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * 确保数据库已初始化
 */
async function ensureDB() {
  if (!db) {
    await initTransferDB();
  }
  return db;
}

/**
 * 生成唯一 ID
 */
function generateId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `transfer_${timestamp}_${random}`;
}

/**
 * 保存转换记录
 * @param {Object} record - 转换记录对象
 * @returns {Promise<string>} 记录 ID
 */
export async function saveTransferRecord(record) {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);

    // 添加 ID 和时间戳
    const recordWithMeta = {
      id: record.id || generateId(),
      timestamp: record.timestamp || Date.now(),
      ...record
    };

    const request = objectStore.put(recordWithMeta);

    request.onsuccess = () => resolve(recordWithMeta.id);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 获取所有转换记录（按时间倒序）
 * @returns {Promise<Array>} 记录列表
 */
export async function getAllTransferRecords() {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const index = objectStore.index('timestamp');

    const request = index.openCursor(null, 'prev'); // 倒序
    const records = [];

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        records.push(cursor.value);
        cursor.continue();
      } else {
        resolve(records);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * 根据 ID 获取单条记录
 * @param {string} id - 记录 ID
 * @returns {Promise<Object|null>} 记录对象
 */
export async function getTransferRecordById(id) {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 删除指定记录
 * @param {string} id - 记录 ID
 * @returns {Promise<void>}
 */
export async function deleteTransferRecord(id) {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * 清空所有记录
 * @returns {Promise<void>}
 */
export async function clearAllTransferRecords() {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * 获取记录总数
 * @returns {Promise<number>}
 */
export async function getTransferRecordCount() {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
