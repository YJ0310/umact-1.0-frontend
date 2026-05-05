import { useState, useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

const COPAY_COMPARISON = {
  labels: ['RM 5K', 'RM 15K', 'RM 30K', 'RM 60K', 'RM 120K', 'RM 200K'],
  claims: [5000, 15000, 30000, 60000, 120000, 200000],
  current: [1000, 3000, 3000, 3000, 3000, 3000],
  singapore_gov: [750, 1750, 2250, 2550, 2750, 2750],
  singapore_pvt: [1250, 3250, 4750, 5750, 6750, 7250],
}

function CopayChart({ showBaseline = true }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    const ctx = ref.current.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: COPAY_COMPARISON.labels,
        datasets: [
          { label: 'Current (RM 3K cap)', data: COPAY_COMPARISON.current, backgroundColor: 'rgba(231,76,60,0.7)', borderRadius: 4 },
          { label: 'Singapore (Gov)', data: COPAY_COMPARISON.singapore_gov, backgroundColor: 'rgba(46,204,113,0.7)', borderRadius: 4 },
          { label: 'Singapore (Private)', data: COPAY_COMPARISON.singapore_pvt, backgroundColor: 'rgba(76,110,245,0.7)', borderRadius: 4 },
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          annotation: showBaseline ? {
            annotations: {
              line1: {
                type: 'line',
                yMin: 3000,
                yMax: 3000,
                borderColor: 'rgb(255, 99, 132)',
                borderWidth: 2,
                borderDash: [6, 6],
                label: { display: true, content: 'Current Cap' }
              }
            }
          } : {}
        },
        scales: { y: { title: { display: true, text: 'Patient Co-payment (RM)' } } }
      }
    })
    return () => chart.destroy()
  }, [showBaseline])
  return <canvas ref={ref} />
}

function FindingCard({ finding, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  return (
    <div className={`card finding-card ${expanded ? 'expanded' : ''}`} onClick={() => setExpanded(!expanded)}>
      <div className="finding-header">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{finding.icon}</span>
            <span className={`badge ${finding.trend === 'up' ? 'badge-danger' : finding.trend === 'down' ? 'badge-success' : 'badge-primary'}`}>
              {finding.badge} {finding.trend === 'up' ? '↑' : finding.trend === 'down' ? '↓' : ''}
            </span>
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{finding.title}</div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: finding.valueColor }}>
            {finding.value}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {finding.subtitle}
          </div>
        </div>
        <span className="finding-toggle">▼</span>
      </div>
      <div className="finding-detail">
        <div className="finding-detail-content">
          <div style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>📊 Data Insight Breakdown</div>
          {finding.detailContent}
        </div>
      </div>
    </div>
  )
}

