import type { SpeedMetricsPayload } from '@/types/database';

export function computeDerivedMetrics(payload: SpeedMetricsPayload) {
  const netKeystrokes = payload.total_keystrokes - payload.delete_count;
  const activeMinutes = payload.total_active_time_ms / 60_000;
  const chars_per_minute = activeMinutes > 0 ? netKeystrokes / activeMinutes : 0;
  const wpm_equivalent = chars_per_minute / 5;
  const total_idle_ms = payload.idle_periods.reduce(
    (sum, p) => sum + (p.end_ms - p.start_ms), 0
  );
  const idle_fraction =
    payload.total_active_time_ms + total_idle_ms > 0
      ? total_idle_ms / (payload.total_active_time_ms + total_idle_ms)
      : 0;

  return {
    chars_per_minute: Math.round(chars_per_minute * 10) / 10,
    wpm_equivalent: Math.round(wpm_equivalent * 10) / 10,
    total_idle_ms,
    idle_fraction: Math.round(idle_fraction * 1000) / 1000,
  };
}
