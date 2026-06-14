import React, { useState } from 'react'

export default function SetupReminder({ settings, onNavigate }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const missing = []
  if (!settings?.business_name) missing.push('business name')
  if (!settings?.phone) missing.push('phone number')
  if (!settings?.email) missing.push('email')
  if (!settings?.license_number) missing.push('contractor license #')
  if (!settings?.tax_rate) missing.push('tax rate')

  if (missing.length === 0) return null

  return (
    <div style={{
      background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
      borderRadius: 10, padding: '10px 16px', marginBottom: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Your business profile is incomplete.</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
            Missing: {missing.join(', ')}. These appear on your invoices.
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button className="btn btn-primary btn-sm" onClick={() => onNavigate('settings')}>
          Complete Profile
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setDismissed(true)}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
