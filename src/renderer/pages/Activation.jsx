import React, { useState } from 'react'

export default function Activation({ onActivate, initialTab = 'activate' }) {
  const [tab, setTab] = useState(initialTab) // 'activate' | 'login'
  const [key, setKey] = useState('')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function formatKey(val) {
    const clean = val.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16)
    return clean.match(/.{1,4}/g)?.join('-') || clean
  }

  async function handleActivate() {
    setError('')
    const clean = key.replace(/-/g, '')
    if (clean.length !== 16) {
      setError('Please enter a complete 16-character license key.')
      return
    }
    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }
    setLoading(true)
    try {
      const result = await window.electron.license.activate({ key, email })
      if (!result.success) {
        setError(result.error || 'Activation failed.')
        setLoading(false)
        return
      }
      await window.electron.settings.set({
        license_key: key,
        license_email: email,
        license_activated_at: new Date().toISOString(),
        app_pin: pin || null,
      })
      onActivate({ email, hasPin: !!pin })
    } catch (e) {
      setError('Activation failed. Please try again.')
    }
    setLoading(false)
  }

  async function handleLogin() {
    setError('')
    if (!pin.trim()) { setError('Enter your PIN.'); return }
    setLoading(true)
    try {
      const settings = await window.electron.settings.get()
      if (settings.app_pin && settings.app_pin !== pin) {
        setError('Incorrect PIN. Try again.')
        setLoading(false)
        return
      }
      onActivate({ email: settings.license_email, hasPin: true })
    } catch (e) {
      setError('Login failed.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 460 }}>

        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, #4f7ef8, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 28,
          }}>⚡</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>Fieldbase</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Professional invoicing for contractors
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {[['activate', 'Activate License'], ['login', 'Sign In']].map(([id, label]) => (
              <button key={id} onClick={() => { setTab(id); setError('') }} style={{
                flex: 1, padding: '16px 0', border: 'none', cursor: 'pointer',
                background: tab === id ? 'var(--surface)' : 'var(--surface2)',
                color: tab === id ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: tab === id ? 600 : 400, fontSize: 14,
                borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>

          <div style={{ padding: 32 }}>
            {tab === 'activate' ? (
              <>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Enter your license key</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    You received this key by email after purchase.
                  </div>
                </div>

                <div className="form-group">
                  <label>License Key</label>
                  <input
                    value={key}
                    onChange={e => setKey(formatKey(e.target.value))}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    style={{ fontFamily: 'monospace', fontSize: 18, letterSpacing: 2, textAlign: 'center', textTransform: 'uppercase' }}
                    maxLength={19}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                    Must match the email used at purchase.
                  </div>
                </div>

                <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', marginBottom: 20, fontSize: 13 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Optional: Set an app PIN</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>
                    Protects your client data if someone else uses this computer.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11 }}>PIN</label>
                      <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" />
                    </div>
                    <div>
                      <label style={{ fontSize: 11 }}>Confirm PIN</label>
                      <input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} placeholder="••••" />
                    </div>
                  </div>
                  {pin && confirmPin && pin !== confirmPin && (
                    <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>PINs don't match</div>
                  )}
                </div>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>
                    {error}
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: 15, justifyContent: 'center' }}
                  onClick={handleActivate}
                  disabled={loading || (pin && pin !== confirmPin)}
                >
                  {loading ? 'Activating…' : 'Activate & Get Started'}
                </button>

                <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                  Don't have a license?{' '}
                  <span style={{ color: 'var(--accent)', cursor: 'pointer' }}
                    onClick={() => window.open && alert('Visit our website to purchase a license.')}>
                    Purchase here →
                  </span>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Welcome back</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Enter your PIN to unlock Fieldbase.
                  </div>
                </div>

                <div className="form-group">
                  <label>App PIN</label>
                  <input
                    type="password"
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    placeholder="Enter PIN"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  />
                </div>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>
                    {error}
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: 15, justifyContent: 'center' }}
                  onClick={handleLogin}
                  disabled={loading}
                >
                  {loading ? 'Signing in…' : 'Unlock App'}
                </button>

                <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                  New install?{' '}
                  <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setTab('activate')}>
                    Activate a license key →
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-muted)' }}>
          This software is licensed per device. Sharing keys is a violation of the license agreement.
        </div>
      </div>
    </div>
  )
}
