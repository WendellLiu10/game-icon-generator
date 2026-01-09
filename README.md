# 游戏图标生成器

基于 Gemini API 的游戏图标批量生成工具，一次生成 3x3 排布的图标网格图片。

## 功能特性

- **文字生成模式**：输入描述，生成 9 个风格统一的图标
- **风格迁移模式**：上传参考图，生成相同风格的新图标
- **一键导出**：直接下载 3x3 网格排布的 PNG 图片
- **自动更新**：一键检查 GitHub 仓库更新，支持自动更新和重启
- **版本显示**：导航栏显示当前应用版本号，鼠标悬停可查看详细信息
- **历史缓存**：生成的图标自动缓存在本地浏览器，即使刷新也不会丢失
- **清理历史**：一键清除所有历史记录和缓存图片
- **本地存储**：API Key、历史记录和上次输入自动保存

## 快速开始

### 1. 启动本地服务器

由于使用 ES Modules，需要通过 HTTP 服务器访问：

```bash
cd web/icon-generator

# 方式一：Python
python -m http.server 8080

# 方式二：Node.js
npx serve .

# 方式三：VS Code Live Server 插件
```

### 2. 访问应用

浏览器打开 `http://localhost:8080`

### 3. 配置 API Key

点击右上角「API Key 设置」，输入你的 Gemini API Key。

### 4. 生成图标

1. 选择生成模式（文字生成 / 风格迁移）
2. 输入图标描述，如：`各种武侠风格的武器图标`
3. 点击「生成 3x3 图标」
4. 等待生成完成后点击「导出图片」

## 更新功能

应用支持两种更新方式：

### 自动更新（推荐）

通过 GitHub Webhook 实现代码推送后服务器自动更新：

#### 1. 启动服务

```bash
# 启动所有服务（HTTP + Webhook）
./start.sh

# 或指定端口
PORT=3500 WEBHOOK_PORT=3501 ./start.sh

# 查看状态
./start.sh status

# 查看日志
./start.sh logs

# 停止所有服务
./stop.sh
```

#### 2. 配置 GitHub Webhook

1. 进入仓库 **Settings** → **Webhooks** → **Add webhook**
2. 填写配置：
   - **Payload URL**: `http://你的服务器IP:3501/webhook`
   - **Content type**: `application/json`
   - **Secret**: 可选，设置后需配置 `WEBHOOK_SECRET` 环境变量
   - **Events**: 选择 **Just the push event**
3. 点击 **Add webhook** 保存

#### 3. 测试

推送代码到 main 分支后，服务器会自动执行 `git pull` 更新代码。

### 手动更新

1. 点击右上角的「🔄 检查更新」按钮
2. 系统会检查 GitHub 仓库是否有新版本
3. 如果有更新，点击「立即更新」刷新页面

**注意**：手动更新只会刷新页面，实际代码更新需要 Webhook 或手动 `git pull`。

## 历史记录与缓存

- **自动缓存**：每次生成的图标会自动保存到浏览器 localStorage 中
- **持久化存储**：刷新页面后历史记录依然保留，最多保存 8 条记录
- **一键清理**：点击「最近生成」区域的「🗑️ 清理历史」按钮可清除所有历史记录
- **存储内容**：包括完整网格图、切片图标、提示词等所有生成数据

## 版本信息

当前版本号显示在页面顶部导航栏，鼠标悬停可查看详细的版本信息（版本号、发布日期、更新说明）。

## 文件结构

```
icon-generator/
├── index.html          # 入口页面
├── app.js              # 应用主逻辑
├── prompts.md          # 提示词模板文档
├── version.json        # 版本信息文件
├── README.md           # 本文件
├── start.sh            # 一键启动脚本 (HTTP + Webhook)
├── stop.sh             # 停止服务脚本
├── webhook-server.py   # GitHub Webhook 服务器
├── api/
│   └── gemini.js       # Gemini API 封装
└── core/
    ├── image-utils.js  # 图片处理工具
    ├── update-checker.js # 版本检查工具
    └── grid-renderer.js # 网格渲染（备用）
```

## 配置说明

### API 配置

编辑 `api/gemini.js` 中的 `CONFIG` 对象：

```javascript
const CONFIG = {
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  imageModel: 'gemini-1.5-flash',
};
```

### 提示词自定义

提示词模板位于 `api/gemini.js` 的 `PROMPT_TEMPLATES` 对象中。

完整说明见 [prompts.md](./prompts.md)。

## 输出规格

| 项目 | 规格 |
|------|------|
| 布局 | 3 行 × 3 列 |
| 背景 | 纯白色 |
| 间距 | 约 10% 安全边距 |
| 风格 | 中国武侠/仙侠手绘风格 |

## 使用示例

### 武器图标

```
各种武侠风格的武器图标，包括剑、刀、枪、棍、弓箭等
```

### 丹药图标

```
不同颜色和效果的丹药，从普通回血丹到珍贵灵丹
```

### 技能图标

```
火系技能图标，展示从小火球到烈焰风暴的不同威力
```

## 常见问题

### Q: 生成失败怎么办？

1. 检查 API Key 是否正确
2. 检查网络连接
3. 查看浏览器控制台错误信息

### Q: 如何修改图标风格？

编辑 `api/gemini.js` 中的 `PROMPT_TEMPLATES`，修改风格描述关键词。

### Q: 支持透明背景吗？

目前模板默认白色背景。如需透明背景，修改提示词中的 `pure WHITE background` 为 `transparent background`。

## 技术栈

- 纯前端实现（HTML/JS/CSS）
- ES6 Modules
- Gemini API (generateContent)
- 无框架依赖

## 相关文件

- [prompts.md](./prompts.md) - 提示词模板详细说明
