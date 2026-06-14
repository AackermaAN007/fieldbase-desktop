import React, { useRef, useState, useEffect } from 'react'

export default function SignaturePad({ onSave, onClose, invoiceId }) {
  const canvasRef = useRef()
  const [drawing, setDrawing] = useState(false)
  const [name, setName] = useState('')
  const [hasSignature, setHasSignature] = useState(false)
  const lastPos = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#1a1d27'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#e8eaf0'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
  }

  function startDraw(e) {
    e.preventDefault()
    const canvas = canvasRef.current
    setDrawing(true)
    lastPos.current = getPos(e, canvas)
  }

  function draw(e) {
    e.preventDefault()
    if (!drawing) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
    setHasSignature(true)
  }

  function stopDraw() { setDrawing(false) }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#1a1d27'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  async function save() {
    if (!hasSignature) return
    const data = canvasRef.current.toDataURL('image/png')
    await window.electron.signatures.save({ invoice_id: invoiceId, signer_name: name, data })
    onSave({ signer_name: name, data, signed_at: new Date().toISOString() })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <div className="modal-title">Customer Signature</div>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Signer's Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" />
          </div>
          <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            Sign in the box below:
          </div>
          <canvas
            ref={canvasRef}
            width={580} height={200}
            style={{ width: '100%', height: 180, borderRadius: 8, border: '1px solid var(--border)', cursor: 'crosshair', touchAction: 'none' }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
          />
          <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            By signing, the customer acknowledges receipt of this estimate/invoice and agrees to the stated terms.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={clear}>Clear</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={!hasSignature || !name.trim()}>
            Save Signature
          </button>
        </div>
      </div>
    </div>
  )
}
