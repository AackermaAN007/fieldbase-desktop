import React, { useState, useEffect } from 'react'
import { fmt, calcInvoiceTotals } from '../utils/invoiceCalc'
import { useToast } from '../components/Toast'

function calcTotal(inv) {
  if (!inv.items) return 0
  const sub = inv.items.reduce((s, i) => s + (i.quantity * i.unit_price), 0)
  const disc = sub * ((inv.discount_pct || 0) / 100)
  const tax = (sub - disc) * ((inv.tax_rate || 0) / 100)
  return sub - disc + tax
}

export default function Dashboard({ onNavigate, settings }) {
  const toast = useToast()
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [jobs, setJobs] = useState([])
  const [sendingReminders, setSendingReminders] = useState(false)
  const [aging, setAging] = useState([])

  useEffect(() => {
    Promise.all([
      window.electron.invoices.list({ type: 'invoice' }),
      window.electron.clients.list(),
      window.electron.jobs.list(),
      window.electron.reports.aging(),
    ]).then(([invs, cls, jbs, ag]) => {
      setInvoices(invs); setClients(cls); setJobs(jbs); setAging(ag)
    }).catch(() => {})
  }, [])

  const paid = invoices.filter(i => i.status === 'paid')
  const outstanding = invoices.filter(i => ['sent','overdue'].includes(i.status))
  const overdue = invoices.filter(i => i.status === 'overdue')

  // Aging buckets
  const current = aging.filter(i => (i.days_overdue || 0) <= 0)
  const days1_30 = aging.filter(i => i.days_overdue > 0 && i.days_overdue <= 30)
  const days31_60 = aging.filter(i => i.days_overdue > 30 && i.days_overdue <= 60)
  const days60plus = aging.filter(i => i.days_overdue > 60)

  const recentInvoices = invoices.slice(0, 6)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Welcome back{settings?.owner_name ? `, ${settings.owner_name}` : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('invoices')}>+ New Invoice</button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {fmt(paid.reduce((s, i) => s + calcTotal(i), 0))}
          </div>
          <div className="stat-sub">{paid.length} paid invoices</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Outstanding</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {fmt(outstanding.reduce((s, i) => s + calcTotal(i), 0))}
          </div>
          <div className="stat-sub">{outstanding.length} unpaid</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Clients</div>
          <div className="stat-value">{clients.length}</div>
          <div className="stat-sub">{jobs.filter(j => j.status === 'active').length} active jobs</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Overdue</div>
          <div className="stat-value" style={{ color: overdue.length ? 'var(--danger)' : undefined }}>
            {overdue.length}
          </div>
          <div className="stat-sub">{fmt(overdue.reduce((s, i) => s + calcTotal(i), 0))}</div>
        </div>
      </div>

      {/* Aging Report */}
      {aging.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title">Invoice Aging Report</div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('invoices')}>View All</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Current', items: current, color: 'var(--accent)' },
              { label: '1–30 Days', items: days1_30, color: 'var(--warning)' },
              { label: '31–60 Days', items: days31_60, color: '#f97316' },
              { label: '60+ Days', items: days60plus, color: 'var(--danger)' },
            ].map(({ label, items, color }) => (
              <div key={label} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color }}>{fmt(items.reduce((s, i) => s + calcTotal(i), 0))}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{items.length} invoice{items.length !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
          {overdue.length > 0 && (
            <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '12px 16px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span>
                ⚠️ <strong>{overdue.length}</strong> overdue invoice{overdue.length !== 1 ? 's' : ''}
                {days60plus.length > 0 && ` — ${days60plus.length} over 60 days`}
              </span>
              <button
                className="btn btn-sm btn-danger"
                disabled={sendingReminders}
                onClick={async () => {
                  setSendingReminders(true)
                  const res = await window.electron.email.sendReminders()
                  setSendingReminders(false)
                  if (res.success) {
                    if (res.sent === 0) toast(res.message || 'No reminders to send today', 'info')
                    else toast(`Sent ${res.sent} reminder email${res.sent !== 1 ? 's' : ''}`)
                  } else {
                    toast(res.error || 'Failed to send reminders', 'error')
                  }
                }}
              >
                {sendingReminders ? 'Sending…' : '✉ Send Reminders'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recent Invoices */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent Invoices</div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('invoices')}>View All</button>
        </div>
        {recentInvoices.length === 0 ? (
          <div className="empty-state">
            <h3>No invoices yet</h3>
            <p>Create your first invoice to get started</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Invoice #</th><th>Client</th><th>Due Date</th><th>Status</th><th className="text-right">Amount</th></tr>
              </thead>
              <tbody>
                {recentInvoices.map(inv => (
                  <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => onNavigate('invoices')}>
                    <td className="font-mono" style={{ fontSize: 12 }}>{inv.invoice_number}</td>
                    <td>{inv.client_name || '—'}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{inv.due_date || '—'}</td>
                    <td><span className={`badge badge-${inv.status}`}>{inv.status}</span></td>
                    <td className="text-right font-mono" style={{ fontWeight: 600 }}>
                      {fmt(calcInvoiceTotals(inv.items || [], inv.tax_rate, inv.discount_pct).total, settings?.currency_symbol || '$')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
