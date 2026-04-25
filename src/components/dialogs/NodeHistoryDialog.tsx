import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Clock, Download, BarChart3 } from "lucide-react";
import { getNodeTestHistory, getTestStats, type TestHistoryRecord } from "@/services/testHistoryService";

interface NodeHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  nodeName: string;
  nodeId: number;
  type: "latency" | "speed";
}

export function NodeHistoryDialog({ isOpen, onClose, nodeName, nodeId: _nodeId, type }: NodeHistoryDialogProps) {
  const [history, setHistory] = useState<TestHistoryRecord[]>([]);

  useEffect(() => {
    if (isOpen) {
      setHistory(getNodeTestHistory(nodeName));
    }
  }, [isOpen, nodeName]);

  const stats = useMemo(() => getTestStats(history), [history]);

  const formatSpeed = (speedMbps: number): string => {
    if (speedMbps >= 1000) {
      return `${(speedMbps / 1000).toFixed(2)} Gbps`;
    }
    return `${speedMbps.toFixed(2)} Mbps`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  };

  const isLatency = type === "latency";

  const chartData = useMemo(() => {
    if (isLatency) {
      return history
        .filter((r) => r.latency != null)
        .slice(0, 20)
        .reverse()
        .map((r) => ({
          time: formatDate(r.timestamp),
          value: r.latency!,
        }));
    } else {
      return history
        .filter((r) => r.downloadSpeed != null)
        .slice(0, 20)
        .reverse()
        .map((r) => ({
          time: formatDate(r.timestamp),
          value: r.downloadSpeed!,
        }));
    }
  }, [history, isLatency]);

  const maxValue = (data: { value: number }[]) => {
    if (data.length === 0) return 100;
    return Math.max(...data.map((d) => d.value)) * 1.1;
  };

  const relevantStats = isLatency
    ? { min: stats.latencyMin, max: stats.latencyMax, avg: stats.latencyAvg }
    : { min: stats.speedMin, max: stats.speedMax, avg: stats.speedAvg };

  const hasData = chartData.length > 0;

  const renderBarChart = () => {
    const max = maxValue(chartData);
    return (
      <div className="h-24 flex items-end gap-1">
        {chartData.map((d, i) => {
          const height = (d.value / max) * 100;
          return (
            <div
              key={i}
              className="flex-1 bg-blue-500 rounded-t transition-all hover:bg-blue-400"
              style={{ height: `${height}%` }}
              title={`${d.time}: ${d.value.toFixed(0)}ms`}
            />
          );
        })}
      </div>
    );
  };

  const renderLineChart = () => {
    const max = maxValue(chartData);
    const width = 100;
    const height = 96;
    const padding = 8;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    if (chartData.length < 2) return null;
    
    const points = chartData.map((d, i) => {
      const x = padding + (i / (chartData.length - 1)) * chartWidth;
      const y = padding + chartHeight - (d.value / max) * chartHeight;
      return { x, y, value: d.value, time: d.time };
    });
    
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24">
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-green-500"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            className="fill-green-500"
          >
            <title>{`${p.time}: ${formatSpeed(p.value)}`}</title>
          </circle>
        ))}
      </svg>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            {isLatency ? "延迟历史" : "速度历史"}
          </DialogTitle>
          <DialogDescription>
            节点: {nodeName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!hasData ? (
            <div className="text-center text-muted-foreground py-8">
              暂无{isLatency ? "延迟" : "速度"}测试历史
            </div>
          ) : (
            <>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  {isLatency ? <Clock className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                  {isLatency ? "延迟统计" : "速度统计"}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">最低:</span>
                    <span className="text-green-600">
                      {isLatency ? `${relevantStats.min?.toFixed(0)}ms` : formatSpeed(relevantStats.min!)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">最高:</span>
                    <span className="text-red-600">
                      {isLatency ? `${relevantStats.max?.toFixed(0)}ms` : formatSpeed(relevantStats.max!)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">平均:</span>
                    <span>
                      {isLatency ? `${relevantStats.avg?.toFixed(0)}ms` : formatSpeed(relevantStats.avg!)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">测试次数:</span>
                  <span>{stats.totalTests}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">成功率:</span>
                  <span className={stats.successRate >= 80 ? "text-green-600" : stats.successRate >= 50 ? "text-yellow-600" : "text-red-600"}>
                    {stats.successRate.toFixed(0)}%
                  </span>
                </div>
              </div>

              {chartData.length > 1 && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                    {isLatency ? <Clock className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                    {isLatency ? "延迟趋势" : "速度趋势"}
                  </div>
                  {isLatency ? renderBarChart() : renderLineChart()}
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{chartData[0]?.time}</span>
                    <span>{chartData[chartData.length - 1]?.time}</span>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground text-center">
                显示最近 20 次测试记录
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
