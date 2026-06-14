import React, { useState, useEffect } from 'react'
import { useToast } from '../components/Toast'

const COLORS = [
  '#4f7ef8', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#f97316', '#ec4899',
]

const STATUS_COLORS = {
  scheduled: '#4f7ef8',
  completed: '#22c55e',
  cancelled: '#6b7280',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function pad(n) { return String(n).padStart(2,'0') }
function toDateStr(y,m,d) { return `${y}-${pad(m+1)}-${pad(d)}` }

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

export default function Calendar({ settings }) {
  const toast = useToast()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [schedules, setSchedules] = useState([])
  const [clients, setClients] = useState([])
  const [jobs, setJobs] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [modal, setModal] = useState(null)

  useEffect(() => { loadSchedules() }, [viewYear, viewMonth])
  useEffect(() => {
    window.electron.clients.list().then(setClients)
    window.electron.jobs.list().then(setJobs)
  }, [])

  async function loadSchedules() {
    const data = await window.electron.schedules.list({ month: viewMonth + 1, year: viewYear })
    setSchedules(data)
  }

  async function saveSchedule(form) {
    try {
      if (form.id) await window.electron.schedules.update(form)
      else await window.electron.schedules.create(form)
      toast(form.id ? 'Appointment updated' : 'Appointment added')
      setModal(null)
      loadSchedules()
    } catch (e) { toast(e.message, 'error') }
  }

  async function deleteSchedule(id) {
    if (!confirm('Delete this appointment?')) return
    await window.electron.schedules.delete(id)
    toast('Appointment deleted')
    setModal(null)
    loadSchedules()
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7

  // Map schedules by date string
  const byDate = {}
  schedules.forEach(s => {
    const d = s.start_datetime?.slice(0, 10)
    if (!d) return
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(s)
  })

  const selectedDateStr = selectedDay ? toDateStr(viewYear, viewMonth, selectedDay) : null
  const selectedItems = selectedDateStr ? (byDate[selectedDateStr] || []) : []

  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`

  // Today's and upcoming appointments for the sidebar
  const upcomingAll = schedules.filter(s => {
    const d = s.start_datetime?.slice(0, 10)
    return d >= todayStr && s.status !== 'cancelled'
  }).slice(0, 8)

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 80px)' }}>
      {/* Main Calendar */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={prevMonth}>←</button>
            <div>
              <div className="page-title">{MONTHS[viewMonth]} {viewYear}</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={nextMonth}>→</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()) }}>
              Today
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => {
            const pre = selectedDay ? toDateStr(viewYear, viewMonth, selectedDay) : todayStr
            setModal({ start_datetime: `${pre}T09:00`, end_datetime: `${pre}T10:00`, color: '#4f7ef8' })
          }}>
            + New Appointment
          </button>
        </div>

        {/* Calendar grid */}
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
            {DAYS.map(d => (
              <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, overflow: 'auto' }}>
            {Array.from({ length: totalCells }).map((_, i) => {
              const dayNum = i - firstDay + 1
              const valid = dayNum >= 1 && dayNum <= daysInMonth
              const dateStr = valid ? toDateStr(viewYear, viewMonth, dayNum) : null
              const events = valid ? (byDate[dateStr] || []) : []
              const isToday = dateStr === todayStr
              const isSelected = valid && dayNum === selectedDay

              return (
                <div
                  key={i}
                  onClick={() => valid && setSelectedDay(dayNum)}
                  style={{
                    minHeight: 90,
                    padding: '6px 8px',
                    borderRight: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    background: isSelected ? 'rgba(79,126,248,0.08)' : 'transparent',
                    cursor: valid ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                  }}
                >
                  {valid && (
                    <>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: isToday ? 'var(--accent)' : 'transparent',
                        color: isToday ? 'white' : 'var(--text-dim)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: isToday ? 700 : 400,
                        marginBottom: 4,
                      }}>
                        {dayNum}
                      </div>
                      {events.slice(0, 3).map(ev => (
                        <div
                          key={ev.id}
                          onClick={e => { e.stopPropagation(); setModal({ ...ev }) }}
                          style={{
                            background: (ev.color || '#4f7ef8') + '25',
                            borderLeft: `3px solid ${ev.color || '#4f7ef8'}`,
                            borderRadius: '0 4px 4px 0',
                            padding: '2px 6px',
                            fontSize: 11,
                            color: ev.color || '#4f7ef8',
                            marginBottom: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: 'pointer',
                          }}
                        >
                          {!ev.all_day && ev.start_datetime?.slice(11, 16)} {ev.title}
                        </div>
                      ))}
                      {events.length > 3 && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 4 }}>+{events.length - 3} more</div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right sidebar — selected day or upcoming */}
      <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {selectedDay ? (
          <div className="card" style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {MONTHS[viewMonth].slice(0,3)} {selectedDay}
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => {
                const pre = toDateStr(viewYear, viewMonth, selectedDay)
                setModal({ start_datetime: `${pre}T09:00`, end_datetime: `${pre}T10:00`, color: '#4f7ef8' })
              }}>+ Add</button>
            </div>
            {selectedItems.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No appointments</div>
            ) : (
              selectedItems.map(ev => (
                <EventCard key={ev.id} ev={ev} onClick={() => setModal({ ...ev })} />
              ))
            )}
          </div>
        ) : (
          <div className="card" style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Upcoming</div>
            {upcomingAll.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No upcoming appointments</div>
            ) : (
              upcomingAll.map(ev => (
                <EventCard key={ev.id} ev={ev} onClick={() => setModal({ ...ev })} />
              ))
            )}
          </div>
        )}
      </div>

      {/* Appointment modal */}
      {modal && (
        <AppointmentModal
          ev={modal}
          clients={clients}
          jobs={jobs}
          onSave={saveSchedule}
          onDelete={deleteSchedule}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function EventCard({ ev, onClick }) {
  const color = ev.color || '#4f7ef8'
  const timeStr = ev.all_day ? 'All day' : ev.start_datetime?.slice(11, 16)
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px', borderRadius: 8, marginBottom: 8, cursor: 'pointer',
        background: color + '15', borderLeft: `3px solid ${color}`,
        transition: 'opacity 0.15s',
      }}
    >
      <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 2 }}>{ev.title}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {ev.start_datetime?.slice(0,10)} {timeStr && `· ${timeStr}`}
      </div>
      {ev.client_name && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>👤 {ev.client_name}</div>}
      {ev.status !== 'scheduled' && (
        <span style={{
          display: 'inline-block', marginTop: 4, fontSize: 10, padding: '2px 8px',
          borderRadius: 20, background: STATUS_COLORS[ev.status] + '25',
          color: STATUS_COLORS[ev.status], fontWeight: 600,
        }}>{ev.status}</span>
      )}
    </div>
  )
}

function AppointmentModal({ ev, clients, jobs, onSave, onDelete, onClose }) {
  const isEdit = !!ev.id
  const [form, setForm] = useState({
    title: ev.title || '',
    client_id: ev.client_id || '',
    job_id: ev.job_id || '',
    start_datetime: ev.start_datetime || '',
    end_datetime: ev.end_datetime || '',
    all_day: ev.all_day || 0,
    notes: ev.notes || '',
    status: ev.status || 'scheduled',
    color: ev.color || '#4f7ef8',
    id: ev.id,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const clientJobs = jobs.filter(j => !form.client_id || String(j.client_id) === String(form.client_id))

  function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave({ ...form, client_id: form.client_id || null, job_id: form.job_id || null })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Appointment' : 'New Appointment'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit} style={{ padding: '0 24px 24px' }}>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Panel installation at Smith residence" required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Client</label>
              <select className="form-input" value={form.client_id} onChange={e => { set('client_id', e.target.value); set('job_id', '') }}>
                <option value="">— No client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Job</label>
              <select className="form-input" value={form.job_id} onChange={e => set('job_id', e.target.value)}>
                <option value="">— No job —</option>
                {clientJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
              <input type="checkbox" checked={!!form.all_day} onChange={e => set('all_day', e.target.checked ? 1 : 0)} />
              <span className="form-label" style={{ margin: 0 }}>All-day event</span>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">{form.all_day ? 'Date' : 'Start'}</label>
              <input className="form-input" type={form.all_day ? 'date' : 'datetime-local'} value={form.all_day ? form.start_datetime?.slice(0,10) : form.start_datetime} onChange={e => set('start_datetime', form.all_day ? e.target.value : e.target.value)} required />
            </div>
            {!form.all_day && (
              <div className="form-group">
                <label className="form-label">End</label>
                <input className="form-input" type="datetime-local" value={form.end_datetime} onChange={e => set('end_datetime', e.target.value)} />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => set('color', c)} style={{
                    width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: form.color === c ? '2px solid white' : '2px solid transparent',
                    boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none',
                    transition: 'all 0.15s',
                  }} />
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} style={{ resize: 'vertical' }} placeholder="Job notes, materials needed, directions…" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <div>
              {isEdit && (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(ev.id)}>Delete</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary">{isEdit ? 'Save Changes' : 'Add Appointment'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
