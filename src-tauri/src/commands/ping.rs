use std::process::Command;
use std::time::Instant;
use log::{info, warn};
use regex::Regex;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct PingResult {
    pub success: bool,
    pub latency: Option<f64>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn ping_host(host: String, count: Option<u32>) -> Result<PingResult, String> {
    let count = count.unwrap_or(3);
    
    info!("Starting ping test for host: {} (count: {})", host, count);
    
    tokio::task::spawn_blocking(move || {
        let start = Instant::now();
        
        #[cfg(target_os = "windows")]
        let output = Command::new("ping")
            .arg("-n")
            .arg(count.to_string())
            .arg("-w")
            .arg("3000")
            .arg(&host)
            .output();
        
        #[cfg(target_os = "macos")]
        let output = Command::new("ping")
            .arg("-c")
            .arg(count.to_string())
            .arg("-W")
            .arg("3000")
            .arg(&host)
            .output();
        
        #[cfg(target_os = "linux")]
        let output = Command::new("ping")
            .arg("-c")
            .arg(count.to_string())
            .arg("-W")
            .arg("3")
            .arg(&host)
            .output();
        
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        let output = Err(std::io::Error::new(std::io::ErrorKind::Unsupported, "Ping not supported on this platform"));
        
        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                
                info!("Ping stdout: {}", stdout);
                if !stderr.is_empty() {
                    warn!("Ping stderr: {}", stderr);
                }
                
                #[cfg(target_os = "windows")]
                {
                    let avg_regex = Regex::new(r"平均 = (\d+)ms").unwrap();
                    if let Some(caps) = avg_regex.captures(&stdout) {
                        if let Some(latency_str) = caps.get(1) {
                            if let Ok(latency) = latency_str.as_str().parse::<f64>() {
                                return Ok(PingResult {
                                    success: true,
                                    latency: Some(latency),
                                    error: None,
                                });
                            }
                        }
                    }
                    
                    let avg_regex_cn = Regex::new(r"Average = (\d+)ms").unwrap();
                    if let Some(caps) = avg_regex_cn.captures(&stdout) {
                        if let Some(latency_str) = caps.get(1) {
                            if let Ok(latency) = latency_str.as_str().parse::<f64>() {
                                return Ok(PingResult {
                                    success: true,
                                    latency: Some(latency),
                                    error: None,
                                });
                            }
                        }
                    }
                }
                
                #[cfg(any(target_os = "macos", target_os = "linux"))]
                {
                    let avg_regex = Regex::new(r"min/avg/max/mdev = [\d.]+/([\d.]+)/").unwrap();
                    if let Some(caps) = avg_regex.captures(&stdout) {
                        if let Some(latency_str) = caps.get(1) {
                            if let Ok(latency) = latency_str.as_str().parse::<f64>() {
                                return Ok(PingResult {
                                    success: true,
                                    latency: Some(latency),
                                    error: None,
                                });
                            }
                        }
                    }
                    
                    let rtt_regex = Regex::new(r"rtt min/avg/max/mdev = [\d.]+/([\d.]+)/").unwrap();
                    if let Some(caps) = rtt_regex.captures(&stdout) {
                        if let Some(latency_str) = caps.get(1) {
                            if let Ok(latency) = latency_str.as_str().parse::<f64>() {
                                return Ok(PingResult {
                                    success: true,
                                    latency: Some(latency),
                                    error: None,
                                });
                            }
                        }
                    }
                }
                
                if output.status.success() {
                    let duration = start.elapsed();
                    return Ok(PingResult {
                        success: true,
                        latency: Some(duration.as_secs_f64() * 1000.0 / count as f64),
                        error: None,
                    });
                }
                
                Ok(PingResult {
                    success: false,
                    latency: None,
                    error: Some(format!("Ping failed: {}", stderr)),
                })
            }
            Err(e) => {
                Ok(PingResult {
                    success: false,
                    latency: None,
                    error: Some(format!("Failed to execute ping: {}", e)),
                })
            }
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
