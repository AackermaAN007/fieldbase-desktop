import React from 'react'

/**
 * Usage:
 *   const [confirm, setConfirm] = useState(null)
 *   <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />
 *
 *   setConfirm({
 *     title: 'Record Payment',
 *     message: 'Record a payment of $250.00 for Invoice #INV-0012?',
 *     amount: '$250.00',          // optional — shows a highlighted amount line
 *     confirmLabel: 'Yes, Record',
 *     danger: false,              // true = red confirm button
 *     onConfirm: () => { ... },
 *   })
 */
export default function ConfirmModal({ config, onClose }) {
  if (!config) return null

  const { title, message, amount, confirmLabel = 'Confirm', danger = false, onConfirm } = config

  function handleConfirm() {
    onConfirm()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}
        style={{ maxWidth: 400 }}>
        <div style={{ padding: '28px 28px 24px' }}>
          {/* Icon */}
          <div style={{
            width: 48, height: 48, borderRadius: 12, marginBottom: 16,
            background: danger ? 'rgba(239,68,68,0.1)' : 'rgba(255,107,53,0.1)',
            border: `1px solid ${danger ? 'rgba(239,68,68,0.25)' : 'rgba(255,107,53,0.25)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {danger ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke={danger ? '#ef4444' : '#FF6B35'} strokeWidth="2" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="1" fill="#ef4444" stroke="none"/>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="#FF6B35" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <circle cx="12" cy="16" r="1" fill="#FF6B35" stroke="none"/>
              </svg>
            )}
          </div>

          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>{message}</div>

          {/* Amount highlight */}
          {amount && (
            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 8,
              background: 'var(--surface2)', border: '1px solid var(--navy-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Amount</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                {amount}
              </span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button
              className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
