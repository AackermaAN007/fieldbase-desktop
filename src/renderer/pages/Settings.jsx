import React, { useState, useEffect } from 'react'
import { useToast } from '../components/Toast'

const SECTIONS = [
  { id: 'business',      icon: '🏢', label: 'Business' },
  { id: 'branding',      icon: '🎨', label: 'Branding' },
  { id: 'invoice',       icon: '📄', label: 'Invoice Defaults' },
  { id: 'numbering',     icon: '🔢', label: 'Numbering' },
  { id: 'tax',           icon: '💰', label: 'Tax & Currency' },
  { id: 'payment',       icon: '💳', label: 'Payment Methods' },
  { id: 'email',         icon: '✉️', label: 'Email & AI' },
  { id: 'latefee',       icon: '⏰', label: 'Late Fees' },
  { id: 'legal',         icon: '📋', label: 'Legal' },
  { id: 'subscription',  icon: '🔑', label: 'Subscription' },
  { id: 'data',          icon: '🗄️', label: 'Data & Backup' },
]

const DEFAULTS = {
  business_name: '', owner_name: '', email: '', phone: '',
  address: '', city: '', state: '', zip: '',
  license_number: '', business_type: 'Electrical Contractor',
  website: '', fax: '',
  warranty_text: '1 year warranty on all labor.',
  default_terms: 'Payment due within 30 days.',
  default_notes: '',
  default_due_days: '30',
  invoice_prefix: 'INV-', estimate_prefix: 'EST-',
  next_invoice_number: '1001', next_estimate_number: '1001',
  tax_rate: '8.25', tax_name: 'Sales Tax',
  currency: 'USD', currency_symbol: '$',
  venmo_username: '', paypal_username: '', cashapp_tag: '', zelle_contact: '',
  accept_cash: '1', accept_check: '1', accept_card: '0',
  resend_api_key: '', email_from_name: '',
  email_subject_template: 'Invoice {invoice_number} from {business_name}',
  email_footer: '',
  anthropic_api_key: '',
  late_fee_pct: '1.5', late_fee_grace_days: '7',
  reminder_days_before: '3', reminder_on_due: '1', reminder_days_after: '7',
  auto_mark_overdue: '1',
  require_signature: '0', contract_text: '',
  show_license_on_invoice: '1',
  logo_data: '', accent_color: '#4f7ef8',
}

