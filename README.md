# ChmlFrp 节点推荐器

<div align="center">

![ChmlFrp节点推荐器](src-tauri/icons/icon.png)

**快速测试节点延迟，帮助用户选择最优节点**

[![GitHub release](https://img.shields.io/github/v/release/zhengddzz/ChmlFrp-NodeSpeedTest?include_prereleases)](https://github.com/zhengddzz/ChmlFrp-NodeSpeedTest/releases)
[![GitHub downloads](https://img.shields.io/github/downloads/zhengddzz/ChmlFrp-NodeSpeedTest/total)](https://github.com/zhengddzz/ChmlFrp-NodeSpeedTest/releases)
[![License](https://img.shields.io/github/license/zhengddzz/ChmlFrp-NodeSpeedTest)](LICENSE)

[下载最新版本](https://github.com/zhengddzz/ChmlFrp-NodeSpeedTest/releases/latest) | [问题反馈](https://github.com/zhengddzz/ChmlFrp-NodeSpeedTest/issues)

</div>

---

## ✨ 功能特性

- 🔍 **节点测速** - TCP 连接测试，快速获取节点延迟
- 🌍 **地域筛选** - 支持国内/国外节点筛选
- 👤 **用户筛选** - VIP/普通用户节点分类
- 📊 **智能排序** - 按延迟或编号排序
- 📌 **窗口置顶** - 方便随时查看测试进度
- 💾 **结果持久化** - 测试结果自动保存
- 🔄 **自动更新** - 支持 GitHub 自动检查更新

## 📥 下载安装

### Windows
- 下载 `.msi` 或 `.exe` 安装包
- 双击安装即可

### macOS
- 下载 `.dmg` 文件
- 拖拽到应用程序文件夹

### Linux
- 下载 `.deb` 或 `.AppImage`
- 根据发行版安装

## 🛠️ 技术栈

- **前端**: React + TypeScript + Tailwind CSS
- **后端**: Rust + Tauri
- **构建**: GitHub Actions

## 📝 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm tauri dev

# 构建
pnpm tauri build
```

## 📄 许可证

[MIT License](LICENSE)

## 🙏 致谢

- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [ChmlFrp](https://chmlfrp.cn/) - 免费内网穿透服务
