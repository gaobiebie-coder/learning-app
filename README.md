# 每日学习（learning-app）

一款 PWA 手机学习软件，由 Kimi 协助开发。

## 在线访问

**https://gaobiebie-coder.github.io/learning-app/**

手机浏览器打开后，可以"添加到主屏幕"，像普通 App 一样使用，支持离线打开。

## 当前功能（v0.2 PWA 版）

- 📇 **每日单词卡**：点击翻面查看释义和例句（内置 10 个核心词，持续扩充）
- 🎯 **今日目标**：进度条追踪，数据按天自动保存
- 📚 **学习模块**：单词、刷题、阅读、错题本入口
- ✅ **每日打卡**：连续学习天数统计（断签自动重计）
- 📴 **离线可用**：Service Worker 缓存，没网也能打开

## 技术架构

纯静态 PWA：无框架、无构建步骤，HTML + CSS + 原生 JS。

- **托管**：GitHub Pages（免费）
- **部署**：推送到 main 分支 → GitHub Actions 自动发布，约 1 分钟生效
- **数据**：学习进度存在手机本地（localStorage），不上传服务器

## 目录结构

```
index.html              页面结构
styles.css              样式
app.js                  交互逻辑（单词卡、进度、打卡、导航）
sw.js                   Service Worker（离线缓存）
manifest.webmanifest    PWA 配置（图标、名称、全屏模式）
icons/                  App 图标
.github/workflows/      自动部署配置
```

## 如何安装到手机主屏幕

- **iPhone（Safari）**：打开网址 → 分享按钮 → 添加到主屏幕
- **安卓（Chrome）**：打开网址 → 右上角菜单 → 安装应用 / 添加到主屏幕
