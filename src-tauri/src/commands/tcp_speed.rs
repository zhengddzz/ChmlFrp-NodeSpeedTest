use std::net::{TcpListener, TcpStream, ToSocketAddrs};
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use std::thread;
use log::{info, error, warn};

static TCP_SPEED_SERVER_RUNNING: AtomicBool = AtomicBool::new(false);
static TCP_SPEED_SERVER_PORT: std::sync::atomic::AtomicU16 = std::sync::atomic::AtomicU16::new(0);

const TEST_DATA_SIZE: usize = 1024 * 1024;

#[tauri::command]
pub async fn start_tcp_speed_server() -> Result<u16, String> {
    if TCP_SPEED_SERVER_RUNNING.load(Ordering::SeqCst) {
        return Ok(TCP_SPEED_SERVER_PORT.load(Ordering::SeqCst));
    }

    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind port: {}", e))?;
    
    let port = listener.local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?
        .port();
    
    listener.set_nonblocking(true)
        .map_err(|e| format!("Failed to set nonblocking: {}", e))?;

    TCP_SPEED_SERVER_PORT.store(port, Ordering::SeqCst);
    TCP_SPEED_SERVER_RUNNING.store(true, Ordering::SeqCst);

    let running = std::sync::Arc::new(AtomicBool::new(true));
    let running_clone = running.clone();

    thread::spawn(move || {
        while TCP_SPEED_SERVER_RUNNING.load(Ordering::SeqCst) {
            match listener.accept() {
                Ok((stream, addr)) => {
                    info!("TCP speed server accepted connection from {}", addr);
                    
                    let test_data = vec![0u8; TEST_DATA_SIZE];
                    let running = running_clone.clone();
                    
                    thread::spawn(move || {
                        if let Err(e) = handle_client(stream, &test_data, running) {
                            error!("Client handler error: {}", e);
                        }
                    });
                }
                Err(e) => {
                    if e.kind() == std::io::ErrorKind::WouldBlock {
                        thread::sleep(Duration::from_millis(50));
                    } else {
                        warn!("Accept error: {}", e);
                    }
                }
            }
        }
        info!("TCP speed server thread exiting");
    });

    info!("TCP speed server started on port {}", port);
    Ok(port)
}

fn handle_client(mut stream: TcpStream, test_data: &[u8], running: std::sync::Arc<AtomicBool>) -> Result<(), std::io::Error> {
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    stream.set_write_timeout(Some(Duration::from_secs(30)))?;
    
    let mut buffer = [0u8; 1024];
    
    loop {
        if !running.load(Ordering::SeqCst) {
            break;
        }
        
        match stream.read(&mut buffer) {
            Ok(0) => {
                info!("Client disconnected");
                break;
            }
            Ok(n) => {
                let request = String::from_utf8_lossy(&buffer[..n]);
                info!("Received request: {}", request.trim());
                
                if request.starts_with("SPEEDTEST") {
                    let parts: Vec<&str> = request.split_whitespace().collect();
                    let size_mb: usize = if parts.len() > 1 {
                        parts[1].parse().unwrap_or(10)
                    } else {
                        10
                    };
                    
                    info!("Sending {} MB for speed test", size_mb);
                    
                    let total_bytes = size_mb * 1024 * 1024;
                    let mut sent = 0usize;
                    
                    while sent < total_bytes && running.load(Ordering::SeqCst) {
                        let to_send = std::cmp::min(test_data.len(), total_bytes - sent);
                        stream.write_all(&test_data[..to_send])?;
                        sent += to_send;
                    }
                    
                    info!("Speed test data sent: {} bytes", sent);
                    break;
                }
            }
            Err(e) => {
                if e.kind() == std::io::ErrorKind::WouldBlock || e.kind() == std::io::ErrorKind::TimedOut {
                    continue;
                }
                error!("Read error: {}", e);
                break;
            }
        }
    }
    
    Ok(())
}

