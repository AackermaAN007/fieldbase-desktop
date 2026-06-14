import React, { useState, useEffect } from 'react'
import { useToast } from '../components/Toast'

const EMPTY = { name: '', email: '', phone: '', address: '', city: '', state: '', zip: '', notes: '' }

export default function Clients({ onNavigate }) {
  const toast = useToast()
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'new' | client object

  useEffect(() => { load() }, [])

  async function load() {
    setClients(await window.electron.clients.list())
  }

  async function save(form) {
    try {
      if (form.id) {
        await window.electron.clients.update(form)
        toast('Client updated')
      } else {
        await window.electron.clients.create(form)
        toast('Client created')
      }
      setModal(null)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  async function del(id) {
    if (!confirm('Delete this client? Their jobs and invoices will also be deleted.')) return
    await window.electron.clients.delete(id)
    toast('Client deleted')
    load()
  }

  const filtered = clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Clients</div>
          <div className="page-subtitle">{clients.length} total clients</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(EMPTY)}>+ New Client</button>
      </div>

      <div className="search-row">
        <div className="search-input-wrap">
          <SearchIcon />
          <input placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>{search ? 'No results' : 'No clients yet'}</h3>
            <p>{search ? 'Try a different search' : 'Add your first client to get started'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>City</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{c.email || '—'}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{c.phone || '—'}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{c.city || '—'}</td>
                    <td>
                      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setModal({ ...c })}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => del(c.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <ClientModal client={modal} onSave={save} onClose={() => setModal(null)} />}
    </div>
  )
}

function ClientModal({ client, onSave, onClose }) {
  const [form, setForm] = useState({ ...client })
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <div className="modal-title">{form.id ? 'Edit Client' : 'New Client'}</div>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Full Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Street Address</label>
            <input value={form.address || ''} onChange={e => set('address', e.target.value)} />
          </div>
          <div className="form-row form-row-3">
            <div className="form-group">
              <label>City</label>
              <input value={form.city || ''} onChange={e => set('city', e.target.value)} />
            </div>
            <div className="form-group">
              <label>State</label>
              <input value={form.state || ''} onChange={e => set('state', e.target.value)} maxLength={2} />
            </div>
            <div className="form-group">
              <label>ZIP</label>
              <input value={form.zip || ''} onChange={e => set('zip', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={3} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => form.name.trim() && onSave(form)}>Save Client</button>
        </div>
      </div>
    </div>
  )
}

function SearchIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
}
