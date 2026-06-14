import React, { useState, useEffect } from 'react'
import { useToast } from './Toast'
import { fmt } from '../utils/invoiceCalc'

const EMPTY = { title: '', description: '', amount: '0', status: 'pending' }

export default function ChangeOrders({ jobId }) {
  const toast = useToast()
  const [orders, setOrders] = useState([])
  const [modal, setModal] = useState(null)

  useEffect(() => { load() }, [jobId])

  async function load() {
    setOrders(await window.electron.changeOrders.list(jobId))
  }

  async function save(form) {
    if (form.id) await window.electron.changeOrders.update({ ...form, job_id: jobId })
    else await window.electron.changeOrders.create({ ...form, job_id: jobId, invoice_id: null })
    toast(form.id ? 'Change order updated' : 'Change order added')
    setModal(null)
    load()
  }

  async function del(id) {
    if (!confirm('Delete this change order?')) return
    await window.electron.changeOrders.delete(id)
    toast('Deleted')
    load()
  }

  const total = orders.reduce((s, o) => s + (o.status !== 'rejected' ? Number(o.amount) : 0), 0)

  const statusColor = { pending: 'var(--warning)', approved: 'var(--success)', rejected: 'var(--danger)', invoiced: 'var(--accent)' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Change Orders ({orders.length})</span>
          {total > 0 && <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--success)' }}>+{fmt(total)} added</span>}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setModal({ ...EMPTY })}>+ Add Change Order</button>
      </div>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', background: 'var(--surface2)', borderRadius: 8, fontSize: 13 }}>
          No change orders. Add one when the scope of work changes after the original estimate.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orders.map(o => (
            <div key={o.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{o.title}</div>
                {o.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{o.description}</div>}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--success)', minWidth: 80, textAlign: 'right' }}>{fmt(o.amount)}</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: statusColor[o.status], minWidth: 60, textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '3px 8px', borderRadius: 20 }}>
                {o.status}
              </span>
              <div className="btn-group">
                <button className="btn btn-secondary btn-sm" onClick={() => setModal({ ...o })}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => del(o.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title">{modal.id ? 'Edit Change Order' : 'New Change Order'}</div>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Title *</label>
                <input value={modal.title} onChange={e => setModal(m => ({ ...m, title: e.target.value }))} placeholder="e.g. Added 2 extra outlets" autoFocus />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={modal.description || ''} onChange={e => setModal(m => ({ ...m, description: e.target.value }))} rows={2} />
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label>Amount ($)</label>
                  <input type="number" value={modal.amount} onChange={e => setModal(m => ({ ...m, amount: e.target.value }))} step="0.01" />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={modal.status} onChange={e => setModal(m => ({ ...m, status: e.target.value }))}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="invoiced">Invoiced</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => modal.title.trim() && save(modal)}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
