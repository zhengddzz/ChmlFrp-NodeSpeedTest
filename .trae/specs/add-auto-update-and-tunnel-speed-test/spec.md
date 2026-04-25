# 自动更新与隧道速度测试功能 Spec

## Why
当前 NodeSpeedTest 应用的更新功能仅支持手动检查并跳转到浏览器下载，用户体验不佳。同时，应用缺少隧道速度测试功能，无法让用户在创建隧道后测试实际的网络传输速度。这两个功能对于提升用户体验和应用完整性至关重要。

## What Changes
- 实现基于 Tauri Updater 插件的自动更新系统，支持应用内下载和安装更新
- 添加应用启动时自动检查更新机制，以弹窗形式提示用户
- 实现隧道速度测试功能，包含完整的隧道创建、启动、测速流程
- 在设置界面添加自动更新开关配置

## Impact
- Affected specs: 更新系统、隧道管理、用户界面
- Affected code: 
  - `src/services/update.ts` - 更新服务重构
  - `src/components/dialogs/UpdateDialog.tsx` - 新增更新对话框
  - `src/components/App/hooks/useUpdateCheck.ts` - 新增启动检查钩子
  - `src/services/tunnelService.ts` - 新增隧道服务
  - `src/services/fileServerService.ts` - 新增文件服务
  - `src/components/pages/NodeTest/index.tsx` - 添加速度测试UI
  - `src-tauri/src/lib.rs` - 添加新的 Tauri 命令
  - `src-tauri/Cargo.toml` - 添加依赖

## ADDED Requirements

### Requirement: 自动更新系统
系统应提供完整的自动更新功能，包括：
- 使用 Tauri Updater 插件从 GitHub Releases 检查和下载更新
- 支持在应用内直接下载并安装更新
- 提供下载进度显示
- 支持用户配置是否在启动时自动检查更新

#### Scenario: 应用启动时检查更新
- **WHEN** 应用启动且用户未禁用自动检查
- **THEN** 系统在 2 秒后自动检查 GitHub Releases 是否有新版本
- **AND** 如果有新版本，显示更新对话框询问用户是否更新

#### Scenario: 用户手动检查更新
- **WHEN** 用户在设置页面点击"检查更新"按钮
- **THEN** 系统检查是否有新版本
- **AND** 显示检查结果（有更新则显示对话框，无更新则显示提示）

#### Scenario: 用户选择更新
- **WHEN** 用户在更新对话框点击"立即更新"
- **THEN** 系统开始下载更新包
- **AND** 显示下载进度
- **AND** 下载完成后自动安装并重启应用

### Requirement: 隧道速度测试功能
系统应提供隧道速度测试功能，完整流程如下：

#### Scenario: 启动文件服务
- **WHEN** 用户开始速度测试
- **THEN** 系统在本地随机选择一个可用端口
- **AND** 在该端口启动一个简单的文件服务，提供测试文件下载

#### Scenario: 创建隧道
- **WHEN** 文件服务启动成功
- **THEN** 系统调用 API 创建一个临时隧道
- **AND** 隧道类型为 TCP
- **AND** 隧道本地端口为文件服务端口

#### Scenario: 启动隧道连接
- **WHEN** 隧道创建成功
- **THEN** 系统启动 frpc 客户端连接到隧道服务器
- **AND** 等待连接建立成功

#### Scenario: 获取外网端口
- **WHEN** 隧道连接成功
- **THEN** 系统获取隧道对应的外网端口信息
- **AND** 显示外网访问地址

#### Scenario: 执行 TCPing 测试
- **WHEN** 获取到外网端口
- **THEN** 系统对隧道服务器的外网端口执行 TCPing 测试
- **AND** 显示延迟结果

#### Scenario: 执行下载速度测试
- **WHEN** TCPing 测试完成
- **THEN** 系统通过隧道下载测试文件
- **AND** 计算并显示下载速度

#### Scenario: 清理资源
- **WHEN** 测试完成或用户取消
- **THEN** 系统停止 frpc 客户端
- **AND** 删除临时隧道
- **AND** 关闭文件服务

## MODIFIED Requirements

### Requirement: 设置界面更新
设置界面应增加自动更新配置选项：
- 添加"启动时自动检查更新"开关
- 更新"检查更新"按钮的行为，支持显示下载进度

## Technical Implementation Notes

### 自动更新实现
1. 添加 `tauri-plugin-updater` 依赖
2. 配置 `tauri.conf.json` 中的更新端点
3. 创建 `UpdateService` 类封装更新逻辑
4. 创建 `UpdateDialog` 组件显示更新信息和进度
5. 创建 `useUpdateCheck` 钩子在应用启动时检查更新

### 隧道速度测试实现
1. 创建 `FileServerService` - 使用 Rust 在本地启动文件服务
2. 创建 `TunnelService` - 封装隧道创建、启动、删除逻辑
3. 添加 Tauri 命令：
   - `start_file_server` - 启动文件服务
   - `stop_file_server` - 停止文件服务
   - `create_temp_tunnel` - 创建临时隧道
   - `start_frpc` - 启动 frpc 客户端
   - `stop_frpc` - 停止 frpc 客户端
   - `download_speed_test` - 执行下载速度测试
