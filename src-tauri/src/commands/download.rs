use crate::models::{DownloadInfo, DownloadProgress, FrpcInfoResponse};
use crate::utils::app_data_frpc_path;
use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::Path;
use tauri::Emitter;

const MAX_RETRIES: u32 = 5;
const PROGRESS_EMIT_THRESHOLD: u64 = 100 * 1024;
const DEFAULT_TIMEOUT: u64 = 30;
const DOWNLOAD_TIMEOUT: u64 = 600;
const HASH_BUFFER_SIZE: usize = 8192;

const PLATFORM_MAP: &[(&str, &str, &str)] = &[
    ("windows", "x86_64", "win_amd64.exe"),
    ("windows", "x86", "win_386.exe"),
    ("windows", "aarch64", "win_arm64.exe"),
    ("linux", "x86", "linux_386"),
    ("linux", "x86_64", "linux_amd64"),
    ("linux", "arm", "linux_arm"),
    ("linux", "aarch64", "linux_arm64"),
    ("macos", "x86_64", "darwin_amd64"),
    ("macos", "aarch64", "darwin_arm64"),
];

fn build_http_client(timeout_secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .user_agent("ChmlFrpNodeSpeedTest/1.0")
        .no_proxy()
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))
}

fn get_platform_string(os: &str, arch: &str) -> Option<&'static str> {
    PLATFORM_MAP
        .iter()
        .find(|(o, a, _)| *o == os && *a == arch)
        .map(|(_, _, platform)| *platform)
}

fn verify_sha256(file_path: &Path, expected_hash: &str) -> Result<(), String> {
    let mut file = std::fs::File::open(file_path)
        .map_err(|e| format!("无法打开文件进行 hash 验证: {}", e))?;

    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; HASH_BUFFER_SIZE];

    loop {
        let bytes_read = file
            .read(&mut buffer)
            .map_err(|e| format!("读取文件失败: {}", e))?;

        if bytes_read == 0 {
            break;
        }

        hasher.update(&buffer[..bytes_read]);
    }

    let computed_hash = hex::encode(hasher.finalize());

    if computed_hash.to_lowercase() != expected_hash.to_lowercase() {
        return Err(format!(
            "文件 hash 验证失败: 预期 {}, 实际 {}",
            expected_hash, computed_hash
        ));
    }

    Ok(())
}

fn set_executable_permission(file_path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(file_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(file_path, perms).map_err(|e| e.to_string())?;
    }
    let _ = file_path;
    Ok(())
}

pub async fn get_download_info() -> Result<DownloadInfo, String> {
    let api_url = "https://cf-v1.uapis.cn/download/frpc/frpc_info.json";
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    let client = build_http_client(DEFAULT_TIMEOUT)?;

    let response = client
        .get(api_url)
        .send()
        .await
        .map_err(|e| format!("获取 frpc 信息失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API 请求失败，状态码: {}", response.status()));
    }

    let info_response: FrpcInfoResponse = response
        .json()
        .await
        .map_err(|e| format!("解析 API 响应失败: {}", e))?;

    if info_response.code != 200 || info_response.state != "success" {
        return Err(format!("API 返回错误: {}", info_response.msg));
    }

    let platform = get_platform_string(os, arch)
        .ok_or_else(|| format!("不支持的平台: {} {}", os, arch))?;

    let download = info_response
        .data
        .downloads
        .iter()
        .find(|d| d.platform == platform)
        .ok_or_else(|| format!("未找到匹配的下载: {} {}", os, arch))?;

    Ok(DownloadInfo {
        url: download.link.clone(),
        hash: download.hash.clone(),
        size: download.size,
    })
}

#[tauri::command]
pub async fn get_frpc_download_url() -> Result<String, String> {
    let info = get_download_info().await?;
    Ok(info.url)
}

#[tauri::command]
pub async fn download_frpc(app_handle: tauri::AppHandle) -> Result<String, String> {
    let download_info = get_download_info().await?;
    let url = download_info.url;
    let expected_hash = download_info.hash;
    let expected_size = download_info.size;

    let frpc_path = app_data_frpc_path(&app_handle)?;
    if let Some(parent) = frpc_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(DOWNLOAD_TIMEOUT))
        .user_agent("ChmlFrpNodeSpeedTest/1.0")
        .no_proxy()
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let mut total_size: u64 = expected_size;

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&frpc_path)
        .map_err(|e| format!("无法打开文件进行写入: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut retry_count = 0;

    loop {
        let response = match client.get(&url).send().await {
            Ok(resp) => resp,
            Err(e) => {
                retry_count += 1;
                if retry_count >= MAX_RETRIES {
                    return Err(format!("下载失败，已重试 {} 次: {}", MAX_RETRIES, e));
                }
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                continue;
            }
        };

        if !response.status().is_success() {
            return Err(format!("下载失败，HTTP 状态码: {}", response.status()));
        }

        if total_size == 0 {
            if let Some(len) = response.content_length() {
                total_size = len;
            }
        }

        retry_count = 0;
        let mut stream = response.bytes_stream();
        let mut this_chunk_size: u64 = 0;

        while let Some(item) = stream.next().await {
            match item {
                Ok(chunk) => {
                    if let Err(e) = file.write_all(&chunk) {
                        return Err(format!("写入文件失败: {}", e));
                    }

                    let chunk_len = chunk.len() as u64;
                    downloaded += chunk_len;
                    this_chunk_size += chunk_len;

                    let percentage = if total_size > 0 {
                        (downloaded as f64 / total_size as f64) * 100.0
                    } else {
                        0.0
                    };

                    if this_chunk_size >= PROGRESS_EMIT_THRESHOLD {
                        let _ = app_handle.emit(
                            "download-progress",
                            DownloadProgress {
                                downloaded,
                                total: total_size,
                                percentage,
                            },
                        );
                        this_chunk_size = 0;
                    }
                }
                Err(_) => {
                    break;
                }
            }
        }

        if total_size > 0 && downloaded >= total_size {
            break;
        }
    }

    let _ = app_handle.emit(
        "download-progress",
        DownloadProgress {
            downloaded,
            total: total_size,
            percentage: 100.0,
        },
    );

    if downloaded == 0 {
        return Err("下载失败: 没有接收到任何数据".to_string());
    }

    if !expected_hash.is_empty() {
        if let Err(e) = verify_sha256(&frpc_path, &expected_hash) {
            let _ = std::fs::remove_file(&frpc_path);
            return Err(e);
        }
    }

    set_executable_permission(&frpc_path)?;

    Ok(frpc_path.to_string_lossy().to_string())
}
