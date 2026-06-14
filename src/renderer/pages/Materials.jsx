import React, { useState, useEffect } from 'react'
import { useToast } from '../components/Toast'
import { fmt } from '../utils/invoiceCalc'

const EMPTY = { name: '', description: '', unit: 'each', cost_price: '0', markup_pct: '20', category: 'General' }
const CATEGORIES = ['General', 'Wire & Conduit', 'Breakers & Panels', 'Outlets & Switches', 'Fixtures & Lighting', 'Tools & Consumables', 'Other']

export default function Materials() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [globalMarkup, setGlobalMarkup] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setItems(await window.electron.materials.list())
  }

  async function save(form) {
    try {
      if (form.id) await window.electron.materials.update(form)
      else await window.electron.materials.create(form)
      toast(form.id ? 'Item updated' : 'Item added')
      setModal(null)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  async function del(id) {
    if (!confirm('Remove this item from the library?')) return
    await window.electron.materials.delete(id)
    toast('Item removed')
    load()
  }

  async function applyGlobalMarkup() {
    if (!globalMarkup || isNaN(globalMarkup)) return
    for (const item of items) {
      await window.electron.materials.update({ ...item, markup_pct: globalMarkup })
    }
    toast(`Markup set to ${globalMarkup}% for all items`)
    setGlobalMarkup('')
    load()
  }

  const cats = ['all', ...CATEGORIES]
  const filtered = items.filter(i => {
    if (catFilter !== 'all' && i.category !== catFilter) return false
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Materials Library</div>
          <div className="page-subtitle">{items.length} items · prices include markup</div>
        </div>
        <div className="btn-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" value={globalMarkup} onChange={e => setGlobalMarkup(e.target.value)}
              placeholder="Global markup %" style={{ width: 140 }} />
            <button className="btn btn-secondary" onClick={applyGlobalMarkup} disabled={!globalMarkup}>Apply to All</button>
          </div>
          <button className="btn btn-primary" onClick={() => setModal({ ...EMPTY })}>+ Add Item</button>
        </div>
      </div>

      <div className="search-row">
        <div className="search-input-wrap">
          <SearchIcon />
          <input placeholder="Search materials..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="tabs">
        {cats.map(c => (
          <button key={c} className={`tab ${catFilter === c ? 'active' : ''}`} onClick={() => setCatFilter(c)}>
            {c === 'all' ? 'All' : c}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No materials</h3>
            <p>Add items to your library to quickly add them to invoices</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th className="text-right">Cost Price</th>
                  <th className="text-right">Markup %</th>
                  <th className="text-right">Bill Price</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const billPrice = m.cost_price * (1 + m.markup_pct / 100)
                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 500 }}>{m.name}</td>
                      <td style={{ color: 'var(--text-dim)' }}>{m.category}</td>
                      <td style={{ color: 'var(--text-dim)' }}>{m.unit}</td>
                      <td className="text-right font-mono">{fmt(m.cost_price)}</td>
                      <td className="text-right" style={{ color: 'var(--warning)' }}>{m.markup_pct}%</td>
                      <td className="text-right font-mono" style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(billPrice)}</td>
                      <td>
                        <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setModal({ ...m })}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => del(m.id)}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <MaterialModal item={modal} onSave={save} onClose={() => setModal(null)} />}
    </div>
  )
}

function MaterialModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({ ...item })
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  const billPrice = Number(form.cost_price) * (1 + Number(form.markup_pct) / 100)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <div className="modal-title">{form.id ? 'Edit Material' : 'Add Material'}</div>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Item Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="12 AWG THHN Wire" />
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Unit</label>
              <input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="each, ft, roll..." />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Your Cost (per unit)</label>
              <input type="number" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} step="0.01" />
            </div>
            <div className="form-group">
              <label>Markup %</label>
              <input type="number" value={form.markup_pct} onChange={e => set('markup_pct', e.target.value)} step="1" />
            </div>
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 14px', fontSize: 13 }}>
            Bill Price: <strong style={{ color: 'var(--success)' }}>{fmt(billPrice)}</strong> per {form.unit || 'unit'}
          </div>
          <div className="form-group" style={{ marginTop: 14 }}>
            <label>Description (optional)</label>
            <input value={form.description || ''} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => form.name.trim() && onSave(form)}>Save</button>
        </div>
      </div>
    </div>
  )
}

function SearchIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
}
