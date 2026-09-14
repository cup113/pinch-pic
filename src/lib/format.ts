export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

export function savingsPercent(originalSize: number, artifactSize: number): number {
  if (originalSize <= 0) return 0;
  return ((originalSize - artifactSize) / originalSize) * 100;
}

export function savingsLabel(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return '±0%';
  return `${rounded > 0 ? '省' : '增'} ${Math.abs(rounded)}%`;
}

export function savingsTone(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return 'text-ink-400';
  return rounded > 0 ? 'text-emerald-600' : 'text-red-500';
}
