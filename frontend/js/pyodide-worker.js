// Pyodide Web Worker — runs Python code in the browser via WebAssembly
importScripts('https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js')

let pyodide = null

async function initPyodide() {
  pyodide = await loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
  })
  self.postMessage({ type: 'ready' })
}

initPyodide().catch(err => {
  self.postMessage({ type: 'error', error: err.message })
})

self.onmessage = async (event) => {
  const { id, code, testCases } = event.data

  if (!pyodide) {
    self.postMessage({ type: 'result', id, results: testCases.map(tc => ({
      case_id: tc.id, passed: false, stdout: '', stderr: 'Python not ready', status: 'Error',
      time_ms: 0, score: 0, is_hidden: tc.is_hidden || false, expected_output: tc.expected_output || '',
    })) })
    return
  }

  const results = []

  for (const tc of testCases) {
    const start = Date.now()
    try {
      // Redirect stdin, capture stdout/stderr
      pyodide.runPython(`
import sys, io
_stdout = io.StringIO()
_stderr = io.StringIO()
sys.stdin = io.StringIO(${JSON.stringify(tc.input || '')})
sys.stdout = _stdout
sys.stderr = _stderr
      `)

      pyodide.runPython(code)

      const stdout = pyodide.runPython('_stdout.getvalue()') || ''
      const stderr = pyodide.runPython('_stderr.getvalue()') || ''

      const elapsed = Date.now() - start
      const got      = normalizeOutput(stdout)
      const expected = normalizeOutput(tc.expected_output || '')
      const passed   = got === expected

      results.push({
        case_id:         tc.id,
        passed,
        stdout:          stdout.trim(),
        stderr:          stderr.trim(),
        status:          passed ? 'Accepted' : 'Wrong Answer',
        time_ms:         elapsed,
        score:           passed ? (tc.points || 0) : 0,
        is_hidden:       tc.is_hidden || false,
        expected_output: tc.expected_output || '',
      })
    } catch (err) {
      const elapsed = Date.now() - start
      results.push({
        case_id:         tc.id,
        passed:          false,
        stdout:          '',
        stderr:          String(err),
        status:          'Runtime Error',
        time_ms:         elapsed,
        score:           0,
        is_hidden:       tc.is_hidden || false,
        expected_output: tc.expected_output || '',
      })
    } finally {
      // Restore stdout/stderr
      try { pyodide.runPython('sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__') } catch {}
    }
  }

  self.postMessage({ type: 'result', id, results })
}

function normalizeOutput(raw) {
  if (!raw) return ''
  return String(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}
