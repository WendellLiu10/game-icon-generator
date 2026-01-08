/**
 * 更新检查器模块
 * 用于检查 GitHub 仓库是否有新版本
 */

const GITHUB_REPO = 'WendellLiu10/game-icon-generator';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/commits/main`;
const VERSION_KEY = 'app_version_hash';

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
export function updateApp(newVersion) {
  // 保存新版本号
  saveCurrentVersion(newVersion);
  
  // 清除缓存并重新加载
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
    });
  }
  
  // 强制刷新页面
  window.location.reload(true);
}
