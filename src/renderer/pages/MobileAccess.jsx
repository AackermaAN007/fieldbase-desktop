import React, { useState, useEffect, useCallback } from 'react'

const QR_TTL = 30 * 60 * 1000 // 30 minutes

export default function MobileAccess({ user }) {
  const [qr, setQr] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [expired, setExpired] = useState(false)

  const generate = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    setExpired(false)
    try {
      const result = await window.electron.mobile.generateToken({ account: user })
      setLoading(false)
      if (result?.error) { setError(result.error); return }
      setQr(result)
      setSecondsLeft(1800)
    } catch (e) {
      setLoading(false)
      setError('Failed to generate QR code. Try again.')
    }
  }, [user])

  // Auto-generate on mount
  useEffect(() => { generate() }, [generate])

  // Countdown timer
  useEffect(() => {
    if (!qr || expired) return
    const interval = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { setExpired(true); clearInterval(interval); return 0 } // 30-min TTL
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [qr, expired])

  const mins = Math.floor(secondsLeft / 60)
  const secs = String(secondsLeft % 60).padStart(2, '0')
  const pct = (secondsLeft / 1800) * 100

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Mobile Access</div>
          <div className="page-subtitle">Scan to open Fieldbase on your phone or tablet</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 900 }}>

        {/* QR Code card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 36 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Scan with your phone</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 28, textAlign: 'center' }}>
            Opens Fieldbase and signs you in automatically as <strong style={{ color: 'var(--text)' }}>{user?.name}</strong>
          </div>

          {/* QR box */}
          <div style={{
            width: 248, height: 248, borderRadius: 16,
            background: '#ffffff', padding: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            {loading && (
              <div style={{ color: '#0a1628', fontSize: 13 }}>Generating…</div>
            )}
            {!loading && qr && !expired && (
              <img src={qr.dataUrl} alt="QR Code" style={{ width: '100%', height: '100%', borderRadius: 8 }} />
            )}
            {expired && (
              <div style={{ textAlign: 'center', color: '#0a1628' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⏱</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Code expired</div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>Click Refresh below</div>
              </div>
            )}
            {error && (
              <div style={{ textAlign: 'center', color: '#ef4444', fontSize: 12, padding: 12 }}>
                {error}
              </div>
            )}
          </div>

          {/* Timer bar */}
          {qr && !expired && (
            <div style={{ width: 248, marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
                <span>Expires in</span>
                <span style={{ color: secondsLeft < 60 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600 }}>
                  {mins}:{secs}
                </span>
              </div>
              <div style={{ height: 3, background: 'var(--surface2)', borderRadius: 2 }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${pct}%`,
                  background: secondsLeft < 60 ? 'var(--danger)' : 'var(--accent)',
                  transition: 'width 1s linear, background 0.3s',
                }} />
              </div>
            </div>
          )}

          <button
            onClick={generate}
            className="btn btn-secondary"
            style={{ marginTop: 20, width: 248 }}
            disabled={loading}
          >
            {loading ? 'Generating…' : expired ? '↻ Generate New Code' : '↻ Refresh Code'}
          </button>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 14, textAlign: 'center' }}>
            Code is single-use and expires in 30 minutes.<br />Never share it with anyone.
          </p>
        </div>

        {/* Instructions card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>How to get the mobile app</div>
            {[
              { step: '1', icon: '📱', title: 'Open your camera app', desc: 'Use your phone or tablet camera — no QR scanner app needed.' },
              { step: '2', icon: '🔲', title: 'Point at the QR code', desc: 'Hold it steady for a second until a link appears at the top.' },
              { step: '3', icon: '🔗', title: 'Tap the link', desc: 'It opens Fieldbase in your browser and signs you in automatically.' },
              { step: '4', icon: '📲', title: 'Install to home screen', desc: 'Tap "Add to Home Screen" so it works like a real app — offline too.' },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'var(--accent-muted)', border: '1px solid var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Platform badges */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Works on</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {[
                { label: 'iPhone / iPad', icon: '🍎' },
                { label: 'Android', icon: '🤖' },
                { label: 'Samsung Tablet', icon: '📋' },
                { label: 'Any browser', icon: '🌐' },
              ].map(({ label, icon }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '7px 12px', fontSize: 13,
                }}>
                  <span>{icon}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
              No app store required. Installs directly from your browser as a PWA (Progressive Web App).
            </p>
          </div>

          {/* Security note */}
          <div style={{
            background: 'rgba(255,107,53,0.06)', border: '1px solid rgba(255,107,53,0.2)',
            borderRadius: 12, padding: '14px 16px', fontSize: 12, color: 'var(--text-dim)',
          }}>
            <strong style={{ color: 'var(--accent)' }}>🔒 Secure by design</strong>
            <br />Each QR code is single-use, expires in 30 minutes, and is tied to your account. Scanning it on a second device after it's been used will show an error.
          </div>
        </div>
      </div>
    </div>
  )
}
