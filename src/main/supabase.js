const SUPABASE_URL = 'https://pufsvutxdxwmwgmpireq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZnN2dXR4ZHh3bXdnbXBpcmVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNjA2NTIsImV4cCI6MjA5NjkzNjY1Mn0.iM1nIaUcm833pWPf2gRUe7ZDiTISftgJh0tuykDzXW4'

// In-memory session (desktop main process)
let _session = null

function setSession(session) { _session = session }
function getSession() { return _session }
function clearSession() { _session = null }

function authHeaders() {
  if (!_session?.access_token) return null
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${_session.access_token}`,
    'Content-Type': 'application/json',
  }
}

// ── REST helpers ─────────────────────────────────────────────────────────────

const log = require('./logger')

async function sbFetch(path, options = {}) {
  const headers = authHeaders()
  if (!headers) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } })
    if (!res.ok) {
      const err = await res.text()
      log.warn(`[cloud] ${options.method || 'GET'} ${path} → ${res.status}: ${err}`)
      return null
    }
    const text = await res.text()
    return text ? JSON.parse(text) : null
  } catch (e) {
    log.warn(`[cloud] fetch error: ${e.message}`)
    return null
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

async function signUp(email, password, name) {
  // Use edge function to create user with auto-confirmation
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password, name }),
    })
    const data = await res.json()
    if (data.error) return { error: data.error }
    // Now sign in to get a session
    return await signIn(email, password)
  } catch (e) {
    return { error: e.message }
  }
}

async function signIn(email, password) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (data.error || data.error_description) return { error: data.error_description || data.error }
    _session = data
    return { session: data, user: data.user }
  } catch (e) {
    return { error: e.message }
  }
}

async function refreshSession(refreshToken) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    const data = await res.json()
    if (data.error || data.error_description) return null
    _session = data
    return data
  } catch { return null }
}

async function signOut() {
  if (_session?.access_token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${_session.access_token}` },
    }).catch(() => {})
  }
  _session = null
}

// ── Cloud sync helpers ────────────────────────────────────────────────────────

function accountId() { return _session?.user?.id || null }

async function cloudInsert(table, data) {
  const aid = accountId()
  if (!aid) return null
  const row = { ...data, account_id: aid }
  const result = await sbFetch(`${table}?select=id`, {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify(row),
  })
  return Array.isArray(result) ? result[0]?.id : result?.id
}

async function cloudUpdate(table, cloudId, data) {
  if (!accountId() || !cloudId) return
  await sbFetch(`${table}?id=eq.${cloudId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

async function cloudDelete(table, cloudId) {
  if (!accountId() || !cloudId) return
  await sbFetch(`${table}?id=eq.${cloudId}`, { method: 'DELETE' })
}

async function cloudSelect(table, params = '') {
  return await sbFetch(`${table}?account_id=eq.${accountId()}${params ? '&' + params : ''}`)
}

// Map local invoice fields → Supabase invoice fields
function mapInvoiceToCloud(inv, clientCloudId) {
  return {
    invoice_number: inv.number || inv.invoice_number,
    client_id: clientCloudId || null,
    client_name: inv.client_name || null,
    issue_date: inv.date || inv.issue_date || null,
    due_date: inv.due_date || null,
    status: inv.status || 'draft',
    tax_rate: Number(inv.tax_rate) || 0,
    discount_pct: Number(inv.discount_pct) || 0,
    notes: inv.notes || null,
    line_items: typeof inv.items === 'string' ? (() => { try { return JSON.parse(inv.items) } catch { return [] } })() : (inv.items || inv.line_items || []),
    type: inv.type || 'invoice',
  }
}

module.exports = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  setSession, getSession, clearSession,
  signUp, signIn, refreshSession, signOut,
  cloudInsert, cloudUpdate, cloudDelete, cloudSelect,
  mapInvoiceToCloud,
  accountId,
}
