import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import { useAlert } from '../components/AlertProvider'
Chart.register(...registerables)

const INSURER_DATA = {
  tierComparison: {
    labels: ['Avg Claim (RM)', 'Avg LOS (days)', 'O/E Ratio', 'Surgical Share (%)'],
    tier1: [21953, 5.21, 1.207, 40.3],
    tier2: [28634, 5.37, 1.293, 45.0],
  },
  mhitImpact: {
    labels: ['Insurer Spend', 'Customer OOP', 'Combined Total'],
    before: [1000436501, 41637286, 1042073787],
    after: [961398553, 35566379, 996964932],
  },
  monthlyTrends: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    data2023: [78, 72, 85, 69, 74, 71, 80, 76, 68, 82, 77, 88],
    data2024: [82, 79, 91, 75, 80, 78, 86, 83, 74, 89, 84, 95],
    data2025: [92, 87, 98, 84, 88, 85, 94, 91, 82, 96, 93, 102],
  },
  fmvGap: {
    hospitals: ['H-01', 'H-02', 'H-03', 'H-04', 'H-05', 'H-06', 'H-07', 'H-08', 'H-09', 'H-10'],
    gaps: [18200, 15800, 14500, 12900, 11200, 9800, 8500, 7200, 6100, 4800],
    tiers: ['Standard', 'Standard', 'Standard', 'Standard', 'Standard', 'Standard', 'Preferred', 'Standard', 'Preferred', 'Preferred'],
  }
}

