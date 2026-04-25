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
import { AlertCircle, CheckCircle2, Loader2, Info, AlertTriangle, Zap, Minimize2 } from "lucide-react";
import { speedTestService, type LogEntry, type SpeedTestProgress } from "@/services/speedTestService";

interface BatchSpeedTestDialogProps {
  isOpen: boolean;
  onClose: (isMinimized?: boolean) => void;
  nodeNames: string[];
  onTestComplete?: (results: Map<string, { latency?: number; downloadSpeed?: number; error?: string }>) => void;
}

interface TestConfig {
  testLatency: boolean;
  testSpeed: boolean;
  speedTestSize: number;
}

interface NodeResult {
  nodeName: string;
  latency?: number;
  downloadSpeed?: number;
  error?: string;
  success: boolean;
}

export interface BatchTestState {
  isRunning: boolean;
  config: TestConfig;
  nodeNames: string[];
  progress: {
    current: number;
    total: number;
    currentNodeName: string;
    stage: string;
    nodeProgress?: number;
    nodeMessage?: string;
  } | null;
  results: NodeResult[];
  logs: LogEntry[];
}

let globalState: BatchTestState = {
  isRunning: false,
  config: { testLatency: true, testSpeed: true, speedTestSize: 100 },
  nodeNames: [],
  progress: null,
  results: [],
  logs: [],
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(l => l());
}

export function subscribeBatchTestState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getBatchTestState(): BatchTestState {
  return globalState;
}

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

const stageLabels: Record<string, string> = {
  idle: "准备中",
  creating_tunnel: "创建隧道",
  starting_frpc: "启动frpc",
  connecting: "等待连接",
  testing_latency: "测试延迟",
  testing_speed: "测试速度",
  cleaning_up: "清理资源",
  completed: "完成",
  error: "错误",
};

