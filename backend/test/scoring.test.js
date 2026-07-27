import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeOutput, computeDerivedMetrics } from '../lib/scoring.js'

// ── normalizeOutput ───────────────────────────────────────────────────────────

describe('normalizeOutput', () => {
  test('returns empty string for null', () => {
    assert.equal(normalizeOutput(null), '')
  })

  test('returns empty string for undefined', () => {
    assert.equal(normalizeOutput(undefined), '')
  })

  test('returns empty string for empty string', () => {
    assert.equal(normalizeOutput(''), '')
  })

  test('normalizes Windows CRLF line endings to LF', () => {
    assert.equal(normalizeOutput('hello\r\nworld'), 'hello\nworld')
  })

  test('normalizes old Mac CR line endings to LF', () => {
    assert.equal(normalizeOutput('hello\rworld'), 'hello\nworld')
  })

  test('normalizes mixed CRLF and CR', () => {
    assert.equal(normalizeOutput('a\r\nb\rc'), 'a\nb\nc')
  })

  test('trims leading whitespace', () => {
    assert.equal(normalizeOutput('  hello'), 'hello')
  })

  test('trims trailing whitespace', () => {
    assert.equal(normalizeOutput('hello  '), 'hello')
  })

  test('trims trailing newline', () => {
    assert.equal(normalizeOutput('hello\n'), 'hello')
  })

  test('trims leading and trailing whitespace', () => {
    assert.equal(normalizeOutput('  hello  '), 'hello')
  })

  test('preserves internal newlines', () => {
    assert.equal(normalizeOutput('line1\nline2'), 'line1\nline2')
  })

  test('coerces number to string', () => {
    assert.equal(normalizeOutput(42), '42')
  })

  test('coerces boolean to string', () => {
    assert.equal(normalizeOutput(true), 'true')
  })

  test('handles multi-line output with CRLF + trim', () => {
    assert.equal(normalizeOutput('\r\nhello\r\nworld\r\n'), 'hello\nworld')
  })

  test('two identical outputs compare equal after normalization', () => {
    const expected = 'Output: 42'
    const got = '  Output: 42\r\n'
    assert.equal(normalizeOutput(got), normalizeOutput(expected))
  })

  test('two different outputs compare not equal after normalization', () => {
    assert.notEqual(normalizeOutput('42'), normalizeOutput('43'))
  })
})

// ── computeDerivedMetrics ─────────────────────────────────────────────────────

describe('computeDerivedMetrics', () => {
  test('returns zero CPM and WPM when total_active_time_ms is 0', () => {
    const result = computeDerivedMetrics({ total_active_time_ms: 0, total_keystrokes: 100 })
    assert.equal(result.chars_per_minute, 0)
    assert.equal(result.wpm_equivalent, 0)
  })

  test('returns zero when total_active_time_ms is missing', () => {
    const result = computeDerivedMetrics({ total_keystrokes: 50 })
    assert.equal(result.chars_per_minute, 0)
    assert.equal(result.wpm_equivalent, 0)
  })

  test('returns zero when total_keystrokes is 0', () => {
    const result = computeDerivedMetrics({ total_active_time_ms: 60000, total_keystrokes: 0 })
    assert.equal(result.chars_per_minute, 0)
    assert.equal(result.wpm_equivalent, 0)
  })

  test('correctly computes CPM for 60 keystrokes in 60 seconds', () => {
    const result = computeDerivedMetrics({ total_active_time_ms: 60_000, total_keystrokes: 60 })
    assert.equal(result.chars_per_minute, 60)
  })

  test('correctly computes CPM for 120 keystrokes in 60 seconds', () => {
    const result = computeDerivedMetrics({ total_active_time_ms: 60_000, total_keystrokes: 120 })
    assert.equal(result.chars_per_minute, 120)
  })

  test('correctly computes CPM for 300 keystrokes in 2 minutes', () => {
    const result = computeDerivedMetrics({ total_active_time_ms: 120_000, total_keystrokes: 300 })
    assert.equal(result.chars_per_minute, 150)
  })

  test('WPM is CPM divided by 5', () => {
    const result = computeDerivedMetrics({ total_active_time_ms: 60_000, total_keystrokes: 250 })
    assert.equal(result.wpm_equivalent, result.chars_per_minute / 5)
  })

  test('rounds CPM to one decimal place', () => {
    // 100 keys / (30000ms / 60000) = 200 keys/min → exactly 200.0
    const result = computeDerivedMetrics({ total_active_time_ms: 30_000, total_keystrokes: 100 })
    assert.equal(result.chars_per_minute, 200)
  })

  test('handles fractional CPM (rounds to 1 decimal)', () => {
    // 1 key / 60s = 1.0 CPM
    const result = computeDerivedMetrics({ total_active_time_ms: 60_000, total_keystrokes: 1 })
    assert.equal(result.chars_per_minute, 1)
    assert.equal(result.wpm_equivalent, 0.2)
  })

  test('returns object with exactly chars_per_minute and wpm_equivalent', () => {
    const result = computeDerivedMetrics({ total_active_time_ms: 60_000, total_keystrokes: 60 })
    assert.deepEqual(Object.keys(result).sort(), ['chars_per_minute', 'wpm_equivalent'])
  })
})
