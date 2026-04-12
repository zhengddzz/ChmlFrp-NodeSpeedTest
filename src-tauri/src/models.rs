use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
