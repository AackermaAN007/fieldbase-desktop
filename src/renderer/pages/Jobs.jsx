import React, { useState, useEffect } from 'react'
import { useToast } from '../components/Toast'
import JobPhotos from '../components/JobPhotos'
import ChangeOrders from '../components/ChangeOrders'

const EMPTY = { client_id: '', title: '', site_address: '', site_city: '', site_state: '', site_zip: '', status: 'active', description: '', assigned_to: '' }

export default function Jobs({ onNavigate }) {
  const toast = useToast()
  const [jobs, setJobs] = useState([])
  const [clients, setClients] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [detailJob, setDetailJob] = useState(null)
  const [detailTab, setDetailTab] = useState('overview')

  useEffect(() => {
    Promise.all([
      window.electron.jobs.list(),
      window.electron.clients.list(),
      window.electron.team.get().catch(() => null),
    ]).then(([j, c, team]) => {
      setJobs(j)
      setClients(c)
      if (team?.members) setTeamMembers(team.members.filter(m => m.status === 'active'))
    })
  }, [])

  async function load() {
    const [j, team] = await Promise.all([
      window.electron.jobs.list(),
      window.electron.team.get().catch(() => null),
    ])
    setJobs(j)
    if (team?.members) setTeamMembers(team.members.filter(m => m.status === 'active'))
  }

  async function save(form) {
    try {
      if (form.id) await window.electron.jobs.update(form)
      else await window.electron.jobs.create(form)
      toast(form.id ? 'Job updated' : 'Job created')
      setModal(null)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  async function del(id) {
    if (!confirm('Delete this job?')) return
    await window.electron.jobs.delete(id)
    toast('Job deleted')
    setDetailJob(null)
    load()
  }

  const filtered = jobs.filter(j => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false
    if (search && !j.title.toLowerCase().includes(search.toLowerCase()) && !(j.client_name || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (detailJob) {
    return (
      <div>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setDetailJob(null)}>← Back</button>
            <div>
              <div className="page-title">{detailJob.title}</div>
              <div className="page-subtitle">{detailJob.client_name} · {[detailJob.site_address, detailJob.site_city].filter(Boolean).join(', ') || 'No site address'}</div>
            </div>
          </div>
          <div className="btn-group">
            <span className={`badge badge-${detailJob.status}`}>{detailJob.status}</span>
            <button className="btn btn-secondary" onClick={() => setModal({ ...detailJob })}>Edit Job</button>
            <button className="btn btn-danger" onClick={() => del(detailJob.id)}>Delete</button>
          </div>
        </div>

        <div className="tabs">
          {[['overview','Overview'],['photos','Photos'],['changes','Change Orders']].map(([id, label]) => (
            <button key={id} className={`tab ${detailTab === id ? 'active' : ''}`} onClick={() => setDetailTab(id)}>{label}</button>
          ))}
        </div>

        {detailTab === 'overview' && (
          <div className="card">
            <div className="form-row form-row-2">
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Client</div>
                <div style={{ fontWeight: 500 }}>{detailJob.client_name}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Site Address</div>
                <div>{[detailJob.site_address, detailJob.site_city, detailJob.site_state, detailJob.site_zip].filter(Boolean).join(', ') || '—'}</div>
              </div>
            </div>
            {detailJob.assigned_to && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Assigned To</div>
                <div>{teamMembers.find(m => m.user_id === detailJob.assigned_to)?.name || detailJob.assigned_to}</div>
              </div>
            )}
            {detailJob.description && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Description</div>
                <div style={{ color: 'var(--text-dim)', lineHeight: 1.6 }}>{detailJob.description}</div>
              </div>
            )}
            <div style={{ marginTop: 16, display: 'flex', gap: 24, fontSize: 13, color: 'var(--text-muted)' }}>
              <span>Created: {detailJob.created_at?.slice(0,10)}</span>
              {detailJob.completed_at && <span>Completed: {detailJob.completed_at?.slice(0,10)}</span>}
            </div>
          </div>
        )}

        {detailTab === 'photos' && (
          <div className="card"><JobPhotos jobId={detailJob.id} /></div>
        )}

        {detailTab === 'changes' && (
          <div className="card"><ChangeOrders jobId={detailJob.id} /></div>
        )}

        {modal && <JobModal job={modal} clients={clients} onSave={save} onClose={() => setModal(null)} />}
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Jobs</div>
          <div className="page-subtitle">{jobs.filter(j => j.status === 'active').length} active jobs</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ ...EMPTY })}>+ New Job</button>
      </div>

      <div className="search-row">
        <div className="search-input-wrap">
          <SearchIcon />
          <input placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {['all', 'active', 'complete'].map(s => (
            <button key={s} className={`tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state"><h3>No jobs found</h3><p>Add a job to start tracking projects</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Job Title</th><th>Client</th><th>Assigned To</th><th>Status</th><th>Created</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(j => {
                  const assignee = teamMembers.find(m => m.user_id === j.assigned_to)
                  return (
                  <tr key={j.id} style={{ cursor: 'pointer' }} onClick={() => setDetailJob(j)}>
                    <td style={{ fontWeight: 500 }}>{j.title}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{j.client_name}</div></td>
                    <td style={{ color: 'var(--text-dim)', fontSize: 12 }}>{[j.site_address, j.site_city].filter(Boolean).join(', ') || '—'}</td>
                    <td style={{ color: 'var(--text-dim)', fontSize: 13 }}>{assignee ? assignee.name : <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                    <td><span className={`badge badge-${j.status}`}>{j.status}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{j.created_at?.slice(0, 10)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setModal({ ...j })}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => del(j.id)}>Delete</button>
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

      {modal && <JobModal job={modal} clients={clients} teamMembers={teamMembers} onSave={save} onClose={() => setModal(null)} />}
    </div>
  )
}

function JobModal({ job, clients, teamMembers, onSave, onClose }) {
  const [form, setForm] = useState({ ...job })
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <div className="modal-title">{form.id ? 'Edit Job' : 'New Job'}</div>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Client *</label>
              <select value={form.client_id || ''} onChange={e => set('client_id', e.target.value)}>
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Job Title *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Panel upgrade, rewire..." />
            </div>
          </div>
          <div className="form-group">
            <label>Site Address</label>
            <input value={form.site_address || ''} onChange={e => set('site_address', e.target.value)} />
          </div>
          <div className="form-row form-row-3">
            <div className="form-group"><label>City</label><input value={form.site_city || ''} onChange={e => set('site_city', e.target.value)} /></div>
            <div className="form-group"><label>State</label><input value={form.site_state || ''} onChange={e => set('site_state', e.target.value)} maxLength={2} /></div>
            <div className="form-group"><label>ZIP</label><input value={form.site_zip || ''} onChange={e => set('site_zip', e.target.value)} /></div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="complete">Complete</option>
              </select>
            </div>
            {teamMembers.length > 0 && (
              <div className="form-group">
                <label>Assigned To</label>
                <select value={form.assigned_to || ''} onChange={e => set('assigned_to', e.target.value)}>
                  <option value="">Unassigned</option>
                  {teamMembers.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Description / Notes</label>
            <textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => form.client_id && form.title.trim() && onSave(form)}>Save Job</button>
        </div>
      </div>
    </div>
  )
}

function SearchIcon() {
  return <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
}
