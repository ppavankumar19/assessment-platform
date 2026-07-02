export function normalizeOutput(raw) {
  if (raw === null || raw === undefined) return ''
  return String(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

export function computeDerivedMetrics(m) {
  const totalMs = m.total_active_time_ms || 0
  const keys = m.total_keystrokes || 0
  const chars_per_minute = totalMs > 0 ? Math.round((keys / (totalMs / 60000)) * 10) / 10 : 0
  const wpm_equivalent  = Math.round(chars_per_minute / 5 * 10) / 10
  return { chars_per_minute, wpm_equivalent }
}
