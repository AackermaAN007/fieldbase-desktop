import React, { useState, useEffect } from 'react'
import { calcInvoiceTotals, fmt, today, addDays } from '../utils/invoiceCalc'

const EMPTY_ITEM = (category = 'Labor') => ({ category, description: '', quantity: 1, unit_price: 0, _id: Math.random() })

export default function InvoiceEditor({ invoice, type = 'invoice', clients, jobs, materials, settings, onSave, onClose }) {
  const isEdit = !!invoice?.id
  const dueDays = parseInt(settings?.default_due_days) || 30
  const [form, setForm] = useState({
    client_id: '', job_id: '', type,
    status: 'draft', issue_date: today(),
    due_date: addDays(today(), dueDays),
    tax_rate: settings?.tax_rate || '8.25',
    discount_pct: '0',
    notes: settings?.default_notes || '',
    terms: settings?.default_terms || 'Payment due within 30 days.',
    is_recurring: 0, recurring_interval: 'monthly',
    late_fee_pct: settings?.late_fee_pct || '0',
    ...invoice,
    items: invoice?.items?.map(i => ({ ...i, _id: Math.random() })) || [EMPTY_ITEM('Labor')],
  })

  const [filteredJobs, setFilteredJobs] = useState([])

  useEffect(() => {
    if (form.client_id) {
      setFilteredJobs(jobs.filter(j => String(j.client_id) === String(form.client_id)))
    } else {
      setFilteredJobs(jobs)
    }
  }, [form.client_id, jobs])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function setItem(idx, k, v) {
    setForm(f => {
      const items = [...f.items]
      items[idx] = { ...items[idx], [k]: v }
      if (k === 'quantity' || k === 'unit_price') {
        items[idx].total = Number(items[idx].quantity) * Number(items[idx].unit_price)
      }
      return { ...f, items }
    })
  }

  function addItem(category) {
    setForm(f => ({ ...f, items: [...f.items, EMPTY_ITEM(category)] }))
  }

  function removeItem(idx) {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  }

  function addMaterial(mat) {
    const unit_price = mat.cost_price * (1 + mat.markup_pct / 100)
    const item = { category: 'Materials', description: mat.name, quantity: 1, unit_price, total: unit_price, _id: Math.random() }
    setForm(f => ({ ...f, items: [...f.items, item] }))
  }

  const totals = calcInvoiceTotals(form.items, form.tax_rate, form.discount_pct)

  const laborItems = form.items.map((it, i) => ({ ...it, _idx: i })).filter(i => i.category === 'Labor')
  const matItems = form.items.map((it, i) => ({ ...it, _idx: i })).filter(i => i.category === 'Materials')

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? `Edit ${type === 'estimate' ? 'Estimate' : 'Invoice'}` : `New ${type === 'estimate' ? 'Estimate' : 'Invoice'}`}</div>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Header fields */}
          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Client</label>
              <select value={form.client_id || ''} onChange={e => set('client_id', e.target.value)}>
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Job (optional)</label>
              <select value={form.job_id || ''} onChange={e => set('job_id', e.target.value)}>
                <option value="">No job</option>
                {filteredJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row form-row-4">
            <div className="form-group">
              <label>Issue Date</label>
              <input type="date" value={form.issue_date || ''} onChange={e => set('issue_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input type="date" value={form.due_date || ''} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Tax Rate (%)</label>
              <input type="number" value={form.tax_rate} onChange={e => set('tax_rate', e.target.value)} step="0.01" />
            </div>
            <div className="form-group">
              <label>Discount (%)</label>
              <input type="number" value={form.discount_pct} onChange={e => set('discount_pct', e.target.value)} step="0.01" />
            </div>
          </div>

          {/* Status (invoice only) */}
          {type === 'invoice' && (
            <div className="form-row form-row-2">
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <div className="form-group">
                <label>Late Fee (%)</label>
                <input type="number" value={form.late_fee_pct} onChange={e => set('late_fee_pct', e.target.value)} step="0.5" placeholder="0" />
              </div>
            </div>
          )}

          {/* Recurring template */}
          <div className="form-row form-row-2" style={{ alignItems: 'flex-end' }}>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="recurring" checked={!!form.is_recurring} onChange={e => set('is_recurring', e.target.checked ? 1 : 0)} style={{ width: 'auto' }} />
              <label htmlFor="recurring" style={{ marginBottom: 0 }}>Recurring Invoice Template</label>
            </div>
            {form.is_recurring ? (
              <div className="form-group">
                <label>Interval</label>
                <select value={form.recurring_interval} onChange={e => set('recurring_interval', e.target.value)}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
            ) : <div />}
          </div>

          <div className="divider" />

          {/* Line items */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 600 }}>Line Items</div>
            <div className="btn-group">
              <button className="btn btn-secondary btn-sm" onClick={() => addItem('Labor')}>+ Labor</button>
              <button className="btn btn-secondary btn-sm" onClick={() => addItem('Materials')}>+ Materials</button>
              {materials.length > 0 && <MaterialsPicker materials={materials} onAdd={addMaterial} />}
            </div>
          </div>

          <table className="invoice-items-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Category</th>
                <th>Description</th>
                <th style={{ width: 80 }}>Qty</th>
                <th style={{ width: 110 }}>Unit Price</th>
                <th style={{ width: 110, textAlign: 'right' }}>Total</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {laborItems.length > 0 && (
                <tr><td colSpan={6} className="items-category-header">Labor</td></tr>
              )}
              {laborItems.map(item => (
                <ItemRow key={item._id} item={item} onSet={(k, v) => setItem(item._idx, k, v)} onRemove={() => removeItem(item._idx)} />
              ))}
              {matItems.length > 0 && (
                <tr><td colSpan={6} className="items-category-header">Materials</td></tr>
              )}
              {matItems.map(item => (
                <ItemRow key={item._id} item={item} onSet={(k, v) => setItem(item._idx, k, v)} onRemove={() => removeItem(item._idx)} />
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="invoice-totals">
            {laborItems.length > 0 && (
              <div className="totals-row">
                <span className="label">Labor Subtotal</span>
                <span className="value font-mono">{fmt(totals.laborSub)}</span>
              </div>
            )}
            {matItems.length > 0 && (
              <div className="totals-row">
                <span className="label">Materials Subtotal</span>
                <span className="value font-mono">{fmt(totals.materialsSub)}</span>
              </div>
            )}
            <div className="totals-row">
              <span className="label">Subtotal</span>
              <span className="value font-mono">{fmt(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="totals-row" style={{ color: 'var(--success)' }}>
                <span className="label">Discount ({form.discount_pct}%)</span>
                <span className="value font-mono">-{fmt(totals.discount)}</span>
              </div>
            )}
            <div className="totals-row">
              <span className="label">{settings?.tax_name || 'Tax'} ({form.tax_rate}%)</span>
              <span className="value font-mono">{fmt(totals.tax, settings?.currency_symbol)}</span>
            </div>
            <div className="totals-row grand">
              <span className="label">Total</span>
              <span className="value font-mono">{fmt(totals.total)}</span>
            </div>
          </div>

          <div className="divider" />
          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Notes (shown on invoice)</label>
              <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Thank you for your business!" />
            </div>
            <div className="form-group">
              <label>Terms & Conditions</label>
              <textarea value={form.terms || ''} onChange={e => set('terms', e.target.value)} rows={3} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave({ ...form, items: form.items.map(({ _id, ...rest }) => rest) })}>
            {isEdit ? 'Save Changes' : `Create ${type === 'estimate' ? 'Estimate' : 'Invoice'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function ItemRow({ item, onSet, onRemove }) {
  return (
    <tr>
      <td>
        <select value={item.category} onChange={e => onSet('category', e.target.value)}>
          <option>Labor</option>
          <option>Materials</option>
        </select>
      </td>
      <td><input value={item.description} onChange={e => onSet('description', e.target.value)} placeholder="Description..." /></td>
      <td><input type="number" value={item.quantity} onChange={e => onSet('quantity', e.target.value)} min="0" step="0.25" /></td>
      <td><input type="number" value={item.unit_price} onChange={e => onSet('unit_price', e.target.value)} min="0" step="0.01" /></td>
      <td className="text-right font-mono" style={{ fontSize: 13, paddingRight: 12 }}>
        {fmt(item.quantity * item.unit_price)}
      </td>
      <td>
        <button className="btn btn-icon" style={{ color: 'var(--text-muted)', padding: '4px 6px' }} onClick={onRemove}>✕</button>
      </td>
    </tr>
  )
}

function MaterialsPicker({ materials, onAdd }) {
  const [open, setOpen] = useState(false)
  const cats = [...new Set(materials.map(m => m.category))]

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(o => !o)}>
        + From Library ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 8, zIndex: 100,
          minWidth: 260, maxHeight: 320, overflowY: 'auto', boxShadow: 'var(--shadow)',
        }}>
          {cats.map(cat => (
            <div key={cat}>
              <div style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--surface2)' }}>{cat}</div>
              {materials.filter(m => m.category === cat).map(m => (
                <div key={m.id} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  className="mat-item"
                  onClick={() => { onAdd(m); setOpen(false) }}>
                  <span style={{ fontSize: 13 }}>{m.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {fmt(m.cost_price * (1 + m.markup_pct / 100))}/{m.unit}
                  </span>
                </div>
              ))}
            </div>
          ))}
          {materials.length === 0 && <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>No materials in library</div>}
        </div>
      )}
    </div>
  )
}
