import React from 'react'
import { calcInvoiceTotals, fmt } from '../utils/invoiceCalc'

export default function InvoicePdfTemplate({ invoice, settings, signature, paymentQRs }) {
  if (!invoice) return null
  const sym = settings?.currency_symbol || '$'
  const taxLabel = settings?.tax_name || 'Tax'
  const totals = calcInvoiceTotals(invoice.items, invoice.tax_rate, invoice.discount_pct)
  const laborItems = (invoice.items || []).filter(i => i.category === 'Labor')
  const matItems = (invoice.items || []).filter(i => i.category === 'Materials')

  const s = {
    page: { background: 'white', color: '#1a1a2e', fontFamily: 'Arial, sans-serif', fontSize: 13, padding: 40, minHeight: '100%' },
    header: { display: 'flex', justifyContent: 'space-between', marginBottom: 32 },
    bizName: { fontSize: 22, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 },
    invTitle: { fontSize: 28, fontWeight: 700, color: settings?.accent_color || '#4f7ef8', textAlign: 'right' },
    invNum: { fontSize: 14, color: '#6b7280', textAlign: 'right' },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#6b7280', marginBottom: 8 },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: 16 },
    th: { textAlign: 'left', padding: '8px 10px', background: '#f3f4f6', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#374151' },
    td: { padding: '8px 10px', borderBottom: '1px solid #e5e7eb', fontSize: 13 },
    catRow: { background: (settings?.accent_color || '#4f7ef8') + '18', padding: '5px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: settings?.accent_color || '#4f7ef8', letterSpacing: 0.5 },
    totalsArea: { display: 'flex', justifyContent: 'flex-end', marginTop: 16 },
    totalsTable: { width: 300 },
    totalRow: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 },
    grandRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 16, fontWeight: 700, borderTop: '2px solid #1a1a2e', marginTop: 4 },
    footer: { marginTop: 40, borderTop: '1px solid #e5e7eb', paddingTop: 16, fontSize: 11, color: '#6b7280' },
  }

  const activeQRs = paymentQRs ? Object.entries(paymentQRs).filter(([, v]) => v?.dataUrl) : []

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          {settings?.logo_data && <img src={settings.logo_data} alt="Logo" style={{ height: 56, maxWidth: 200, objectFit: 'contain', marginBottom: 8, display: 'block' }} />}
          <div style={s.bizName}>{settings?.business_name || 'Your Business'}</div>
          {settings?.address && <div>{settings.address}</div>}
          {(settings?.city || settings?.state) && <div>{[settings.city, settings.state, settings.zip].filter(Boolean).join(', ')}</div>}
          {settings?.phone && <div>{settings.phone}</div>}
          {settings?.email && <div>{settings.email}</div>}
          {settings?.license_number && <div style={{ color: '#6b7280', marginTop: 4 }}>Lic # {settings.license_number}</div>}
        </div>
        <div>
          <div style={s.invTitle}>{invoice.type === 'estimate' ? 'ESTIMATE' : 'INVOICE'}</div>
          <div style={s.invNum}>{invoice.invoice_number}</div>
          {invoice.issue_date && <div style={{ ...s.invNum, marginTop: 8 }}>Date: {invoice.issue_date}</div>}
          {invoice.due_date && <div style={s.invNum}>Due: {invoice.due_date}</div>}
          <div style={{ ...s.invNum, marginTop: 8 }}>
            <span style={{ background: statusColors[invoice.status]?.bg, color: statusColors[invoice.status]?.text, padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
              {(invoice.status || '').toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div style={{ display: 'flex', gap: 48, marginBottom: 28 }}>
        <div style={s.section}>
          <div style={s.sectionTitle}>Bill To</div>
          <div style={{ fontWeight: 600 }}>{invoice.client_name}</div>
          {invoice.client_address && <div>{invoice.client_address}</div>}
          {(invoice.client_city || invoice.client_state) && <div>{[invoice.client_city, invoice.client_state, invoice.client_zip].filter(Boolean).join(', ')}</div>}
          {invoice.client_email && <div>{invoice.client_email}</div>}
          {invoice.client_phone && <div>{invoice.client_phone}</div>}
        </div>
        {invoice.job_title && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Job / Project</div>
            <div style={{ fontWeight: 600 }}>{invoice.job_title}</div>
            {invoice.site_address && <div>{invoice.site_address}</div>}
            {(invoice.site_city || invoice.site_state) && <div>{[invoice.site_city, invoice.site_state, invoice.site_zip].filter(Boolean).join(', ')}</div>}
          </div>
        )}
      </div>

      {/* Line items */}
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Description</th>
            <th style={{ ...s.th, width: 80, textAlign: 'center' }}>Qty</th>
            <th style={{ ...s.th, width: 120, textAlign: 'right' }}>Unit Price</th>
            <th style={{ ...s.th, width: 120, textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {laborItems.length > 0 && (
            <>
              <tr><td colSpan={4} style={s.catRow}>Labor</td></tr>
              {laborItems.map((item, i) => (
                <tr key={i}>
                  <td style={s.td}>{item.description}</td>
                  <td style={{ ...s.td, textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(item.unit_price, sym)}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(item.quantity * item.unit_price, sym)}</td>
                </tr>
              ))}
            </>
          )}
          {matItems.length > 0 && (
            <>
              <tr><td colSpan={4} style={s.catRow}>Materials</td></tr>
              {matItems.map((item, i) => (
                <tr key={i}>
                  <td style={s.td}>{item.description}</td>
                  <td style={{ ...s.td, textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(item.unit_price, sym)}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(item.quantity * item.unit_price, sym)}</td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div style={s.totalsArea}>
        <div style={s.totalsTable}>
          {laborItems.length > 0 && (
            <div style={s.totalRow}><span style={{ color: '#6b7280' }}>Labor Subtotal</span><span style={{ fontFamily: 'monospace' }}>{fmt(totals.laborSub, sym)}</span></div>
          )}
          {matItems.length > 0 && (
            <div style={s.totalRow}><span style={{ color: '#6b7280' }}>Materials Subtotal</span><span style={{ fontFamily: 'monospace' }}>{fmt(totals.materialsSub, sym)}</span></div>
          )}
          <div style={s.totalRow}><span style={{ color: '#6b7280' }}>Subtotal</span><span style={{ fontFamily: 'monospace' }}>{fmt(totals.subtotal, sym)}</span></div>
          {totals.discount > 0 && <div style={{ ...s.totalRow, color: '#22c55e' }}><span>Discount ({invoice.discount_pct}%)</span><span style={{ fontFamily: 'monospace' }}>-{fmt(totals.discount, sym)}</span></div>}
          <div style={s.totalRow}><span style={{ color: '#6b7280' }}>{taxLabel} ({invoice.tax_rate}%)</span><span style={{ fontFamily: 'monospace' }}>{fmt(totals.tax, sym)}</span></div>
          <div style={s.grandRow}><span>Total</span><span style={{ fontFamily: 'monospace' }}>{fmt(totals.total, sym)}</span></div>
        </div>
      </div>

      {/* Notes & Terms */}
      {(invoice.notes || invoice.terms) && (
        <div style={{ display: 'flex', gap: 32, marginTop: 28 }}>
          {invoice.notes && (
            <div style={{ flex: 1 }}>
              <div style={s.sectionTitle}>Notes</div>
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{invoice.notes}</div>
            </div>
          )}
          {invoice.terms && (
            <div style={{ flex: 1 }}>
              <div style={s.sectionTitle}>Terms & Conditions</div>
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{invoice.terms}</div>
            </div>
          )}
        </div>
      )}

      {/* Signature */}
      {signature && (
        <div style={{ marginTop: 28 }}>
          <div style={s.sectionTitle}>Customer Signature</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <img src={signature.data} alt="Signature" style={{ height: 56, background: '#f9fafb', borderRadius: 4, padding: 4, border: '1px solid #e5e7eb' }} />
            <div style={{ fontSize: 11, color: '#6b7280' }}>{signature.signer_name} · {signature.signed_at?.slice(0,10)}</div>
          </div>
        </div>
      )}

      {/* Payment Methods Section */}
      {activeQRs.length > 0 && (
        <div style={{ marginTop: 32, borderTop: '1px solid #e5e7eb', paddingTop: 20 }}>
          <div style={s.sectionTitle}>Pay Now — Scan to Pay Instantly</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {activeQRs.map(([method, info]) => (
              <div key={method} style={{ textAlign: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', minWidth: 110 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: methodColors[method] }}>
                  {methodEmoji[method]} {methodLabel[method]}
                </div>
                <img src={info.dataUrl} alt={`${method} QR`} style={{ width: 80, height: 80, display: 'block', margin: '0 auto' }} />
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4, wordBreak: 'break-all' }}>{info.handle}</div>
              </div>
            ))}
            {/* Zelle — no QR, just info card */}
            {paymentQRs?.zelle?.handle && !paymentQRs.zelle.dataUrl && (
              <div style={{ textAlign: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', minWidth: 110 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#6d33c7' }}>💛 Zelle</div>
                <div style={{ fontSize: 26, margin: '10px 0' }}>🏦</div>
                <div style={{ fontSize: 11, color: '#374151', fontWeight: 600, marginTop: 4 }}>{paymentQRs.zelle.handle}</div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Search in your bank app</div>
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 10 }}>
            Include invoice # <strong>{invoice.invoice_number}</strong> in your payment note.
          </div>
        </div>
      )}

      {/* Zelle only (no QR methods active) */}
      {activeQRs.length === 0 && paymentQRs?.zelle?.handle && (
        <div style={{ marginTop: 28, borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
          <div style={s.sectionTitle}>Payment</div>
          <div style={{ fontSize: 13 }}>💛 <strong>Zelle:</strong> {paymentQRs.zelle.handle} — search in your bank app. Include invoice # {invoice.invoice_number}.</div>
        </div>
      )}

      {/* Footer */}
      <div style={s.footer}>
        {settings?.warranty_text && <div style={{ marginBottom: 4 }}>⚡ {settings.warranty_text}</div>}
        <div>{settings?.business_name} · {settings?.phone} · {settings?.email}</div>
        {settings?.license_number && <div>Contractor License: {settings.license_number}</div>}
      </div>
    </div>
  )
}

const statusColors = {
  draft: { bg: '#f3f4f6', text: '#6b7280' },
  sent: { bg: '#eff6ff', text: '#4f7ef8' },
  paid: { bg: '#f0fdf4', text: '#22c55e' },
  overdue: { bg: '#fef2f2', text: '#ef4444' },
  estimate: { bg: '#fffbeb', text: '#f59e0b' },
}

const methodLabel = { venmo: 'Venmo', paypal: 'PayPal', cashapp: 'Cash App' }
const methodEmoji = { venmo: '💜', paypal: '💙', cashapp: '💚' }
const methodColors = { venmo: '#3d95ce', paypal: '#003087', cashapp: '#00d632' }
