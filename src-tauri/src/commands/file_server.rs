use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use once_cell::sync::Lazy;

static FILE_SERVER_PORT: Lazy<Arc<AtomicU16>> = Lazy::new(|| Arc::new(AtomicU16::new(0)));
static FILE_SERVER_RUNNING: Lazy<Arc<AtomicU16>> = Lazy::new(|| Arc::new(AtomicU16::new(0)));
static FILE_SERVER_HANDLE: Lazy<Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(None)));

const TEST_FILE_SIZE: usize = 10 * 1024 * 1024;

fn generate_test_file() -> Vec<u8> {
    let mut data = Vec::with_capacity(TEST_FILE_SIZE);
    for i in 0..TEST_FILE_SIZE {
        data.push((i % 256) as u8);
    }
    data
}

#[tauri::command]
pub async fn start_file_server() -> Result<u16, String> {
    if FILE_SERVER_RUNNING.load(Ordering::SeqCst) == 1 {
        let port = FILE_SERVER_PORT.load(Ordering::SeqCst);
        return Ok(port);
    }

    let test_data = generate_test_file();
    let test_data = Arc::new(test_data);

    let listener = std::net::TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind port: {}", e))?;
    
    let port = listener.local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?
        .port();
    
    FILE_SERVER_PORT.store(port, Ordering::SeqCst);
    FILE_SERVER_RUNNING.store(1, Ordering::SeqCst);

    listener.set_nonblocking(true)
        .map_err(|e| format!("Failed to set nonblocking: {}", e))?;

    let running = Arc::new(AtomicU16::new(1));
    let running_clone = running.clone();
    let test_data_clone = test_data.clone();

    let handle = tokio::spawn(async move {
        let listener = tokio::net::TcpListener::from_std(listener).unwrap();
        
        loop {
            if running_clone.load(Ordering::SeqCst) == 0 {
                break;
            }

            match listener.accept().await {
                Ok((mut stream, _)) => {
                    let data = test_data_clone.clone();
                    tokio::spawn(async move {
                        use tokio::io::{AsyncReadExt, AsyncWriteExt};
                        
                        let mut buffer = [0u8; 1024];
                        if let Ok(n) = stream.read(&mut buffer).await {
                            if n > 0 {
                                let request = String::from_utf8_lossy(&buffer[..n]);
                                if request.starts_with("GET /test") {
                                    let response = format!(
                                        "HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                                        data.len()
                                    );
                                    let _ = stream.write_all(response.as_bytes()).await;
                                    let _ = stream.write_all(&data).await;
                                } else {
                                    let response = "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n";
                                    let _ = stream.write_all(response.as_bytes()).await;
                                }
                            }
                        }
                    });
                }
                Err(e) => {
                    if e.kind() != std::io::ErrorKind::WouldBlock {
                        eprintln!("Accept error: {}", e);
                    }
                    tokio::time::sleep(Duration::from_millis(10)).await;
                }
            }
        }
    });

    *FILE_SERVER_HANDLE.lock().await = Some(handle);

    Ok(port)
}

#[tauri::command]
pub async fn stop_file_server() -> Result<(), String> {
    FILE_SERVER_RUNNING.store(0, Ordering::SeqCst);
    
    if let Some(handle) = FILE_SERVER_HANDLE.lock().await.take() {
        handle.abort();
    }
    
    FILE_SERVER_PORT.store(0, Ordering::SeqCst);
    
    Ok(())
}

#[tauri::command]
pub fn get_file_server_port() -> u16 {
    FILE_SERVER_PORT.load(Ordering::SeqCst)
}

#[tauri::command]
pub fn is_file_server_running() -> bool {
    FILE_SERVER_RUNNING.load(Ordering::SeqCst) == 1
}
