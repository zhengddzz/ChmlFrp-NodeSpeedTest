use std::net::{TcpStream, ToSocketAddrs};
use std::time::{Duration, Instant};
use log::{info, error, debug, warn};

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct TcpingResult {
    pub success: bool,
    pub latency: Option<f64>,
    pub error: Option<String>,
    pub raw_output: Option<String>,
}

#[tauri::command]
pub async fn tcping_host(host: String, port: Option<u16>, timeout: Option<u64>) -> Result<TcpingResult, String> {
    let port = port.unwrap_or(7000);
    let timeout_secs = timeout.unwrap_or(3);
    
    info!("Starting TCP ping test for host: {}:{}", host, port);

    if host.is_empty() {
        return Ok(TcpingResult {
            success: false,
            latency: None,
            error: Some("Host is empty".to_string()),
            raw_output: Some("Host is empty".to_string()),
        });
    }

    if port == 0 {
        return Ok(TcpingResult {
            success: false,
            latency: None,
            error: Some("Port is 0".to_string()),
            raw_output: Some("Port is 0".to_string()),
        });
    }
    
    tokio::task::spawn_blocking(move || {
        let start = Instant::now();
        let addr_str = format!("{}:{}", host, port);
        
        debug!("Resolving and connecting to: {}", addr_str);
        
        let socket_addr = match addr_str.to_socket_addrs() {
            Ok(addrs) => {
                let mut found = None;
                for addr in addrs {
                    debug!("Resolved address: {}", addr);
                    found = Some(addr);
                    break;
                }
                match found {
                    Some(addr) => {
                        info!("Resolved {} to {}", addr_str, addr);
                        addr
                    }
                    None => {
                        let error_msg = format!("Failed to resolve host: {}", host);
                        error!("{}", error_msg);
                        return Ok(TcpingResult {
                            success: false,
                            latency: None,
                            error: Some(error_msg.clone()),
                            raw_output: Some(error_msg),
                        });
                    }
                }
            }
            Err(e) => {
                let error_msg = format!("Failed to parse address '{}': {}", addr_str, e);
                error!("{}", error_msg);
                return Ok(TcpingResult {
                    success: false,
                    latency: None,
                    error: Some(error_msg.clone()),
                    raw_output: Some(error_msg),
                });
            }
        };
        
        debug!("Connecting to resolved address: {}", socket_addr);
        
        match TcpStream::connect_timeout(&socket_addr, Duration::from_secs(timeout_secs)) {
            Ok(_stream) => {
                let duration = start.elapsed();
                let latency_ms = duration.as_secs_f64() * 1000.0;
                
                info!("TCP ping to {}:{} successful: {:.2}ms", host, port, latency_ms);
                
                Ok(TcpingResult {
                    success: true,
                    latency: Some(latency_ms),
                    error: None,
                    raw_output: Some(format!("Connected to {}:{} in {:.2}ms", host, port, latency_ms)),
                })
            }
            Err(e) => {
                let duration = start.elapsed();
                let error_msg = format!("TCP connection failed: {}", e);
                
                warn!("TCP ping to {}:{} failed after {:.2}ms: {}", host, port, duration.as_secs_f64() * 1000.0, e);
                
                Ok(TcpingResult {
                    success: false,
                    latency: None,
                    error: Some(error_msg.clone()),
                    raw_output: Some(format!("Failed to connect to {}:{}: {}", host, port, e)),
                })
            }
        }
    })
    .await
    .map_err(|e| {
        error!("Task join error for TCP ping: {}", e);
        format!("Task join error: {}", e)
    })?
}
