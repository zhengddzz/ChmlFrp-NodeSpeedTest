import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

export type DownloadProgressCallback = (progress: DownloadProgress) => void;

export class FrpcService {
  private progressListener: UnlistenFn | null = null;

  async checkFrpcExists(): Promise<boolean> {
    try {
      return await invoke<boolean>("check_frpc_exists");
    } catch (error) {
      console.error("检查 frpc 失败:", error);
      return false;
    }
  }

  async downloadFrpc(onProgress?: DownloadProgressCallback): Promise<string> {
    if (onProgress) {
      this.progressListener = await listen<DownloadProgress>(
        "download-progress",
        (event) => {
          onProgress(event.payload);
        }
      );
    }

    try {
      const path = await invoke<string>("download_frpc");
      return path;
    } finally {
      if (this.progressListener) {
        this.progressListener();
        this.progressListener = null;
      }
    }
  }

  async getDownloadUrl(): Promise<string> {
    return await invoke<string>("get_frpc_download_url");
  }

  async stopAllFrpc(): Promise<void> {
    try {
      await invoke("stop_all_frpc");
    } catch (error) {
      console.error("停止所有 frpc 失败:", error);
    }
  }
}

export const frpcService = new FrpcService();
