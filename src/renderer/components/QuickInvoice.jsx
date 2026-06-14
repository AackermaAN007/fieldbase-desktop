import React, { useState, useEffect } from 'react'
import { useToast } from './Toast'
import { calcInvoiceTotals, fmt } from '../utils/invoiceCalc'

export default function QuickInvoice({ settings, onCreated, onNavigateInvoices }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    client_id: '',
    description: '',
    amount: '',
    tax_rate: '',
    due_days: '',
    notes: '',
  })

  useEffect(() => {
    window.electron.clients.list().then(setClients)
  }, [open])

  useEffect(() => {
    if (settings) {
      setForm(f => ({
        ...f,
        tax_rate: settings.default_tax_rate || '0',
        due_days: settings.default_due_days || '30',
      }))
    }
  }, [settings])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function issueDate() {
    return new Date().toISOString().slice(0, 10)
  }
  function dueDate() {
    const d = new Date()
    d.setDate(d.getDate() + parseInt(form.due_days || 30))
    return d.toISOString().slice(0, 10)
  }

  const sym = settings?.currency_symbol || '$'
  const subtotal = parseFloat(form.amount) || 0
  const taxRate = parseFloat(form.tax_rate) || 0
  const tax = subtotal * taxRate / 100
  const total = subtotal + tax

  async function save() {
    if (!form.description.trim()) { toast('Add a description', 'error'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast('Enter an amount', 'error'); return }
    setSaving(true)
    try {
      const client = clients.find(c => String(c.id) === String(form.client_id))
      const invoiceData = {
        client_id: form.client_id || null,
        type: 'invoice',
        status: 'draft',
        issue_date: issueDate(),
        due_date: dueDate(),
        tax_rate: taxRate,
        discount_pct: 0,
        notes: form.notes || settings?.default_notes || '',
        terms: settings?.default_terms || '',
        late_fee_pct: parseFloat(settings?.late_fee_pct) || 0,
        items: [{
          category: 'Labor',
          description: form.description,
          quantity: 1,
          unit_price: subtotal,
          total: subtotal,
          sort_order: 0,
        }],
      }
      await window.electron.invoices.create(invoiceData)
      toast('Invoice created!')
      setOpen(false)
      setForm(f => ({ ...f, client_id: '', description: '', amount: '', notes: '' }))
      if (onCreated) onCreated()
    } catch (e) {
      toast(e.message || 'Failed to create invoice', 'error')
    }
    setSaving(false)
  }

  return (
    <>
      {/* Floating quick-add button */}
      <button
        onClick={() => setOpen(true)}
        title="Quick Invoice"
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 500,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--accent)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(79,126,248,0.45)',
          transition: 'transform 0.15s, box-shadow 0.15s',
          fontSize: 22, color: 'white', fontWeight: 300,
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(79,126,248,0.6)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(79,126,248,0.45)' }}
      >
        ⚡
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Quick Invoice</h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Create a draft invoice in seconds</div>
              </div>
              <button className="modal-close" onClick={() => setOpen(false)}>×</button>
            </div>

            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Client */}
              <div>
                <label className="form-label">Client</label>
                <select className="form-input" value={form.client_id} onChange={e => set('client_id', e.target.value)}>
                  <option value="">— No client (fill in later) —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* What for */}
              <div>
                <label className="form-label">What is this invoice for? *</label>
                <input
                  className="form-input"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="e.g. Electrical panel installation — 200A upgrade"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && document.getElementById('qi-amount')?.focus()}
                />
              </div>

              {/* Amount + Tax side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Amount ({sym})</label>
                  <input
                    id="qi-amount"
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={e => set('amount', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="form-label">Tax rate (%)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.tax_rate}
                    onChange={e => set('tax_rate', e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Due days */}
              <div>
                <label className="form-label">Due in (days)</label>
                <select className="form-input" value={form.due_days} onChange={e => set('due_days', e.target.value)}>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="45">45 days</option>
                  <option value="60">60 days</option>
                </select>
              </div>

              {/* Total preview */}
              {subtotal > 0 && (
                <div style={{
                  background: 'rgba(79,126,248,0.07)', border: '1px solid rgba(79,126,248,0.2)',
                  borderRadius: 8, padding: '12px 16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {taxRate > 0 && <span>{fmt(subtotal, sym)} + {taxRate}% tax</span>}
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 8 }}>TOTAL</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{fmt(total, sym)}</span>
                  </div>
                </div>
              )}

              {/* Optional notes */}
              <div>
                <label className="form-label">Notes (optional)</label>
                <textarea
                  className="form-input"
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  rows={2}
                  style={{ resize: 'none' }}
                  placeholder="Payment terms, job address, etc."
                />
              </div>

              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setOpen(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={save} disabled={saving}>
                  {saving ? 'Creating…' : '⚡ Create Invoice'}
                </button>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                Saved as draft — open Invoices to edit, send, or add more line items
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
