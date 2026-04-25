use crate::models::{FrpcProcesses, SpeedTestConfig};
use crate::utils::resolve_frpc_path;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use tauri::{Manager, State};
use log::{info, warn, error};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

fn generate_config_file(config: &SpeedTestConfig, app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用目录失败: {}", e))?;

    let config_path = app_dir.join("speedtest_frpc.ini");

    let config_content = format!(
        r#"[common]
server_addr = {}
server_port = {}
user = {}
token = {}
log_level = info
tls_enable = false
tcp_mux = true
pool_count = 5

[{}]
type = tcp
local_ip = {}
local_port = {}
remote_port = {}
"#,
        config.server_addr,
        config.server_port,
        config.user,
        config.token,
        config.tunnel_name,
        config.local_ip,
        config.local_port,
        config.remote_port
    );

    let mut file = std::fs::File::create(&config_path)
        .map_err(|e| format!("创建配置文件失败: {}", e))?;

    file.write_all(config_content.as_bytes())
        .map_err(|e| format!("写入配置文件失败: {}", e))?;

    Ok(config_path)
}

#[tauri::command]
pub async fn start_frpc(
    app_handle: tauri::AppHandle,
    config: SpeedTestConfig,
    processes: State<'_, FrpcProcesses>,
) -> Result<(), String> {
    let tunnel_name = config.tunnel_name.clone();
    
    info!("[Frpc] Starting frpc for tunnel: {}", tunnel_name);
    info!("[Frpc] Config: server={}, port={}, local_port={}, remote_port={}", 
          config.server_addr, config.server_port, config.local_port, config.remote_port);
    
    {
        let procs = processes
            .processes
            .lock()
            .map_err(|e| format!("获取进程锁失败: {}", e))?;
        if procs.contains_key(&tunnel_name) {
            warn!("[Frpc] frpc already running for tunnel: {}", tunnel_name);
            return Err("frpc 已在运行中".to_string());
        }
    }
    
    let frpc_path = resolve_frpc_path(&app_handle)?;
    
    if !frpc_path.exists() {
        error!("[Frpc] frpc not found at: {:?}", frpc_path);
        return Err("frpc 未找到，请先下载".to_string());
    }
    
    info!("[Frpc] Using frpc at: {:?}", frpc_path);
    
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = std::fs::metadata(&frpc_path).map_err(|e| e.to_string())?;
        let mut perms = metadata.permissions();
        if perms.mode() & 0o111 == 0 {
            perms.set_mode(0o755);
            std::fs::set_permissions(&frpc_path, perms).map_err(|e| e.to_string())?;
        }
    }
    
    let config_path = generate_config_file(&config, &app_handle)?;
    info!("[Frpc] Config file created at: {:?}", config_path);

    let mut cmd = Command::new(&frpc_path);
    cmd.arg("-c")
        .arg(&config_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000);
    }

    let mut child = cmd.spawn().map_err(|e| {
        error!("[Frpc] Failed to spawn frpc: {}", e);
        format!("启动 frpc 失败: {}", e)
    })?;

    let pid = child.id();
    info!("[Frpc] frpc process spawned with PID: {:?}", pid);

    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        std::thread::spawn(move || {
            for line in reader.lines().flatten() {
                info!("[frpc stdout] {}", line);
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        std::thread::spawn(move || {
            for line in reader.lines().flatten() {
                warn!("[frpc stderr] {}", line);
            }
        });
    }

    {
        let mut procs = processes
            .processes
            .lock()
            .map_err(|e| format!("获取进程锁失败: {}", e))?;
        procs.insert(tunnel_name.clone(), child);
    }

    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    info!("[Frpc] frpc startup wait completed");
    Ok(())
}

#[tauri::command]
pub async fn stop_frpc(
    tunnel_name: String,
    processes: State<'_, FrpcProcesses>,
) -> Result<(), String> {
    let mut procs = processes
        .processes
        .lock()
        .map_err(|e| format!("获取进程锁失败: {}", e))?;
    
    if let Some(mut child) = procs.remove(&tunnel_name) {
        let _ = child.kill();
        let _ = child.wait();
    }
    
    Ok(())
}

#[tauri::command]
pub async fn stop_all_frpc(
    processes: State<'_, FrpcProcesses>,
) -> Result<(), String> {
    let mut procs = processes
        .processes
        .lock()
        .map_err(|e| format!("获取进程锁失败: {}", e))?;
    
    for (_, mut child) in procs.drain() {
        let _ = child.kill();
        let _ = child.wait();
    }
    
    Ok(())
}

#[tauri::command]
pub fn is_frpc_running(
    tunnel_name: String,
    processes: State<'_, FrpcProcesses>,
) -> bool {
    if let Ok(procs) = processes.processes.lock() {
        procs.contains_key(&tunnel_name)
    } else {
        false
    }
}

#[tauri::command]
pub async fn check_frpc_exists(app_handle: tauri::AppHandle) -> Result<bool, String> {
    let frpc_path = resolve_frpc_path(&app_handle)?;
    Ok(frpc_path.exists())
}
