import React, { useState, useEffect, useCallback } from 'react'

const ROLES = { owner: 'Owner', office_admin: 'Office Admin', field_worker: 'Field Worker' }

export default function Business({ user }) {
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('team') // team | jobs | time
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'field_worker' })
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [timeEntries, setTimeEntries] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const t = await window.electron.team.get()
    setTeam(t)
    if (t) {
      const entries = await window.electron.team.getTimeEntries({ teamId: t.id })
      setTimeEntries(Array.isArray(entries) ? entries : [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createTeam(e) {
    e.preventDefault()
    if (!teamName.trim()) return
    setCreatingTeam(true)
    const result = await window.electron.team.create({ name: teamName.trim() })
    setCreatingTeam(false)
    if (result?.error) { setError(result.error); return }
    setTeam(result.team)
    load()
  }

  async function sendInvite(e) {
    e.preventDefault()
    if (!inviteForm.email || !team) return
    setInviting(true)
    setInviteResult(null)
    const result = await window.electron.team.invite({ teamId: team.id, email: inviteForm.email, role: inviteForm.role })
    setInviting(false)
    if (result?.error) { setError(result.error); return }
    setInviteResult(result)
    setInviteForm({ email: '', role: 'field_worker' })
  }

  async function removeMember(memberId) {
    if (!confirm('Remove this team member?')) return
    await window.electron.team.removeMember({ memberId })
    load()
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading…</div>

  // No team yet — create one
  if (!team) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">Business</div>
            <div className="page-subtitle">Multi-user team management</div>
          </div>
        </div>
        <div style={{ maxWidth: 520 }}>
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Create your team</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>
              Set up your business team to invite field workers, assign jobs, and track time across your crew.
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              <strong style={{ color: 'var(--accent)' }}>$29/month</strong> — cancel anytime.{' '}
              <span
                style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => window.electron.shell.openExternal('https://buy.stripe.com/test_7sYcN69IEb8AbUf1QrcMM00')}
              >
                Upgrade now →
              </span>
            </div>
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>{error}</div>}
            <form onSubmit={createTeam} style={{ display: 'flex', gap: 10 }}>
              <input
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="Your company name"
                style={{ flex: 1, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14 }}
              />
              <button type="submit" className="btn btn-primary" disabled={creatingTeam || !teamName.trim()} style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}>
                {creatingTeam ? 'Creating…' : 'Create Team'}
              </button>
            </form>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
            {[
              { icon: '👥', title: 'Team Members', desc: 'Invite field workers and office admins with different permission levels.' },
              { icon: '📋', title: 'Job Dispatching', desc: 'Assign jobs to specific workers. They see their assigned work on mobile.' },
              { icon: '⏱', title: 'Time Tracking', desc: 'Workers clock in/out from their phone. See hours by job and person.' },
              { icon: '📊', title: 'Team Reports', desc: 'Revenue by worker, job profitability, and crew performance.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="card" style={{ padding: 18 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Team exists — management dashboard
  const memberCount = team.members?.length || 0
  const activeCount = team.members?.filter(m => m.status === 'active').length || 0

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{team.name}</div>
          <div className="page-subtitle">{activeCount} active member{activeCount !== 1 ? 's' : ''} · Business Team</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[['team', '👥 Team'], ['time', '⏱ Time Tracking']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '9px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: 'none', color: tab === id ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: `2px solid ${tab === id ? 'var(--accent)' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {tab === 'team' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, maxWidth: 960 }}>
          {/* Members list */}
          <div>
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Team Members</div>
              {team.members?.length ? team.members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent-muted)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: 'var(--accent)', flexShrink: 0 }}>
                    {(m.name || m.email || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name || m.email}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{m.email}</div>
                  </div>
                  <RoleBadge role={m.role} />
                  <StatusDot active={m.status === 'active'} />
                  {m.role !== 'owner' && (
                    <button onClick={() => removeMember(m.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '2px 6px' }} title="Remove">×</button>
                  )}
                </div>
              )) : <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No members yet. Invite your first worker →</div>}
            </div>
          </div>

          {/* Invite panel */}
          <div>
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Invite a Worker</div>
              <form onSubmit={sendInvite}>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email" required
                    value={inviteForm.email}
                    onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="worker@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="field_worker">Field Worker</option>
                    <option value="office_admin">Office Admin</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" disabled={inviting} style={{ width: '100%' }}>
                  {inviting ? 'Sending…' : 'Send Invite'}
                </button>
              </form>

              {inviteResult && (
                <div style={{ marginTop: 16, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--success)', marginBottom: 8 }}>✓ Invite link created</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Share this link with the worker:</div>
                  <div style={{ fontSize: 11, background: 'var(--surface2)', padding: '8px 10px', borderRadius: 6, wordBreak: 'break-all', color: 'var(--text)', fontFamily: 'monospace' }}>
                    {inviteResult.inviteUrl}
                  </div>
                  <button
                    onClick={() => navigator.clipboard?.writeText(inviteResult.inviteUrl)}
                    style={{ marginTop: 8, fontSize: 12, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', color: 'var(--text-muted)', cursor: 'pointer', width: '100%' }}
                  >
                    Copy Link
                  </button>
                </div>
              )}
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Role Permissions</div>
              {[
                { role: 'owner', color: '#FF6B35', desc: 'Full access. Manages team, billing, all data.' },
                { role: 'office_admin', color: '#3b82f6', desc: 'Can create jobs, invoices, clients. No billing.' },
                { role: 'field_worker', color: '#22c55e', desc: 'Mobile only. View assigned jobs, clock in/out.' },
              ].map(({ role, color, desc }) => (
                <div key={role} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{ROLES[role]}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'time' && (
        <div style={{ maxWidth: 800 }}>
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Time Entries</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Workers clock in and out from the Fieldbase mobile app.</div>
            {timeEntries.length ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                    {['Worker', 'Clock In', 'Clock Out', 'Duration', 'Notes'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeEntries.map(entry => {
                    const duration = entry.clock_out
                      ? Math.round((new Date(entry.clock_out) - new Date(entry.clock_in)) / 60000)
                      : null
                    const member = team.members?.find(m => m.user_id === entry.user_id)
                    return (
                      <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 10px' }}>{member?.name || member?.email || 'Unknown'}</td>
                        <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>{formatTime(entry.clock_in)}</td>
                        <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>{entry.clock_out ? formatTime(entry.clock_out) : <span style={{ color: 'var(--accent)' }}>Active</span>}</td>
                        <td style={{ padding: '10px 10px' }}>{duration != null ? `${Math.floor(duration / 60)}h ${duration % 60}m` : '—'}</td>
                        <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>{entry.notes || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>⏱</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>No time entries yet</div>
                <div style={{ fontSize: 13 }}>Workers clock in from the Fieldbase mobile app. Entries appear here in real time.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RoleBadge({ role }) {
  const colors = { owner: '#FF6B35', office_admin: '#3b82f6', field_worker: '#22c55e' }
  const color = colors[role] || '#8899bb'
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${color}20`, color, textTransform: 'capitalize' }}>
      {ROLES[role] || role}
    </span>
  )
}

function StatusDot({ active }) {
  return <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? '#22c55e' : '#8899bb', flexShrink: 0 }} title={active ? 'Active' : 'Inactive'} />
}

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
