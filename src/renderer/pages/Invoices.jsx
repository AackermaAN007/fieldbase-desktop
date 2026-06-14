import React, { useState, useEffect, useRef } from 'react'
import { useToast } from '../components/Toast'
import InvoiceEditor from '../components/InvoiceEditor'
import InvoicePdfTemplate from '../components/InvoicePdfTemplate'
import SignaturePad from '../components/SignaturePad'
import PaymentTracker from '../components/PaymentTracker'
import { calcInvoiceTotals, fmt } from '../utils/invoiceCalc'

async function buildPaymentQRs(inv, s) {
  const QRCode = await import('qrcode')
  const opts = { width: 200, margin: 1, color: { dark: '#1a1d27', light: '#ffffff' } }
  const total = calcInvoiceTotals(inv.items, inv.tax_rate, inv.discount_pct).total
  const note = encodeURIComponent(`Invoice ${inv.invoice_number}`)
  const result = {}

  if (s.venmo_username) {
    const url = `https://venmo.com/${s.venmo_username}?txn=pay&amount=${total.toFixed(2)}&note=${note}`
    result.venmo = { dataUrl: await QRCode.toDataURL(url, opts), handle: `@${s.venmo_username}` }
  }
  if (s.paypal_username) {
    const url = `https://paypal.me/${s.paypal_username}/${total.toFixed(2)}`
    result.paypal = { dataUrl: await QRCode.toDataURL(url, opts), handle: `paypal.me/${s.paypal_username}` }
  }
  if (s.cashapp_tag) {
    const url = `https://cash.app/$${s.cashapp_tag}/${total.toFixed(2)}`
    result.cashapp = { dataUrl: await QRCode.toDataURL(url, opts), handle: `$${s.cashapp_tag}` }
  }
  if (s.zelle_contact) {
    // Zelle has no universal deep link — just show contact info
    result.zelle = { dataUrl: null, handle: s.zelle_contact }
  }
  return result
}

