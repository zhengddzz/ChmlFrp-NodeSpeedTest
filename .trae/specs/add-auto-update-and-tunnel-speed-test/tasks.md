# Tasks

## Phase 1: 自动更新系统

- [x] Task 1: 配置 Tauri Updater 插件
  - [x] SubTask 1.1: 在 `Cargo.toml` 添加 `tauri-plugin-updater` 依赖
  - [x] SubTask 1.2: 在 `tauri.conf.json` 配置更新端点和签名
  - [x] SubTask 1.3: 在 `lib.rs` 注册 Updater 插件

- [x] Task 2: 创建更新服务
  - [x] SubTask 2.1: 创建 `src/services/updateService.ts`，封装检查更新、下载安装逻辑
  - [x] SubTask 2.2: 实现下载进度回调
  - [x] SubTask 2.3: 实现自动检查更新设置存储

- [x] Task 3: 创建更新对话框组件
  - [x] SubTask 3.1: 创建 `src/components/dialogs/UpdateDialog.tsx`
  - [x] SubTask 3.2: 实现更新信息展示（版本号、发布日期、更新日志）
  - [x] SubTask 3.3: 实现下载进度条
  - [x] SubTask 3.4: 实现 Markdown 格式的更新日志渲染

- [x] Task 4: 创建启动检查钩子
  - [x] SubTask 4.1: 创建 `src/components/App/hooks/useUpdateCheck.ts`
  - [x] SubTask 4.2: 实现应用启动后延迟检查更新逻辑
  - [x] SubTask 4.3: 集成到 `App.tsx`

- [x] Task 5: 更新设置界面
  - [x] SubTask 5.1: 在 `UpdateSection.tsx` 添加"启动时自动检查更新"开关
  - [x] SubTask 5.2: 更新"检查更新"按钮支持显示下载进度
  - [x] SubTask 5.3: 集成 `UpdateDialog` 组件

## Phase 2: 隧道速度测试功能

- [x] Task 6: 创建文件服务（Rust 后端）
  - [x] SubTask 6.1: 在 `src-tauri/src/commands/` 创建 `file_server.rs`
  - [x] SubTask 6.2: 实现 `start_file_server` 命令（随机端口、提供测试文件）
  - [x] SubTask 6.3: 实现 `stop_file_server` 命令
  - [x] SubTask 6.4: 在 `lib.rs` 注册命令

- [x] Task 7: 创建隧道服务（前端）
  - [x] SubTask 7.1: 创建 `src/services/tunnelService.ts`
  - [x] SubTask 7.2: 实现 `createTempTunnel` 方法（调用 API 创建隧道）
  - [x] SubTask 7.3: 实现 `deleteTunnel` 方法
  - [x] SubTask 7.4: 实现 `getTunnelInfo` 方法

- [x] Task 8: 创建 frpc 管理服务（Rust 后端）
  - [x] SubTask 8.1: 在 `src-tauri/src/commands/` 创建 `frpc.rs`
  - [x] SubTask 8.2: 实现 `start_frpc` 命令（启动 frpc 进程）
  - [x] SubTask 8.3: 实现 `stop_frpc` 命令
  - [x] SubTask 8.4: 实现 `is_frpc_running` 命令
  - [x] SubTask 8.5: 在 `lib.rs` 注册命令

- [x] Task 9: 创建速度测试服务
  - [x] SubTask 9.1: 创建 `src/services/speedTestService.ts`
  - [x] SubTask 9.2: 实现完整的速度测试流程编排
  - [x] SubTask 9.3: 实现下载速度计算
  - [x] SubTask 9.4: 实现资源清理逻辑

- [x] Task 10: 更新节点测试界面
  - [x] SubTask 10.1: 在 `NodeTest/index.tsx` 添加"速度测试"按钮
  - [x] SubTask 10.2: 创建速度测试结果展示组件
  - [x] SubTask 10.3: 实现测试进度显示
  - [x] SubTask 10.4: 实现测试结果持久化

## Phase 3: 测试与优化

- [ ] Task 11: 编写测试
  - [ ] SubTask 11.1: 测试自动更新流程
  - [ ] SubTask 11.2: 测试隧道创建和删除
  - [ ] SubTask 11.3: 测试速度测试功能
  - [ ] SubTask 11.4: 测试错误处理和边界情况

- [ ] Task 12: 文档更新
  - [ ] SubTask 12.1: 更新 README.md 添加新功能说明
  - [ ] SubTask 12.2: 更新 Release Notes

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 2]
- [Task 5] depends on [Task 3]
- [Task 7] depends on [Task 6]
- [Task 9] depends on [Task 6, Task 7, Task 8]
- [Task 10] depends on [Task 9]
- [Task 11] depends on [Task 5, Task 10]
