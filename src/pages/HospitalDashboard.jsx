import { useState, useEffect, useRef, useMemo } from 'react'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

const CHART_COLORS = ['#4c6ef5','#7c3aed','#2ecc71','#f0a530','#e74c3c','#3498db','#e67e22','#1abc9c','#9b59b6','#34495e','#d35400','#27ae60','#c0392b','#2980b9','#8e44ad']

/* ── Policy Calculations ─────────────────────────────────── */
function currentCopay(claim) { return Math.min(claim * 0.20, 3000) }

function sgGovCopay(claim) {
  const bands = [[5000, 0.15], [20000, 0.10], [50000, 0.05], [100000, 0.03], [150000, 0.01]]
  let remaining = claim, paid = 0, lower = 0
  for (const [upper, rate] of bands) {
    const width = Math.max(Math.min(remaining, upper - lower), 0)
    paid += width * rate; remaining -= width; lower = upper
    if (remaining <= 0) break
  }
  return paid
}

function sgPvtCopay(claim) {
  const bands = [[5000, 0.25], [20000, 0.20], [50000, 0.15], [100000, 0.10], [150000, 0.05]]
  let remaining = claim, paid = 0, lower = 0
  for (const [upper, rate] of bands) {
    const width = Math.max(Math.min(remaining, upper - lower), 0)
    paid += width * rate; remaining -= width; lower = upper
    if (remaining <= 0) break
  }
  return paid
}

function chinaBlendedRate(claimCount, quota) {
  if (claimCount === 0 || quota === 0) return 1.0
  const buffer = quota * 1.2
  const penalty = quota * 1.5

  if (claimCount <= buffer) {
    return 1.0
  } else if (claimCount <= penalty) {
    const full = buffer
    const reduced = claimCount - buffer
    return ((full * 1.0) + (reduced * 0.8)) / claimCount
  } else {
    const full = buffer
    const reduced = penalty - buffer
    const severe = claimCount - penalty
    return ((full * 1.0) + (reduced * 0.8) + (severe * 0.6)) / claimCount
  }
}

/* ══════════════════════════════════════════════════════════════
   CHART COMPONENTS
   ══════════════════════════════════════════════════════════════ */

