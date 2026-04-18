import { useState, useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Gauge, Clock, Download, AlertCircle, CheckCircle2, Loader2, Info, AlertTriangle } from "lucide-react";
import { speedTestService, type SpeedTestProgress, type SpeedTestResult, type LogEntry } from "@/services/speedTestService";

interface SpeedTestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  nodeName: string;
  onTestComplete?: (result: { latency?: number; downloadSpeed?: number }) => void;
}

interface TestConfig {
  testLatency: boolean;
  testSpeed: boolean;
  speedTestSize: number;
}

const stageProgress: Record<string, number> = {
  idle: 0,
  checking_frpc: 5,
  downloading_frpc: 15,
  starting_tcp_server: 30,
  creating_tunnel: 40,
  starting_frpc: 50,
  testing_latency: 70,
  testing_speed: 85,
  cleaning_up: 95,
  completed: 100,
  error: 0,
};

const stageMessages: Record<string, string> = {
  idle: "准备测试",
  checking_frpc: "正在检查 frpc...",
  downloading_frpc: "正在下载 frpc...",
  starting_tcp_server: "正在启动 TCP 服务器...",
  creating_tunnel: "正在创建隧道...",
  starting_frpc: "正在启动 frpc 客户端...",
  testing_latency: "正在测试延迟...",
  testing_speed: "正在测试下载速度...",
  cleaning_up: "正在清理资源...",
  completed: "测试完成",
  error: "测试失败",
};

function LogItem({ log }: { log: LogEntry }) {
  const getIcon = () => {
    switch (log.type) {
      case "success":
        return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />;
      case "error":
        return <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />;
      case "warning":
        return <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />;
      default:
        return <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />;
    }
  };

  const getTextColor = () => {
    switch (log.type) {
      case "success":
        return "text-green-600";
      case "error":
        return "text-red-600";
      case "warning":
        return "text-yellow-600";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className={`flex items-start gap-2 text-xs ${getTextColor()}`}>
      {getIcon()}
      <span className="break-all">{log.message}</span>
    </div>
  );
}

export function SpeedTestDialog({ isOpen, onClose, nodeName, onTestComplete }: SpeedTestDialogProps) {
  const [config, setConfig] = useState<TestConfig>({
    testLatency: true,
    testSpeed: true,
    speedTestSize: 100,
  });
  const [progress, setProgress] = useState<SpeedTestProgress>({
    stage: "idle",
    message: "准备测试",
    logs: [],
  });
  const [result, setResult] = useState<SpeedTestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setProgress({ stage: "idle", message: "准备测试", logs: [] });
      setResult(null);
      setIsRunning(false);
    }
  }, [isOpen, nodeName]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [progress.logs]);

  const handleStartTest = useCallback(async () => {
    if (!config.testLatency && !config.testSpeed) {
      return;
    }

    setIsRunning(true);
    setResult(null);
    setProgress({ stage: "idle", message: "准备测试", logs: [] });

    const testResult = await speedTestService.runSpeedTest(
      nodeName,
      (p) => {
        setProgress(p);
      },
      {
        testLatency: config.testLatency,
        testSpeed: config.testSpeed,
        speedTestSize: config.speedTestSize,
      }
    );

    setResult(testResult);
    setIsRunning(false);

    if (testResult.success && onTestComplete) {
      onTestComplete({
        latency: testResult.latency,
        downloadSpeed: testResult.downloadSpeed,
      });
    }
  }, [nodeName, config, onTestComplete]);

  const handleClose = useCallback(async () => {
    if (isRunning) {
      speedTestService.cancel();
      await speedTestService.forceCleanup();
    }
    onClose();
  }, [isRunning, onClose]);

  const formatSpeed = (speedMbps: number): string => {
    if (speedMbps >= 1000) {
      return `${(speedMbps / 1000).toFixed(2)} Gbps`;
    }
    return `${speedMbps.toFixed(2)} Mbps`;
  };

  const currentProgress = progress.progress ?? stageProgress[progress.stage] ?? 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="w-5 h-5" />
            节点测试
          </DialogTitle>
          <DialogDescription>
            节点: {nodeName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isRunning && !result && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="testLatency"
                    checked={config.testLatency}
                    onCheckedChange={(checked) => 
                      setConfig(prev => ({ ...prev, testLatency: !!checked }))
                    }
                  />
                  <label htmlFor="testLatency" className="text-sm cursor-pointer">
                    测试延迟
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="testSpeed"
                    checked={config.testSpeed}
                    onCheckedChange={(checked) => 
                      setConfig(prev => ({ ...prev, testSpeed: !!checked }))
                    }
                  />
                  <label htmlFor="testSpeed" className="text-sm cursor-pointer">
                    测试下载速度
                  </label>
                </div>

                {config.testSpeed && (
                  <div className="flex items-center gap-2 pl-6">
                    <label className="text-sm text-muted-foreground whitespace-nowrap">
                      测试大小:
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={100000}
                      value={config.speedTestSize}
                      onChange={(e) => 
                        setConfig(prev => ({ 
                          ...prev, 
                          speedTestSize: Math.max(1, Math.min(100000, parseInt(e.target.value) || 100))
                        }))
                      }
                      className="w-20 h-8"
                    />
                    <span className="text-sm text-muted-foreground">MB</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-1">测试说明</p>
                    <p>本测试在本机同时进行上传和下载，实际下载速度受限于本机上传带宽。</p>
                    <p className="mt-1">请确保至少有1个隧道配额没有使用，否则测试将失败。</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isRunning && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium">{stageMessages[progress.stage] || progress.message}</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>总体进度</span>
                  <span>{currentProgress.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${currentProgress}%` }}
                  />
                </div>
              </div>

              {progress.logs.length > 0 && (
                <div className="border rounded-lg p-3 bg-muted/30 max-h-48 overflow-y-auto">
                  <div className="text-xs font-medium text-muted-foreground mb-2">日志</div>
                  <div className="space-y-1.5">
                    {progress.logs.map((log, index) => (
                      <LogItem key={index} log={log} />
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              {result.success ? (
                <>
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">测试成功</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {result.latency !== undefined && (
                      <div className="flex flex-col p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                          <Clock className="w-3 h-3" />
                          延迟
                        </div>
                        <span className="text-lg font-semibold">
                          {result.latency.toFixed(0)}ms
                        </span>
                      </div>
                    )}

                    {result.downloadSpeed !== undefined && (
                      <div className="flex flex-col p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                          <Download className="w-3 h-3" />
                          带宽速度
                        </div>
                        <span className="text-lg font-semibold">
                          {formatSpeed(result.downloadSpeed)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-700 dark:text-blue-300">
                        <p className="font-medium mb-1">测试说明</p>
                        <p>本测试在本机同时进行上传和下载，实际下载速度受限于本机上传带宽。</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2 text-destructive">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">测试失败</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        {result.error}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {progress.logs.length > 0 && (
                <div className="border rounded-lg p-3 bg-muted/30 max-h-32 overflow-y-auto">
                  <div className="text-xs font-medium text-muted-foreground mb-2">日志</div>
                  <div className="space-y-1.5">
                    {progress.logs.map((log, index) => (
                      <LogItem key={index} log={log} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleClose}>
            {isRunning ? "取消" : "关闭"}
          </Button>
          {!isRunning && !result?.success && (
            <Button 
              onClick={handleStartTest}
              disabled={!config.testLatency && !config.testSpeed}
            >
              <Gauge className="w-4 h-4 mr-1.5" />
              开始测试
            </Button>
          )}
          {result && !isRunning && (
            <Button onClick={handleStartTest}>
              重新测试
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
