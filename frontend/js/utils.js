/**
 * Shared utilities used across all frontend pages.
 */

// ---- Toast notifications ----

let toastContainer = null

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.id = 'toast-container'
    document.body.appendChild(toastContainer)
  }
  return toastContainer
}

export function toast(message, type = 'info', duration = 3500) {
  const c = getToastContainer()
  const el = document.createElement('div')
  el.className = `toast ${type}`
  el.textContent = message
  c.appendChild(el)
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transition = 'opacity 0.3s'
    setTimeout(() => el.remove(), 300)
  }, duration)
}

export const toastSuccess = (msg, dur) => toast(msg, 'success', dur)
export const toastError   = (msg, dur) => toast(msg, 'error',   dur)
export const toastWarning = (msg, dur) => toast(msg, 'warning', dur)
export const toastInfo    = (msg, dur) => toast(msg, 'info',    dur)

// ---- Time formatting ----

export function formatTime(ms) {
  if (ms <= 0) return '0:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

export function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

export function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h/24)}d ago`
}

// ---- DOM helpers ----

export function qs(sel, root = document) { return root.querySelector(sel) }
export function qsa(sel, root = document) { return [...root.querySelectorAll(sel)] }

export function show(el) { if (el) el.classList.remove('hidden') }
export function hide(el) { if (el) el.classList.add('hidden') }
export function toggle(el, visible) { visible ? show(el) : hide(el) }

export function setText(sel, text, root = document) {
  const el = root.querySelector(sel)
  if (el) el.textContent = text
}

export function setHTML(sel, html, root = document) {
  const el = root.querySelector(sel)
  if (el) el.innerHTML = html
}

// ---- Modal ----

export function openModal(id) {
  const m = document.getElementById(id)
  if (m) m.classList.add('open')
}

export function closeModal(id) {
  const m = document.getElementById(id)
  if (m) m.classList.remove('open')
}

// Close modal on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('open')
  }
})

// Close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'))
  }
})

// ---- Confirm dialog ----

export function confirm(message, onConfirm, title = 'Are you sure?') {
  const backdrop = document.getElementById('confirm-modal')
  if (!backdrop) return

  document.getElementById('confirm-title').textContent = title
  document.getElementById('confirm-msg').textContent = message

  // Clone to remove all previously stacked listeners before adding new one
  const oldBtn = document.getElementById('confirm-ok')
  const confirmBtn = oldBtn.cloneNode(true)
  oldBtn.parentNode.replaceChild(confirmBtn, oldBtn)

  const cancelBtn = document.getElementById('confirm-cancel')

  confirmBtn.addEventListener('click', () => {
    backdrop.classList.remove('open')
    onConfirm()
  })
  cancelBtn.onclick = () => { backdrop.classList.remove('open') }

  backdrop.classList.add('open')
}

// ---- Supabase helpers ----

export function getSupabaseConfig() {
  // These are injected into the window by each HTML page
  return {
    url:     window.SUPABASE_URL  || '',
    anonKey: window.SUPABASE_ANON || '',
  }
}

// ---- Local storage session (test flow) ----

export function saveTestSession(roundId, data) {
  localStorage.setItem(`test_session_${roundId}`, JSON.stringify(data))
}

export function loadTestSession(roundId) {
  try {
    const raw = localStorage.getItem(`test_session_${roundId}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearTestSession(roundId) {
  localStorage.removeItem(`test_session_${roundId}`)
}

// ---- Badge helpers ----

export function statusBadge(status) {
  const map = {
    registered:   ['gray',   'Registered'],
    started:      ['indigo', 'In Progress'],
    completed:    ['green',  'Completed'],
    disqualified: ['red',    'Disqualified'],
  }
  const [color, label] = map[status] || ['gray', status]
  return `<span class="badge badge-${color}">${label}</span>`
}

export function roundStatusBadge(round) {
  if (!round.is_published) return `<span class="badge badge-gray">Draft</span>`
  if (!round.is_active)    return `<span class="badge badge-amber">Paused</span>`
  return `<span class="badge badge-green">Live</span>`
}

export function roundTypeBadge(type) {
  const map = {
    output_prediction: ['blue',  'Output Prediction'],
    mcq:               ['indigo','MCQ'],
    coding:            ['amber', 'Coding'],
    c_programming:     ['amber', 'C Programming'],
    // legacy
    live_coding:       ['gray',  'Live Coding'],
  }
  const [color, label] = map[type] || ['gray', type]
  return `<span class="badge badge-${color}">${label}</span>`
}

// ---- HTML escaping ----

export function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ---- Score helpers ----

export function scoreColor(score, cutoff) {
  if (cutoff != null && score >= cutoff) return 'text-success'
  if (score > 0) return 'text-warning'
  return 'text-danger'
}
