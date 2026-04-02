# AI Learning Companion - Obsidian 插件

一个 AI 驱动的学习伴侣插件，包含两种互补的学习模式，支持文件、图片附件和自定义提示词。

## 功能特性

### 💭 探讨模式（双向交流）
- AI 扮演**平等的讨论伙伴**，而非单向授课的老师
- 一起探索话题的不同侧面，互相启发
- 双方都是学习者，共同发现新见解
- 支持苏格拉底式和讲解式两种教学风格切换

### 🎯 检验模式（费曼技巧）
- 你扮演老师，AI 扮演学生向你提问
- 通过"教"来检验自己对知识的理解程度
- 三种学生水平可选（初学者、中等、进阶）

### 🎭 角色系统
- 每个角色有独特的**头像 emoji** 和性格设定
- 多种讨论伙伴可选：🧑‍💻 小智、📚 学者、💡 灵感、🤔 哲思
- 学生角色：🌱 小白、📖 小华、🎯 小强

### ⚙️ 自定义提示词
- 点击"提示词"按钮编辑系统提示词模板
- 使用变量自定义：`{{characterName}}`、`{{topic}}` 等
- 可恢复默认设置

### 📎 文件与图片支持
- **添加文件**: 从 Obsidian vault 中选择任意文件发送给 AI
- **添加图片**: 上传图片，支持多模态 AI 模型（GPT-4o、Claude 3.5）
- 图片在对话中预览，保存时自动嵌入 Markdown

### 💾 对话保存与管理
- 对话保存为标准 Markdown 文件，带 YAML frontmatter
- 支持在 Obsidian 中直接查看和编辑
- 历史记录浏览功能
- 图片附件自动保存到子文件夹

### 🔧 支持多种 AI 模型
- OpenAI (GPT-4o, GPT-4, GPT-3.5)
- Claude (Claude 3.5 Sonnet, Claude 3 Opus)
- 本地模型 (Ollama)
- 自定义 API 端点

## 安装方法

### 方法 1: 手动安装
1. 下载 `main.js` 和 `manifest.json` 文件
2. 在你的 Obsidian vault 中创建文件夹：`.obsidian/plugins/ai-learning-companion/`
3. 将下载的文件复制到该文件夹
4. 重启 Obsidian
5. 在设置 → 第三方插件中启用 "AI Learning Companion"

### 方法 2: 开发模式
```bash
cd d:/ai/ai-learning-companion
npm install
npm run build
# 然后将 main.js 和 manifest.json 复制到 .obsidian/plugins/ai-learning-companion/
```

## 使用方法

### 1. 配置 API
1. 打开 Obsidian 设置 → AI 学习伴侣
2. 选择或添加一个模型配置
3. 输入 API Key

### 2. 开始学习
1. 点击左侧边栏的毕业帽图标 🎓
2. 选择模式：💭 探讨模式 或 🎯 检验模式
3. 点击"新话题"输入讨论主题
4. **选择角色**（带头像卡片选择）
5. 开始对话

### 3. 发送文件/图片
- 点击 **📄 添加文件** 从 vault 中选择文件
- 点击 **🖼️ 添加图片** 上传本地图片
- 附件会在发送前预览，可点击 × 移除

### 4. 保存与回顾
- 点击 **💾 保存** 将对话保存到 Markdown 文件
- 点击 **📁 历史记录** 浏览和打开历史对话
- 点击 **📊 总结** 生成学习总结或理解度评估

### 5. 自定义提示词
- 点击 **⚙️ 提示词** 打开提示词编辑器
- 选择提示词模板，直接编辑
- 使用变量如 `{{characterName}}`、`{{topic}}` 等

## 文件结构

```
your-vault/
├── AI-Conversations/           # 对话保存目录（可自定义）
│   ├── attachments/           # 图片附件
│   │   └── *.png
│   └── 主题-时间戳.md          # 对话记录
└── .obsidian/plugins/ai-learning-companion/
    ├── main.js
    └── manifest.json
```

## 保存格式示例

```markdown
---
title: "Transformer 架构"
date: 2025-03-29T12:30:00.000Z
mode: 探讨模式
character: "小智"
characterAvatar: "🧑‍💻"
tags: [ai-conversation, teacher]
---

# Transformer 架构

> **模式**: 💭 探讨模式 | **角色**: 🧑‍💻 小智 | **时间**: 2025/3/29 20:30:00

---

### 👤 我 <small>20:30:00</small>

让我们开始学习"Transformer 架构"吧！

### 🧑‍💻 小智 <small>20:30:05</small>

太好了！我对这个话题很感兴趣。Transformer 是现代自然语言处理的核心架构...

**附件:**
![示意图](attachments/1700000000-diagram.png)
```

## 默认角色

### 讨论伙伴（探讨模式）
| 角色 | 头像 | 风格 |
|------|------|------|
| 小智 | 🧑‍💻 | 好奇心强，喜欢从不同角度探索 |
| 学者 | 📚 | 严谨博学，引入理论和研究 |
| 灵感 | 💡 | 创意十足，善于类比和跨学科视角 |
| 哲思 | 🤔 | 深思型，追问本质和"为什么" |

### 学生角色（检验模式）
| 角色 | 头像 | 水平 | 特点 |
|------|------|------|------|
| 小白 | 🌱 | 初学者 | 基础问题，追问到底 |
| 小华 | 📖 | 中等 | 有深度，追根究底 |
| 小强 | 🎯 | 进阶 | 挑战性问题，检验盲点 |

## 支持的模型

| 模型 | 图片支持 | 说明 |
|------|----------|------|
| GPT-4o | ✅ | 推荐，速度快，多模态 |
| GPT-4 | ❌ | 高质量，但较慢 |
| Claude 3.5 Sonnet | ✅ | 推荐，推理能力强 |
| Claude 3 Opus | ✅ | 最强推理，但昂贵 |
| Ollama 本地模型 | ❌ | 免费本地运行 |

## 开发

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 生产构建
npm run build
```

## 许可证

MIT