export function BatchSpeedTestDialog({ isOpen, onClose, nodeNames, onTestComplete }: BatchSpeedTestDialogProps) {
  const [config, setConfig] = useState<TestConfig>(globalState.config);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<BatchTestState["progress"]>(null);
  const [results, setResults] = useState<NodeResult[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const stopRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const onTestCompleteRef = useRef(onTestComplete);

  useEffect(() => {
    onTestCompleteRef.current = onTestComplete;
  }, [onTestComplete]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  useEffect(() => {
    if (isOpen) {
      setProgress(globalState.progress);
      setResults(globalState.results);
      setLogs(globalState.logs);
      setIsRunning(globalState.isRunning);
      setConfig(globalState.config);
      stopRef.current = false;
      setIsMinimizing(false);
    }
  }, [isOpen]);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const entry: LogEntry = { timestamp: Date.now(), message, type };
    globalState.logs = [...globalState.logs, entry];
    setLogs(globalState.logs);
    notifyListeners();
  }, []);

  const handleStartTest = useCallback(async () => {
    if (!config.testLatency && !config.testSpeed) {
      return;
    }

    globalState.config = config;
    globalState.isRunning = true;
    globalState.results = [];
    globalState.logs = [];
    globalState.progress = null;
    notifyListeners();

    setIsRunning(true);
    setResults([]);
    setLogs([]);
    stopRef.current = false;

    addLog(`开始批量测试，共 ${nodeNames.length} 个节点`, "info");
    addLog(`配置: 延迟测试=${config.testLatency ? "是" : "否"}, 速度测试=${config.testSpeed ? "是" : "否"}${config.testSpeed ? `, 大小=${config.speedTestSize}MB` : ""}`, "info");

    const newResults: NodeResult[] = [];
    const total = nodeNames.length;

    for (let i = 0; i < nodeNames.length; i++) {
      if (stopRef.current) {
        addLog("用户取消了测试", "warning");
        break;
      }

      const nodeName = nodeNames[i];
      const nodeProgress = { current: i + 1, total, currentNodeName: nodeName, stage: "starting" };
      globalState.progress = nodeProgress;
      setProgress(nodeProgress);
      notifyListeners();

      addLog(`[${i + 1}/${total}] 开始测试节点: ${nodeName}`, "info");

      try {
        const result = await speedTestService.runSpeedTest(
          nodeName,
          (p: SpeedTestProgress) => {
            const stageLabel = stageLabels[p.stage] || p.stage;
            const progressData = {
              current: i + 1,
              total,
              currentNodeName: nodeName,
              stage: stageLabel,
              nodeProgress: p.progress,
              nodeMessage: p.message,
            };
            globalState.progress = progressData;
            setProgress(progressData);
            notifyListeners();
          },
          {
            testLatency: config.testLatency,
            testSpeed: config.testSpeed,
            speedTestSize: config.speedTestSize,
          }
        );

        if (result.success) {
          const nodeResult: NodeResult = {
            nodeName,
            latency: result.latency,
            downloadSpeed: result.downloadSpeed,
            success: true,
          };
          newResults.push(nodeResult);
          
          const latencyStr = result.latency != null ? `${result.latency.toFixed(0)}ms` : "-";
          const speedStr = result.downloadSpeed != null ? `${result.downloadSpeed.toFixed(2)}Mbps` : "-";
          addLog(`[${i + 1}/${total}] ${nodeName} 完成 - 延迟: ${latencyStr}, 速度: ${speedStr}`, "success");
        } else {
          const nodeResult: NodeResult = {
            nodeName,
            error: result.error,
            success: false,
          };
          newResults.push(nodeResult);
          addLog(`[${i + 1}/${total}] ${nodeName} 失败: ${result.error}`, "error");
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "测试失败";
        const nodeResult: NodeResult = {
          nodeName,
          error: errorMsg,
          success: false,
        };
        newResults.push(nodeResult);
        addLog(`[${i + 1}/${total}] ${nodeName} 异常: ${errorMsg}`, "error");
      }

      globalState.results = [...newResults];
      setResults([...newResults]);
      notifyListeners();
    }

    globalState.isRunning = false;
    globalState.progress = null;
    setIsRunning(false);
    setProgress(null);
    notifyListeners();

    if (!stopRef.current && onTestCompleteRef.current) {
      const resultMap = new Map<string, { latency?: number; downloadSpeed?: number; error?: string }>();
      newResults.forEach(r => {
        resultMap.set(r.nodeName, {
          latency: r.latency,
          downloadSpeed: r.downloadSpeed,
          error: r.error,
        });
      });
      onTestCompleteRef.current(resultMap);
    }

    const successCount = newResults.filter(r => r.success).length;
    addLog(`测试完成: ${successCount}/${total} 成功`, successCount === total ? "success" : "warning");
  }, [nodeNames, config, addLog]);

  const handleStop = useCallback(() => {
    stopRef.current = true;
    speedTestService.cancel();
    speedTestService.forceCleanup();
    globalState.isRunning = false;
    globalState.progress = null;
    notifyListeners();
    addLog("已停止测试", "warning");
  }, [addLog]);

  const [isMinimizing, setIsMinimizing] = useState(false);
  const isMinimizingRef = useRef(false);

  useEffect(() => {
    isMinimizingRef.current = isMinimizing;
  }, [isMinimizing]);

  const handleClose = useCallback(() => {
    if (isRunning) {
      handleStop();
    }
    onClose();
  }, [isRunning, handleStop, onClose]);

  const handleMinimize = useCallback(() => {
    setIsMinimizing(true);
    onClose(true);
  }, [onClose]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open && !isMinimizingRef.current) {
      handleClose();
    }
    if (open) {
      setIsMinimizing(false);
    }
  }, [handleClose]);

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            批量速度测试
          </DialogTitle>
          <DialogDescription>
            共 {nodeNames.length} 个节点
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {!isRunning && results.length === 0 && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="batchTestLatency"
                    checked={config.testLatency}
                    onCheckedChange={(checked) =>
                      setConfig(prev => ({ ...prev, testLatency: !!checked }))
                    }
                  />
                  <label htmlFor="batchTestLatency" className="text-sm cursor-pointer">
                    测试延迟
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="batchTestSpeed"
                    checked={config.testSpeed}
                    onCheckedChange={(checked) =>
                      setConfig(prev => ({ ...prev, testSpeed: !!checked }))
                    }
                  />
                  <label htmlFor="batchTestSpeed" className="text-sm cursor-pointer">
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
                    <p className="font-medium mb-1">全部节点测试说明</p>
                    <p className="mt-1">请确保至少有2个隧道配额没有使用，否则测试将失败。</p>
                    <p className="mt-1">批量测试将逐个节点进行，可能需要10+分钟，请耐心等待。</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isRunning && progress && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">
                    正在测试 ({progress.current}/{progress.total})
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleMinimize}
                  className="h-7 px-2"
                >
                  <Minimize2 className="w-3.5 h-3.5 mr-1" />
                  最小化
                </Button>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="text-sm font-medium truncate">{progress.currentNodeName}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{progress.stage}</span>
                  {progress.nodeMessage && (
                    <>
                      <span>-</span>
                      <span>{progress.nodeMessage}</span>
                    </>
                  )}
                </div>
                {progress.nodeProgress != null && progress.nodeProgress > 0 && (
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all duration-200"
                      style={{ width: `${progress.nodeProgress * 100}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>总体进度</span>
                  <span>{progress.current}/{progress.total} ({((progress.current / progress.total) * 100).toFixed(0)}%)</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {logs.length > 0 && (
            <div className="border rounded-lg p-3 bg-muted/30 max-h-40 overflow-y-auto">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                日志 ({logs.length}) - 成功: {successCount}, 失败: {failCount}
              </div>
              <div className="space-y-1.5">
                {logs.map((log, index) => (
                  <LogItem key={index} log={log} />
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            {isRunning ? "取消" : "关闭"}
          </Button>
          {!isRunning && results.length === 0 && (
            <Button
              onClick={handleStartTest}
              disabled={!config.testLatency && !config.testSpeed}
            >
              <Zap className="w-4 h-4 mr-1.5" />
              开始测试
            </Button>
          )}
          {!isRunning && results.length > 0 && (
            <Button onClick={handleStartTest}>
              重新测试
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
