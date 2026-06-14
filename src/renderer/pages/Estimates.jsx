import React, { useState, useEffect } from 'react'
import { useToast } from '../components/Toast'
import InvoiceEditor from '../components/InvoiceEditor'
import { fmt, calcInvoiceTotals } from '../utils/invoiceCalc'

export default function Estimates({ settings }) {
  const toast = useToast()
  const [estimates, setEstimates] = useState([])
  const [clients, setClients] = useState([])
  const [jobs, setJobs] = useState([])
  const [materials, setMaterials] = useState([])
  const [modal, setModal] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const [ests, cls, jbs, mats] = await Promise.all([
        window.electron.invoices.list({ type: 'estimate' }),
        window.electron.clients.list(),
        window.electron.jobs.list(),
        window.electron.materials.list(),
      ])
      setEstimates(ests); setClients(cls); setJobs(jbs); setMaterials(mats)
    } catch {}
  }

  async function save(form) {
    try {
      const data = { ...form, type: 'estimate' }
      if (form.id) await window.electron.invoices.update(data)
      else await window.electron.invoices.create(data)
      toast(form.id ? 'Estimate updated' : 'Estimate created')
      setModal(null)
      loadAll()
    } catch (e) { toast(e.message, 'error') }
  }

  async function convertToInvoice(id) {
    const inv = await window.electron.invoices.convertToInvoice(id)
    toast(`Created invoice ${inv.invoice_number}`)
    loadAll()
  }

  function del(id, number) {
    setEstimates(prev => prev.filter(e => e.id !== id))
    toast.undoable(
      `Estimate ${number} deleted`,
      async () => { await window.electron.invoices.delete(id) },
      () => { loadAll() }
    )
  }

  async function openEdit(id) {
    const est = await window.electron.invoices.get(id)
    setModal(est)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Estimates</div>
          <div className="page-subtitle">{estimates.length} total estimates</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}>+ New Estimate</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {estimates.length === 0 ? (
          <div className="empty-state">
            <h3>No estimates yet</h3>
            <p>Create an estimate and convert it to an invoice when approved</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Estimate #</th>
                  <th>Client</th>
                  <th>Job</th>
                  <th>Issue Date</th>
                  <th>Status</th>
                  <th className="text-right">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {estimates.map(est => (
                  <tr key={est.id}>
                    <td className="font-mono" style={{ fontSize: 12 }}>{est.invoice_number}</td>
                    <td style={{ fontWeight: 500 }}>{est.client_name || '—'}</td>
                    <td style={{ color: 'var(--text-dim)', fontSize: 12 }}>{est.job_title || '—'}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{est.issue_date || '—'}</td>
                    <td><span className="badge badge-estimate">estimate</span></td>
                    <td className="text-right font-mono" style={{ fontWeight: 600 }}>
                      {fmt(calcInvoiceTotals(est.items || [], est.tax_rate, est.discount_pct).total, settings?.currency_symbol || '$')}
                    </td>
                    <td>
                      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(est.id)}>Edit</button>
                        <button className="btn btn-success btn-sm" onClick={() => convertToInvoice(est.id)}>→ Invoice</button>
                        <button className="btn btn-danger btn-sm" onClick={() => del(est.id, est.invoice_number)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal !== null && (
        <InvoiceEditor
          invoice={modal?.id ? modal : undefined}
          type="estimate"
          clients={clients}
          jobs={jobs}
          materials={materials}
          settings={settings}
          onSave={save}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
