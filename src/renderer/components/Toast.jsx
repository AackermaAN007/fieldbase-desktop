import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  // Regular toast: toast(message, type)
  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type, undoable: false }])
    setTimeout(() => remove(id), 3500)
  }, [remove])

  // Undoable action: toast.undoable(message, onCommit, onUndo, duration?)
  // - Shows a draining timer bar
  // - "Undo" button cancels the commit and calls onUndo
  // - After duration ms (default 5s), calls onCommit and dismisses
  toast.undoable = useCallback((message, onCommit, onUndo, duration = 5000) => {
    const id = Date.now() + Math.random()
    const commitTimer = setTimeout(() => {
      onCommit()
      remove(id)
    }, duration)
    setToasts(t => [...t, {
      id, message, type: 'info', undoable: true,
      onUndo: () => { clearTimeout(commitTimer); onUndo?.(); remove(id) },
      duration, startedAt: Date.now(),
    }])
  }, [remove])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => t.undoable
          ? <UndoToast key={t.id} toast={t} />
          : <div key={t.id} className={`toast toast-${t.type}`}>
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'} {t.message}
            </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

function UndoToast({ toast: t }) {
  const [progress, setProgress] = useState(100)
  const rafRef = useRef()

  useEffect(() => {
    function tick() {
      const elapsed = Date.now() - t.startedAt
      const pct = Math.max(0, 1 - elapsed / t.duration) * 100
      setProgress(pct)
      if (pct > 0) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [t.startedAt, t.duration])

  return (
    <div className="toast toast-undo">
      <div className="toast-undo-bar" style={{ width: `${progress}%` }} />
      <span className="toast-undo-msg">{t.message}</span>
      <button className="toast-undo-btn" onClick={t.onUndo}>Undo</button>
    </div>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
