/**
 * 事件处理工具模块
 * 提供简化的事件绑定和表单处理
 */

/**
 * 批量绑定事件
 * @param {Array} mappings - 事件映射数组 [{element, event, handler}]
 */
export function bindEvents(mappings) {
    mappings.forEach(({ element, event, handler }) => {
        if (element) {
            if (element instanceof NodeList || Array.isArray(element)) {
                element.forEach(el => el.addEventListener(event, handler));
            } else {
                element.addEventListener(event, handler);
            }
        }
    });
}

/**
 * 处理带验证的选择器变更
 * @param {HTMLElement} element - select 元素
 * @param {Object} options - 配置选项
 * @param {Array} options.allowedValues - 允许的值列表
 * @param {Object} options.state - 状态对象
 * @param {string} options.stateProp - 状态属性名
 * @param {string} options.storageKey - localStorage 键名
 * @param {function} [options.parser] - 值解析函数
 * @param {function} [options.onValid] - 有效值回调
 */
export function handleSelectChange(element, options) {
    if (!element) return;

    const { allowedValues, state, stateProp, storageKey, parser, onValid } = options;

    element.addEventListener('change', (e) => {
        let value = e.target.value;
        if (parser) value = parser(value);

        if (allowedValues.includes(value)) {
            state[stateProp] = value;
            localStorage.setItem(storageKey, String(value));
            if (onValid) onValid(value);
        } else {
            console.warn(`无效的选择: ${value}`);
            element.value = String(state[stateProp]);
        }
    });
}

/**
 * 从 localStorage 恢复值
 * @param {string} key - localStorage 键名
 * @param {Array} allowedValues - 允许的值列表
 * @param {*} defaultValue - 默认值
 * @param {function} [parser] - 值解析函数
 * @returns {*} 恢复的值或默认值
 */
export function restoreFromStorage(key, allowedValues, defaultValue, parser = null) {
    const saved = localStorage.getItem(key);
    if (!saved) return defaultValue;

    const value = parser ? parser(saved) : saved;
    if (allowedValues.includes(value)) {
        return value;
    }
    localStorage.removeItem(key);
    return defaultValue;
}

/**
 * 设置对话框事件
 * @param {Object} config - 配置
 * @param {HTMLDialogElement} config.dialog - 对话框元素
 * @param {HTMLElement} config.openBtn - 打开按钮
 * @param {HTMLElement} config.cancelBtn - 取消按钮
 * @param {HTMLElement} config.confirmBtn - 确认按钮
 * @param {function} config.onOpen - 打开回调
 * @param {function} config.onConfirm - 确认回调
 */
export function setupDialog({ dialog, openBtn, cancelBtn, confirmBtn, onOpen, onConfirm }) {
    if (openBtn && dialog) {
        openBtn.addEventListener('click', () => {
            if (onOpen) onOpen();
            dialog.showModal();
        });
    }

    if (cancelBtn && dialog) {
        cancelBtn.addEventListener('click', () => dialog.close());
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            if (onConfirm) onConfirm();
        });
    }
}
