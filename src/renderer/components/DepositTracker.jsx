import React, { useState, useEffect } from 'react'
import { useToast } from './Toast'
import { fmt } from '../utils/invoiceCalc'

export default function DepositTracker({ invoiceId, invoiceTotal }) {
  const toast = useToast()
  const [deposits, setDeposits] = useState([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ amount: '', note: '', paid_at: new Date().toISOString().slice(0, 10) })

  useEffect(() => { load() }, [invoiceId])

  async function load() {
    setDeposits(await window.electron.deposits.list(invoiceId))
  }

  async function add() {
    const amt = Number(form.amount)
    if (!form.amount || isNaN(amt) || amt <= 0) return
    const result = await window.electron.deposits.create({ invoice_id: invoiceId, amount: amt, note: form.note, paid_at: form.paid_at })
    const newId = result?.id
    setAdding(false)
    setForm({ amount: '', note: '', paid_at: new Date().toISOString().slice(0, 10) })
    await load()
    toast.undoable(
      `Deposit of ${fmt(amt)} recorded`,
      () => {},
      async () => { if (newId) { await window.electron.deposits.delete(newId); load() } }
    )
  }

  function del(d) {
    setDeposits(prev => prev.filter(x => x.id !== d.id))
    toast.undoable(
      `${fmt(d.amount)} deposit removed`,
      async () => { await window.electron.deposits.delete(d.id) },
      async () => { load() }
    )
  }

  const totalPaid = deposits.reduce((s, d) => s + d.amount, 0)
  const balance = (invoiceTotal || 0) - totalPaid

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>Deposits / Payments Received</div>
        <button className="btn btn-secondary btn-sm" onClick={() => setAdding(a => !a)}>+ Record Payment</button>
      </div>

      {deposits.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {deposits.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--surface2)', borderRadius: 6, marginBottom: 4, fontSize: 13 }}>
              <span style={{ color: 'var(--success)', fontWeight: 600, minWidth: 80 }}>{fmt(d.amount)}</span>
              <span style={{ flex: 1, color: 'var(--text-muted)' }}>{d.note || 'Payment received'}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{d.paid_at?.slice(0, 10)}</span>
              <button onClick={() => del(d)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {invoiceTotal > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, fontSize: 13, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 6 }}>
          <span style={{ color: 'var(--text-muted)' }}>Paid: <strong style={{ color: 'var(--success)' }}>{fmt(totalPaid)}</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>Balance Due: <strong style={{ color: balance > 0 ? 'var(--warning)' : 'var(--success)' }}>{fmt(balance)}</strong></span>
        </div>
      )}

      {adding && (
        <div style={{ marginTop: 10, background: 'var(--surface2)', borderRadius: 8, padding: 14, border: '1px solid var(--border)' }}>
          <div className="form-row form-row-3">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Amount ($)</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" step="0.01" autoFocus />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Note</label>
              <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Check, Venmo, etc." />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Date</label>
              <input type="date" value={form.paid_at} onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))} />
            </div>
          </div>
          <div className="btn-group" style={{ marginTop: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={add}>Save</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
