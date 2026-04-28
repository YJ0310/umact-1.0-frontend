import { useState, useEffect, useRef, useMemo } from 'react'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

const POLICY_COLORS = {
  current: 'rgba(46, 204, 113, 0.75)', // green
  singapore: 'rgba(52, 152, 219, 0.75)', // blue
  china: 'rgba(231, 76, 60, 0.75)' // red
}

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

function zoneToBadge(zone) {
  if (zone === 'Normal') return 'badge-success'
  if (zone === 'Buffer') return 'badge-warning'
  if (zone === 'Reduced') return 'badge-warning'
  if (zone === 'Penalty') return 'badge-danger'
  return 'badge-primary'
}

function normalizeTier(value) {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) return numeric
  const match = String(value ?? '').match(/\d/)
  return match ? Number(match[0]) : 2
}

function shortenDRG(name) {
  if (!name) return ''
  const parts = name.split(' | ')
  if (parts.length >= 3) return parts[2]
  return name
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
  const [yearlyPoolDetails, setYearlyPoolDetails] = useState([])
  const [loading, setLoading] = useState(true)

  const [viewMode, setViewMode] = useState('byHospital') // 'byHospital' | 'byDRG' | 'tiers'
  const [selectedHospital, setSelectedHospital] = useState('')
  const [selectedDRG, setSelectedDRG] = useState('')
  const [policyToggle, setPolicyToggle] = useState('current') // 'current' | 'singapore' | 'china' | 'both'
  const [selectedDetailYear, setSelectedDetailYear] = useState('all')
  const [hospitalSearch, setHospitalSearch] = useState('')
  const [showHospitalSuggestions, setShowHospitalSuggestions] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleString())

  useEffect(() => {
    fetch('/api/analytics/hospitals')
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          const { hospitals, hospitalDRG, yearlyPoolDetails: yearlyDetails = [], drgCatalog = [] } = result.data
          const uniqueDRGs = drgCatalog.length ? drgCatalog : []
          setDrgList(uniqueDRGs)
          setYearlyPoolDetails(yearlyDetails)

          const mapped = hospitals.map(h => {
            const tier = normalizeTier(h.tier)
            const drgs = {}
            uniqueDRGs.forEach(drg => {
              const match = hospitalDRG.find(d => d._id.hospital === h.hospital_name && d._id.drg === drg)
              if (match) {
                const avgClaim = Math.round(match.avgClaim)
                const claimCount = match.count
                const enforceQuota = Boolean(match.enforceQuota)
                const poolAmount = enforceQuota ? Math.max(1, Math.round(match.poolAmount || 1)) : 0
                const claimRequestAmount = Math.round(match.claimRequestAmount || 0)
                const reimbursedAmount = Math.round(match.reimbursedAmount || claimRequestAmount)
                const penaltyAmount = Math.round(match.penaltyAmount || Math.max(0, claimRequestAmount - reimbursedAmount))
                const usagePct = typeof match.usagePct === 'number'
                  ? match.usagePct
                  : (poolAmount > 0 ? (claimRequestAmount / poolAmount) * 100 : null)
                const statusZone = match.statusZone || 'Observe'
                const oe = (avgClaim / (tier === 1 ? 18000 : 25000)).toFixed(3)
                drgs[drg] = {
                  avgClaim,
                  claimCount,
                  poolAmount,
                  claimRequestAmount,
                  reimbursedAmount,
                  penaltyAmount,
                  usagePct,
                  statusZone,
                  enforceQuota,
                  oe: parseFloat(oe)
                }
              } else {
                drgs[drg] = {
                  avgClaim: 0,
                  claimCount: 0,
                  poolAmount: 0,
                  claimRequestAmount: 0,
                  reimbursedAmount: 0,
                  penaltyAmount: 0,
                  usagePct: null,
                  statusZone: 'Observe',
                  enforceQuota: false,
                  oe: 1
                }
              }
            })
            // Map _id to id if needed, logic is expecting `id` string
            return { id: h._id || h.hospital_name, name: h.hospital_name, tier, region: h.region, drgs }
          })

          console.log("allHospitals")
          console.log(result)
          console.log(hospitals)
          console.log(hospitalDRG)
          console.log(mapped)

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
  const filteredHospitals = useMemo(() => {
    const term = hospitalSearch.trim().toLowerCase()
    if (!term) return allHospitals
    return allHospitals.filter((h) => h.name.toLowerCase().includes(term))
  }, [allHospitals, hospitalSearch])

  const hospitalSuggestions = useMemo(() => {
    return filteredHospitals.slice(0, 12)
  }, [filteredHospitals])

  useEffect(() => {
    if (!filteredHospitals.length) return
    const exists = filteredHospitals.some((h) => h.id === selectedHospital)
    if (!exists) {
      setSelectedHospital(filteredHospitals[0].id)
    }
  }, [filteredHospitals, selectedHospital])
  const yearlyOptions = useMemo(() => {
    return [...new Set(yearlyPoolDetails.map(r => r.policyYear))].sort((a, b) => a - b)
  }, [yearlyPoolDetails])

  const hospitalYearlyDetails = useMemo(() => {
    if (!hospital) return []
    return yearlyPoolDetails
      .filter((row) => row._id.hospital === hospital.name)
      .filter((row) => selectedDetailYear === 'all' ? true : String(row.policyYear) === String(selectedDetailYear))
      .sort((a, b) => {
        if (a.policyYear !== b.policyYear) return b.policyYear - a.policyYear
        return String(a._id.drg).localeCompare(String(b._id.drg))
      })
  }, [yearlyPoolDetails, hospital, selectedDetailYear])

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
      tier1: { count: t1.length, avgClaim: avgClaim(t1), avgOE: avgOE(t1), label: 'Tier 1 Hospitals', desc: 'Lower cost, high efficiency — benchmark group.' },
      tier2: { count: t2.length, avgClaim: avgClaim(t2), avgOE: avgOE(t2), label: 'Tier 2 Hospitals', desc: 'Higher cost — claims may be benchmarked against Tier 1.' },
    }
  }, [allHospitals])

  /* ── Build chart for single hospital (all DRGs) ────────── */
  const hospitalPolicyCompareConfig = useMemo(() => {
    if (!hospital || !drgList.length) return null
    const labels = drgList
    const currentData = labels.map((drg) => {
      const d = hospital.drgs[drg]
      const netPerClaim = Math.max(0, d.avgClaim - currentCopay(d.avgClaim))
      return Math.round(netPerClaim * d.claimCount)
    })
    console.log("currentData")
    console.log(allHospitals)
    console.log(hospital)
    console.log(hospital.drgs)
    console.log(currentData)
    const singaporeData = labels.map((drg) => {
      const d = hospital.drgs[drg]
      const copay = hospital.tier === 2 ? sgPvtCopay(d.avgClaim) : sgGovCopay(d.avgClaim)
      return Math.round(Math.max(0, d.avgClaim - copay) * d.claimCount)
    })
    const chinaData = labels.map((drg) => Math.round(hospital.drgs[drg].reimbursedAmount || 0))

    const datasets = []
    if (policyToggle === 'current' || policyToggle === 'singapore' || policyToggle === 'china' || policyToggle === 'both') {
      datasets.push({
        label: 'Current (Malaysia)',
        data: currentData,
        backgroundColor: POLICY_COLORS.current,
        borderRadius: 4
      })
    }
    if (policyToggle === 'singapore' || policyToggle === 'both') {
      datasets.push({
        label: 'Singapore',
        data: singaporeData,
        backgroundColor: POLICY_COLORS.singapore,
        borderRadius: 4
      })
    }
    if (policyToggle === 'china' || policyToggle === 'both') {
      datasets.push({
        label: 'China',
        data: chinaData,
        backgroundColor: POLICY_COLORS.china,
        borderRadius: 4
      })
    }

    return {
      type: 'bar',
      data: { labels: labels.map(shortenDRG), datasets },
      options: {
        responsive: true, indexAxis: 'y',
        plugins: { legend: { position: 'bottom' }, title: { display: true, text: `${hospital.name} — Country Comparison (Insurer Paid, RM)` } },
        scales: { x: { title: { display: true, text: 'Insurer Net Cost (RM)' } } }
      }
    }
  }, [hospital, drgList, policyToggle])

  const hospitalPoolConfig = useMemo(() => {
    if (!hospital || !drgList.length) return null
    const labels = drgList.map(shortenDRG)
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Allocation Amount (Pool)',
            data: drgList.map((drg) => Math.round(hospital.drgs[drg].poolAmount || 0)),
            backgroundColor: 'rgba(149, 165, 166, 0.75)',
            borderRadius: 4
          },
          {
            label: 'Claim Request Amount',
            data: drgList.map((drg) => Math.round(hospital.drgs[drg].claimRequestAmount || 0)),
            backgroundColor: 'rgba(243, 156, 18, 0.75)',
            borderRadius: 4
          },
          {
            label: 'Actual Claim Amount (Paid)',
            data: drgList.map((drg) => Math.round(hospital.drgs[drg].reimbursedAmount || 0)),
            backgroundColor: POLICY_COLORS.china,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: `${hospital.name} — DRG Money Pool Tracking (RM)` }
        },
        scales: {
          y: { title: { display: true, text: 'Amount (RM)' } },
          x: { ticks: { maxRotation: 45, minRotation: 35 } }
        }
      }
    }
  }, [hospital, drgList])

  const hospitalPenaltyConfig = useMemo(() => {
    if (!hospital || !drgList.length) return null
    return {
      type: 'bar',
      data: {
        labels: drgList.map(shortenDRG),
        datasets: [
          {
            label: 'Penalty Amount',
            data: drgList.map((drg) => Math.round(hospital.drgs[drg].penaltyAmount || 0)),
            backgroundColor: 'rgba(192, 57, 43, 0.8)',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: `${hospital.name} — Penalty Amount by DRG (RM)` }
        },
        scales: {
          y: { title: { display: true, text: 'Penalty (RM)' } },
          x: { ticks: { maxRotation: 45, minRotation: 35 } }
        }
      }
    }
  }, [hospital, drgList])

  /* ── Build chart for single DRG (all hospitals) ────────── */
  const drgChartConfig = useMemo(() => {
    if (!allHospitals.length || !selectedDRG) return null
    const sorted = [...allHospitals]
      .filter((h) => (h.drgs[selectedDRG]?.claimRequestAmount || 0) > 0)
      .sort((a, b) => b.drgs[selectedDRG].claimRequestAmount - a.drgs[selectedDRG].claimRequestAmount)
      .slice(0, 20)
    const labels = sorted.map(h => h.name.length > 20 ? h.name.slice(0, 18) + '…' : h.name)
    const datasets = []

    if (policyToggle === 'current' || policyToggle === 'singapore' || policyToggle === 'china' || policyToggle === 'both') {
      datasets.push({
        label: 'Current (Malaysia)',
        data: sorted.map((h) => {
          const d = h.drgs[selectedDRG]
          const netPerClaim = Math.max(0, d.avgClaim - currentCopay(d.avgClaim))
          return Math.round(netPerClaim * d.claimCount)
        }),
        backgroundColor: POLICY_COLORS.current,
        borderRadius: 4
      })
    }

    if (policyToggle === 'singapore' || policyToggle === 'both') {
      datasets.push({
        label: 'Singapore',
        data: sorted.map((h) => {
          const d = h.drgs[selectedDRG]
          const copay = h.tier === 2 ? sgPvtCopay(d.avgClaim) : sgGovCopay(d.avgClaim)
          return Math.round(Math.max(0, d.avgClaim - copay) * d.claimCount)
        }),
        backgroundColor: POLICY_COLORS.singapore,
        borderRadius: 4
      })
    }

    if (policyToggle === 'china' || policyToggle === 'both') {
      datasets.push({
        label: 'China',
        data: sorted.map((h) => Math.round(h.drgs[selectedDRG].reimbursedAmount || 0)),
        backgroundColor: POLICY_COLORS.china,
        borderRadius: 4
      })
    }

    return {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, indexAxis: 'y',
        plugins: { legend: { position: 'bottom' }, title: { display: true, text: `${shortenDRG(selectedDRG)} — Top 20 Hospitals Comparison (RM)` } },
        scales: { x: { title: { display: true, text: 'Insurer Paid Amount (RM)' } } }
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
        labels: drgList.map(shortenDRG),
        datasets: [
          { label: 'Tier 1', data: avgByDrg(t1), backgroundColor: 'rgba(46,204,113,0.6)', borderRadius: 4 },
          { label: 'Tier 2', data: avgByDrg(t2), backgroundColor: 'rgba(231,76,60,0.6)', borderRadius: 4 },
        ]
      },
      options: {
        responsive: true, indexAxis: 'y',
        plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Average Claim by DRG — Tier 1 vs Tier 2' } },
        scales: { x: { title: { display: true, text: 'Avg Claim (RM)' } } }
      }
    }
  }, [allHospitals, drgList])

  /* ══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */
  if (loading) return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="skeleton skeleton-title" style={{ marginBottom: '0.75rem' }} />
        <div className="skeleton skeleton-text" />
      </div>
      <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
        <div className="card"><div className="skeleton skeleton-chart" /></div>
        <div className="card"><div className="skeleton skeleton-chart" /></div>
      </div>
      <div className="card">
        <div className="skeleton skeleton-text" style={{ width: '45%' }} />
        <div className="skeleton skeleton-card" style={{ marginTop: '0.75rem' }} />
      </div>
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
              <input
                className="input"
                placeholder="Search hospital (60 total)"
                value={hospitalSearch}
                onChange={(e) => setHospitalSearch(e.target.value)}
                onFocus={() => setShowHospitalSuggestions(true)}
                onBlur={() => setTimeout(() => setShowHospitalSuggestions(false), 150)}
                style={{ marginBottom: '0.5rem' }}
              />
              {showHospitalSuggestions && (
                <div className="suggestion-list">
                  {hospitalSuggestions.length ? hospitalSuggestions.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      className="suggestion-item"
                      onClick={() => {
                        setSelectedHospital(h.id)
                        setHospitalSearch(h.name)
                        setShowHospitalSuggestions(false)
                      }}
                    >
                      <span>{h.name}</span>
                      <span className="badge badge-primary">Tier {h.tier}</span>
                    </button>
                  )) : (
                    <div className="suggestion-empty">No matching hospitals</div>
                  )}
                </div>
              )}
              <select
                className="input"
                value={selectedHospital}
                onChange={e => setSelectedHospital(e.target.value)}
                style={{ width: '100%' }}
              >
                {filteredHospitals.length ? filteredHospitals.map(h => (
                  <option key={h.id} value={h.id}>{h.name} (Tier {h.tier}) — {h.region}</option>
                )) : (
                  <option value="">No matching hospitals</option>
                )}
              </select>
            </div>
          )}
          {viewMode === 'byDRG' && (
            <div style={{ flex: 1 }}>
              <div className="input-label" style={{ marginBottom: '0.25rem' }}>Select DRG Category</div>
              <select className="input" value={selectedDRG} onChange={e => setSelectedDRG(e.target.value)} style={{ width: '100%' }}>
                {drgList.map(d => <option key={d} value={d}>{shortenDRG(d)}</option>)}
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
                {hospital.tier === 1 ? '⭐ Tier 1' : '⚠️ Tier 2'}
              </span>
            </div>
          </div>

          {/* Policy Comparison Chart */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <ChartComponent config={hospitalPolicyCompareConfig} height={460} />
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
              Current = green, Singapore = blue, China = red
            </p>
          </div>

          {/* Money Pool Tracking Charts */}
          <div className="grid grid-2" style={{ marginBottom: '1rem', gap: '1rem' }}>
            <div className="card">
              <ChartComponent config={hospitalPoolConfig} height={360} />
            </div>
            <div className="card">
              <ChartComponent config={hospitalPenaltyConfig} height={360} />
            </div>
          </div>

          {/* DRG Table */}
          <div className="card">
            <h4 style={{ marginBottom: '0.75rem' }}>📋 All DRGs — {hospital.name}</h4>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>DRG Category</th><th>Allocation (RM)</th><th>Claim Request (RM)</th><th>Actual Claim (RM)</th><th>Penalty (RM)</th><th>Usage %</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {drgList.map(drg => {
                    const d = hospital.drgs[drg]
                    if (!d || d.claimRequestAmount === 0) return null
                    const pct = d.enforceQuota && d.usagePct !== null ? Math.round(d.usagePct) : null
                    return (
                      <tr key={drg}>
                        <td style={{ fontWeight: 500 }}>{shortenDRG(drg)}</td>
                        <td>{d.enforceQuota ? `RM ${d.poolAmount.toLocaleString()}` : 'N/A'}</td>
                        <td>RM {d.claimRequestAmount.toLocaleString()}</td>
                        <td>RM {d.reimbursedAmount.toLocaleString()}</td>
                        <td>RM {d.penaltyAmount.toLocaleString()}</td>
                        <td>
                          {d.enforceQuota ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div className="progress-bar" style={{ width: 60, height: 6 }}>
                                <div className={`progress-fill ${pct <= 100 ? 'green' : pct <= 120 ? 'yellow' : 'red'}`}
                                  style={{ width: `${Math.min(pct, 200) / 2}%` }} />
                              </div>
                              <span style={{ fontSize: 'var(--font-size-xs)' }}>{pct}%</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>N/A</span>
                          )}
                        </td>
                        <td><span className={`badge ${zoneToBadge(d.statusZone)}`}>{d.statusZone}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Yearly Detail Ledger */}
          <div className="card" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <h4 style={{ margin: 0 }}>📒 Yearly DRG Pool Details — {hospital.name}</h4>
              <div style={{ minWidth: 180 }}>
                <div className="input-label" style={{ marginBottom: '0.25rem' }}>Policy Year</div>
                <select className="input" value={selectedDetailYear} onChange={(e) => setSelectedDetailYear(e.target.value)}>
                  <option value="all">All Years</option>
                  {yearlyOptions.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Year</th><th>DRG</th><th>Pool (RM)</th><th>Claim Amount (RM)</th><th>Penalty (RM)</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {hospitalYearlyDetails.map((row, idx) => (
                    <tr key={`${row.policyYear}-${row._id.drg}-${idx}`}>
                      <td>{row.policyYear}</td>
                      <td>{shortenDRG(row._id.drg)}</td>
                      <td>{row.enforceQuota ? `RM ${Math.round(row.poolAmount || 0).toLocaleString()}` : 'N/A'}</td>
                      <td>RM {Math.round(row.claimRequestAmount || 0).toLocaleString()}</td>
                      <td>RM {Math.round(row.penaltyAmount || 0).toLocaleString()}</td>
                      <td><span className={`badge ${zoneToBadge(row.statusZone)}`}>{row.statusZone}</span></td>
                    </tr>
                  ))}
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
              Top 20 hospitals are shown for readability. Current = green, Singapore = blue, China = red.
            </p>
          </div>

          {/* DRG Summary Table */}
          <div className="card">
            <h4 style={{ marginBottom: '0.75rem' }}>📋 All Hospitals — {shortenDRG(selectedDRG)}</h4>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Hospital</th><th>Tier</th><th>Region</th><th>Allocation (RM)</th><th>Claim Request (RM)</th><th>Actual Claim (RM)</th><th>Penalty (RM)</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {[...allHospitals].sort((a, b) => b.drgs[selectedDRG].claimRequestAmount - a.drgs[selectedDRG].claimRequestAmount).map(h => {
                    const d = h.drgs[selectedDRG]
                    if (!d || d.claimRequestAmount === 0) return null
                    return (
                      <tr key={h.id}>
                        <td style={{ fontWeight: 500 }}>{h.name}</td>
                        <td><span className={`badge ${h.tier === 1 ? 'badge-success' : 'badge-danger'}`}>Tier {h.tier}</span></td>
                        <td>{h.region}</td>
                        <td>{d.enforceQuota ? `RM ${d.poolAmount.toLocaleString()}` : 'N/A'}</td>
                        <td>RM {d.claimRequestAmount.toLocaleString()}</td>
                        <td>RM {d.reimbursedAmount.toLocaleString()}</td>
                        <td>RM {d.penaltyAmount.toLocaleString()}</td>
                        <td><span className={`badge ${zoneToBadge(d.statusZone)}`}>{d.statusZone}</span></td>
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
                        <td><span className={`badge ${h.tier === 1 ? 'badge-success' : 'badge-danger'}`}>Tier {h.tier}</span></td>
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
