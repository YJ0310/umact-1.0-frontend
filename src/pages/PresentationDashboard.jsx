import { useState, useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

const FINDINGS = [
  {
    icon: '🎯', title: 'Model Accuracy', value: 'R² = 0.962', valueColor: 'var(--success)',
    subtitle: 'CatBoost FMV Benchmark — Champion Model',
    badge: 'HistGB',
    detail: 'The champion model was selected from 7 competing algorithms (CatBoost, XGBoost, LightGBM, HistGB, Ridge, ElasticNet, Tweedie GLM) using strict 5-fold grouped cross-validation. HistGB achieved the lowest OOF RMSLE of 0.1198 with CV Std of 0.0138, demonstrating strong generalization. The model is trained exclusively on Tier 1 (Preferred) hospital claims to create a fair pricing reference. SHAP analysis confirms the top drivers are surgical indicator, clinical severity, and chronic conditions — all clinically intuitive.'
  },
  {
    icon: '💰', title: 'Potential Savings', value: 'RM 21.04M', valueColor: 'var(--accent)',
    subtitle: 'High-Priority Audit Queue Expected Savings',
    badge: '772 claims',
    detail: 'Using conformal prediction intervals with an RM 17,565.04 radius, claims are triaged into High/Medium/Low priority queues. The 772 high-priority claims represent the largest cost deviation from FMV, with conservative savings of RM 8.15M and expected savings of RM 21.04M. This provides a direct, quantifiable answer to "where should auditors focus?"'
  },
  {
    icon: '📊', title: 'Over-Benchmark Exposure', value: 'RM 159.16M', valueColor: 'var(--danger)',
    subtitle: 'Total Tier 2 Over-FMV Cost',
    badge: '58.73% of claims',
    detail: 'Applied to 8,972 Tier 2 claims, 5,269 (58.73%) exceeded the FMV benchmark. The total over-benchmark cost was RM 159.16M. Median FMV gap was RM 216.72, meaning the "typical" Tier 2 claim is close to FMV, but the upper tail is material — about 10% exceed FMV by more than RM 12,700.'
  },
  {
    icon: '🏢', title: 'Insurer Spend Reduction', value: '-3.90%', valueColor: 'var(--success)',
    subtitle: 'After FMV Clipping on Tier 2',
    badge: 'RM 39M saved',
    detail: 'After applying the MHIT simulation (approved_amount = min(actual_billed, predicted_FMV)), insurer spend dropped from RM 1,000.4M to RM 961.4M (-3.90%). Customer OOP dropped from RM 41.6M to RM 35.6M (-14.58%). Tier 2 O/E improved from 1.2925 to 1.2096, directly demonstrating that FMV clipping generates measurable savings.'
  },
  {
    icon: '🏥', title: 'Hospital Tiering', value: '91.4% Stable', valueColor: 'var(--accent)',
    subtitle: '60 Hospitals Classified into 2 Tiers',
    badge: 'K-Means',
    detail: 'K-Means clustering (K=2) was selected from 3 algorithms (K-Means, Ward, Gaussian Mixture) based on highest silhouette score (0.4220). Mann-Whitney U tests returned all p < 0.001 with Cohen\'s d > 1.4 across all metrics. 100-iteration bootstrap stability: 32/60 hospitals (53.3%) received stable tier assignments. Remaining hospitals expand benchmark coverage.'
  },
  {
    icon: '👤', title: 'Customer OOP Savings', value: '-14.58%', valueColor: 'var(--success)',
    subtitle: 'Customer Out-of-Pocket Reduction',
    badge: 'Win-Win',
    detail: 'The FMV clipping model benefits both insurers AND customers. Customer OOP dropped RM 6.07M (from RM 41.6M to RM 35.6M). This is because when hospital charges are clipped to the fair benchmark, the 20% co-payment is calculated on a lower base amount, directly reducing what patients pay.'
  },
]

const COPAY_COMPARISON = {
  labels: ['RM\n5,000', 'RM\n15,000', 'RM\n30,000', 'RM\n60,000', 'RM\n120,000', 'RM\n200,000'],
  claims: [5000, 15000, 30000, 60000, 120000, 200000],
  current: [1000, 3000, 3000, 3000, 3000, 3000],
  singapore_gov: [750, 1750, 2250, 2550, 2750, 2750],
  singapore_pvt: [1250, 3250, 4750, 5750, 6750, 7250],
}

function CopayChart() {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    const chart = new Chart(ref.current.getContext('2d'), {
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
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { title: { display: true, text: 'Patient Co-payment (RM)' } } }
      }
    })
    return () => chart.destroy()
  }, [])
  return <canvas ref={ref} />
}

function FindingCard({ finding }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`card finding-card ${expanded ? 'expanded' : ''}`} onClick={() => setExpanded(!expanded)}>
      <div className="finding-header">
        <div style={{flex: 1}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem'}}>
            <span style={{fontSize: '1.5rem'}}>{finding.icon}</span>
            <span className="badge badge-primary">{finding.badge}</span>
          </div>
          <div style={{fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '0.25rem'}}>{finding.title}</div>
          <div style={{fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: finding.valueColor}}>
            {finding.value}
          </div>
          <div style={{fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '0.25rem'}}>
            {finding.subtitle}
          </div>
        </div>
        <span className="finding-toggle">▼</span>
      </div>
      <div className="finding-detail">
        <div className="finding-detail-content">
          <strong>📖 How we derived this:</strong><br/>
          {finding.detail}
        </div>
      </div>
    </div>
  )
}

