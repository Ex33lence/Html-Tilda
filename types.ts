
export type DeviceType = 'desktop' | 'monitor' | 'laptop' | 'tablet' | 'iphone' | 'xiaomi';

export interface DeviceConfig {
  width: number;
  height: number;
  label: string;
  frame?: 'none' | 'laptop' | 'tablet' | 'phone' | 'monitor' | 'desktop';
}

export interface VersionEntry {
  id: string;
  code: string;
  timestamp: number;
  size: number;
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'event';
  message: string;
  time: number;
}

export enum TabType {
  CODE = 'code',
  MEDIA = 'media',
  EMOJI = 'emoji',
  LOG = 'log',
  PERF = 'perf'
}

export interface CodeStats {
  chars: number;
  words: number;
  lines: number;
  sizeKb: string;
}

export interface PerformanceData {
  score: number;
  metrics: {
    fcp: string;
    lcp: string;
    cls: string;
    tbt: string;
  };
  suggestions: string[];
}
