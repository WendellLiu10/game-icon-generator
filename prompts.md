# 图标生成提示词模板

## 文字生成模式

用于纯文字描述生成 3x3 图标网格。

```
Create a single image containing a 3x3 grid of 9 game icons.

Requirements:
- The image should have a pure WHITE background
- Arrange exactly 9 icons in a 3 rows x 3 columns grid layout
- Each icon should be centered in its grid cell with equal spacing
- Leave safe margins around each icon (about 10% padding)
- All 9 icons should follow the same visual style: Chinese wuxia/xianxia game style, hand-painted, rich colors
- Each icon should be a variation of the theme: {用户输入的描述}
- The icons should be distinct but cohesive in style
- Make sure all icons are properly aligned and evenly spaced

Output a single square image with this 3x3 icon grid.
```

### 变量说明

| 变量 | 说明 |
|------|------|
| `{用户输入的描述}` | 用户在界面输入的图标主题描述 |

---

## 风格迁移模式

用于参考已有图标风格生成新的 3x3 图标网格。

```
Create a single image containing a 3x3 grid of 9 game icons, matching the EXACT visual style of the reference image.

Requirements:
- The image should have a pure WHITE background
- Arrange exactly 9 icons in a 3 rows x 3 columns grid layout
- Each icon should be centered in its grid cell with equal spacing
- Leave safe margins around each icon (about 10% padding)
- Match the art style, color palette, line work, and level of detail from the reference image PRECISELY
- Each icon should be a variation of the theme: {用户输入的描述}
- The icons should be distinct but cohesive in style
- Make sure all icons are properly aligned and evenly spaced

Output a single square image with this 3x3 icon grid.
```

### 变量说明

| 变量 | 说明 |
|------|------|
| `{用户输入的描述}` | 用户在界面输入的图标主题描述 |
| 参考图 | 通过 `inlineData` 传入的 Base64 图片 |

---

## 自定义提示词

如需修改生成效果，可以调整以下关键词：

### 风格关键词

| 关键词 | 效果 |
|--------|------|
| `Chinese wuxia/xianxia` | 中国武侠/仙侠风格 |
| `hand-painted` | 手绘风格 |
| `pixel art` | 像素风格 |
| `flat design` | 扁平设计 |
| `3D rendered` | 3D 渲染风格 |
| `cartoon style` | 卡通风格 |

### 背景关键词

| 关键词 | 效果 |
|--------|------|
| `pure WHITE background` | 纯白背景 |
| `transparent background` | 透明背景 |
| `gradient background` | 渐变背景 |

### 布局关键词

| 关键词 | 效果 |
|--------|------|
| `3x3 grid` | 3行3列 |
| `2x2 grid` | 2行2列 |
| `4x4 grid` | 4行4列 |
| `10% padding` | 10% 安全边距 |

---

## 示例描述

以下是一些有效的用户输入示例：

1. **武器类**
   - `各种武侠风格的武器图标，包括剑、刀、枪、棍、弓箭等`
   - `不同品质的宝剑，从普通铁剑到神兵利器`

2. **道具类**
   - `武侠游戏中的消耗品，如丹药、解毒药、回血药`
   - `各种宝箱和容器，包括木箱、铁箱、金箱`

3. **技能类**
   - `火系技能图标，从小火球到烈焰风暴`
   - `剑法招式图标，展示不同的剑气效果`

4. **材料类**
   - `炼丹材料，各种灵草和矿石`
   - `锻造材料，铁矿、铜矿、金矿等`
