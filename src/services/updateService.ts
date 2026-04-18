import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { getVersion } from "@tauri-apps/api/app";

export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

const GITHUB_REPO = "zhengddzz/ChmlFrp-NodeSpeedTest";

export class UpdateService {
  async checkUpdate(): Promise<{
    available: boolean;
    version?: string;
    date?: string;
    body?: string;
  }> {
    try {
      const update = await check({
        headers: {},
      });

      if (update?.available) {
        return {
          available: true,
          version: update.version,
          date: update.date,
          body: update.body,
        };
      }

      return { available: false };
    } catch (error) {
      console.error("Tauri updater 检查失败，尝试 GitHub API:", error);
      return this.checkUpdateViaGitHub();
    }
  }

  private async checkUpdateViaGitHub(): Promise<{
    available: boolean;
    version?: string;
    date?: string;
    body?: string;
  }> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API 返回 ${response.status}`);
      }

      const release = await response.json();
      const latestVersion = release.tag_name?.replace(/^v/, "") || "";
      const currentVersion = await this.getCurrentVersion();

      if (latestVersion && this.compareVersions(latestVersion, currentVersion) > 0) {
        return {
          available: true,
          version: latestVersion,
          date: release.published_at,
          body: release.body,
        };
      }

      return { available: false };
    } catch (error) {
      console.error("GitHub API 检查更新失败:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`检查更新失败: ${errorMsg}`);
    }
  }

  private compareVersions(a: string, b: string): number {
    const aParts = a.split(".").map(Number);
    const bParts = b.split(".").map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal > bVal) return 1;
      if (aVal < bVal) return -1;
    }
    return 0;
  }

  async installUpdate(onProgress?: (progress: number) => void): Promise<void> {
    try {
      const update = await check({
        headers: {},
      });

      if (update?.available) {
        let contentLength = 0;
        let downloadedBytes = 0;

        await update.downloadAndInstall((progressEvent: DownloadEvent) => {
          if (progressEvent.event === "Started") {
            contentLength = progressEvent.data.contentLength || 0;
          } else if (progressEvent.event === "Progress" && onProgress) {
            downloadedBytes += progressEvent.data.chunkLength;
            if (contentLength > 0) {
              const percentage = (downloadedBytes / contentLength) * 100;
              onProgress(Math.min(percentage, 100));
            }
          }
        });
      } else {
        throw new Error("没有可用的更新，请手动下载最新版本");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`安装更新失败: ${errorMsg}`);
    }
  }

  getAutoCheckEnabled(): boolean {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("autoCheckUpdate");
    return stored !== "false";
  }

  setAutoCheckEnabled(enabled: boolean): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("autoCheckUpdate", enabled ? "true" : "false");
  }

  async getCurrentVersion(): Promise<string> {
    try {
      return await getVersion();
    } catch (error) {
      console.error("获取版本失败:", error);
      return "未知";
    }
  }

  getReleaseUrl(): string {
    return `https://github.com/${GITHUB_REPO}/releases/latest`;
  }
}

export const updateService = new UpdateService();
