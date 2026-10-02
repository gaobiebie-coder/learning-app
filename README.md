# 每日学习（learning-app）

一款手机学习软件，由 Kimi 协助开发。

## 当前功能（v0.1）

- 📇 **每日单词卡**：点击翻面查看释义和例句
- 🎯 **今日目标**：学习进度条追踪
- 📚 **学习模块**：单词、刷题、阅读、错题本入口
- ✅ **每日打卡**：连续学习天数统计

## 技术架构

- **框架**：Flutter（一套代码，可出 Android / iOS）
- **本地**：只存放纯 Dart 代码（`lib/`、`test/`、`pubspec.yaml`）
- **云端**：GitHub Actions 自动生成平台脚手架、跑测试、打包 APK

## 每次推送后自动发生

1. 静态检查（`flutter analyze`）
2. 单元测试（`flutter test`）
3. 打包 Android 安装包（APK），在 Actions 页面可下载

## 如何下载安装包到手机

1. 手机打开 `github.com/gaobiebie-coder/learning-app`
2. 进入 **Actions** 页签 → 点最新一次成功的构建
3. 在 **Artifacts** 下载 `app-debug-apk`
4. 安卓手机解压后直接安装（iOS 需要 Apple 开发者账号，后续再配）

## 目录结构

```
lib/main.dart          全部界面代码（起步期单文件，后续拆分）
test/widget_test.dart  界面测试
.github/workflows/     云端构建配置
```