function ChartComponent({ config, height = 300 }) {
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

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function HospitalDashboard() {
  const [allHospitals, setAllHospitals] = useState([])
  const [drgList, setDrgList] = useState([])
  const [loading, setLoading] = useState(true)

  const [viewMode, setViewMode] = useState('byHospital') // 'byHospital' | 'byDRG' | 'tiers'
  const [selectedHospital, setSelectedHospital] = useState('')
  const [selectedDRG, setSelectedDRG] = useState('')
  const [policyToggle, setPolicyToggle] = useState('current') // 'current' | 'singapore' | 'china' | 'both'
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleString())

  useEffect(() => {
    fetch('/api/analytics/hospitals')
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          const { hospitals, hospitalDRG } = result.data
          const uniqueDRGs = [...new Set(hospitalDRG.map(d => d._id.drg))].filter(Boolean).sort()
          setDrgList(uniqueDRGs)

          const mapped = hospitals.map(h => {
            const tier = Number(h.tier ?? h.final_tier ?? 2)
            const drgs = {}
            uniqueDRGs.forEach(drg => {
              const match = hospitalDRG.find(d => d._id.hospital === h.hospital_name && d._id.drg === drg)
              if (match) {
                const avgClaim = Math.round(match.avgClaim)
                const claimCount = match.count
                const quota = Math.max(1, Math.round(match.quota || 1))
                const oe = (avgClaim / (tier === 1 ? 18000 : 25000)).toFixed(3)
                drgs[drg] = { avgClaim, claimCount, quota, oe: parseFloat(oe) }
              } else {
                drgs[drg] = { avgClaim: 0, claimCount: 0, quota: 1, oe: 1 }
              }
            })
            // Map _id to id if needed, logic is expecting `id` string
            return { id: h._id || h.hospital_name, name: h.hospital_name, tier, region: h.region, drgs }
          })

          setAllHospitals(mapped)
          setSelectedHospital(mapped[0]?.id || '')
          setSelectedDRG(uniqueDRGs[0] || '')
          if (result.data.lastUpdated) {
            setLastUpdate(new Date(result.data.lastUpdated).toLocaleString())
          }
          setLoading(false)
        }
      })
      .catch(console.error)
  }, [])

  const hospital = allHospitals.find(h => h.id === selectedHospital)

  /* ── Derived tier summary ──────────────────────────────── */
  const tierSummary = useMemo(() => {
    if (!allHospitals.length) return null
    const t1 = allHospitals.filter(h => h.tier === 1)
    const t2 = allHospitals.filter(h => h.tier === 2)
    const avgClaim = (arr) => {
      if (!arr.length) return 0
      const all = arr.flatMap(h => Object.values(h.drgs).map(d => d.avgClaim)).filter(v => v > 0)
      if (!all.length) return 0
      return Math.round(all.reduce((a, b) => a + b, 0) / all.length)
    }
    const avgOE = (arr) => {
      if (!arr.length) return 0
      const all = arr.flatMap(h => Object.values(h.drgs).map(d => d.oe)).filter(v => v > 0)
      if (!all.length) return 0
      return (all.reduce((a, b) => a + b, 0) / all.length).toFixed(3)
    }
    return {
      tier1: { count: t1.length, avgClaim: avgClaim(t1), avgOE: avgOE(t1), label: 'Preferred Providers', desc: 'Lower cost, high efficiency — your best value option.' },
      tier2: { count: t2.length, avgClaim: avgClaim(t2), avgOE: avgOE(t2), label: 'Standard Providers', desc: 'Higher cost — claims may be benchmarked against fair value.' },
    }
  }, [allHospitals])

  /* ── Build chart for single hospital (all DRGs) ────────── */
  const hospitalChartConfig = useMemo(() => {
    if (!hospital || !drgList.length) return null
    const labels = drgList
    const oldData = labels.map(drg => hospital.drgs[drg].avgClaim)

    let newLabel, newData
    if (policyToggle === 'singapore' || policyToggle === 'both') {
      newLabel = 'Singapore Model'
      newData = oldData.map(v => Math.round(v - (hospital.tier === 2 ? sgPvtCopay(v) : sgGovCopay(v))))
    } else if (policyToggle === 'china') {
      newLabel = 'China Model'
      newData = oldData.map((v, i) => {
        const d = hospital.drgs[labels[i]]
        return Math.round(v * chinaBlendedRate(d.claimCount, d.quota))
      })
    } else {
      newLabel = 'Current Policy'
      newData = oldData.map(v => Math.round(v - currentCopay(v)))
    }

    const datasets = [
      { label: 'Current (Old) Policy', data: oldData.map(v => Math.round(v - currentCopay(v))), backgroundColor: 'rgba(231,76,60,0.6)', borderRadius: 4 },
    ]
    if (policyToggle !== 'current') {
      datasets.push({ label: newLabel, data: newData, backgroundColor: 'rgba(46,204,113,0.6)', borderRadius: 4 })
    }
    if (policyToggle === 'both') {
      datasets.push({
        label: 'China Model', data: oldData.map((v, i) => {
          const d = hospital.drgs[labels[i]]
          return Math.round(v * chinaBlendedRate(d.claimCount, d.quota))
        }), backgroundColor: 'rgba(76,110,245,0.6)', borderRadius: 4
      })
    }

    return {
      type: 'bar',
      data: { labels: labels.map(l => l.length > 16 ? l.slice(0, 14) + '…' : l), datasets },
      options: {
        responsive: true, indexAxis: 'y',
        plugins: { legend: { position: 'bottom' }, title: { display: true, text: `${hospital.name} — Insurer Net Cost by DRG (RM)` } },
        scales: { x: { title: { display: true, text: 'Insurer Net Cost (RM)' } } }
      }
    }
  }, [hospital, drgList, policyToggle])

  /* ── Build chart for single DRG (all hospitals) ────────── */
  const drgChartConfig = useMemo(() => {
    if (!allHospitals.length || !selectedDRG) return null
    const sorted = [...allHospitals].sort((a, b) => b.drgs[selectedDRG].avgClaim - a.drgs[selectedDRG].avgClaim)
    const labels = sorted.map(h => h.name.length > 20 ? h.name.slice(0, 18) + '…' : h.name)
    const oldData = sorted.map(h => Math.round(h.drgs[selectedDRG].avgClaim - currentCopay(h.drgs[selectedDRG].avgClaim)))

    const datasets = [
      { label: 'Current (Old) Policy', data: oldData, backgroundColor: sorted.map(h => h.tier === 2 ? 'rgba(231,76,60,0.6)' : 'rgba(46,204,113,0.6)'), borderRadius: 4 }
    ]

    if (policyToggle === 'singapore' || policyToggle === 'both') {
      datasets.push({
        label: 'Singapore Model', data: sorted.map(h => {
          const v = h.drgs[selectedDRG].avgClaim
          return Math.round(v - (h.tier === 2 ? sgPvtCopay(v) : sgGovCopay(v)))
        }), backgroundColor: 'rgba(46,204,113,0.4)', borderRadius: 4, borderColor: 'rgba(46,204,113,1)', borderWidth: 1
      })
    }
    if (policyToggle === 'china' || policyToggle === 'both') {
      datasets.push({
        label: 'China Model', data: sorted.map(h => {
          const d = h.drgs[selectedDRG]
          return Math.round(d.avgClaim * chinaBlendedRate(d.claimCount, d.quota))
        }), backgroundColor: 'rgba(76,110,245,0.4)', borderRadius: 4, borderColor: 'rgba(76,110,245,1)', borderWidth: 1
      })
    }

    return {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, indexAxis: 'y',
        plugins: { legend: { position: 'bottom' }, title: { display: true, text: `${selectedDRG} — Cost Across All Hospitals (RM)` } },
        scales: { x: { title: { display: true, text: 'Avg Claim Cost (RM)' } } }
      }
    }
  }, [allHospitals, selectedDRG, policyToggle])

  /* ── Tier comparison chart ─────────────────────────────── */
  const tierChartConfig = useMemo(() => {
    if (!allHospitals.length || !drgList.length) return null
    const t1 = allHospitals.filter(h => h.tier === 1)
    const t2 = allHospitals.filter(h => h.tier === 2)
    const avgByDrg = (arr) => drgList.map(drg => {
      const vals = arr.map(h => h.drgs[drg].avgClaim).filter(v => v > 0)
      if (!vals.length) return 0
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
    })
    return {
      type: 'bar',
      data: {
        labels: drgList.map(l => l.length > 14 ? l.slice(0, 12) + '…' : l),
        datasets: [
          { label: 'Preferred (Tier 1)', data: avgByDrg(t1), backgroundColor: 'rgba(46,204,113,0.6)', borderRadius: 4 },
          { label: 'Standard (Tier 2)', data: avgByDrg(t2), backgroundColor: 'rgba(231,76,60,0.6)', borderRadius: 4 },
        ]
      },
      options: {
        responsive: true, indexAxis: 'y',
        plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Average Claim by DRG — Preferred vs Standard Hospitals' } },
        scales: { x: { title: { display: true, text: 'Avg Claim (RM)' } } }
      }
    }
  }, [allHospitals, drgList])

  /* ══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */
  if (loading) return (
    <div className="container" style={{ textAlign: 'center', padding: '4rem 0' }}>
      <div className="spinner" style={{ fontSize: '3rem', marginBottom: '1rem' }}>↻</div>
      <h2>Loading Hospital Network Data...</h2>
      <p style={{ color: 'var(--text-secondary)' }}>Fetching live analytics from MongoDB Atlas</p>
    </div>
  )

  return (
    <div className="container">
      <div className="dashboard-header animate-in">
        <div>
          <h1>🏥 Hospital & DRG Analytics</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Interactive real-time hospital claim analysis</p>
        </div>
        <div className="badge badge-success">🟢 Live • {lastUpdate}</div>
      </div>

      {/* ── MAIN CONTROLS ──────────────────────────────────── */}
      <div className="card animate-in" style={{ animationDelay: '0.05s', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          {/* View Mode */}
          <div style={{ flex: '1 1 200px' }}>
            <div className="input-label" style={{ marginBottom: '0.35rem' }}>📊 View Mode</div>
            <div className="tabs" style={{ marginBottom: 0 }}>
              {[['byHospital', '🏥 By Hospital'], ['byDRG', '🏷️ By DRG'], ['tiers', '📋 By Tier']].map(([k, l]) => (
                <button key={k} className={`tab ${viewMode === k ? 'active' : ''}`} onClick={() => setViewMode(k)}>{l}</button>
              ))}
            </div>
          </div>

          {/* Policy Toggle */}
          <div style={{ flex: '1 1 200px' }}>
            <div className="input-label" style={{ marginBottom: '0.35rem' }}>⚖️ Policy Comparison</div>
            <div className="tabs" style={{ marginBottom: 0 }}>
              {[['current', '🇲🇾 Current'], ['singapore', '🇸🇬 Singapore'], ['china', '🇨🇳 China'], ['both', '🔄 Both']].map(([k, l]) => (
                <button key={k} className={`tab ${policyToggle === k ? 'active' : ''}`} onClick={() => setPolicyToggle(k)}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Selectors (show only relevant one) */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {viewMode === 'byHospital' && (
            <div style={{ flex: 1 }}>
              <div className="input-label" style={{ marginBottom: '0.25rem' }}>Select Hospital</div>
              <select className="input" value={selectedHospital} onChange={e => setSelectedHospital(e.target.value)} style={{ width: '100%' }}>
                {allHospitals.map(h => (
                  <option key={h.id} value={h.id}>{h.name} ({h.tier === 1 ? 'Preferred' : 'Standard'}) — {h.region}</option>
                ))}
              </select>
            </div>
          )}
          {viewMode === 'byDRG' && (
            <div style={{ flex: 1 }}>
              <div className="input-label" style={{ marginBottom: '0.25rem' }}>Select DRG Category</div>
              <select className="input" value={selectedDRG} onChange={e => setSelectedDRG(e.target.value)} style={{ width: '100%' }}>
                {drgList.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── BY HOSPITAL VIEW ───────────────────────────────── */}
      {viewMode === 'byHospital' && hospital && (
        <div className="animate-in">
          {/* Hospital Header */}
          <div className="card" style={{ marginBottom: '1rem', borderLeft: `4px solid ${hospital.tier === 1 ? 'var(--success)' : 'var(--danger)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3>{hospital.name}</h3>
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>{hospital.region}</span>
              </div>
              <span className={`badge ${hospital.tier === 1 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 'var(--font-size-sm)' }}>
                {hospital.tier === 1 ? '⭐ Preferred Provider' : '⚠️ Standard Provider'}
              </span>
            </div>
          </div>

          {/* Chart */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <ChartComponent config={hospitalChartConfig} height={450} />
          </div>

          {/* DRG Table */}
          <div className="card">
            <h4 style={{ marginBottom: '0.75rem' }}>📋 All DRGs — {hospital.name}</h4>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>DRG Category</th><th>Avg Claim (RM)</th><th>Claims</th><th>Quota</th><th>Usage %</th><th>O/E</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {drgList.map(drg => {
                    const d = hospital.drgs[drg]
                    if (!d || d.claimCount === 0) return null
                    const pct = Math.round((d.claimCount / d.quota) * 100)
                    const zone = pct <= 120 ? 'badge-success' : pct <= 150 ? 'badge-warning' : 'badge-danger'
                    const zoneLabel = pct <= 120 ? 'Normal' : pct <= 150 ? 'Watch' : 'Over'
                    return (
                      <tr key={drg}>
                        <td style={{ fontWeight: 500 }}>{drg}</td>
                        <td>RM {d.avgClaim.toLocaleString()}</td>
                        <td>{d.claimCount}</td>
                        <td>{d.quota}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div className="progress-bar" style={{ width: 60, height: 6 }}>
                              <div className={`progress-fill ${pct <= 120 ? 'green' : pct <= 150 ? 'yellow' : 'red'}`}
                                style={{ width: `${Math.min(pct, 200) / 2}%` }} />
                            </div>
                            <span style={{ fontSize: 'var(--font-size-xs)' }}>{pct}%</span>
                          </div>
                        </td>
                        <td>{d.oe}</td>
                        <td><span className={`badge ${zone}`}>{zoneLabel}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── BY DRG VIEW ────────────────────────────────────── */}
      {viewMode === 'byDRG' && drgChartConfig && (
        <div className="animate-in">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <ChartComponent config={drgChartConfig} height={700} />
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
              🟢 Green bars = Preferred (Tier 1) hospitals &nbsp;|&nbsp; 🔴 Red bars = Standard (Tier 2) hospitals
            </p>
          </div>

          {/* DRG Summary Table */}
          <div className="card">
            <h4 style={{ marginBottom: '0.75rem' }}>📋 All Hospitals — {selectedDRG}</h4>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Hospital</th><th>Tier</th><th>Region</th><th>Avg Claim (RM)</th><th>Claims</th><th>O/E</th></tr>
                </thead>
                <tbody>
                  {[...allHospitals].sort((a, b) => b.drgs[selectedDRG].avgClaim - a.drgs[selectedDRG].avgClaim).map(h => {
                    const d = h.drgs[selectedDRG]
                    if (!d || d.claimCount === 0) return null
                    return (
                      <tr key={h.id}>
                        <td style={{ fontWeight: 500 }}>{h.name}</td>
                        <td><span className={`badge ${h.tier === 1 ? 'badge-success' : 'badge-danger'}`}>{h.tier === 1 ? 'Preferred' : 'Standard'}</span></td>
                        <td>{h.region}</td>
                        <td>RM {d.avgClaim.toLocaleString()}</td>
                        <td>{d.claimCount}</td>
                        <td>{d.oe}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TIER VIEW ──────────────────────────────────────── */}
      {viewMode === 'tiers' && tierSummary && (
        <div className="animate-in">
          {/* Tier Overview Cards */}
          <div className="grid grid-2" style={{ marginBottom: '1.25rem' }}>
            {[['tier1', tierSummary.tier1, 'var(--success)', '⭐'], ['tier2', tierSummary.tier2, 'var(--danger)', '⚠️']].map(([key, tier, color, icon]) => (
              <div key={key} className="card" style={{ borderLeft: `4px solid ${color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{icon}</div>
                    <h3>{tier.label}</h3>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{tier.desc}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800 }}>{tier.count}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>hospitals</div>
                  </div>
                </div>
                <div className="divider" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: 'var(--font-size-sm)' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Avg Claim</span><br /><strong>RM {tier.avgClaim.toLocaleString()}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Avg O/E</span><br /><strong>{tier.avgOE}</strong></div>
                </div>
              </div>
            ))}
          </div>

          {/* Tier Comparison Chart */}
          {tierChartConfig && (
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <ChartComponent config={tierChartConfig} height={450} />
            </div>
          )}

          {/* Hospital List by Tier */}
          <div className="card">
            <h4 style={{ marginBottom: '0.75rem' }}>📋 All Hospitals by Tier</h4>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Hospital</th><th>Tier</th><th>Region</th><th>Avg All-DRG Claim (RM)</th><th>Avg O/E</th></tr>
                </thead>
                <tbody>
                  {[...allHospitals].sort((a, b) => a.tier - b.tier).map(h => {
                    const drgVals = Object.values(h.drgs).filter(d => d.claimCount > 0)
                    if (!drgVals.length) return null
                    const avgC = Math.round(drgVals.reduce((s, d) => s + d.avgClaim, 0) / drgVals.length)
                    const avgOE = (drgVals.reduce((s, d) => s + d.oe, 0) / drgVals.length).toFixed(3)
                    return (
                      <tr key={h.id}>
                        <td style={{ fontWeight: 500 }}>{h.name}</td>
                        <td><span className={`badge ${h.tier === 1 ? 'badge-success' : 'badge-danger'}`}>{h.tier === 1 ? '⭐ Preferred' : '⚠️ Standard'}</span></td>
                        <td>{h.region}</td>
                        <td>RM {avgC.toLocaleString()}</td>
                        <td>{avgOE}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
