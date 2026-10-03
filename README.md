# 每日学习（learning-app）

一款 PWA 手机学习软件，由 Kimi 协助开发。

## 在线访问

**https://gaobiebie-coder.github.io/learning-app/**

手机浏览器打开后，可以"添加到主屏幕"，像普通 App 一样使用，支持离线打开。
代码更新后 App 会**后台静默更新**，无需清理缓存。

## 功能

- 📰 **经济学人每日精读**：每天自动抓取官方 RSS，推荐最新一篇；目录可按版块翻阅；正文中**点击任意单词**弹出内置词典释义（离线可用），支持整句在线翻译；点击跳转官网读全文
- 📒 **生词本**：查过的单词自动收藏（含出处），首页单词卡自动循环复习，复习少的优先出现
- 📇 **每日单词卡**：点击翻面查看释义和例句
- 🎯 **今日目标**：进度条追踪，数据按天自动保存
- ✅ **每日打卡**：连续学习天数统计（断签自动重计）
- 📴 **离线可用**：Service Worker 缓存，没网也能打开

## 技术架构

纯静态 PWA：无框架、无构建步骤，HTML + CSS + 原生 JS。

- **托管**：GitHub Pages（免费）
- **部署**：推送到 main 分支 → GitHub Actions 自动发布，约 1 分钟生效
- **每日更新**：GitHub Actions 定时任务（每天北京时间 06:17）抓取经济学人 RSS，有新文章自动提交
- **内置词典**：[ECDICT](https://github.com/skywind3000/ECDICT)（MIT License）提取 4 万高频词 + 词形变化表
- **数据**：学习进度存在手机本地（localStorage），不上传服务器

## 目录结构

```
index.html              页面结构
styles.css              样式
app.js                  主页 / 打卡 / 导航逻辑
reading.js              经济学人阅读 + 点词翻译
sw.js                   Service Worker（离线缓存 + 静默更新）
manifest.webmanifest    PWA 配置
icons/                  App 图标
data/articles.json      文章目录（每日自动更新）
data/dict.json          内置英汉词典
scripts/fetch_articles.py   每日抓稿脚本
scripts/build_dict.py       词典构建脚本
.github/workflows/deploy.yml          推送自动部署
.github/workflows/update-articles.yml 每日文章更新
```

## 版权说明

应用仅展示经济学人官方 RSS 公开的标题和摘要，并提供原文链接；
付费正文请通过 economist.com 订阅阅读。

## 如何安装到手机主屏幕

- **iPhone（Safari）**：打开网址 → 分享按钮 → 添加到主屏幕
- **安卓（Chrome）**：打开网址 → 右上角菜单 → 安装应用 / 添加到主屏幕
