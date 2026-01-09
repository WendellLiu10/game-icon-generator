/**
 * 更新检查器模块
 * 用于检查 GitHub 仓库是否有新版本
 */

const GITHUB_REPO = 'WendellLiu10/game-icon-generator';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/commits/main`;
const VERSION_KEY = 'app_version_hash';
const VERSION_FILE = './version.json';

/**
 * 获取本地版本信息
 * @returns {Promise<{version: string, date: string, description: string}>}
 */
export async function getLocalVersion() {
  try {
    const response = await fetch(VERSION_FILE, {
      cache: 'no-cache'  // 防止浏览器缓存版本文件
    });
    
    if (!response.ok) {
      console.warn('无法获取版本文件');
      return { version: '未知', date: '', description: '' };
    }
    
    const versionData = await response.json();
    return versionData;
  } catch (error) {
    console.error('读取版本文件失败:', error);
    return { version: '未知', date: '', description: '' };
  }
}

/**
 * 获取 GitHub 仓库的最新 commit hash
 * @returns {Promise<{hash: string, message: string, date: string}>}
 */
export async function getLatestCommit() {
  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    return {
      hash: data.sha.substring(0, 7), // 短 hash
      message: data.commit.message.split('\n')[0], // 第一行 commit 信息
      date: new Date(data.commit.author.date).toLocaleString('zh-CN')
    };
  } catch (error) {
    console.error('获取最新版本失败:', error);
    throw error;
  }
}

/**
 * 获取当前存储的版本 hash
 * @returns {string|null}
 */
export function getCurrentVersion() {
  return localStorage.getItem(VERSION_KEY);
}

/**
 * 保存当前版本 hash
 * @param {string} hash
 */
export function saveCurrentVersion(hash) {
  localStorage.setItem(VERSION_KEY, hash);
}

/**
 * 检查是否有新版本
 * @returns {Promise<{hasUpdate: boolean, current: string|null, latest: object}>}
 */
export async function checkForUpdates() {
  const currentVersion = getCurrentVersion();
  const latestCommit = await getLatestCommit();
  
  const hasUpdate = currentVersion !== null && currentVersion !== latestCommit.hash;
  
  return {
    hasUpdate,
    current: currentVersion,
    latest: latestCommit
  };
}

/**
 * 更新应用（重新加载页面）
 */
export async function updateApp(newVersion) {
  // 保存新版本号
  saveCurrentVersion(newVersion);
  
  // 清除所有缓存
  await clearAllCaches();
  
  // 强制刷新页面（带时间戳）
  const timestamp = Date.now();
  window.location.href = window.location.pathname + '?t=' + timestamp;
}

/**
 * 清除所有缓存
 */
export async function clearAllCaches() {
  // 清除 Service Worker
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => reg.unregister()));
  }
  
  // 清除浏览器缓存（如果支持 Cache API）
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map(name => caches.delete(name)));
  }
}
