import React, { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Jobs from './pages/Jobs'
import Invoices from './pages/Invoices'
import Estimates from './pages/Estimates'
import Materials from './pages/Materials'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'
import Calendar from './pages/Calendar'
import Settings from './pages/Settings'
import MobileAccess from './pages/MobileAccess'
import Business from './pages/Business'
import Auth from './pages/Auth'
import OnboardingModal from './components/OnboardingModal'
import LicenseBanner from './components/LicenseBanner'
import QuickInvoice from './components/QuickInvoice'
import SetupReminder from './components/SetupReminder'
import { ToastProvider } from './components/Toast'

const PAGES = {
  dashboard: Dashboard,
  clients: Clients,
  jobs: Jobs,
  invoices: Invoices,
  estimates: Estimates,
  materials: Materials,
  expenses: Expenses,
  reports: Reports,
  calendar: Calendar,
  mobile: MobileAccess,
  business: Business,
  settings: Settings,
}

export default function App() {
  const [appState, setAppState] = useState('loading')
  const [page, setPage] = useState('dashboard')
  const [pageKey, setPageKey] = useState(0) // forces re-animation on page change
  const [settings, setSettings] = useState({})
  const [user, setUser] = useState(null)
  const [licensed, setLicensed] = useState(false)
  const [updateStatus, setUpdateStatus] = useState(null) // null | 'downloading' | 'ready'

  useEffect(() => { init() }, [])

  useEffect(() => {
    if (!window.electron?.on) return
    const off1 = window.electron.on('update:downloading', () => setUpdateStatus('downloading'))
    const off2 = window.electron.on('update:ready', () => setUpdateStatus('ready'))
    return () => { if (typeof off1 === 'function') off1(); if (typeof off2 === 'function') off2() }
  }, [])

  async function init() {
    const s = await window.electron.settings.get()
    setSettings(s)
    setLicensed(!!s.license_activated_at)

    // Try to restore Supabase cloud session first
    try {
      const restored = await window.electron.auth.restoreSession()
      if (restored?.restored && restored.account?.email) {
        await window.electron.settings.set({ current_user: JSON.stringify(restored.account) })
        setUser(restored.account)
        setAppState(s.onboarding_done ? 'ready' : 'onboarding')
        return
      }
    } catch {}

    // Fall back to locally stored user (legacy / offline)
    if (s.current_user) {
      try {
        const user = JSON.parse(s.current_user)
        if (user?.email) {
          setUser(user)
          setAppState(s.onboarding_done ? 'ready' : 'onboarding')
          return
        }
      } catch {}
    }

    setAppState('auth')
  }

  const handleNavigate = useCallback((p) => {
    setPage(p)
    setPageKey(k => k + 1)
  }, [])

  const handleAuth = useCallback(async (account) => {
    await window.electron.settings.set({ current_user: JSON.stringify(account) })
    const s = await window.electron.settings.get()
    setUser(account)
    setSettings(s)
    setAppState(s.onboarding_done ? 'ready' : 'onboarding')
  }, [])

  const handleLogout = useCallback(async () => {
    await window.electron.auth.logout()
    await window.electron.settings.set({ current_user: null })
    setUser(null)
    setAppState('auth')
  }, [])

  const handleOnboarding = useCallback(async (data) => {
    await window.electron.settings.set({ ...data, onboarding_done: true })
    setSettings(prev => ({ ...prev, ...data, onboarding_done: true }))
    setAppState('ready')
  }, [])

  const handleSettingsChange = useCallback(async (data) => {
    await window.electron.settings.set(data)
    setSettings(prev => ({ ...prev, ...data }))
  }, [])

  const handleLicenseActivated = useCallback(async () => {
    const s = await window.electron.settings.get()
    setSettings(s)
    setLicensed(!!s.license_activated_at)
  }, [])

  const PageComponent = PAGES[page] || Dashboard

  if (appState === 'loading') return <LoadingScreen />

  if (appState === 'auth') {
    return (
      <ToastProvider>
        <Auth onAuth={handleAuth} />
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <div className="app-layout">
        <Sidebar
          currentPage={page}
          onNavigate={handleNavigate}
          settings={settings}
          user={user}
          licensed={licensed}
          onLogout={handleLogout}
        />
        <div className="main-content">
          <LicenseBanner onActivated={handleLicenseActivated} />
          <SetupReminder settings={settings} onNavigate={handleNavigate} />
          {updateStatus === 'downloading' && (
            <div style={{
              background: 'rgba(79,126,248,0.08)', border: '1px solid rgba(79,126,248,0.2)',
              borderRadius: 8, padding: '9px 16px', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
              color: 'var(--text-muted)',
            }}>
              <div className="spinner" style={{ width: 14, height: 14 }} />
              Downloading update…
            </div>
          )}
          {updateStatus === 'ready' && (
            <div style={{
              background: 'rgba(79,126,248,0.12)', border: '1px solid rgba(79,126,248,0.35)',
              borderRadius: 8, padding: '9px 16px', marginBottom: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              fontSize: 13,
            }}>
              <span>⬆ A new version of Fieldbase is ready to install.</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => window.electron?.updater?.install()}
                style={{ whiteSpace: 'nowrap' }}
              >
                Restart & Update
              </button>
            </div>
          )}
          <div key={pageKey} className="page-enter">
            <PageComponent
              onNavigate={handleNavigate}
              settings={settings}
              onSettingsChange={handleSettingsChange}
              licensed={licensed}
              user={user}
            />
          </div>
        </div>
      </div>
      <QuickInvoice settings={settings} onCreated={() => { if (page === 'invoices') setPageKey(k => k + 1) }} onNavigateInvoices={() => handleNavigate('invoices')} />
      {appState === 'onboarding' && <OnboardingModal onSave={handleOnboarding} />}
    </ToastProvider>
  )
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'var(--bg)',
      gap: 20, animation: 'pageEnter 0.4s ease',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'var(--surface)', border: '1px solid var(--navy-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(255,107,53,0.2)',
        }}>
          <svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="26" width="12" height="24" rx="3" fill="rgba(255,255,255,0.9)"/>
            <rect x="26" y="34" width="10" height="16" rx="3" fill="rgba(255,255,255,0.55)"/>
            <rect x="40" y="30" width="12" height="20" rx="3" fill="#FF6B35"/>
            <line x1="8" y1="51" x2="56" y2="51" stroke="#FF6B35" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="16" cy="20" r="6" fill="#FF6B35"/>
            <circle cx="16" cy="20" r="10" fill="none" stroke="#FF6B35" strokeWidth="1.5" opacity="0.35"/>
          </svg>
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1 }}>
          <span style={{ color: 'var(--accent)' }}>Field</span><span style={{ color: 'var(--text)', fontWeight: 300 }}>base</span>
        </div>
      </div>
      <div className="spinner" />
    </div>
  )
}
