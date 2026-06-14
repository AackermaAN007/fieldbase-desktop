import React, { useState, useEffect } from 'react'
import { useToast } from './Toast'

export default function JobPhotos({ jobId }) {
  const toast = useToast()
  const [photos, setPhotos] = useState([])
  const [preview, setPreview] = useState(null)

  useEffect(() => { load() }, [jobId])

  async function load() {
    setPhotos(await window.electron.photos.list(jobId))
  }

  async function upload() {
    const added = await window.electron.photos.upload(jobId)
    if (added?.length) { toast(`${added.length} photo(s) added`); load() }
  }

  async function del(id) {
    await window.electron.photos.delete(id)
    toast('Photo removed')
    load()
  }

  async function updateCaption(id, caption) {
    await window.electron.photos.updateCaption(id, caption)
    load()
  }

  async function openPreview(id) {
    const p = await window.electron.photos.get(id)
    setPreview(p)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Job Photos ({photos.length})</div>
        <button className="btn btn-secondary btn-sm" onClick={upload}>+ Add Photos</button>
      </div>

      {photos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', background: 'var(--surface2)', borderRadius: 8, fontSize: 13 }}>
          No photos yet. Add before/after shots to document the job.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {photos.map(p => (
            <div key={p.id} style={{ background: 'var(--surface2)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ height: 100, background: '#111', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => openPreview(p.id)}>
                <img src={`electron-photo://${p.id}`} alt={p.caption || p.filename}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none' }} />
                <div style={{ position: 'absolute', fontSize: 24, opacity: 0.3 }}>🖼</div>
              </div>
              <div style={{ padding: '6px 8px' }}>
                <input
                  value={p.caption || ''}
                  onChange={e => updateCaption(p.id, e.target.value)}
                  placeholder="Add caption…"
                  style={{ background: 'transparent', border: 'none', fontSize: 11, color: 'var(--text-dim)', width: '100%', padding: 0 }}
                />
                <button onClick={() => del(p.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 10, cursor: 'pointer', padding: 0, marginTop: 2 }}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div style={{ maxWidth: '80vw', maxHeight: '80vh' }}>
            <img src={preview.data} alt={preview.caption}
              style={{ maxWidth: '80vw', maxHeight: '80vh', borderRadius: 8, objectFit: 'contain' }} />
            {preview.caption && (
              <div style={{ textAlign: 'center', marginTop: 8, color: 'white', fontSize: 13 }}>{preview.caption}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
