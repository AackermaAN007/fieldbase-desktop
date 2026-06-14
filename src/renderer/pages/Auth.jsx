import React, { useState } from 'react'

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function switchMode(m) { setMode(m); setError('') }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    if (!form.email || !form.password) { setError('Email and password are required.'); return }
    setLoading(true)
    const result = await window.electron.auth.login({ email: form.email, password: form.password })
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    onAuth(result.account)
  }

  async function handleSignup(e) {
    e.preventDefault()
    setError('')
    if (!form.name || !form.email || !form.password) { setError('All fields are required.'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    const result = await window.electron.auth.signup({ email: form.email, password: form.password, name: form.name })
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    onAuth(result.account)
  }

  async function handleGoogle() {
    setError('')
    setLoading(true)
    const result = await window.electron.auth.google()
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    onAuth(result.account)
  }

  return (
    <AuthShell>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>
            {mode === 'login' ? 'Sign in to Fieldbase' : 'Create your account'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            {mode === 'login' ? 'Welcome back.' : 'Get started for free.'}
          </div>
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          {/* Google */}
          <OAuthBtn onClick={handleGoogle} disabled={loading}>
            <GoogleIcon /> Continue with Google
          </OAuthBtn>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>or continue with email</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Error */}
          {error && <ErrorBox msg={error} />}

          {/* Form */}
          <form onSubmit={mode === 'login' ? handleLogin : handleSignup}>
            {mode === 'signup' && (
              <div className="form-group">
                <label>Full Name</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Smith" autoFocus={mode === 'signup'} />
              </div>
            )}
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" autoFocus={mode === 'login'} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <PasswordField value={form.password} onChange={v => set('password', v)} placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'} />
            </div>
            {mode === 'signup' && (
              <div className="form-group">
                <label>Confirm Password</label>
                <PasswordField value={form.confirm} onChange={v => set('confirm', v)} placeholder="••••••••" />
              </div>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: 12, fontSize: 15, justifyContent: 'center', marginTop: 4 }} disabled={loading}>
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
            {mode === 'login' ? (
              <>No account?{' '}<span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => switchMode('signup')}>Create one →</span></>
            ) : (
              <>Already have an account?{' '}<span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => switchMode('login')}>Sign in →</span></>
            )}
          </p>
        </div>
      </div>
    </AuthShell>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AuthShell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: '0 auto 14px',
            background: 'var(--surface)', border: '1px solid var(--navy-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(255,107,53,0.25)',
          }}>
            <svg viewBox="0 0 64 64" width="46" height="46" xmlns="http://www.w3.org/2000/svg">
              <rect x="10" y="26" width="12" height="24" rx="3" fill="rgba(255,255,255,0.9)" />
              <rect x="26" y="34" width="10" height="16" rx="3" fill="rgba(255,255,255,0.55)" />
              <rect x="40" y="30" width="12" height="20" rx="3" fill="#FF6B35" />
              <line x1="8" y1="51" x2="56" y2="51" stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" />
              <circle cx="16" cy="20" r="6" fill="#FF6B35" />
              <circle cx="16" cy="20" r="10" fill="none" stroke="#FF6B35" strokeWidth="1.5" opacity="0.35" />
            </svg>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>
            <span style={{ color: '#FF6B35' }}>Field</span><span style={{ fontWeight: 300 }}>base</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Field operations &amp; business management
          </div>
        </div>

        {children}

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'var(--text-muted)' }}>
          Synced securely to the cloud &nbsp;·&nbsp; 🔒 Private &amp; secure
        </p>
      </div>
    </div>
  )
}

function OAuthBtn({ onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        width: '100%', padding: '11px 16px',
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 10, color: 'var(--text)',
        fontSize: 14, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'opacity 0.15s, border-color 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function PasswordField({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ paddingRight: 40 }}
      />
      <button type="button" onClick={() => setShow(s => !s)} style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-muted)', fontSize: 12, padding: '2px 4px',
      }}>
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

function ErrorBox({ msg }) {
  return (
    <div style={{
      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13, marginBottom: 14,
    }}>{msg}</div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
