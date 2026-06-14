import React, { useState, useEffect } from 'react'
import { fmt } from '../utils/invoiceCalc'
import { useToast } from './Toast'

const METHODS = ['cash', 'check', 'venmo', 'paypal', 'cashapp', 'zelle', 'stripe', 'other']
const METHOD_ICONS = { venmo: '💜', paypal: '💙', cashapp: '💚', zelle: '💛', cash: '💵', check: '🏦', stripe: '💳', other: '💰' }

function today() { return new Date().toISOString().slice(0, 10) }

export default function PaymentTracker({ invoiceId, invoiceTotal, sym = '$', onPaidStatusChange }) {
  const toast = useToast()
  const [payments, setPayments] = useState([])
  const [form, setForm] = useState({ amount: '', method: 'cash', note: '', paid_at: today() })
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [invoiceId])

  async function load() {
    const p = await window.electron.payments.list(invoiceId)
    setPayments(p)
  }

  async function addPayment() {
    const amt = parseFloat(form.amount)
    if (!form.amount || isNaN(amt)) { toast('Enter a valid amount', 'error'); return }
    setSaving(true)
    const result = await window.electron.payments.create({
      invoice_id: invoiceId,
      amount: amt,
      method: form.method,
      note: form.note,
      paid_at: form.paid_at,
    })
    const newId = result?.id
    setForm({ amount: '', method: 'cash', note: '', paid_at: today() })
    setAdding(false)
    setSaving(false)
    await load()
    if (onPaidStatusChange) onPaidStatusChange()

    toast.undoable(
      `Payment of ${fmt(amt, sym)} recorded`,
      () => {},
      async () => {
        if (newId) await window.electron.payments.delete(newId)
        await load()
        if (onPaidStatusChange) onPaidStatusChange()
      }
    )
  }

  function removePayment(p) {
    setPayments(prev => prev.filter(x => x.id !== p.id))
    if (onPaidStatusChange) onPaidStatusChange()
    toast.undoable(
      `${fmt(p.amount, sym)} payment removed`,
      async () => {
        await window.electron.payments.delete(p.id)
      },
      async () => {
        await load()
        if (onPaidStatusChange) onPaidStatusChange()
      }
    )
  }

  const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const remaining = invoiceTotal - totalPaid
  const paidPct = invoiceTotal > 0 ? Math.min(totalPaid / invoiceTotal * 100, 100) : 0
  const fullyPaid = remaining <= 0.01

  return (
    <div>
      <div className="card-header">
        <div className="card-title">💳 Payment Tracking</div>
        {!fullyPaid && (
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(a => !a)}>
            {adding ? 'Cancel' : '+ Record Payment'}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
          <span>Paid: <strong style={{ color: 'var(--success)' }}>{fmt(totalPaid, sym)}</strong></span>
          <span>Total: <strong>{fmt(invoiceTotal, sym)}</strong></span>
          {remaining > 0.01 && <span>Remaining: <strong style={{ color: 'var(--warning)' }}>{fmt(remaining, sym)}</strong></span>}
        </div>
        <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${paidPct}%`,
            background: fullyPaid ? 'var(--success)' : 'var(--accent)',
            borderRadius: 4, transition: 'width 0.4s ease',
          }} />
        </div>
        {fullyPaid && (
          <div style={{ marginTop: 8, color: 'var(--success)', fontWeight: 600, fontSize: 13 }}>✓ Fully paid</div>
        )}
      </div>

      {/* Add payment form */}
      {adding && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>Record Payment Received</div>
          <div className="form-row form-row-2" style={{ margin: 0, marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Amount ({sym})</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder={fmt(remaining, sym)} step="0.01" min="0" autoFocus />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Payment Method</label>
              <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                {METHODS.map(m => <option key={m} value={m}>{METHOD_ICONS[m]} {m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row form-row-2" style={{ margin: 0, marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Date Received</label>
              <input type="date" value={form.paid_at} onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Note (optional)</label>
              <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Check #1234, Venmo @john..." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              setForm(f => ({ ...f, amount: Math.max(0, remaining).toFixed(2) }))
            }}>Fill Remaining</button>
            <button className="btn btn-primary btn-sm" onClick={addPayment} disabled={saving}>Save Payment</button>
          </div>
        </div>
      )}

      {/* Payment history */}
      {payments.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {payments.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{METHOD_ICONS[p.method] || '💰'}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{p.method}{p.note ? ` — ${p.note}` : ''}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.paid_at?.slice(0, 10)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace' }}>{fmt(p.amount, sym)}</span>
                <TwoTapDelete onDelete={() => removePayment(p)} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
          No payments recorded yet
        </div>
      )}
    </div>
  )
}

function TwoTapDelete({ onDelete }) {
  const [armed, setArmed] = useState(false)

  function handleClick() {
    if (!armed) {
      setArmed(true)
      setTimeout(() => setArmed(false), 2000)
    } else {
      setArmed(false)
      onDelete()
    }
  }

  return (
    <button
      onClick={handleClick}
      className="btn btn-sm"
      style={{
        padding: '3px 8px', fontSize: 11, fontWeight: 600,
        background: armed ? 'rgba(239,68,68,0.15)' : 'transparent',
        color: armed ? 'var(--danger)' : 'var(--text-muted)',
        border: armed ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--navy-border)',
        transition: 'all 0.15s',
      }}
    >
      {armed ? 'Confirm ✕' : '✕'}
    </button>
  )
}
