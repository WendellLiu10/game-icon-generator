/**
 * IndexedDB 通用工具模块
 * 提供可复用的数据库操作封装
 */

/**
 * 生成唯一 ID
 * @param {string} prefix - ID 前缀
 * @returns {string}
 */
export function generateId(prefix = 'item') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 将 IDBRequest 包装为 Promise
 * @param {IDBRequest} request
 * @returns {Promise}
 */
export function wrapRequest(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * 执行 IndexedDB 事务操作
 * @param {IDBDatabase} db - 数据库实例
 * @param {string|string[]} storeNames - 存储名称
 * @param {string} mode - 'readonly' 或 'readwrite'
 * @param {function} operation - 接收 store 并返回 IDBRequest 的函数
 * @returns {Promise}
 */
export function withStore(db, storeName, mode, operation) {
    const transaction = db.transaction([storeName], mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);
    return wrapRequest(request);
}

/**
 * 创建数据库连接工厂
 * @param {string} dbName - 数据库名称
 * @param {number} version - 数据库版本
 * @param {function} onUpgrade - 升级处理函数
 * @returns {function} 返回获取数据库连接的函数
 */
export function createDBConnection(dbName, version, onUpgrade) {
    let db = null;

    return async function getDB() {
        if (db) return db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                onUpgrade(event.target.result, event);
            };
        });
    };
}

/**
 * 创建通用 CRUD 操作
 * @param {function} getDB - 获取数据库连接的函数
 * @param {string} storeName - 存储名称
 * @returns {Object} CRUD 操作对象
 */
export function createCRUD(getDB, storeName) {
    return {
        async add(item) {
            const db = await getDB();
            return withStore(db, storeName, 'readwrite', store => store.add(item));
        },

        async put(item) {
            const db = await getDB();
            return withStore(db, storeName, 'readwrite', store => store.put(item));
        },

        async get(id) {
            const db = await getDB();
            return withStore(db, storeName, 'readonly', store => store.get(id));
        },

        async getAll() {
            const db = await getDB();
            return withStore(db, storeName, 'readonly', store => store.getAll());
        },

        async delete(id) {
            const db = await getDB();
            return withStore(db, storeName, 'readwrite', store => store.delete(id));
        },

        async clear() {
            const db = await getDB();
            return withStore(db, storeName, 'readwrite', store => store.clear());
        },

        async count() {
            const db = await getDB();
            return withStore(db, storeName, 'readonly', store => store.count());
        },

        async getAllByIndex(indexName, value) {
            const db = await getDB();
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            return wrapRequest(index.getAll(value));
        }
    };
}