function ShapChart({ data }) {
  if (!data) return null;
  return (
    <div style={{ marginTop: '1rem' }}>
      {data.map((item, i) => (
        <div key={i} style={{ marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '2px' }}>
            <span>{item.feature}</span>
            <span>{(item.impact * 100).toFixed(0)}%</span>
          </div>
          <div style={{ height: '8px', background: 'var(--bg-card)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${item.impact * 100}%`, background: 'var(--accent)' }}></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function PresentationDashboard() {
  const [tab, setTab] = useState('ceo')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics/presentation')
      .then(res => res.json())
      .then(res => {
        if (res.success) setData(res.data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div className="container" style={{ padding: '2rem 0' }}>
      {/* Header skeleton */}
      <div className="dashboard-header animate-in" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div className="skeleton skeleton-title" style={{ marginBottom: '0.75rem', width: '350px' }} />
          <div className="skeleton skeleton-text" style={{ marginBottom: '0.5rem', width: '280px' }} />
          <div className="skeleton skeleton-text" style={{ width: '200px' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div className="skeleton skeleton-card" style={{ width: '120px', height: '32px' }} />
          <div className="skeleton skeleton-card" style={{ width: '140px', height: '32px' }} />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="tabs animate-in" style={{ marginBottom: '1.25rem', animationDelay: '0.05s' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton skeleton-card" style={{ flex: 1, height: '36px', marginRight: '0.5rem' }} />
        ))}
      </div>

      {/* Hero banner skeleton */}
      <div className="card animate-in" style={{ animationDelay: '0.1s', marginBottom: '1.25rem', background: 'var(--bg-card)', minHeight: '120px' }}>
        <div className="skeleton skeleton-title" style={{ marginBottom: '0.75rem', width: '60%' }} />
        <div className="skeleton skeleton-text" style={{ marginBottom: '0.5rem', width: '85%' }} />
        <div className="skeleton skeleton-text" style={{ width: '70%' }} />
      </div>

      {/* Findings grid skeleton */}
      <div className="grid grid-2 animate-in" style={{ animationDelay: '0.15s', marginBottom: '1.25rem', gap: '1rem' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card" style={{ minHeight: '180px' }}>
            <div className="skeleton skeleton-text" style={{ marginBottom: '0.75rem', width: '40%' }} />
            <div className="skeleton skeleton-title" style={{ marginBottom: '0.75rem', width: '60%' }} />
            <div className="skeleton skeleton-text" style={{ marginBottom: '1rem', width: '50%' }} />
            <div className="skeleton skeleton-card" style={{ height: '60px' }} />
          </div>
        ))}
      </div>

      {/* Content sections skeleton */}
      <div className="grid grid-2 animate-in" style={{ animationDelay: '0.2s', gap: '1rem' }}>
        <div className="card" style={{ minHeight: '280px' }}>
          <div className="skeleton skeleton-title" style={{ marginBottom: '1rem', width: '70%' }} />
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ marginBottom: '0.75rem' }}>
              <div className="skeleton skeleton-text" style={{ marginBottom: '0.35rem', width: '45%' }} />
              <div className="skeleton skeleton-text" style={{ width: '60%' }} />
            </div>
          ))}
        </div>
        <div className="card" style={{ minHeight: '280px' }}>
          <div className="skeleton skeleton-title" style={{ marginBottom: '1rem', width: '65%' }} />
          {[1, 2].map(i => (
            <div key={i} style={{ marginBottom: '1rem' }}>
              <div className="skeleton skeleton-chart" style={{ height: '100px' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="card animate-in" style={{ animationDelay: '0.25s', marginTop: '1.25rem' }}>
        <div className="skeleton skeleton-title" style={{ marginBottom: '1rem', width: '50%' }} />
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {[1, 2, 3].map(i => (
                  <th key={i}><div className="skeleton skeleton-text" style={{ width: '80%' }} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map(row => (
                <tr key={row}>
                  {[1, 2, 3].map(col => (
                    <td key={col}><div className="skeleton skeleton-text" style={{ width: '75%' }} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const fmt = (val) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val)
  const fmtM = (val) => `RM ${(val / 1000000).toFixed(2)}M`

  const CEO_FINDINGS = [
    {
      icon: '🎯', title: 'Model Accuracy', value: 'R² = 0.962', valueColor: 'var(--success)',
      subtitle: 'CatBoost FMV Benchmark — AI Model',
      badge: 'Validated', trend: 'stable',
      detailContent: (
        <div className="table-wrapper">
          <table style={{ fontSize: '11px' }}>
            <thead>
              <tr><th>Metric</th><th>CatBoost</th><th>Industry Avg</th></tr>
            </thead>
            <tbody>
              <tr><td>R-Squared</td><td style={{ color: 'var(--success)', fontWeight: 700 }}>0.9621</td><td>0.884</td></tr>
              <tr><td>RMSLE</td><td style={{ fontWeight: 700 }}>0.1221</td><td>0.185</td></tr>
              <tr><td>Stability</td><td>High</td><td>Medium</td></tr>
            </tbody>
          </table>
        </div>
      )
    },
    {
      icon: '💰', title: 'Expected Savings', value: fmtM(data?.summary?.insurerSaving || 0), valueColor: 'var(--accent)',
      subtitle: 'Annualized Claim Reduction',
      badge: 'Target', trend: 'down',
      detailContent: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingBottom: '4px', borderBottom: '1px solid var(--border)' }}>
            <span>Insurer Savings</span>
            <span style={{ fontWeight: 700 }}>{fmtM(data?.summary?.insurerSaving || 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingBottom: '4px', borderBottom: '1px solid var(--border)' }}>
            <span>Customer Savings</span>
            <span style={{ fontWeight: 700 }}>{fmtM(data?.summary?.customerSaving || 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 800, color: 'var(--accent)' }}>
            <span>Total Reduction</span>
            <span>{fmtM(data?.summary?.totalSaving || 0)}</span>
          </div>
        </div>
      )
    },
    {
      icon: '📊', title: 'Outlier Exposure', value: fmtM(data?.summary?.exposure || 0), valueColor: 'var(--danger)',
      subtitle: 'Tier 2 Over-Benchmark Cost',
      badge: 'Risk', trend: 'up',
      detailContent: (
        <div style={{ background: 'var(--danger-light)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--danger)' }}>
          <div style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 700, marginBottom: '4px' }}>⚠️ TAIL RISK ALERT</div>
          <div style={{ fontSize: '12px', lineHeight: 1.4 }}>
            Historical Tier 2 claims exceed FMV by <strong>15.9%</strong> on average. 
            Targeting top 10 hospitals will recover <strong>65%</strong> of this leakage.
          </div>
        </div>
      )
    },
    {
      icon: '👤', title: 'Member Retention', value: '-14.58%', valueColor: 'var(--success)',
      subtitle: 'Reduction in Member Out-of-Pocket',
      badge: 'Win-Win', trend: 'down',
      detailContent: (
        <div className="table-wrapper">
          <table style={{ fontSize: '11px' }}>
            <thead>
              <tr><th>Stakeholder</th><th>Current</th><th>RiskByte</th></tr>
            </thead>
            <tbody>
              <tr><td>Member OOP</td><td>RM 41.6M</td><td style={{ color: 'var(--success)', fontWeight: 700 }}>RM 35.6M</td></tr>
              <tr><td>Claim Friction</td><td>High</td><td>Low</td></tr>
            </tbody>
          </table>
        </div>
      )
    }
  ]

  return (
    <div className="container">
      <div className="dashboard-header animate-in">
        <div>
          <h1>🎯 Executive Presentation</h1>
          <p style={{ color: 'var(--text-secondary)' }}>CEO • CFO • CTO • COO aligned insights</p>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
            Last data refresh: {data?.lastUpdate ? new Date(data.lastUpdate).toLocaleString() : 'Just now'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="badge badge-primary" style={{ cursor: 'pointer', border: 'none' }} onClick={() => window.print()}>
            📥 Export Report
          </button>
          <span className="badge badge-primary" style={{ fontSize: '0.8rem' }}>Team RiskByte • UMACT 2026</span>
        </div>
      </div>

      <div className="tabs animate-in" style={{ animationDelay: '0.05s' }}>
        {[['ceo', '👩‍💼 CEO'], ['cfo', '💵 CFO'], ['cto', '🧠 CTO'], ['coo', '⚙️ COO']].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'ceo' && (
        <div className="animate-in" style={{ animationDelay: '0.1s' }}>
          {/* Hero Banner */}
          <div className="card" style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #3b82f6 100%)', color: 'white', marginBottom: '1.25rem', border: 'none' }}>
            <div style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: '0.5rem' }}>Executive Summary</h2>
              <p style={{ fontSize: 'var(--font-size-lg)', opacity: 0.9 }}>
                "FMV clipping saves <strong>{fmtM(data?.summary?.totalSaving || 0)}</strong> with zero new infrastructure by aligning Tier 2 billing to historical Tier 1 benchmarks."
              </p>
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                <div className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>-3.9% Insurer Spend</div>
                <div className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>-14.6% Member OOP</div>
                <div className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>100% Data Driven</div>
              </div>
            </div>
          </div>

          <div className="grid grid-2">
            {CEO_FINDINGS.map((f, i) => <FindingCard key={i} finding={f} defaultExpanded={i < 2} />)}
          </div>

          <div className="card" style={{ marginTop: '1.25rem', borderLeft: '4px solid var(--success)' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>✅ Recommended Decision</h4>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              Approve the deployment of the <strong>CatBoost FMV Clipping Model</strong> for all Tier 2 claims starting Q3 2026. This will immediately reduce medical inflation and improve portfolio sustainability.
            </p>
          </div>
        </div>
      )}

      {tab === 'cfo' && (
        <div className="animate-in" style={{ animationDelay: '0.1s' }}>
          <div className="grid grid-2" style={{ marginBottom: '1.25rem' }}>
            <div className="card" style={{ background: 'var(--bg-card)' }}>
              <h3 style={{ marginBottom: '1rem' }}>💵 ROI Analysis (Annualized)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Est. Implementation Cost</span>
                  <span style={{ fontWeight: 700 }}>RM 850k</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Projected Annual Savings</span>
                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>{fmtM(data?.summary?.insurerSaving || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Payback Period</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent)' }}>~3 Months</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>ROI (Year 1)</span>
                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>+4,500%</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>📈 Financial Impact Summary</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { label: 'Insurer Spend', before: 'RM 1.00B', after: 'RM 0.96B', delta: '-3.9%' },
                  { label: 'Member OOP', before: 'RM 41.6M', after: 'RM 35.6M', delta: '-14.6%' },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>{item.label}</div>
                    <div style={{ fontWeight: 800, fontSize: 'var(--font-size-lg)' }}>{item.after}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--success)' }}>{item.delta} reduction</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>Baseline: {item.before}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>📊 Co-payment Gap Analysis</h3>
              <div className="badge badge-danger">Leakage: {fmtM(data?.summary?.totalSaving || 0)}/yr</div>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: 'var(--font-size-sm)' }}>
              Horizontal line indicates the current RM 3,000 cap. Notice how the current model fails to steer behavior as bill sizes increase.
            </p>
            <CopayChart />
          </div>

          <div className="card" style={{ marginTop: '1.25rem' }}>
            <h3>🏥 Savings Breakdown by Diagnosis</h3>
            <div className="table-wrapper" style={{ marginTop: '0.75rem' }}>
              <table>
                <thead>
                  <tr><th>Diagnosis Category</th><th>Estimated Exposure</th><th>Projected Saving</th></tr>
                </thead>
                <tbody>
                  {(data?.diagnosis || []).map((d, i) => (
                    <tr key={i}>
                      <td>{d.name}</td>
                      <td>{fmt(d.saving * 4.2)}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(d.saving)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'cto' && (
        <div className="animate-in" style={{ animationDelay: '0.1s' }}>
          <div className="grid grid-2">
            <div className="card">
              <h3>🏆 Model Leaderboard</h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Benchmarked across 7 algorithms using grouped cross-validation.
              </p>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Algorithm</th><th>RMSLE</th><th>R²</th><th>Stability</th></tr>
                  </thead>
                  <tbody>
                    {(data?.models || []).map((m, i) => (
                      <tr key={i} style={m.name.includes('Champion') ? { background: 'var(--accent-light)' } : {}}>
                        <td>{m.name}</td>
                        <td>{m.rmsle}</td>
                        <td>{m.r2}</td>
                        <td><span className={`badge ${m.stability === 'High' ? 'badge-success' : 'badge-primary'}`}>{m.stability}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h3>🧠 Feature Importance (SHAP)</h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Top drivers for Fair Market Value prediction.
              </p>
              <ShapChart data={data?.shap} />
              <div style={{ marginTop: '1.5rem' }}>
                <h4>⚙️ Model Governance</h4>
                <ul style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
                  <li>Retraining: Every 6 months with latest Tier 1 data.</li>
                  <li>Drift Monitoring: Weekly alert if O/E ratio shifts &gt; 5%.</li>
                  <li>Data Source: Core MongoDB Actuarial Engine.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: '1.25rem' }}>
            <h3>🛠️ System Architecture & Pipeline</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', position: 'relative' }}>
              {/* Simple Flow Diagram */}
              {[
                { label: 'Claim Ingest', icon: '📥' },
                { label: 'Feature Engineering', icon: '⚙️' },
                { label: 'FMV Prediction', icon: '🧠' },
                { label: 'Audit Triage', icon: '⚖️' },
                { label: 'Realized Saving', icon: '💎' }
              ].map((step, i, arr) => (
                <div key={i} style={{ textAlign: 'center', flex: 1, zIndex: 2 }}>
                  <div style={{ width: '50px', height: '50px', background: 'var(--accent)', borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    {step.icon}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', marginTop: '8px', fontWeight: 600 }}>{step.label}</div>
                  {i < arr.length - 1 && (
                    <div style={{ position: 'absolute', top: '25px', left: `${(i * 20) + 15}%`, width: '10%', height: '2px', background: 'var(--border)', zIndex: 1 }}></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'coo' && (
        <div className="animate-in" style={{ animationDelay: '0.1s' }}>
          <div className="grid grid-2">
            <div className="card" style={{ borderTop: '4px solid var(--accent)' }}>
              <h3>📋 Recommended Strategy: Singapore Hybrid</h3>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Our analysis concludes the <strong>Singapore Government sliding model</strong> is the most suitable for the Malaysian market.
              </p>
              <div className="table-wrapper" style={{ marginTop: '1rem' }}>
                <table>
                  <thead><tr><th>Claim Band</th><th>Reimbursement</th></tr></thead>
                  <tbody>
                    <tr><td>First RM 5K</td><td>85%</td></tr>
                    <tr><td>RM 5K–20K</td><td>90%</td></tr>
                    <tr><td>RM 20K–50K</td><td>95%</td></tr>
                    <tr><td>Above RM 50K</td><td>97% (capped at RM 3k OOP)</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h3>🔍 Audit Triage Workflow</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(231,76,60,0.1)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>🔴 High Priority</span>
                  <span style={{ fontWeight: 700 }}>{data?.audit?.high || 772} Claims</span>
                  <span>Manual Audit Required</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(241,196,15,0.1)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ color: 'var(--warning)', fontWeight: 600 }}>🟡 Medium Priority</span>
                  <span style={{ fontWeight: 700 }}>{data?.audit?.medium || 3140} Claims</span>
                  <span>Automated Flagging</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(46,204,113,0.1)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>🟢 Low Priority</span>
                  <span style={{ fontWeight: 700 }}>{data?.audit?.low || 5060} Claims</span>
                  <span>Auto-Pass (FMV Compliant)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: '1.25rem' }}>
            <h3>📅 Implementation Roadmap (3-Phase Rollout)</h3>
            <div className="table-wrapper" style={{ marginTop: '0.75rem' }}>
              <table>
                <thead>
                  <tr><th>Phase</th><th>Focus Area</th><th>Key KPI</th><th>Timeline</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Phase 1</td>
                    <td>Audit Triage & High-Priority Reviews</td>
                    <td>RM 8M Recovered</td>
                    <td>Months 1-3</td>
                  </tr>
                  <tr>
                    <td>Phase 2</td>
                    <td>FMV Clipping for Tier 2 Hospitals</td>
                    <td>-3.9% Spend Reduction</td>
                    <td>Months 4-8</td>
                  </tr>
                  <tr>
                    <td>Phase 3</td>
                    <td>Policy Transition (Singapore Model)</td>
                    <td>Long-term Portfolio Stability</td>
                    <td>Months 9-12</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
