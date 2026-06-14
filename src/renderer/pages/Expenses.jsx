import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '../components/Toast'
import { fmt } from '../utils/invoiceCalc'

const CATEGORIES = ['Materials', 'Fuel', 'Tools', 'Subcontractors', 'Insurance', 'Meals', 'Office', 'Other']

const CAT_COLORS = {
  Materials: '#4f7ef8', Fuel: '#f59e0b', Tools: '#10b981',
  Subcontractors: '#8b5cf6', Insurance: '#ef4444', Meals: '#f97316',
  Office: '#6b7280', Other: '#9ca3af',
}

function today() { return new Date().toISOString().slice(0, 10) }

const EMPTY = { date: today(), vendor: '', description: '', amount: '', tax_amount: '0', category: 'Materials', job_id: '', client_id: '', notes: '', receipt_image: '', ai_scanned: 0 }

export default function Expenses({ settings }) {
  const toast = useToast()
  const [expenses, setExpenses] = useState([])
  const [jobs, setJobs] = useState([])
  const [clients, setClients] = useState([])
  const [modal, setModal] = useState(null)
  const [filterCat, setFilterCat] = useState('all')
  const [filterMonth, setFilterMonth] = useState('')
  const [search, setSearch] = useState('')
  const [scanning, setScanning] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [exps, jbs, cls] = await Promise.all([
      window.electron.expenses.list({}),
      window.electron.jobs.list(),
      window.electron.clients.list(),
    ])
    setExpenses(exps); setJobs(jbs); setClients(cls)
  }

  async function save(form) {
    try {
      const data = {
        ...form,
        amount: parseFloat(form.amount) || 0,
        tax_amount: parseFloat(form.tax_amount) || 0,
        job_id: form.job_id || null,
        client_id: form.client_id || null,
        receipt_image: form.receipt_image || null,
      }
      if (form.id) await window.electron.expenses.update(data)
      else await window.electron.expenses.create(data)
      toast(form.id ? 'Expense updated' : 'Expense saved')
      setModal(null)
      loadAll()
    } catch (e) { toast(e.message, 'error') }
  }

  async function del(id) {
    if (!confirm('Delete this expense?')) return
    await window.electron.expenses.delete(id)
    toast('Expense deleted')
    loadAll()
  }

  async function scanReceipt() {
    setScanning(true)
    try {
      const file = await window.electron.expenses.pickReceipt()
      if (!file) { setScanning(false); return }

      toast('AI is reading your receipt...')
      const result = await window.electron.expenses.scanReceipt({ imagePath: file.path })

      if (!result.success) {
        toast(result.error, 'error')
        setScanning(false)
        return
      }

      // Open form pre-filled with AI data + receipt image
      setModal({ ...EMPTY, ...result.data, receipt_image: file.dataUrl, ai_scanned: 1 })
      toast('Receipt scanned! Review and save.')
    } catch (e) {
      toast('Scan failed: ' + e.message, 'error')
    }
    setScanning(false)
  }

  const sym = settings?.currency_symbol || '$'

  const filtered = expenses.filter(e => {
    if (filterCat !== 'all' && e.category !== filterCat) return false
    if (filterMonth && !e.date?.startsWith(filterMonth)) return false
    if (search && !`${e.vendor} ${e.description} ${e.notes}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalFiltered = filtered.reduce((s, e) => s + (e.amount || 0), 0)
  const totalAll = expenses.reduce((s, e) => s + (e.amount || 0), 0)

  // Monthly totals for mini chart
  const byCategory = CATEGORIES.map(cat => ({
    cat,
    total: filtered.filter(e => e.category === cat).reduce((s, e) => s + (Number(e.amount) || 0), 0),
  })).filter(x => x.total > 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Expenses</div>
          <div className="page-subtitle">{filtered.length} expenses · {fmt(totalFiltered, sym)} shown · {fmt(totalAll, sym)} total</div>
        </div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={scanReceipt} disabled={scanning}>
            {scanning ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Scanning...</> : '📷 Scan Receipt (AI)'}
          </button>
          <button className="btn btn-primary" onClick={() => setModal({ ...EMPTY })}>+ Add Expense</button>
        </div>
      </div>

      {/* Category breakdown */}
      {byCategory.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          {byCategory.map(({ cat, total }) => (
            <div key={cat} onClick={() => setFilterCat(filterCat === cat ? 'all' : cat)}
              style={{
                background: filterCat === cat ? CAT_COLORS[cat] + '30' : 'var(--surface)',
                border: `1px solid ${filterCat === cat ? CAT_COLORS[cat] : 'var(--border)'}`,
                borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              <div style={{ fontSize: 11, color: CAT_COLORS[cat], fontWeight: 700 }}>{cat}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{fmt(total, sym)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="search-row" style={{ marginBottom: 16 }}>
        <div className="search-input-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input placeholder="Search vendor, description..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ width: 160 }}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ width: 160 }} />
        {(filterCat !== 'all' || filterMonth || search) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setFilterCat('all'); setFilterMonth(''); setSearch('') }}>Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
            <h3>No expenses yet</h3>
            <p>Click "Scan Receipt (AI)" to photograph a receipt and auto-fill, or add manually.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Vendor</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Job</th>
                  <th className="text-right">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(exp => (
                  <tr key={exp.id} style={{ cursor: 'pointer' }} onClick={() => setModal(exp)}>
                    <td style={{ color: 'var(--text-dim)', fontSize: 12 }}>{exp.date}</td>
                    <td style={{ fontWeight: 500 }}>
                      {exp.ai_scanned ? <span title="AI scanned" style={{ marginRight: 4 }}>🤖</span> : null}
                      {exp.vendor || '—'}
                    </td>
                    <td style={{ color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.description || '—'}</td>
                    <td>
                      <span style={{ background: CAT_COLORS[exp.category] + '20', color: CAT_COLORS[exp.category], padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                        {exp.category}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{exp.job_title || '—'}</td>
                    <td className="text-right font-mono" style={{ fontWeight: 600 }}>{fmt(exp.amount, sym)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-danger btn-sm" onClick={() => del(exp.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <ExpenseModal
          expense={modal}
          jobs={jobs}
          clients={clients}
          settings={settings}
          onSave={save}
          onClose={() => setModal(null)}
          onScanNew={async (current) => {
            setModal(null)
            await scanReceipt()
          }}
        />
      )}
    </div>
  )
}

function ExpenseModal({ expense, jobs, clients, settings, onSave, onClose }) {
  const [form, setForm] = useState({ ...expense })
  const [saving, setSaving] = useState(false)
  const sym = settings?.currency_symbol || '$'

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.amount || isNaN(parseFloat(form.amount))) { alert('Enter an amount'); return }
    if (!form.date) { alert('Enter a date'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <div className="modal-title">
            {form.id ? 'Edit Expense' : 'New Expense'}
            {form.ai_scanned ? <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--accent)', background: 'rgba(79,126,248,0.15)', padding: '2px 8px', borderRadius: 10 }}>🤖 AI Scanned</span> : null}
          </div>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Receipt preview */}
          {form.receipt_image && (
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <img src={form.receipt_image} alt="Receipt" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
            </div>
          )}

          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Date *</label>
              <input type="date" value={form.date || ''} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Vendor / Store</label>
              <input value={form.vendor || ''} onChange={e => set('vendor', e.target.value)} placeholder="Home Depot, Shell, etc." />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="What was purchased" />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Amount ({sym}) *</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} step="0.01" min="0" />
            </div>
            <div className="form-group">
              <label>Tax Amount ({sym})</label>
              <input type="number" value={form.tax_amount || 0} onChange={e => set('tax_amount', e.target.value)} step="0.01" min="0" />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Link to Job (optional)</label>
              <select value={form.job_id || ''} onChange={e => set('job_id', e.target.value)}>
                <option value="">No job</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Link to Client (optional)</label>
              <select value={form.client_id || ''} onChange={e => set('client_id', e.target.value)}>
                <option value="">No client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : form.id ? 'Save Changes' : 'Save Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}