function ChartBox({ config, height = 300 }) {
  const ref = useRef(null)
  const chartRef = useRef(null)
  useEffect(() => {
    if (chartRef.current) chartRef.current.destroy()
    if (!ref.current) return
    chartRef.current = new Chart(ref.current.getContext('2d'), config)
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [JSON.stringify(config)])
  return <canvas ref={ref} style={{ maxHeight: height }} />
}

export default function InsurerDashboard() {
  const { showAlert } = useAlert()
  const [tab, setTab] = useState('request-board')
  const [stats, setStats] = useState(null)
  const [requests, setRequests] = useState([])
  const [users, setUsers] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [decisionNotes, setDecisionNotes] = useState({})
  const [decisionAmounts, setDecisionAmounts] = useState({})
  const [savingRequest, setSavingRequest] = useState(null)
  const [editingUserId, setEditingUserId] = useState(null)
  const [userEdit, setUserEdit] = useState({ planType: '', annualLimit: '' })

  const getId = (item) => item?._id?.$oid || item?._id || ''

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/analytics/insurer')
      const result = await res.json()
      if (result.success) setStats(result.data)
    } catch (err) {
      showAlert('Failed to load insurer stats.', 'error')
    }
  }

  const fetchRequests = async () => {
    setLoadingRequests(true)
    try {
      const res = await fetch('/api/analytics/insurer/requests')
      const result = await res.json()
      if (result.success) setRequests(result.data || [])
    } catch (err) {
      showAlert('Failed to load request board.', 'error')
    } finally {
      setLoadingRequests(false)
    }
  }

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const res = await fetch('/api/analytics/insurer/users')
      const result = await res.json()
      if (result.success) setUsers(result.data || [])
    } catch (err) {
      showAlert('Failed to load users.', 'error')
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    fetchStats()
    fetchRequests()
    fetchUsers()
  }, [])

  const submitDecision = async (request, status) => {
    const requestId = getId(request)
    setSavingRequest(requestId)
    const note = decisionNotes[requestId] || ''
    const amount = decisionAmounts[requestId]
    const reviewData = request.type === 'claim'
      ? {
          actualAmountFinal: status === 'approved' ? Number(amount || request.payload?.claimAmount || 0) : null,
          note: note || null
        }
      : { note: note || null }

    try {
      const res = await fetch(`/api/analytics/insurer/requests/${requestId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason: note || null, reviewData })
      })
      const data = await res.json()
      if (data.success) {
        showAlert(`Request ${status}.`, 'success')
        fetchRequests()
      } else {
        showAlert(data.error || 'Failed to update request.', 'error')
      }
    } catch (err) {
      showAlert('Network error while updating request.', 'error')
    } finally {
      setSavingRequest(null)
    }
  }

  const startEditUser = (user) => {
    setEditingUserId(getId(user))
    setUserEdit({
      planType: user?.planType || '',
      annualLimit: user?.annualLimit || ''
    })
  }

  const saveUser = async () => {
    if (!editingUserId) return
    try {
      const res = await fetch(`/api/analytics/insurer/users/${editingUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planType: userEdit.planType,
          annualLimit: userEdit.annualLimit
        })
      })
      const data = await res.json()
      if (data.success) {
        showAlert('User updated.', 'success')
        setEditingUserId(null)
        fetchUsers()
      } else {
        showAlert(data.error || 'Failed to update user.', 'error')
      }
    } catch (err) {
      showAlert('Network error while updating user.', 'error')
    }
  }

  const deleteUser = async (userId) => {
    try {
      const res = await fetch(`/api/analytics/insurer/users/${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        showAlert('User removed.', 'success')
        fetchUsers()
      } else {
        showAlert(data.error || 'Failed to remove user.', 'error')
      }
    } catch (err) {
      showAlert('Network error while removing user.', 'error')
    }
  }

  const tierBarConfig = {
    type: 'bar',
    data: {
      labels: INSURER_DATA.tierComparison.labels,
      datasets: [
        { label: 'Preferred (Tier 1)', data: INSURER_DATA.tierComparison.tier1, backgroundColor: 'rgba(46,204,113,0.7)', borderRadius: 6 },
        { label: 'Standard (Tier 2)', data: INSURER_DATA.tierComparison.tier2, backgroundColor: 'rgba(231,76,60,0.7)', borderRadius: 6 },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Preferred vs Standard Hospitals — Key Metrics' } },
      scales: { y: { beginAtZero: true } }
    }
  }

  const mhitConfig = {
    type: 'bar',
    data: {
      labels: INSURER_DATA.mhitImpact.labels,
      datasets: [
        { label: 'Before FMV Clipping', data: INSURER_DATA.mhitImpact.before.map(v => v / 1e6), backgroundColor: 'rgba(231,76,60,0.7)', borderRadius: 6 },
        { label: 'After FMV Clipping', data: INSURER_DATA.mhitImpact.after.map(v => v / 1e6), backgroundColor: 'rgba(46,204,113,0.7)', borderRadius: 6 },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'MHIT Impact — Before vs After FMV Clipping (RM Millions)' } },
      scales: { y: { title: { display: true, text: 'RM (Millions)' } } }
    }
  }

  const trendsConfig = {
    type: 'line',
    data: {
      labels: INSURER_DATA.monthlyTrends.labels,
      datasets: [
        { label: '2023', data: INSURER_DATA.monthlyTrends.data2023, borderColor: '#4c6ef5', tension: 0.4, fill: false, borderWidth: 2 },
        { label: '2024', data: INSURER_DATA.monthlyTrends.data2024, borderColor: '#7c3aed', tension: 0.4, fill: false, borderWidth: 2 },
        { label: '2025', data: INSURER_DATA.monthlyTrends.data2025, borderColor: '#e74c3c', tension: 0.4, fill: false, borderWidth: 2 },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Monthly Claim Trends (2023–2025, RM Millions)' } },
      scales: { y: { title: { display: true, text: 'RM (Millions)' } } }
    }
  }

  const fmvGapConfig = {
    type: 'bar',
    data: {
      labels: INSURER_DATA.fmvGap.hospitals,
      datasets: [{
        label: 'Over-FMV Amount (RM)',
        data: INSURER_DATA.fmvGap.gaps,
        backgroundColor: INSURER_DATA.fmvGap.tiers.map(t => t === 'Standard' ? 'rgba(231,76,60,0.7)' : 'rgba(46,204,113,0.7)'),
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true, indexAxis: 'y',
      plugins: { legend: { display: false }, title: { display: true, text: 'Top 10 Hospitals — FMV Over-Benchmark Gap (RM)' } },
      scales: { x: { title: { display: true, text: 'Over-FMV Amount (RM)' } } }
    }
  }

  // Show loading skeleton while stats, requests, and users are loading
  if (!stats || loadingRequests || loadingUsers) {
    return (
      <div className="container">
        <div className="dashboard-header animate-in">
          <div>
            <div className="skeleton skeleton-text" style={{maxWidth: '300px', marginBottom: '0.5rem'}} />
            <div className="skeleton skeleton-text" style={{maxWidth: '400px'}} />
          </div>
        </div>

        <div className="stats-row animate-in" style={{animationDelay: '0.1s'}}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card card-stat">
              <div className="skeleton skeleton-circle" style={{width: '24px', height: '24px', marginBottom: '0.5rem'}} />
              <div className="skeleton skeleton-text" style={{maxWidth: '80px', marginBottom: '0.5rem'}} />
              <div className="skeleton skeleton-text" style={{maxWidth: '100px'}} />
            </div>
          ))}
        </div>

        <div className="tabs animate-in" style={{animationDelay: '0.15s'}}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton skeleton-text" style={{maxWidth: '120px', marginRight: '1rem', height: '36px'}} />
          ))}
        </div>

        <div className="card animate-in" style={{animationDelay: '0.2s'}}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton skeleton-text" style={{marginBottom: '0.75rem'}} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="dashboard-header animate-in">
        <div>
          <h1>🏢 Insurer Command Center</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Request governance, member edits, and profit analytics</p>
        </div>
      </div>

      <div className="stats-row animate-in" style={{ animationDelay: '0.1s' }}>
        {[
          { label: 'Total Claims Analysed', value: stats ? stats.totalClaims.toLocaleString() : '...', icon: '📋' },
          { label: 'Total Claim Amount', value: stats ? `RM ${(stats.totalClaimAmount / 1e6).toFixed(1)}M` : '...', icon: '💰' },
          { label: 'Avg Patient Co-Pay', value: stats ? `RM ${Math.round(stats.copayment?.avgCopay || 0).toLocaleString()}` : '...', icon: '📊' },
          { label: 'Live Requests', value: `${requests.length} items`, icon: '🎯' },
        ].map((s, i) => (
          <div key={i} className="card card-stat">
            <div style={{ fontSize: '1.25rem' }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 'var(--font-size-xl)' }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="tabs animate-in" style={{ animationDelay: '0.15s' }}>
        {[
          ['request-board', '🧾 Request Board'],
          ['edit-users', '🛠️ Edit Users'],
          ['profit', '📈 Profit'],
          ['profit-details', '📊 Profit Details']
        ].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'request-board' && (
        <div className="card animate-in">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
            <h3>Unified Request Board</h3>
            <button className="btn btn-ghost btn-sm" onClick={fetchRequests} disabled={loadingRequests}>Refresh</button>
          </div>
          <div className="table-wrapper">
            {loadingRequests ? (
              <div className="skeleton skeleton-chart" />
            ) : (
              <table>
                <thead>
                  <tr><th>Customer</th><th>Type</th><th>Hospital/DRG</th><th>Amount</th><th>Status</th><th>Decision</th></tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>No requests.</td></tr>
                  ) : requests.map((r) => {
                    const requestId = getId(r)
                    const decisionNote = decisionNotes[requestId] || ''
                    const decisionAmount = decisionAmounts[requestId] || ''
                    return (
                      <tr key={requestId}>
                        <td>{r.customerName || r.firebaseUid || 'Unknown'}</td>
                        <td>{r.type}</td>
                        <td>{r.payload?.hospitalName || '-'} / {r.payload?.drg || '-'}</td>
                        <td>RM {Number(r.payload?.claimAmount || 0).toLocaleString()}</td>
                        <td><span className={`badge ${r.status === 'approved' ? 'badge-success' : r.status === 'denied' ? 'badge-danger' : r.status === 'reviewed' ? 'badge-primary' : 'badge-warning'}`}>{r.status}</span></td>
                        <td>
                          <div style={{display: 'grid', gap: '0.5rem'}}>
                            <input
                              className="input"
                              placeholder="Decision note (optional)"
                              value={decisionNote}
                              onChange={(e) => setDecisionNotes((prev) => ({ ...prev, [requestId]: e.target.value }))}
                            />
                            {r.type === 'claim' && (
                              <input
                                className="input"
                                type="number"
                                placeholder="Approved amount"
                                value={decisionAmount}
                                onChange={(e) => setDecisionAmounts((prev) => ({ ...prev, [requestId]: e.target.value }))}
                              />
                            )}
                            <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                              <button className="btn btn-primary btn-sm" onClick={() => submitDecision(r, 'approved')} disabled={savingRequest === requestId}>Approve</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => submitDecision(r, 'reviewed')} disabled={savingRequest === requestId}>Need Docs</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => submitDecision(r, 'denied')} disabled={savingRequest === requestId}>Deny</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'edit-users' && (
        <div className="card animate-in">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
            <h3>Edit & Remove Users</h3>
            <button className="btn btn-ghost btn-sm" onClick={fetchUsers} disabled={loadingUsers}>Refresh</button>
          </div>
          <div className="table-wrapper">
            {loadingUsers ? (
              <div className="skeleton skeleton-chart" />
            ) : (
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Plan</th><th>Annual Limit</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>No users.</td></tr>
                  ) : users.map((u) => {
                    const userId = getId(u)
                    const isEditing = editingUserId === userId
                    return (
                      <tr key={userId}>
                        <td>{u.name || 'Unknown'}</td>
                        <td>{u.email || '—'}</td>
                        <td>
                          {isEditing ? (
                            <select className="input" value={userEdit.planType} onChange={(e) => setUserEdit((prev) => ({ ...prev, planType: e.target.value }))}>
                              {['Basic', 'Silver', 'Gold', 'Platinum'].map((p) => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="badge badge-primary">{u.planType || 'Basic'}</span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input className="input" type="number" value={userEdit.annualLimit} onChange={(e) => setUserEdit((prev) => ({ ...prev, annualLimit: e.target.value }))} />
                          ) : (
                            `RM ${Number(u.annualLimit || 0).toLocaleString()}`
                          )}
                        </td>
                        <td style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                          {isEditing ? (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={saveUser}>Save</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditingUserId(null)}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button className="btn btn-ghost btn-sm" onClick={() => startEditUser(u)}>Edit</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => deleteUser(userId)}>Remove</button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'profit' && (
        <div className="animate-in">
          <div className="chart-grid">
            <div className="card"><ChartBox config={tierBarConfig} /></div>
            <div className="card"><ChartBox config={mhitConfig} /></div>
          </div>
        </div>
      )}

      {tab === 'profit-details' && (
        <div className="animate-in">
          <div className="chart-grid">
            <div className="card"><ChartBox config={trendsConfig} /></div>
            <div className="card"><ChartBox config={fmvGapConfig} /></div>
          </div>
        </div>
      )}
    </div>
  )
}
