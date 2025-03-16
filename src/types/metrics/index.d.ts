declare module '../config/metrics' {
  export function initMetrics(): void;
  export function recordMetric(name: string, value: number, tags?: Record<string, string>): void;
  export function incrementCounter(name: string, tags?: Record<string, string>): void;
  export function startTimer(name: string, tags?: Record<string, string>): () => void;
  export function recordHttpRequest(req: any, res: any, startTime: number): void;
}