export default function PresentationDashboard() {
  const [tab, setTab] = useState('ceo')

  return (
    <div className="container">
      <div className="dashboard-header animate-in">
        <div>
          <h1>🎯 Executive Presentation</h1>
          <p style={{color: 'var(--text-secondary)'}}>CEO • CFO • CTO • COO aligned insights</p>
        </div>
        <span className="badge badge-primary" style={{fontSize: '0.8rem'}}>Team RiskByte • UMACT 2026</span>
      </div>

      <div className="tabs animate-in" style={{animationDelay: '0.05s'}}>
        {[['ceo', '👩‍💼 CEO'], ['cfo', '💵 CFO'], ['cto', '🧠 CTO'], ['coo', '⚙️ COO']].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'ceo' && (
        <div className="grid grid-2 animate-in" style={{animationDelay: '0.1s'}}>
          {FINDINGS.slice(0, 4).map((f, i) => <FindingCard key={i} finding={f} />)}
        </div>
      )}

      {tab === 'cfo' && (
        <div className="animate-in" style={{animationDelay: '0.1s'}}>
          <div className="card" style={{marginBottom: '1.25rem'}}>
            <h3 style={{marginBottom: '0.75rem'}}>💵 Financial Impact Summary</h3>
            <p style={{color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: 'var(--font-size-sm)'}}>
              FMV clipping reduces insurer spend while lowering customer out-of-pocket exposure. Savings concentrate in Tier 2 outliers.
            </p>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem'}}>
              {[
                { label: 'Insurer spend reduction', value: '-3.90%' },
                { label: 'Customer OOP reduction', value: '-14.58%' },
                { label: 'Tier 2 over-FMV', value: 'RM 159.16M' },
                { label: 'High-priority savings', value: 'RM 21.04M' },
              ].map((item, i) => (
                <div key={i} style={{padding: '0.75rem', background: 'var(--accent-light)', borderRadius: 'var(--radius-md)', textAlign: 'center'}}>
                  <div style={{fontWeight: 800, fontSize: 'var(--font-size-lg)', color: 'var(--accent)'}}>{item.value}</div>
                  <div style={{fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)'}}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 style={{marginBottom: '0.75rem'}}>📊 Co-payment Model Comparison</h3>
            <p style={{color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: 'var(--font-size-sm)'}}>
              The current RM 3,000 cap is hit at just RM 15,000 of claims. The sliding model keeps patients sharing costs proportionally.
            </p>
            <CopayChart />
          </div>
        </div>
      )}

      {tab === 'cto' && (
        <div className="grid grid-2 animate-in" style={{animationDelay: '0.1s'}}>
          {FINDINGS.filter((f) => ['Model Accuracy', 'Hospital Tiering'].includes(f.title)).map((f, i) => (
            <FindingCard key={i} finding={f} />
          ))}
          <div className="card" style={{lineHeight: 1.7}}>
            <h3 style={{marginBottom: '0.5rem'}}>🧠 Model & Pipeline Notes</h3>
            <ul style={{paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)'}}>
              <li>Training data: Tier 1 claims only for FMV fairness baseline.</li>
              <li>Features: severity, LOS, surgical indicator, chronic conditions.</li>
              <li>Validation: 5-fold grouped CV to prevent hospital leakage.</li>
              <li>Outputs: FMV benchmark, conformal intervals, tiering signals.</li>
            </ul>
          </div>
        </div>
      )}

      {tab === 'coo' && (
        <div className="animate-in" style={{animationDelay: '0.1s'}}>
          <div className="grid grid-2">
            <div className="card" style={{borderLeft: '4px solid var(--accent)'}}>
              <h4>🇸🇬 Singapore Model</h4>
              <p style={{color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', margin: '0.5rem 0'}}>
                Sliding coinsurance with age-based max cap. Patient pays less as the bill gets larger.
              </p>
              <div className="table-wrapper" style={{marginTop: '0.5rem'}}>
                <table>
                  <thead><tr><th>Claim Band</th><th>Gov Rate</th><th>Private Rate</th></tr></thead>
                  <tbody>
                    <tr><td>First RM 5K</td><td>15%</td><td>25%</td></tr>
                    <tr><td>RM 5K–20K</td><td>10%</td><td>20%</td></tr>
                    <tr><td>RM 20K–50K</td><td>5%</td><td>15%</td></tr>
                    <tr><td>RM 50K–100K</td><td>3%</td><td>10%</td></tr>
                    <tr><td>Above RM 100K</td><td>1%</td><td>5%</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card" style={{borderLeft: '4px solid var(--warning)'}}>
              <h4>🇨🇳 China Model</h4>
              <p style={{color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', margin: '0.5rem 0'}}>
                Annual DRG claim quota per hospital. Exceeding quota triggers payment reduction.
              </p>
              <div className="table-wrapper" style={{marginTop: '0.5rem'}}>
                <table>
                  <thead><tr><th>Zone</th><th>Quota Range</th><th>Reimbursement</th></tr></thead>
                  <tbody>
                    <tr><td><span className="badge badge-success">Normal</span></td><td>0%–120%</td><td>100%</td></tr>
                    <tr><td><span className="badge badge-warning">Reduced</span></td><td>120%–150%</td><td>80%</td></tr>
                    <tr><td><span className="badge badge-danger">Penalty</span></td><td>Above 150%</td><td>60%</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card" style={{marginTop: '1.25rem', lineHeight: 1.7}}>
            <h3 style={{marginBottom: '0.5rem'}}>⚙️ Operations Playbook</h3>
            <ul style={{paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)'}}>
              <li>Trigger request review for outlier claims and missing documents.</li>
              <li>Apply hospital DRG pool quotas to control annual exposure.</li>
              <li>Use tiered hospital lists to steer members to preferred providers.</li>
              <li>Publish monthly governance reports to track savings.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
