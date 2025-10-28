# 🎭 Mock 数据工具

[![Build](https://github.com/hero553/mock-api-gm/workflows/Build/badge.svg)](https://github.com/hero553/mock-api-gm/actions)
[![Deploy](https://github.com/hero553/mock-api-gm/workflows/Deploy%20to%20GitHub%20Pages/badge.svg)](https://github.com/hero553/mock-api-gm/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

方便好用的 Mock 数据工具，用于开发环境快速模拟 API 响应。支持拦截和模拟 Fetch 和 XHR 请求，提供可视化管理界面。

## ✨ 功能特性

- 🎯 **请求拦截** - 自动拦截 Fetch 和 XMLHttpRequest 请求
- 🎨 **可视化界面** - 美观的管理面板，操作简单直观
- 📝 **灵活匹配** - 支持正则表达式和字符串匹配
- 💾 **配置管理** - 支持导入导出配置，方便团队共享
- 📊 **请求日志** - 实时查看请求拦截情况
- ⏱️ **延迟模拟** - 模拟真实的网络延迟
- 🔄 **自动更新** - 每次提交代码自动部署最新版本

## 📦 安装

### 方式 1：一键安装（推荐，自动更新）

点击下方链接安装，Tampermonkey 会自动识别：

**🚀 [点击安装最新版本](https://hero553.github.io/mock-api-gm/mock-data-tool.user.js)**

> ✅ **自动更新**: 每次推送代码后，脚本会自动更新到最新版本
> 
> ✅ **永久链接**: 链接永远指向最新版本，无需手动更新

### 方式 2：从 GitHub Releases 安装

1. 访问 [Releases 页面](https://github.com/hero553/mock-api-gm/releases)
2. 下载最新版本的 `mock-data-tool.user.js` 文件
3. Tampermonkey 会自动识别并提示安装

### 方式 3：从源码构建

```bash
# 克隆仓库
git clone https://github.com/hero553/mock-api-gm.git
cd mock-api-gm

# 安装依赖
yarn install

# 开发模式
yarn dev

# 构建生产版本
yarn build
```

## 🚀 快速开始

### 1. 打开管理面板

访问任意网页，点击右下角的 🎭 悬浮按钮打开管理面板。

### 2. 添加 Mock 规则

点击"+ 添加规则"按钮，填写以下信息：

- **规则名称**：例如 "用户信息接口"
- **URL 匹配**：`/api/user/info`
- **请求方法**：GET
- **响应类型**：JSON
- **响应数据**：
  ```json
  {
    "code": 0,
    "message": "success",
    "data": {
      "id": 123,
      "name": "张三",
      "email": "zhangsan@example.com"
    }
  }
  ```
- **状态码**：200
- **延迟**：500（可选，单位：毫秒）

### 3. 保存并测试

保存规则后，刷新页面。当页面发起匹配的请求时，会自动返回你配置的 Mock 数据。

## 📖 使用说明

### URL 匹配方式

#### 字符串匹配（简单）
输入 `/api/user` 可以匹配所有包含此路径的请求

#### 正则表达式（灵活）
- 匹配特定 ID：`/api/user/\d+`
- 精确匹配：`^https://example\.com/api/user$`
- 匹配多个路径：`/api/(user|product)`

### 配置导入导出

1. **导出配置**：在规则管理页面点击"导出配置"，保存为 JSON 文件
2. **导入配置**：点击"导入配置"，选择之前导出的 JSON 文件

### 请求日志

切换到"请求日志"标签，可以查看：
- 所有经过的请求
- 哪些请求被拦截（绿色高亮）
- 匹配的规则名称
- 请求时间

## 🔄 自动更新机制

### 工作原理

1. 每次你推送代码到 GitHub
2. GitHub Actions 自动构建并部署到 GitHub Pages
3. Tampermonkey 定期检查更新（通常每24小时）
4. 发现新版本时自动提示更新

### 手动检查更新

在 Tampermonkey 管理面板中：
1. 找到 "Mock 数据工具" 脚本
2. 点击脚本名称旁的图标
3. 选择 "检查更新"

### 更新地址

脚本配置了以下更新地址：
- **更新检查**: `https://hero553.github.io/mock-api-gm/mock-data-tool.user.js`
- **下载地址**: `https://hero553.github.io/mock-api-gm/mock-data-tool.user.js`

## 🛠️ 开发

### 技术栈

- TypeScript
- Vite
- vite-plugin-monkey
- Tampermonkey API

### 开发命令

```bash
# 开发模式（热重载）
yarn dev

# 构建生产版本
yarn build

# 类型检查
yarn typecheck
```

### 发布流程

```bash
# 提交代码
git add .
git commit -m "feat: add new feature"
git push

# 脚本会自动部署到 GitHub Pages
# 用户会自动收到更新
```

## 📝 版本发布

如果需要创建正式的 Release：

```bash
# 创建标签
git tag v1.0.1
git push origin v1.0.1

# GitHub Actions 会自动创建 Release
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献步骤

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [Tampermonkey](https://www.tampermonkey.net/) - 强大的用户脚本管理器
- [Vite](https://vitejs.dev/) - 快速的构建工具
- [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) - Vite 油猴脚本插件

## 📞 联系方式

- 提交 Issue: [GitHub Issues](https://github.com/hero553/mock-api-gm/issues)
- 项目主页: [GitHub](https://github.com/hero553/mock-api-gm)
- 安装地址: [GitHub Pages](https://hero553.github.io/mock-api-gm/)

---

**注意**：此工具仅用于开发环境，请勿在生产环境使用。
