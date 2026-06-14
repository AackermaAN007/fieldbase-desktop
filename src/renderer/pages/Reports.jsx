import React, { useState, useEffect } from 'react'
import { fmt } from '../utils/invoiceCalc'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function Reports({ settings }) {
  const [data, setData] = useState(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const sym = settings?.currency_symbol || '$'

  useEffect(() => { load() }, [year])

  async function load() {
    const r = await window.electron.reports.revenue({ year })
    setData(r)
  }

  if (!data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div className="spinner" />
    </div>
  )

  const maxMonthly = Math.max(...data.monthly.map(m => m.revenue), 1)
  const netProfit = data.profit
  const profitMargin = data.thisYear?.total > 0 ? (netProfit / data.thisYear.total * 100) : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Revenue & Reports</div>
          <div className="page-subtitle">Financial overview and payment history</div>
        </div>
        <div className="btn-group">
          <select className="btn btn-secondary btn-sm" value={year} onChange={e => setYear(Number(e.target.value))}>
            {[0,1,2].map(i => {
              const y = new Date().getFullYear() - i
              return <option key={y} value={y}>{y}</option>
            })}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">Revenue {year}</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{fmt(data.thisYear?.total || 0, sym)}</div>
          <div className="stat-sub">{data.monthly.reduce((s, m) => s + m.invoice_count, 0)} invoices paid</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Expenses {year}</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{fmt(data.expensesYear?.total || 0, sym)}</div>
          <div className="stat-sub">Total business costs</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Net Profit {year}</div>
          <div className="stat-value" style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {fmt(netProfit, sym)}
          </div>
          <div className="stat-sub">{profitMargin.toFixed(1)}% margin</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">This Month</div>
          <div className="stat-value">{fmt(data.thisMonth?.total || 0, sym)}</div>
          <div className="stat-sub">All time: {fmt(data.allTime?.total || 0, sym)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Monthly Revenue Bar Chart */}
        <div className="card">
          <div className="card-header"><div className="card-title">Monthly Revenue — {year}</div></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, paddingBottom: 4 }}>
            {MONTHS.map((label, i) => {
              const monthStr = String(i + 1).padStart(2, '0')
              const row = data.monthly.find(m => m.month === monthStr)
              const val = row?.revenue || 0
              const pct = maxMonthly > 0 ? val / maxMonthly : 0
              const isCurrentMonth = new Date().getMonth() === i && new Date().getFullYear() === year
              return (
                <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  {val > 0 && (
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {fmt(val, sym).replace(sym, '')}
                    </div>
                  )}
                  <div style={{
                    width: '100%', minHeight: 4,
                    height: `${Math.max(pct * 110, val > 0 ? 8 : 2)}px`,
                    background: isCurrentMonth ? 'var(--accent)' : val > 0 ? 'rgba(79,126,248,0.5)' : 'var(--surface2)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.4s ease',
                  }} />
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Expenses by Category */}
        <div className="card">
          <div className="card-header"><div className="card-title">Expenses by Category — {year}</div></div>
          {data.expensesByCategory.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No expenses recorded this year.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.expensesByCategory.map(({ category, total }) => {
                const pct = data.expensesYear?.total > 0 ? total / data.expensesYear.total * 100 : 0
                const colors = { Materials: '#4f7ef8', Fuel: '#f59e0b', Tools: '#10b981', Subcontractors: '#8b5cf6', Insurance: '#ef4444', Meals: '#f97316', Office: '#6b7280', Other: '#9ca3af' }
                const color = colors[category] || '#6b7280'
                return (
                  <div key={category}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color }}>{category}</span>
                      <span style={{ fontWeight: 600 }}>{fmt(total, sym)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Top Clients */}
        <div className="card">
          <div className="card-header"><div className="card-title">Top Clients by Revenue</div></div>
          {data.topClients.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No paid invoices yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {data.topClients.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < data.topClients.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: `hsl(${i * 60}, 60%, 50%)22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: `hsl(${i * 60}, 60%, 60%)` }}>
                      {i + 1}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{c.name || 'Unknown'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.invoices} invoice{c.invoices !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(c.revenue, sym)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Methods */}
        <div className="card">
          <div className="card-header"><div className="card-title">Revenue by Payment Method</div></div>
          {data.byMethod.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No payments recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {data.byMethod.map((m, i) => {
                const icons = { venmo: '💜', paypal: '💙', cashapp: '💚', zelle: '💛', cash: '💵', check: '🏦', stripe: '💳', manual: '✏️' }
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < data.byMethod.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{icons[m.method] || '💰'}</span>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13, textTransform: 'capitalize' }}>{m.method}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.count} payment{m.count !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700 }}>{fmt(m.total, sym)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