export default function Settings({ settings, onSettingsChange }) {
  const toast = useToast()
  const [activeSection, setActiveSection] = useState('business')
  const [form, setForm] = useState({ ...DEFAULTS, ...settings })
  const [logoPreview, setLogoPreview] = useState(settings?.logo_data || null)
  const [dirty, setDirty] = useState(false)
  const [licenseStatus, setLicenseStatus] = useState(null)
  const [testingEmail, setTestingEmail] = useState(false)

  useEffect(() => {
    setForm(f => ({ ...DEFAULTS, ...settings, ...f }))
    setLogoPreview(prev => prev || settings?.logo_data || null)
  }, [settings])

  useEffect(() => {
    if (activeSection === 'subscription') {
      window.electron.license.check().then(setLicenseStatus)
    }
  }, [activeSection])

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    setDirty(true)
  }

  // Toggles save instantly — no save button needed
  async function setToggle(k, v) {
    const updated = { ...form, [k]: v }
    setForm(updated)
    await onSettingsChange({ ...updated, logo_data: logoPreview || '' })
    toast('Saved')
  }

  async function save() {
    await onSettingsChange({ ...form, logo_data: logoPreview || '' })
    setDirty(false)
    toast('Settings saved')
  }

  async function backup() {
    const p = await window.electron.db.backup()
    if (p) toast(`Backup saved`)
  }

  async function uploadLogo() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/svg+xml,image/webp'
    input.onchange = () => {
      const file = input.files[0]
      if (!file) return
      if (file.size > 500 * 1024) { toast('Logo must be under 500 KB', 'error'); return }
      const reader = new FileReader()
      reader.onload = e => { setLogoPreview(e.target.result); setDirty(true) }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  async function sendTestEmail() {
    if (!form.resend_api_key) { toast('Add your Resend API key first', 'error'); return }
    if (!form.email) { toast('Add your business email in Business Info first', 'error'); return }
    if (dirty) { toast('Save your settings first before sending a test', 'error'); return }
    setTestingEmail(true)
    try {
      const result = await window.electron.email.sendTest()
      if (result.success) toast(`Test email sent to ${result.to}`)
      else toast(result.error || 'Send failed', 'error')
    } catch (e) { toast('Could not send test email', 'error') }
    setTestingEmail(false)
  }

  const s = form

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

      {/* Left nav */}
      <div style={{
        width: 190, flexShrink: 0, background: 'var(--surface)',
        borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        <div style={{ padding: '16px 12px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)' }}>
          Settings
        </div>
        <nav style={{ flex: 1 }}>
          {SECTIONS.map(sec => (
            <button key={sec.id} onClick={() => setActiveSection(sec.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '9px 14px', border: 'none', cursor: 'pointer',
              background: activeSection === sec.id ? 'rgba(79,126,248,0.12)' : 'transparent',
              color: activeSection === sec.id ? 'var(--accent)' : 'var(--text-dim)',
              fontWeight: activeSection === sec.id ? 600 : 400,
              fontSize: 13,
              borderLeft: `3px solid ${activeSection === sec.id ? 'var(--accent)' : 'transparent'}`,
              transition: 'all 0.12s', textAlign: 'left',
            }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>{sec.icon}</span>
              {sec.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginBottom: 6, justifyContent: 'center' }} onClick={backup}>
            Export Backup
          </button>
        </div>
      </div>

      {/* Right content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Sticky save bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 28px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg)', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {SECTIONS.find(s => s.id === activeSection)?.label}
            </div>
            {dirty && <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 1 }}>● Unsaved changes</div>}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={save}
            style={{
              minWidth: 110, justifyContent: 'center',
              background: dirty ? 'var(--accent)' : 'var(--surface2)',
              color: dirty ? 'white' : 'var(--text-muted)',
              border: dirty ? 'none' : '1px solid var(--border)',
              transition: 'all 0.2s',
            }}
          >
            {dirty ? 'Save Changes' : 'Saved ✓'}
          </button>
        </div>

        {/* Section content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

          {/* ── Business Info ── */}
          {activeSection === 'business' && (
            <SectionWrap desc="Your company details appear on every invoice and estimate.">
              <Row2>
                <Field label="Business Name *"><input className="form-input" value={s.business_name} onChange={e => set('business_name', e.target.value)} placeholder="Acme Electric LLC" /></Field>
                <Field label="Owner / Contact Name"><input className="form-input" value={s.owner_name} onChange={e => set('owner_name', e.target.value)} /></Field>
              </Row2>
              <Row2>
                <Field label="Business Type">
                  <select className="form-input" value={s.business_type} onChange={e => set('business_type', e.target.value)}>
                    {['Electrical Contractor','General Contractor','HVAC','Plumbing','Roofing','Landscaping','Painting','Flooring','Other'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Contractor License #"><input className="form-input" value={s.license_number} onChange={e => set('license_number', e.target.value)} placeholder="LIC-123456" /></Field>
              </Row2>
              <Row2>
                <Field label="Business Email"><input className="form-input" type="email" value={s.email} onChange={e => set('email', e.target.value)} placeholder="you@yourbusiness.com" /></Field>
                <Field label="Phone"><input className="form-input" value={s.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 123-4567" /></Field>
              </Row2>
              <Row2>
                <Field label="Website"><input className="form-input" value={s.website} onChange={e => set('website', e.target.value)} placeholder="www.yoursite.com" /></Field>
                <Field label="Fax (optional)"><input className="form-input" value={s.fax} onChange={e => set('fax', e.target.value)} /></Field>
              </Row2>
              <Field label="Street Address"><input className="form-input" value={s.address} onChange={e => set('address', e.target.value)} /></Field>
              <Row3>
                <Field label="City"><input className="form-input" value={s.city} onChange={e => set('city', e.target.value)} /></Field>
                <Field label="State"><input className="form-input" value={s.state} onChange={e => set('state', e.target.value)} maxLength={2} style={{ textTransform: 'uppercase' }} /></Field>
                <Field label="ZIP"><input className="form-input" value={s.zip} onChange={e => set('zip', e.target.value)} /></Field>
              </Row3>
            </SectionWrap>
          )}

          {/* ── Branding ── */}
          {activeSection === 'branding' && (
            <SectionWrap desc="Your logo and accent color appear on all invoices and PDFs.">
              <Field label="Business Logo">
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 160, height: 80, borderRadius: 8,
                    background: 'var(--surface2)', border: '2px dashed var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {logoPreview
                      ? <img src={logoPreview} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No logo</span>
                    }
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={uploadLogo}>Upload Logo</button>
                    {logoPreview && <button className="btn btn-danger btn-sm" onClick={() => { setLogoPreview(null); setDirty(true) }}>Remove</button>}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      PNG, JPG, SVG<br />Max 500 KB<br />Ideal: 300×100 px
                    </div>
                  </div>
                </div>
              </Field>

              <Field label="Invoice Accent Color" hint="Used for invoice title bar, column headers, and highlights">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <input type="color" value={s.accent_color || '#4f7ef8'} onChange={e => set('accent_color', e.target.value)}
                    style={{ width: 44, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2, background: 'none' }} />
                  <input className="form-input" value={s.accent_color || '#4f7ef8'} onChange={e => set('accent_color', e.target.value)} style={{ width: 110 }} placeholder="#4f7ef8" />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['#4f7ef8','#10b981','#f59e0b','#ef4444','#8b5cf6','#0ea5e9','#1e293b'].map(c => (
                      <div key={c} onClick={() => set('accent_color', c)} style={{
                        width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
                        border: s.accent_color === c ? '2px solid white' : '2px solid transparent',
                        boxShadow: s.accent_color === c ? `0 0 0 2px ${c}` : 'none', transition: 'all 0.12s',
                      }} />
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 12, padding: '10px 16px', borderRadius: 8, background: s.accent_color || '#4f7ef8', color: 'white', fontSize: 13, fontWeight: 600 }}>
                  Preview — Invoice Header
                </div>
              </Field>
            </SectionWrap>
          )}

          {/* ── Invoice Defaults ── */}
          {activeSection === 'invoice' && (
            <SectionWrap desc="These values pre-fill whenever you create a new invoice. You can still change them per invoice.">
              <Field label="Default Payment Terms" hint="Printed at the bottom of every invoice">
                <textarea className="form-input" value={s.default_terms} onChange={e => set('default_terms', e.target.value)} rows={2} style={{ resize: 'vertical' }} />
              </Field>
              <Field label="Warranty / Guarantee Text">
                <textarea className="form-input" value={s.warranty_text} onChange={e => set('warranty_text', e.target.value)} rows={2} style={{ resize: 'vertical' }} />
              </Field>
              <Field label="Default Notes">
                <textarea className="form-input" value={s.default_notes} onChange={e => set('default_notes', e.target.value)} rows={2} style={{ resize: 'vertical' }} placeholder="e.g. Thank you for your business!" />
              </Field>
              <Row2>
                <Field label="Default Due Days" hint="Days after issue date that payment is due">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input className="form-input" type="number" value={s.default_due_days} onChange={e => set('default_due_days', e.target.value)} style={{ width: 80 }} />
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>days</span>
                  </div>
                </Field>
                <div />
              </Row2>
              <Toggle label="Show contractor license number on invoices" value={s.show_license_on_invoice} onChange={v => setToggle('show_license_on_invoice', v)} desc="Displays your license # in the business header area" />
            </SectionWrap>
          )}

          {/* ── Numbering ── */}
          {activeSection === 'numbering' && (
            <SectionWrap desc="Control how invoice and estimate numbers are formatted and sequenced.">
              <div style={{ padding: '14px 18px', background: 'rgba(79,126,248,0.07)', border: '1px solid rgba(79,126,248,0.2)', borderRadius: 8, fontSize: 13, marginBottom: 8 }}>
                Preview — next invoice will be: <strong style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{s.invoice_prefix}{s.next_invoice_number}</strong>
                &nbsp;·&nbsp; next estimate: <strong style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{s.estimate_prefix}{s.next_estimate_number}</strong>
              </div>
              <Row2>
                <Field label="Invoice Prefix" hint='e.g. "INV-", "2026-", "JOB-"'>
                  <input className="form-input" value={s.invoice_prefix} onChange={e => set('invoice_prefix', e.target.value)} placeholder="INV-" />
                </Field>
                <Field label="Next Invoice Number">
                  <input className="form-input" type="number" value={s.next_invoice_number} onChange={e => set('next_invoice_number', e.target.value)} />
                </Field>
              </Row2>
              <Row2>
                <Field label="Estimate Prefix">
                  <input className="form-input" value={s.estimate_prefix} onChange={e => set('estimate_prefix', e.target.value)} placeholder="EST-" />
                </Field>
                <Field label="Next Estimate Number">
                  <input className="form-input" type="number" value={s.next_estimate_number} onChange={e => set('next_estimate_number', e.target.value)} />
                </Field>
              </Row2>
              <InfoBox>⚠️ Changing "Next Number" will affect the next invoice you create. The counter increases automatically after each invoice.</InfoBox>
            </SectionWrap>
          )}

          {/* ── Tax & Currency ── */}
          {activeSection === 'tax' && (
            <SectionWrap desc="Default tax settings applied to all new invoices. Each invoice can override these individually.">
              <Row2>
                <Field label="Default Tax Rate" hint="Can be changed per invoice">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input className="form-input" type="number" value={s.tax_rate} onChange={e => set('tax_rate', e.target.value)} step="0.01" style={{ width: 90 }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>%</span>
                  </div>
                </Field>
                <Field label="Tax Label" hint='Shown on invoice — e.g. "Sales Tax", "GST", "VAT"'>
                  <input className="form-input" value={s.tax_name} onChange={e => set('tax_name', e.target.value)} placeholder="Sales Tax" />
                </Field>
              </Row2>
              <Row2>
                <Field label="Currency">
                  <select className="form-input" value={s.currency} onChange={e => {
                    const map = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', MXN: 'MX$', AUD: 'A$' }
                    set('currency', e.target.value)
                    set('currency_symbol', map[e.target.value] || '$')
                  }}>
                    <option value="USD">USD — US Dollar ($)</option>
                    <option value="EUR">EUR — Euro (€)</option>
                    <option value="GBP">GBP — British Pound (£)</option>
                    <option value="CAD">CAD — Canadian Dollar (CA$)</option>
                    <option value="MXN">MXN — Mexican Peso (MX$)</option>
                    <option value="AUD">AUD — Australian Dollar (A$)</option>
                  </select>
                </Field>
                <Field label="Symbol" hint="Override if needed">
                  <input className="form-input" value={s.currency_symbol} onChange={e => set('currency_symbol', e.target.value)} style={{ width: 80 }} />
                </Field>
              </Row2>
            </SectionWrap>
          )}

          {/* ── Payment Methods ── */}
          {activeSection === 'payment' && (
            <SectionWrap desc="Fill in the payment methods you accept. Each one gets a QR code on your invoice PDF so clients can pay instantly.">

              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-dim)' }}>Digital Payments — QR codes on invoices</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <PaymentCard
                  color="#3d95ce" emoji="💜" name="Venmo"
                  active={!!s.venmo_username}
                  hint="@yourname — clients scan to pay instantly"
                  previewHandle={s.venmo_username ? `@${s.venmo_username}` : null}
                >
                  <input className="form-input" value={s.venmo_username} onChange={e => set('venmo_username', e.target.value)} placeholder="username (no @)" />
                </PaymentCard>

                <PaymentCard
                  color="#003087" emoji="💙" name="PayPal"
                  active={!!s.paypal_username}
                  hint="paypal.me/yourname — generates payment link"
                  previewHandle={s.paypal_username ? `paypal.me/${s.paypal_username}` : null}
                >
                  <input className="form-input" value={s.paypal_username} onChange={e => set('paypal_username', e.target.value)} placeholder="username" />
                </PaymentCard>

                <PaymentCard
                  color="#00d632" emoji="💚" name="Cash App"
                  active={!!s.cashapp_tag}
                  hint="$yourcashtag — clients tap to open Cash App"
                  previewHandle={s.cashapp_tag ? `$${s.cashapp_tag}` : null}
                >
                  <input className="form-input" value={s.cashapp_tag} onChange={e => set('cashapp_tag', e.target.value)} placeholder="cashtag (no $)" />
                </PaymentCard>

                <PaymentCard
                  color="#6d33c7" emoji="💛" name="Zelle"
                  active={!!s.zelle_contact}
                  hint="Phone or email — shown as text on invoice (Zelle has no QR)"
                  previewHandle={s.zelle_contact || null}
                >
                  <input className="form-input" value={s.zelle_contact} onChange={e => set('zelle_contact', e.target.value)} placeholder="(555) 123-4567 or email" />
                </PaymentCard>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-dim)' }}>Offline / In-Person Payments</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Toggle
                    label="Accept Cash"
                    value={s.accept_cash} onChange={v => setToggle('accept_cash', v)}
                    desc='Shows "Cash accepted" on invoice footer'
                  />
                  <Toggle
                    label="Accept Check / Money Order"
                    value={s.accept_check} onChange={v => setToggle('accept_check', v)}
                    desc='Shows "Checks payable to [your business name]" on invoice'
                  />
                  <Toggle
                    label="Accept Credit / Debit Card (in person)"
                    value={s.accept_card} onChange={v => setToggle('accept_card', v)}
                    desc='Shows "Card payments accepted on-site" on invoice'
                  />
                </div>
              </div>

              {!s.venmo_username && !s.paypal_username && !s.cashapp_tag && !s.zelle_contact && (
                <InfoBox>💡 Add at least one digital payment method. Clients who can pay with their phone pay faster — typically within the same day.</InfoBox>
              )}
            </SectionWrap>
          )}

          {/* ── Email & AI ── */}
          {activeSection === 'email' && (
            <SectionWrap desc="Configure email delivery and AI receipt scanning.">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>Email Delivery via Resend</div>
              <Field label="Resend API Key" hint={<>Free at <strong>resend.com</strong> · 3,000 emails/month included</>}>
                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <input className="form-input" type="password" value={s.resend_api_key} onChange={e => set('resend_api_key', e.target.value)} placeholder="re_..." style={{ flex: 1 }} />
                  {s.resend_api_key && (
                    <span style={{ alignSelf: 'center', fontSize: 11, color: 'var(--success)', fontWeight: 600, whiteSpace: 'nowrap' }}>✓ Key set</span>
                  )}
                </div>
              </Field>
              <Row2>
                <Field label="From Name" hint="Who the email appears to come from">
                  <input className="form-input" value={s.email_from_name} onChange={e => set('email_from_name', e.target.value)} placeholder={s.business_name || 'Your Business'} />
                </Field>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 0 }}>
                  <button className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={sendTestEmail} disabled={testingEmail}>
                    {testingEmail ? 'Sending…' : '✉ Send Test Email'}
                  </button>
                </div>
              </Row2>
              <Field label="Email Subject" hint="Placeholders: {invoice_number} · {business_name} · {type}">
                <input className="form-input" value={s.email_subject_template} onChange={e => set('email_subject_template', e.target.value)} />
              </Field>
              <Field label="Email Footer" hint="Appears at the bottom of every invoice email">
                <textarea className="form-input" value={s.email_footer} onChange={e => set('email_footer', e.target.value)} rows={2} style={{ resize: 'vertical' }} placeholder="Questions? Call (555) 123-4567." />
              </Field>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>AI Receipt Scanning</div>
                <Field label="Anthropic API Key" hint={<>Get a key at <strong>console.anthropic.com</strong> · Used in Expenses → Scan Receipt</>}>
                  <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                    <input className="form-input" type="password" value={s.anthropic_api_key || ''} onChange={e => set('anthropic_api_key', e.target.value)} placeholder="sk-ant-..." style={{ flex: 1 }} />
                    {s.anthropic_api_key && (
                      <span style={{ alignSelf: 'center', fontSize: 11, color: 'var(--success)', fontWeight: 600, whiteSpace: 'nowrap' }}>✓ Key set</span>
                    )}
                  </div>
                </Field>
                <InfoBox>📷 The AI reads your receipt photos and auto-fills vendor, date, amount, and category. Receipt images are sent securely to Anthropic for processing and immediately discarded — they are never stored by Anthropic.</InfoBox>
              </div>
            </SectionWrap>
          )}

          {/* ── Late Fees ── */}
          {activeSection === 'latefee' && (
            <SectionWrap desc="Automatic handling of overdue invoices and payment reminders.">
              <Row2>
                <Field label="Late Fee %" hint="Applied to outstanding balance after grace period">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input className="form-input" type="number" value={s.late_fee_pct} onChange={e => set('late_fee_pct', e.target.value)} step="0.5" style={{ width: 80 }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>% per month</span>
                  </div>
                </Field>
                <Field label="Grace Period" hint="Days before late fee kicks in">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input className="form-input" type="number" value={s.late_fee_grace_days} onChange={e => set('late_fee_grace_days', e.target.value)} style={{ width: 80 }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>days</span>
                  </div>
                </Field>
              </Row2>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 12 }}>Reminder Schedule</div>
                <Row3>
                  <Field label="Days before due">
                    <input className="form-input" type="number" value={s.reminder_days_before} onChange={e => set('reminder_days_before', e.target.value)} />
                  </Field>
                  <Field label="Remind on due date">
                    <select className="form-input" value={s.reminder_on_due} onChange={e => set('reminder_on_due', e.target.value)}>
                      <option value="1">Yes</option>
                      <option value="0">No</option>
                    </select>
                  </Field>
                  <Field label="Days after due">
                    <input className="form-input" type="number" value={s.reminder_days_after} onChange={e => set('reminder_days_after', e.target.value)} />
                  </Field>
                </Row3>
              </div>

              <Toggle
                label="Auto-mark invoices as Overdue"
                value={s.auto_mark_overdue} onChange={v => setToggle('auto_mark_overdue', v)}
                desc="When you open the Aging Report, invoices past due date are automatically moved to Overdue status"
              />
            </SectionWrap>
          )}

          {/* ── Legal ── */}
          {activeSection === 'legal' && (
            <SectionWrap desc="Signature requirements and contract terms shown on invoices.">
              <Toggle
                label="Require customer signature"
                value={s.require_signature} onChange={v => setToggle('require_signature', v)}
                desc="Shows a warning on the invoice detail until a signature is collected. Use for jobs where written approval matters."
              />
              <Field label="Contract / Scope of Work Template" hint="Pre-fills as the contract section on new invoices. Leave blank to skip.">
                <textarea
                  className="form-input"
                  value={s.contract_text} onChange={e => set('contract_text', e.target.value)}
                  rows={7} style={{ resize: 'vertical' }}
                  placeholder="All work will be performed in a professional manner per local electrical codes. Owner is responsible for permits unless otherwise agreed. Payment in full due upon job completion. A service charge of 1.5% per month will be applied to overdue balances..."
                />
              </Field>
              <InfoBox>📋 Signatures are drawn with a mouse or touchscreen and stored on this device only. They appear on the invoice PDF when collected.</InfoBox>
            </SectionWrap>
          )}

          {/* ── Subscription ── */}
          {activeSection === 'subscription' && (
            <SectionWrap desc="Your Fieldbase license status and subscription details.">
              {licenseStatus === null ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Checking license…</div>
              ) : !licenseStatus.valid && licenseStatus.reason === 'not_activated' ? (
                <ActivateLicensePanel />
              ) : (
                <SubscriptionPanel status={licenseStatus} onRefresh={() => window.electron.license.check().then(setLicenseStatus)} />
              )}
            </SectionWrap>
          )}

          {/* ── Data & Backup ── */}
          {activeSection === 'data' && (
            <SectionWrap desc="All your data is stored locally on this computer. Back up regularly.">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={backup}>📦 Export Database Backup</button>
              </div>
              <InfoBox>
                <strong>Where is my data?</strong><br />
                <code style={{ fontSize: 12, background: 'var(--surface)', padding: '2px 8px', borderRadius: 4, display: 'inline-block', marginTop: 6 }}>
                  %APPDATA%\invoice-app\invoices.db
                </code>
                <br /><br />
                Back up before Windows updates or when moving to a new computer. To restore: close the app, replace the .db file, and reopen.
              </InfoBox>
            </SectionWrap>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Subscription panel ─────────────────────────────────────────────────────────
function SubscriptionPanel({ status, onRefresh }) {
  const STRIPE_PORTAL = 'https://buy.stripe.com/test_7sYcN69IEb8AbUf1QrcMM00'

  const daysLeft = status.days_left
  const expiryDate = status.expires_at ? new Date(status.expires_at).toLocaleDateString() : null
  const isLifetime = status.plan === 'lifetime'
  const expiringSoon = daysLeft != null && daysLeft <= 7

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        padding: 20, borderRadius: 10,
        background: isLifetime ? 'rgba(34,197,94,0.07)' : expiringSoon ? 'rgba(245,158,11,0.07)' : 'rgba(79,126,248,0.07)',
        border: `1px solid ${isLifetime ? 'rgba(34,197,94,0.25)' : expiringSoon ? 'rgba(245,158,11,0.25)' : 'rgba(79,126,248,0.2)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 28 }}>{isLifetime ? '♾️' : expiringSoon ? '⚠️' : '✅'}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {isLifetime ? 'Lifetime License' : expiringSoon ? 'Expiring Soon' : 'Active Subscription'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {isLifetime ? 'Full access — no renewal needed' : `$32/month · ${expiryDate ? `renews ${expiryDate}` : 'active'}`}
            </div>
          </div>
        </div>
        {!isLifetime && daysLeft != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (daysLeft / 31) * 100)}%`, background: expiringSoon ? 'var(--warning)' : 'var(--accent)', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 12, color: expiringSoon ? 'var(--warning)' : 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        {!isLifetime && (
          <button className="btn btn-primary btn-sm" onClick={() => window.electron.shell.openExternal(STRIPE_PORTAL)}>
            Manage Subscription →
          </button>
        )}
        <button className="btn btn-secondary btn-sm" onClick={onRefresh}>Refresh Status</button>
      </div>

      <InfoBox>
        <strong>How it works:</strong> Your subscription renews automatically each month via Stripe. If payment succeeds, your access extends by 30 days with no action needed. If payment fails, Stripe retries 3 times before cancelling. You'll see this panel update automatically.
      </InfoBox>
    </div>
  )
}

function ActivateLicensePanel() {
  const toast = useToast()
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function activate() {
    if (!key.trim()) { setError('Enter your license key'); return }
    setLoading(true)
    setError('')
    const res = await window.electron.license.activate({ key: key.trim() })
    if (res.success) {
      toast('License activated!')
      window.location.reload()
    } else {
      setError(res.error || 'Activation failed')
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <div style={{ padding: '16px 20px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Not activated</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Enter the license key you received via email.</div>
      </div>
      <Field label="License Key">
        <input
          className="form-input"
          value={key} onChange={e => setKey(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          style={{ fontFamily: 'monospace', letterSpacing: 2, fontSize: 15 }}
          onKeyDown={e => e.key === 'Enter' && activate()}
        />
      </Field>
      {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={activate} disabled={loading}>
        {loading ? 'Activating…' : 'Activate License'}
      </button>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
        Don't have a key? Contact alejoweslinalexander@gmail.com
      </div>
    </div>
  )
}

// ── Payment method card ────────────────────────────────────────────────────────
function PaymentCard({ color, emoji, name, active, hint, previewHandle, children }) {
  return (
    <div style={{
      border: `1px solid ${active ? color + '40' : 'var(--border)'}`,
      borderRadius: 10, padding: 16, background: active ? color + '06' : 'var(--surface)',
      transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{emoji}</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{name}</span>
        {active && (
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: color + '20', color }}>
            ACTIVE
          </span>
        )}
      </div>
      {children}
      {previewHandle && (
        <div style={{ marginTop: 8, fontSize: 11, color, fontWeight: 600 }}>
          ✓ QR code will show as: {previewHandle}
        </div>
      )}
      {!previewHandle && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>{hint}</div>}
    </div>
  )
}

// ── Layout helpers ─────────────────────────────────────────────────────────────
function SectionWrap({ desc, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 680 }}>
      {desc && <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>{desc}</p>}
      {children}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-dim)' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{children}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

function Row2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>{children}</div>
}

function Row3({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>{children}</div>
}

function Toggle({ label, value, onChange, desc }) {
  const on = value === '1' || value === true || value === 1
  return (
    <div
      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, background: on ? 'rgba(79,126,248,0.05)' : 'transparent', border: `1px solid ${on ? 'rgba(79,126,248,0.2)' : 'var(--border)'}`, transition: 'all 0.15s' }}
      onClick={() => onChange(on ? '0' : '1')}
    >
      <div style={{
        width: 40, height: 22, borderRadius: 11, flexShrink: 0, marginTop: 1,
        background: on ? 'var(--accent)' : 'var(--border)', position: 'relative', transition: 'background 0.2s',
      }}>
        <div style={{
          position: 'absolute', top: 3, left: on ? 21 : 3,
          width: 16, height: 16, borderRadius: '50%', background: 'white',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>}
      </div>
    </div>
  )
}

function InfoBox({ children }) {
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
      {children}
    </div>
  )
}

