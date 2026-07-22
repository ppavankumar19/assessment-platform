/**
 * Centralized API client for all frontend pages.
 * Reads the Supabase access token from localStorage and attaches it to every request.
 */

const BASE = ''  // Same origin — Fastify serves both API and static files

function getToken() {
  return localStorage.getItem('admin_token') || ''
}

async function request(method, path, body, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...options,
  })

  if (res.status === 401) {
    localStorage.removeItem('admin_token')
    window.location.href = '/login.html'
    throw new Error('Unauthorized')
  }

  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res
  }

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  delete: (path)        => request('DELETE', path),

  // Authenticated user
  getUser: () => api.get('/api/auth/user'),

  // Admin - rounds
  getRounds:       ()        => api.get('/api/admin/rounds'),
  createRound:     (body)    => api.post('/api/admin/rounds', body),
  getRound:        (id)      => api.get(`/api/admin/rounds/${id}`),
  updateRound:     (id, body)=> api.put(`/api/admin/rounds/${id}`, body),
  deleteRound:     (id)      => api.delete(`/api/admin/rounds/${id}`),
  publishRound:    (id)      => api.post(`/api/admin/rounds/${id}/publish`, {}),
  unpublishRound:  (id)      => api.post(`/api/admin/rounds/${id}/unpublish`, {}),
  pauseRound:      (id)      => api.post(`/api/admin/rounds/${id}/pause`, {}),
  getRoundSessions:(id)      => api.get(`/api/admin/rounds/${id}/sessions`),
  exportRound:     (id, fin) => request('GET', `/api/admin/rounds/${id}/export${fin ? '?finalized=true' : ''}`),

  // Admin - questions
  createQuestion: (body)    => api.post('/api/admin/questions', body),
  updateQuestion: (id, body)=> api.put(`/api/admin/questions/${id}`, body),
  deleteQuestion: (id)      => api.delete(`/api/admin/questions/${id}`),

  // Admin - sessions
  getSession:        (id)   => api.get(`/api/admin/sessions/${id}`),
  deleteSession:     (id)   => api.delete(`/api/admin/sessions/${id}`),
  disqualifySession: (id)   => api.post(`/api/admin/sessions/${id}/disqualify`, {}),

  // Admin - library
  getLibrary:        (type, search) => api.get(`/api/admin/library${type ? `?type=${type}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  createLibraryQ:    (body)  => api.post('/api/admin/library', body),
  updateLibraryQ:    (id, body) => api.put(`/api/admin/library/${id}`, body),
  deleteLibraryQ:    (id)   => api.delete(`/api/admin/library/${id}`),
  importLibraryQ:    (id, round_id, order_index) => api.post(`/api/admin/library/${id}/import`, { round_id, order_index }),

  // Test (public - no auth token)
  getPublicRounds: () => fetch('/api/test/rounds').then(r => r.json()),
  registerCandidate: (roundId, body) =>
    fetch(`/api/test/${roundId}/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),
  startSession: (roundId, session_token) =>
    fetch(`/api/test/${roundId}/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token }),
    }).then(r => r.json()),
  getQuestions: (roundId, token, includeHidden = false) =>
    fetch(`/api/test/${roundId}/questions?token=${encodeURIComponent(token)}${includeHidden ? '&include_hidden=true' : ''}`)
      .then(r => r.json()),

  // Submit MCQ, output prediction, or coding answer (server-side scoring)
  submitAnswer: (body) =>
    fetch('/api/test/answer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),

  // Run code against visible test cases (no submission saved)
  executeC: (session_token, code, test_cases) =>
    fetch('/api/test/execute-c', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token, code, test_cases }),
    }).then(r => r.json()),

  executePy: (session_token, code, test_cases) =>
    fetch('/api/test/execute-py', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token, code, test_cases }),
    }).then(r => r.json()),

  getSessionStatus: (sessionId, token) =>
    fetch(`/api/test/session/${sessionId}/status?token=${encodeURIComponent(token)}`).then(r => r.json()),
  completeSession: (sessionId, session_token) =>
    fetch(`/api/test/session/${sessionId}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token }),
    }).then(r => r.json()),
  logEvent: (sessionId, session_token, event_type, event_data = {}) =>
    fetch(`/api/test/session/${sessionId}/event`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token, event_type, event_data }),
    }).then(r => r.json()).catch(() => {}),
}

export default api
