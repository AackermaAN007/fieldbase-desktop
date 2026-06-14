import React, { useEffect, useState } from 'react'

const STRIPE_CHECKOUT_URL = 'https://buy.stripe.com/test_7sYcN69IEb8AbUf1QrcMM00'

export default function LicenseBanner({ onActivated }) {
  const [licenseStatus, setLicenseStatus] = useState(null)

  useEffect(() => {
    checkLicense()
    const interval = setInterval(checkLicense, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function checkLicense() {
    try {
      const result = await window.electron.license.check()
      setLicenseStatus(result)
    } catch { setLicenseStatus({ valid: true }) }
  }

  if (!licenseStatus) return null
  if (licenseStatus.valid && (licenseStatus.days_left == null || licenseStatus.days_left > 7)) return null

  if (!licenseStatus.valid && licenseStatus.reason === 'expired') {
    return <ExpiredScreen onActivated={onActivated} />
  }

  if (licenseStatus.valid && licenseStatus.days_left <= 7) {
    return (
      <div style={{
        background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.3)',
        padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 13, flexShrink: 0,
      }}>
        <span>
          ⚠️ <strong>Subscription expires in {licenseStatus.days_left} day{licenseStatus.days_left !== 1 ? 's' : ''}</strong> — renew to keep access.
        </span>
        <button
          className="btn btn-sm"
          style={{ background: '#f59e0b', color: 'white', border: 'none' }}
          onClick={() => window.electron.shell.openExternal(STRIPE_CHECKOUT_URL)}
        >
          Renew $32/mo →
        </button>
      </div>
    )
  }

  return null
}

function ExpiredScreen({ onActivated }) {
  const [tab, setTab] = useState('subscribe')
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function activate() {
    if (!key.trim()) { setError('Enter your license key'); return }
    setLoading(true)
    setError('')
    const result = await window.electron.license.activate({ key: key.trim() })
    if (result.success) {
      onActivated()
    } else {
      setError(result.error || 'Activation failed')
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,17,23,0.97)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 460, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Subscription Expired</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
          Your Fieldbase subscription has ended. Renew to continue — all your data is safe.
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24, justifyContent: 'center' }}>
          {[['subscribe', 'Subscribe & Renew'], ['key', 'I have a new key']].map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setError('') }} style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === id ? 'var(--accent)' : 'var(--surface2)',
              color: tab === id ? 'white' : 'var(--text-muted)',
              fontWeight: tab === id ? 600 : 400, fontSize: 14, transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 28,
        }}>
          {tab === 'subscribe' ? (
            <>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>$32</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>per month · cancel anytime</div>
              <ul style={{ textAlign: 'left', listStyle: 'none', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Full access to all features', 'Unlimited invoices & clients', 'AI receipt scanning', 'Free updates & support'].map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span style={{ color: 'var(--success)' }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                className="btn btn-primary"
                style={{ fontSize: 15, padding: '12px 0', justifyContent: 'center' }}
                onClick={() => window.electron.shell.openExternal(STRIPE_CHECKOUT_URL)}
              >
                Subscribe Now →
              </button>
              <p style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                After paying, your new key will be emailed to you within minutes.
              </p>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                Enter the license key from your renewal email.
              </div>
              <input
                value={key}
                onChange={e => setKey(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                style={{
                  width: '100%', padding: '10px 14px', fontSize: 16, letterSpacing: 2,
                  fontFamily: 'monospace', marginBottom: 12, borderRadius: 8,
                  background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
                  outline: 'none', textAlign: 'center',
                }}
                onKeyDown={e => e.key === 'Enter' && activate()}
              />
              {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{error}</div>}
              <button
                className="btn btn-primary"
                style={{ fontSize: 15, padding: '12px 0', justifyContent: 'center', width: '100%' }}
                onClick={activate}
                disabled={loading}
              >
                {loading ? 'Activating…' : 'Activate Key'}
              </button>
            </>
          )}
        </div>

        <p style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)' }}>
          Questions? Email alejoweslinalexander@gmail.com
        </p>
      </div>
    </div>
  )
}
