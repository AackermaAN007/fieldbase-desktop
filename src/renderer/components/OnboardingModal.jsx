import React, { useState } from 'react'

export default function OnboardingModal({ onSave }) {
  const [form, setForm] = useState({
    business_name: '', owner_name: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '',
    license_number: '', tax_rate: '8.25', warranty_text: '1 year warranty on all labor.',
  })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleSave() {
    if (!form.business_name.trim()) return alert('Business name is required.')
    onSave({ ...form, _skipped: false })
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-md">
        <div className="modal-header">
          <div>
            <div className="modal-title">Welcome to Fieldbase</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Set up your business info to get started</div>
          </div>
        </div>
        <div className="modal-body">
          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Business Name *</label>
              <input value={form.business_name} onChange={e => set('business_name', e.target.value)} placeholder="Acme Electric LLC" />
            </div>
            <div className="form-group">
              <label>Owner Name</label>
              <input value={form.owner_name} onChange={e => set('owner_name', e.target.value)} placeholder="John Smith" />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="info@acmeelectric.com" />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 123-4567" />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St" />
          </div>
          <div className="form-row form-row-3">
            <div className="form-group">
              <label>City</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div className="form-group">
              <label>State</label>
              <input value={form.state} onChange={e => set('state', e.target.value)} maxLength={2} placeholder="TX" />
            </div>
            <div className="form-group">
              <label>ZIP</label>
              <input value={form.zip} onChange={e => set('zip', e.target.value)} />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Contractor License #</label>
              <input value={form.license_number} onChange={e => set('license_number', e.target.value)} placeholder="EC-123456" />
            </div>
            <div className="form-group">
              <label>Default Tax Rate (%)</label>
              <input type="number" value={form.tax_rate} onChange={e => set('tax_rate', e.target.value)} step="0.01" />
            </div>
          </div>
          <div className="form-group">
            <label>Default Warranty Text (appears on invoices)</label>
            <textarea value={form.warranty_text} onChange={e => set('warranty_text', e.target.value)} rows={2} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => onSave({ _skipped: true })}>
            Skip for now
          </button>
          <button className="btn btn-primary" onClick={handleSave}>Save & Get Started</button>
        </div>
      </div>
    </div>
  )
}
