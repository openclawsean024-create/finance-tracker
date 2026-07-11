// 通用工具函式
export function formatNTD(n: number): string {
  return 'NT$ ' + Math.round(n).toLocaleString('zh-TW');
}

export function formatDate(ts: number | string): string {
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(yearMonth: string): { start: number; end: number } {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = new Date(y, m - 1, 1).getTime();
  const end = new Date(y, m, 1).getTime() - 1;
  return { start, end };
}

// 計算兩個日期相差天數（b - a）
export function daysBetween(a: number, b: number): number {
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
