import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

/* ══════════════════════════════════════════════════════════════
   DATA — aligned with Final Report analysis
   ══════════════════════════════════════════════════════════════ */
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
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [pendingQuotes, setPendingQuotes] = useState([])
  const [pendingClaims, setPendingClaims] = useState([])
  const [approvingId, setApprovingId] = useState(null)

  useEffect(() => {
    fetch('/api/analytics/insurer')
      .then(res => res.json())
      .then(result => { if (result.success) setStats(result.data) })
    fetchPending()
  }, [])

  const fetchPending = () => {
    fetch('/api/analytics/insurer/pending')
      .then(res => res.json())
      .then(result => { if (result.success) setPendingQuotes(result.data) })
    fetch('/api/analytics/insurer/claims/pending')
      .then(res => res.json())
      .then(result => { if (result.success) setPendingClaims(result.data) })
  }

  const handleApprove = async (id) => {
    setApprovingId(id)
    try {
      const res = await fetch(`/api/analytics/insurer/approve/${id}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) fetchPending()
    } catch (e) {
      console.error(e)
    }
    setApprovingId(null)
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

  return (
    <div className="container">
      <div className="dashboard-header animate-in">
        <div>
          <h1>🏢 Insurer Analytics</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Profit comparison & cost governance dashboard</p>
        </div>
      </div>

      {/* Key Stats */}
      <div className="stats-row animate-in" style={{ animationDelay: '0.1s' }}>
        {[
          { label: 'Total Claims Analysed', value: stats ? stats.totalClaims.toLocaleString() : '...', icon: '📋' },
          { label: 'Total Claim Amount', value: stats ? `RM ${(stats.totalClaimAmount / 1e6).toFixed(1)}M` : '...', icon: '💰' },
          { label: 'Avg Patient Co-Pay', value: stats ? `RM ${Math.round(stats.copayment?.avgCopay || 0).toLocaleString()}` : '...', icon: '📊' },
          { label: 'Pending Approvals', value: `${pendingQuotes.length} docs`, icon: '🎯' },
        ].map((s, i) => (
          <div key={i} className="card card-stat">
            <div style={{ fontSize: '1.25rem' }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 'var(--font-size-xl)' }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="tabs animate-in" style={{ animationDelay: '0.15s' }}>
        {[['overview', '📊 Overview'], ['comparison', '⚖️ Before vs After'], ['hospitals', '🏥 Hospital FMV'], ['insurer-tools', '🔧 Insurer Actions']].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="animate-in">
          <div className="chart-grid">
            <div className="card"><ChartBox config={tierBarConfig} /></div>
            <div className="card"><ChartBox config={trendsConfig} /></div>
          </div>

          <div className="card" style={{ marginTop: '1.25rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>O/E Ratio — Before vs After MHIT</h3>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Tier</th><th>Observed (RM)</th><th>Expected (RM)</th><th>O/E Before</th><th>O/E After</th><th>Savings (RM)</th></tr></thead>
                <tbody>
                  <tr>
                    <td><span className="badge badge-success">Preferred</span></td>
                    <td>338,761,174</td><td>280,560,385</td><td>1.2074</td><td>1.2074</td><td>—</td>
                  </tr>
                  <tr>
                    <td><span className="badge badge-danger">Standard</span></td>
                    <td>703,312,612</td><td>544,148,256</td><td>1.2925</td><td>1.2096</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>RM 45,108,855</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'comparison' && (
        <div className="animate-in">
          <div className="chart-grid">
            <div className="card"><ChartBox config={mhitConfig} /></div>
            <div className="card">
              <div className="chart-title">💡 What does FMV Clipping do?</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <p>FMV (Fair Market Value) clipping caps hospital charges at the <strong>predicted benchmark</strong> — if a hospital charges more than the expected fair cost for a procedure, the excess is not reimbursed at full rate.</p>
                <div className="divider" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem', background: 'var(--success-light)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: 'var(--font-size-lg)', color: 'var(--success)' }}>-3.90%</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Insurer Spend</div>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'var(--success-light)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: 'var(--font-size-lg)', color: 'var(--success)' }}>-14.58%</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Customer OOP</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'hospitals' && (
        <div className="animate-in">
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <ChartBox config={fmvGapConfig} />
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
              🟢 Green = Preferred hospitals &nbsp;|&nbsp; 🔴 Red = Standard hospitals
            </p>
          </div>
        </div>
      )}

      {tab === 'insurer-tools' && (
        <div className="animate-in">
          <div className="grid grid-2">
            {/* Approve / Register */}
            <div className="card">
              <h4 style={{ marginBottom: '0.75rem' }}>✅ Approve & Register</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '1rem' }}>
                Review new customer applications, approve verified plans, and register policyholders.
              </p>
              <div className="table-wrapper" style={{ marginBottom: '1rem' }}>
                <table>
                  <thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {pendingQuotes.length === 0 ? (
                      <tr><td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>No pending applications.</td></tr>
                    ) : pendingQuotes.map((c) => (
                      <tr key={c._id}>
                        <td>{c.firebaseUid || 'Anon User'}</td>
                        <td><span className="badge badge-primary">{c.planType}</span></td>
                        <td><span className={`badge ${c.checkup_files ? 'badge-warning' : 'badge-danger'}`}>{c.checkup_files ? 'Has Checkup' : 'Missing Checkup'}</span></td>
                        <td>
                          <button 
                            className="btn btn-sm btn-primary" 
                            disabled={approvingId === c._id}
                            onClick={() => handleApprove(c._id)}
                          >
                            {approvingId === c._id ? '...' : 'Approve'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Claims Review */}
            <div className="card">
              <h4 style={{ marginBottom: '0.75rem' }}>📄 Pending Claims</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '1rem' }}>
                Review and approve newly submitted claims from the Customer Portal.
              </p>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Hospital</th><th>User</th><th>Amount</th><th>Action</th></tr></thead>
                  <tbody>
                    {pendingClaims.length === 0 ? (
                      <tr><td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>No pending claims.</td></tr>
                    ) : pendingClaims.map((c, i) => (
                      <tr key={i}>
                        <td>{c.hospitalName}</td>
                        <td title={c.firebaseUid}>{c.firebaseUid.substring(0,8)}...</td>
                        <td>RM {c.claimAmount.toLocaleString()}</td>
                        <td><button className="btn btn-sm btn-outline">Review</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
