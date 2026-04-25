use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Child;
use std::sync::Mutex;

#[derive(Serialize, Clone)]
pub struct LogMessage {
    pub message: String,
    pub timestamp: String,
}

#[derive(Deserialize)]
pub struct HttpRequestOptions {
    pub url: String,
    pub method: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
    pub bypass_proxy: Option<bool>,
}

#[derive(Serialize, Clone)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percentage: f64,
}

#[derive(Deserialize, Debug)]
pub struct FrpcInfoResponse {
    pub msg: String,
    pub state: String,
    pub code: u32,
    pub data: FrpcInfoData,
}

#[derive(Deserialize, Debug)]
pub struct FrpcInfoData {
    pub downloads: Vec<FrpcDownload>,
    pub version: String,
}

#[derive(Deserialize, Debug, Clone)]
pub struct FrpcDownload {
    pub hash: String,
    pub os: String,
    pub hash_type: String,
    pub platform: String,
    pub link: String,
    pub arch: String,
    pub size: u64,
}

pub struct DownloadInfo {
    pub url: String,
    pub hash: String,
    pub size: u64,
}

pub struct FrpcProcesses {
    pub processes: Mutex<HashMap<String, Child>>,
}

impl FrpcProcesses {
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Deserialize, Debug, Clone)]
pub struct SpeedTestConfig {
    pub server_addr: String,
    pub server_port: u16,
    pub token: String,
    pub user: String,
    pub local_ip: String,
    pub local_port: u16,
    pub remote_port: u16,
    pub tunnel_name: String,
}