export default function Invoices({ settings }) {
  const toast = useToast()
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [jobs, setJobs] = useState([])
  const [materials, setMaterials] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [detailInv, setDetailInv] = useState(null)
  const [sigModal, setSigModal] = useState(null)
  const [signature, setSignature] = useState(null)
  const [paymentQRs, setPaymentQRs] = useState(null)
  const [emailConfirm, setEmailConfirm] = useState(null)
  const pdfRef = useRef()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const [invs, cls, jbs, mats] = await Promise.all([
        window.electron.invoices.list({ type: 'invoice' }),
        window.electron.clients.list(),
        window.electron.jobs.list(),
        window.electron.materials.list(),
      ])
      setInvoices(invs); setClients(cls); setJobs(jbs); setMaterials(mats)
    } catch {}
  }

  async function openDetail(id) {
    const inv = await window.electron.invoices.get(id)
    const sig = await window.electron.signatures.get(id)
    setDetailInv(inv)
    setSignature(sig || null)
    // Build QR codes with latest settings
    const s = await window.electron.settings.get()
    const qrs = await buildPaymentQRs(inv, s)
    setPaymentQRs(qrs)
  }

  async function save(form) {
    try {
      if (form.id) await window.electron.invoices.update(form)
      else await window.electron.invoices.create(form)
      toast(form.id ? 'Invoice updated' : 'Invoice created')
      setModal(null)
      loadAll()
    } catch (e) { toast(e.message, 'error') }
  }

  function promptDel(id, invNumber) {
    setDetailInv(null)
    loadAll()
    toast.undoable(
      `Invoice ${invNumber} deleted`,
      async () => { await window.electron.invoices.delete(id) },
      () => { loadAll() }
    )
  }

  async function updateStatus(id, status) {
    const inv = await window.electron.invoices.get(id)
    const prev = inv.status
    await window.electron.invoices.update({ ...inv, status, items: inv.items || [] })
    if (detailInv?.id === id) openDetail(id)
    loadAll()
    toast.undoable(
      `Marked as ${status}`,
      () => {},
      async () => {
        const fresh = await window.electron.invoices.get(id)
        await window.electron.invoices.update({ ...fresh, status: prev, items: fresh.items || [] })
        if (detailInv?.id === id) openDetail(id)
        loadAll()
      }
    )
  }

  function promptSendEmail(inv) {
    if (!inv.client_email) { toast('This client has no email address', 'error'); return }
    setEmailConfirm(inv)
  }

  async function sendByEmail(inv) {
    setEmailConfirm(null)
    const html = pdfRef.current?.innerHTML
    if (!html) { toast('Could not generate invoice content', 'error'); return }
    const result = await window.electron.email.sendInvoice({ invoiceId: inv.id, htmlContent: html })
    if (result.success) { toast(`Invoice emailed to ${inv.client_email}`); loadAll() }
    else toast(result.error || 'Failed to send', 'error')
  }

  async function exportPdf(inv) {
    const savePath = await window.electron.invoices.exportPdf(inv.id)
    if (!savePath) return
    const html = pdfRef.current?.innerHTML
    if (html) {
      const win = window.open('', '_blank')
      win?.document.write(`<html><head><style>body{margin:0;font-family:Arial,sans-serif;}@page{size:letter;margin:0;}</style></head><body>${html}</body></html>`)
      win?.document.close()
      win?.print()
    }
    toast('PDF ready — use Print → Save as PDF')
  }

  const filtered = statusFilter === 'all' ? invoices : invoices.filter(i => i.status === statusFilter)
  const currentInv = detailInv

  if (detailInv) {
    const totals = calcInvoiceTotals(detailInv.items, detailInv.tax_rate, detailInv.discount_pct)
    const activePayments = paymentQRs ? Object.entries(paymentQRs).filter(([, v]) => v) : []

    return (
      <div>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setDetailInv(null); setPaymentQRs(null); loadAll() }}>← Back</button>
            <div>
              <div className="page-title">{detailInv.invoice_number}</div>
              <div className="page-subtitle">{detailInv.client_name} · Due {detailInv.due_date || '—'}</div>
            </div>
          </div>
          <div className="btn-group">
            <span className={`badge badge-${detailInv.status}`}>{detailInv.status}</span>
            <select className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }} value="" onChange={e => {
              const s = e.target.value; e.target.value = ''
              if (s) updateStatus(detailInv.id, s)
            }}>
              <option value="">Change Status ▾</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
            <button className="btn btn-secondary btn-sm" onClick={() => setSigModal(detailInv.id)}>✍ Signature</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setModal(detailInv) }}>Edit</button>
            <button className="btn btn-primary btn-sm" onClick={() => promptSendEmail(detailInv)}>✉ Send Email</button>
            <button className="btn btn-secondary btn-sm" onClick={() => exportPdf(detailInv)}>↓ PDF</button>
            <button className="btn btn-danger btn-sm" onClick={() => promptDel(detailInv.id, detailInv.invoice_number)}>Delete</button>
          </div>
        </div>

        {/* Require-signature warning */}
        {settings?.require_signature === '1' && !signature && detailInv.status !== 'paid' && (
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13 }}>
            ⚠️ <strong>Signature required</strong> — this invoice has not been signed yet.
            <button className="btn btn-sm btn-secondary" style={{ marginLeft: 12 }} onClick={() => setSigModal(detailInv.id)}>Collect Signature</button>
          </div>
        )}

        {/* Signature display */}
        {signature && (
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--success)' }}>✓ Signed</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{signature.signer_name} · {signature.signed_at?.slice(0,10)}</span>
            <img src={signature.data} alt="Signature" style={{ height: 36, background: 'white', borderRadius: 4, padding: 2 }} />
          </div>
        )}

        {/* Payment methods quick-links bar */}
        {activePayments.length > 0 && (
          <div className="card" style={{ marginBottom: 16, padding: '14px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 10 }}>
              Payment Links — click to open in payment app
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {paymentQRs?.venmo?.handle && (
                <a href={`https://venmo.com/${settings?.venmo_username}?txn=pay&amount=${totals.total.toFixed(2)}&note=${encodeURIComponent('Invoice ' + detailInv.invoice_number)}`}
                  style={linkStyle('#3d95ce')} onClick={e => { e.preventDefault(); window.electron?.shell?.openExternal(e.currentTarget.href) }}>
                  💜 Venmo {paymentQRs.venmo.handle}
                </a>
              )}
              {paymentQRs?.paypal?.handle && (
                <a href={`https://paypal.me/${settings?.paypal_username}/${totals.total.toFixed(2)}`}
                  style={linkStyle('#003087')} onClick={e => { e.preventDefault(); window.electron?.shell?.openExternal(e.currentTarget.href) }}>
                  💙 PayPal {paymentQRs.paypal.handle}
                </a>
              )}
              {paymentQRs?.cashapp?.handle && (
                <a href={`https://cash.app/$${settings?.cashapp_tag}/${totals.total.toFixed(2)}`}
                  style={linkStyle('#00d632')} onClick={e => { e.preventDefault(); window.electron?.shell?.openExternal(e.currentTarget.href) }}>
                  💚 Cash App {paymentQRs.cashapp.handle}
                </a>
              )}
              {paymentQRs?.zelle?.handle && (
                <span style={{ ...linkStyle('#6d33c7'), cursor: 'default' }}>
                  💛 Zelle: {paymentQRs.zelle.handle}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Invoice preview */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }} ref={pdfRef}>
          <InvoicePdfTemplate invoice={detailInv} settings={settings} signature={signature} paymentQRs={paymentQRs} />
        </div>

        {/* Payments */}
        <div className="card">
          <PaymentTracker
            invoiceId={detailInv.id}
            invoiceTotal={totals.total}
            sym={settings?.currency_symbol || '$'}
            onPaidStatusChange={() => openDetail(detailInv.id)}
          />
        </div>

        {modal && (
          <InvoiceEditor invoice={modal} type="invoice" clients={clients} jobs={jobs}
            materials={materials} settings={settings} onSave={save} onClose={() => setModal(null)} />
        )}
        {sigModal && (
          <SignaturePad invoiceId={sigModal} onSave={sig => { setSignature(sig); setSigModal(null) }} onClose={() => setSigModal(null)} />
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Email confirm — lean inline banner, not a blocking modal */}
      {emailConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setEmailConfirm(null)}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 16, padding: '28px 32px', width: 420,
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            animation: 'pageEnter 0.15s ease',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>📧</div>
            <div style={{ fontWeight: 700, fontSize: 17, textAlign: 'center', marginBottom: 20 }}>
              Send this invoice?
            </div>

            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Invoice</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{emailConfirm.invoice_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>To</span>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{emailConfirm.client_email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Total</span>
                <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)' }}>
                  {fmt(calcInvoiceTotals(emailConfirm.items, emailConfirm.tax_rate, emailConfirm.discount_pct).total)}
                </span>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20 }}>
              Once sent, the client will receive this by email. Double-check the amount is correct before sending.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEmailConfirm(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => sendByEmail(emailConfirm)}>
                Yes, Send It
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="page-header">
        <div>
          <div className="page-title">Invoices</div>
          <div className="page-subtitle">{invoices.length} total invoices</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}>+ New Invoice</button>
      </div>

      <div className="tabs">
        {['all','draft','sent','paid','overdue'].map(s => (
          <button key={s} className={`tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && <span style={{ marginLeft: 5, fontSize: 11, color: 'var(--text-muted)' }}>({invoices.filter(i => i.status === s).length})</span>}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state"><h3>No invoices</h3><p>Create your first invoice</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Invoice #</th><th>Client</th><th>Issue Date</th><th>Due Date</th><th>Status</th><th className="text-right">Amount</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(inv.id)}>
                    <td className="font-mono" style={{ fontSize: 12 }}>{inv.invoice_number}</td>
                    <td style={{ fontWeight: 500 }}>{inv.client_name || '—'}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{inv.issue_date || '—'}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{inv.due_date || '—'}</td>
                    <td><span className={`badge badge-${inv.status}`}>{inv.status}</span></td>
                    <td className="text-right font-mono" style={{ fontWeight: 600 }}>
                      {fmt(calcInvoiceTotals(inv.items || [], inv.tax_rate, inv.discount_pct).total, settings?.currency_symbol || '$')}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openDetail(inv.id)}>Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal !== null && (
        <InvoiceEditor invoice={modal?.id ? modal : undefined} type="invoice"
          clients={clients} jobs={jobs} materials={materials} settings={settings}
          onSave={save} onClose={() => setModal(null)} />
      )}

      {/* Hidden PDF render area */}
      <div ref={pdfRef} style={{ position: 'fixed', left: -9999, top: 0, width: 816, background: 'white' }}>
        {currentInv && <InvoicePdfTemplate invoice={currentInv} settings={settings} signature={signature} paymentQRs={paymentQRs} />}
      </div>
    </div>
  )
}

function linkStyle(color) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', borderRadius: 20,
    background: color + '18', border: `1px solid ${color}40`,
    color, fontSize: 13, fontWeight: 600, textDecoration: 'none',
    cursor: 'pointer',
  }
}
