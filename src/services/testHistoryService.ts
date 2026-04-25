export interface TestHistoryRecord {
  nodeName: string;
  nodeId: number;
  timestamp: number;
  latency?: number;
  downloadSpeed?: number;
  success: boolean;
  error?: string;
}

const STORAGE_KEY = "node_test_history";
const MAX_HISTORY_PER_NODE = 50;

export function getTestHistory(): TestHistoryRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function getNodeTestHistory(nodeName: string): TestHistoryRecord[] {
  const history = getTestHistory();
  return history
    .filter((r) => r.nodeName === nodeName)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function addTestHistory(record: TestHistoryRecord): void {
  const history = getTestHistory();
  history.unshift(record);
  
  const grouped: Record<string, TestHistoryRecord[]> = {};
  history.forEach((r) => {
    if (!grouped[r.nodeName]) {
      grouped[r.nodeName] = [];
    }
    if (grouped[r.nodeName].length < MAX_HISTORY_PER_NODE) {
      grouped[r.nodeName].push(r);
    }
  });
  
  const filtered: TestHistoryRecord[] = [];
  Object.values(grouped).forEach((records) => {
    filtered.push(...records);
  });
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function getTestStats(records: TestHistoryRecord[]): {
  latencyMin?: number;
  latencyMax?: number;
  latencyAvg?: number;
  speedMin?: number;
  speedMax?: number;
  speedAvg?: number;
  successRate: number;
  totalTests: number;
} {
  const latencyRecords = records.filter((r) => r.latency != null);
  const speedRecords = records.filter((r) => r.downloadSpeed != null);
  const successRecords = records.filter((r) => r.success);

  const stats = {
    latencyMin: latencyRecords.length > 0 ? Math.min(...latencyRecords.map((r) => r.latency!)) : undefined,
    latencyMax: latencyRecords.length > 0 ? Math.max(...latencyRecords.map((r) => r.latency!)) : undefined,
    latencyAvg: latencyRecords.length > 0 ? latencyRecords.reduce((sum, r) => sum + (r.latency || 0), 0) / latencyRecords.length : undefined,
    speedMin: speedRecords.length > 0 ? Math.min(...speedRecords.map((r) => r.downloadSpeed!)) : undefined,
    speedMax: speedRecords.length > 0 ? Math.max(...speedRecords.map((r) => r.downloadSpeed!)) : undefined,
    speedAvg: speedRecords.length > 0 ? speedRecords.reduce((sum, r) => sum + (r.downloadSpeed || 0), 0) / speedRecords.length : undefined,
    successRate: records.length > 0 ? (successRecords.length / records.length) * 100 : 0,
    totalTests: records.length,
  };

  return stats;
}
