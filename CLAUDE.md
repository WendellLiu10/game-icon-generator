# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

基于 Gemini API 的游戏图标批量生成器，支持文字生成和风格迁移两种模式，可一次生成 1x1/3x3/5x5 网格布局的图标。

**技术栈**: 纯前端 (HTML/CSS/JavaScript ES6 Modules)，无构建工具，无框架依赖。

## 开发命令

```bash
# 启动本地服务器（任选一种）
python -m http.server 8080
npx serve .

# 一键启动（HTTP + Webhook 自动更新）
./start.sh
./start.sh status    # 查看状态
./start.sh logs      # 查看日志
./stop.sh            # 停止服务

# 自定义端口
PORT=3500 WEBHOOK_PORT=3501 ./start.sh
```

## 核心架构

```
app.js              # 应用主逻辑，状态管理，UI 交互
api/gemini.js       # Gemini API 封装，提示词模板
core/
├── image-utils.js  # 图片处理（Base64、切片、缩放）
├── history-db.js   # IndexedDB 历史记录存储
└── update-checker.js # 版本检查与更新
```

### 数据流

```
用户输入 → 构建 Prompt → Gemini API → 网格图 → 切片 → IndexedDB 存储 → 展示
```

### 关键配置

- **API 配置**: `api/gemini.js` → `CONFIG` 对象
- **提示词模板**: `api/gemini.js` → `PROMPT_TEMPLATES`（详见 `prompts.md`）
- **版本信息**: `version.json`

### 存储策略

| 数据 | 存储位置 |
|------|---------|
| API Key | localStorage |
| 历史记录 | IndexedDB（最多 8 条）|
| commit hash | localStorage |

## 注意事项

- 项目使用 ES Modules，必须通过 HTTP 服务器访问
- Gemini API 有频率限制，高分辨率生成耗时较长
- 无自动化测试，依赖手动测试