#[tauri::command]
pub async fn check_tcp_speed_server(port: u16) -> Result<bool, String> {
    info!("Checking TCP speed server on port {}", port);
    
    let result = tokio::task::spawn_blocking(move || -> Result<bool, String> {
        let addr = format!("127.0.0.1:{}", port);
        
        let socket_addr = addr.parse::<std::net::SocketAddr>()
            .map_err(|e: std::net::AddrParseError| format!("地址解析失败: {}", e))?;
        
        match TcpStream::connect_timeout(&socket_addr, Duration::from_secs(3)) {
            Ok(mut stream) => {
                stream.set_read_timeout(Some(Duration::from_secs(3)))
                    .map_err(|e| format!("设置读超时失败: {}", e))?;
                stream.set_write_timeout(Some(Duration::from_secs(3)))
                    .map_err(|e| format!("设置写超时失败: {}", e))?;
                
                let request = "PING\n";
                if let Err(e) = stream.write_all(request.as_bytes()) {
                    info!("TCP server check write failed: {}", e);
                    return Ok(false);
                }
                
                let mut buf = [0u8; 64];
                match stream.read(&mut buf) {
                    Ok(0) => {
                        info!("TCP server check: server closed connection (normal for PING)");
                        Ok(true)
                    }
                    Ok(n) => {
                        info!("TCP server check: received {} bytes", n);
                        Ok(true)
                    }
                    Err(e) => {
                        if e.kind() == std::io::ErrorKind::TimedOut || e.kind() == std::io::ErrorKind::WouldBlock {
                            info!("TCP server check: timeout (server is listening)");
                            Ok(true)
                        } else {
                            info!("TCP server check read error: {}", e);
                            Ok(false)
                        }
                    }
                }
            }
            Err(e) => {
                info!("TCP server check connect failed: {}", e);
                Ok(false)
            }
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;
    
    info!("TCP speed server check result: {}", result);
    Ok(result)
}

#[tauri::command]
pub async fn stop_tcp_speed_server() -> Result<(), String> {
    TCP_SPEED_SERVER_RUNNING.store(false, Ordering::SeqCst);
    TCP_SPEED_SERVER_PORT.store(0, Ordering::SeqCst);
    info!("TCP speed server stopped");
    Ok(())
}

#[derive(serde::Serialize)]
pub struct SpeedTestResult {
    pub success: bool,
    pub speed_mbps: f64,
    pub total_bytes: u64,
    pub duration_ms: u64,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn tcp_speed_test(
    host: String,
    port: u16,
    size_mb: Option<usize>,
) -> Result<SpeedTestResult, String> {
    let size_mb = size_mb.unwrap_or(10);
    
    info!("Starting TCP speed test to {}:{} for {} MB", host, port, size_mb);

    if host.is_empty() {
        return Ok(SpeedTestResult {
            success: false,
            speed_mbps: 0.0,
            total_bytes: 0,
            duration_ms: 0,
            error: Some("Host is empty".to_string()),
        });
    }

    if port == 0 {
        return Ok(SpeedTestResult {
            success: false,
            speed_mbps: 0.0,
            total_bytes: 0,
            duration_ms: 0,
            error: Some("Port is 0".to_string()),
        });
    }
    
    tokio::task::spawn_blocking(move || {
        let start = Instant::now();
        
        let addr_str = format!("{}:{}", host, port);
        info!("Attempting to resolve address: {}", addr_str);
        
        let socket_addr = match addr_str.to_socket_addrs() {
            Ok(mut addrs) => {
                match addrs.next() {
                    Some(addr) => {
                        info!("Resolved {} to {}", addr_str, addr);
                        addr
                    }
                    None => {
                        error!("No addresses found for {}", addr_str);
                        return Ok(SpeedTestResult {
                            success: false,
                            speed_mbps: 0.0,
                            total_bytes: 0,
                            duration_ms: 0,
                            error: Some(format!("Failed to resolve address: {}", addr_str)),
                        });
                    }
                }
            }
            Err(e) => {
                error!("Failed to parse address '{}': {}", addr_str, e);
                return Ok(SpeedTestResult {
                    success: false,
                    speed_mbps: 0.0,
                    total_bytes: 0,
                    duration_ms: 0,
                    error: Some(format!("Invalid address format '{}': {}", addr_str, e)),
                });
            }
        };
        
        let mut stream = match TcpStream::connect_timeout(&socket_addr, Duration::from_secs(10)) {
            Ok(s) => s,
            Err(e) => {
                return Ok(SpeedTestResult {
                    success: false,
                    speed_mbps: 0.0,
                    total_bytes: 0,
                    duration_ms: 0,
                    error: Some(format!("Failed to connect: {}", e)),
                });
            }
        };
        
        let request = format!("SPEEDTEST {}\n", size_mb);
        if let Err(e) = stream.write_all(request.as_bytes()) {
            return Ok(SpeedTestResult {
                success: false,
                speed_mbps: 0.0,
                total_bytes: 0,
                duration_ms: 0,
                error: Some(format!("Failed to send request: {}", e)),
            });
        }
        
        let mut received = 0u64;
        let mut buffer = vec![0u8; 64 * 1024];
        
        loop {
            match stream.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => {
                    received += n as u64;
                }
                Err(e) => {
                    if e.kind() != std::io::ErrorKind::WouldBlock {
                        warn!("Read error during speed test: {}", e);
                        break;
                    }
                }
            }
        }
        
        let duration = start.elapsed();
        let duration_secs = duration.as_secs_f64();
        let speed_mbps = if duration_secs > 0.0 {
            (received as f64 * 8.0) / duration_secs / 1_000_000.0
        } else {
            0.0
        };
        
        info!("TCP speed test completed: {} bytes in {:.2}s = {:.2} Mbps", 
              received, duration_secs, speed_mbps);
        
        Ok(SpeedTestResult {
            success: received > 0,
            speed_mbps,
            total_bytes: received,
            duration_ms: duration.as_millis() as u64,
            error: None,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
