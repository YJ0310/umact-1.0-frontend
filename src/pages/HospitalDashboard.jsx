import { useState, useEffect, useRef, useMemo } from 'react'
import { Chart, registerables } from 'chart.js'
import { AgCharts } from "ag-charts-react";
import {
  AnimationModule,
  BoxPlotSeriesModule,
  CategoryAxisModule,
  ContextMenuModule,
  CrosshairModule,
  LegendModule,
  ModuleRegistry,
  NumberAxisModule,
} from "ag-charts-enterprise";

Chart.register(...registerables)

ModuleRegistry.registerModules([
  AnimationModule,
  BoxPlotSeriesModule,
  CategoryAxisModule,
  CrosshairModule,
  LegendModule,
  NumberAxisModule,
  ContextMenuModule,
]);

const POLICY_COLORS = {
  current: 'rgba(46, 204, 113, 0.75)', // green
  singapore: 'rgba(52, 152, 219, 0.75)', // blue
  china: 'rgba(231, 76, 60, 0.75)' // red
}

const DRG_CATEGORY_MAP = {
  'Surgical': 'Surgical',
  'Medical': 'Medical',
  'Obstetrics': 'Obstetrics'
}

function getDRGCategory(name) {
  if (!name) return 'Other'
  const major = name.split(' | ')[0]
  return DRG_CATEGORY_MAP[major] || 'Other'
}

const CATEGORY_COLORS = {
  'Surgical': 'rgba(231, 76, 60, 0.7)',
  'Medical': 'rgba(52, 152, 219, 0.7)',
  'Obstetrics': 'rgba(155, 89, 182, 0.7)',
  'Other': 'rgba(149, 165, 166, 0.7)'
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

function getSubCategory(name) {
  if (!name) return 'Unknown'
  const parts = name.split(' | ')
  return parts.length >= 2 ? parts[1] : 'Other'
}

/* ══════════════════════════════════════════════════════════════
   CHART COMPONENTS
   ══════════════════════════════════════════════════════════════ */

function ChartComponent({ config, height = 300 }) {
  const ref = useRef(null)
  const chartRef = useRef(null)
  const [currentHeight, setCurrentHeight] = useState(height)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setCurrentHeight(Math.min(height, 300))
      } else {
        setCurrentHeight(height)
      }
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [height])

  useEffect(() => {
    if (chartRef.current) chartRef.current.destroy()
    if (!ref.current) return
    chartRef.current = new Chart(ref.current.getContext('2d'), {
      ...config,
      options: {
        ...config.options,
        maintainAspectRatio: false,
      }
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [JSON.stringify(config)])

  return <div style={{ height: currentHeight, width: '100%', position: 'relative' }}><canvas ref={ref} /></div>
}

function UsageBar({ pct }) {
  const displayPct = Math.min(pct || 0, 100)
  let color = 'var(--success)'
  if (pct > 120) color = 'var(--danger)'
  else if (pct > 100) color = 'var(--warning)'

  return (
    <div style={{ width: '100%', minWidth: '60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
        <span style={{ fontWeight: 600 }}>{pct ? `${pct.toFixed(1)}%` : '0%'}</span>
      </div>
      <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${displayPct}%`, height: '100%', background: color, transition: 'width 0.3s' }}></div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function HospitalDashboard() {
  const [allHospitals, setAllHospitals] = useState([])
  const [drgList, setDrgList] = useState([])
  const [yearlyPoolDetails, setYearlyPoolDetails] = useState([])
  const [boxPlotStats, setBoxPlotStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  const [viewMode, setViewMode] = useState('byHospital') // 'byHospital' | 'byDRG' | 'tiers'
  const [drgGroupMode, setDrgGroupMode] = useState('detailed') // 'detailed' | 'category'
  const [selectedHospital, setSelectedHospital] = useState('')
  const [selectedDRG, setSelectedDRG] = useState('')
  const [policyToggle, setPolicyToggle] = useState('china') // Default to china
  const [selectedYear, setSelectedYear] = useState('2025') // Default to 2025 as requested
  const [hospitalSearch, setHospitalSearch] = useState('')
  const [isHospitalModalOpen, setIsHospitalModalOpen] = useState(false)
  const [tempHospitalId, setTempHospitalId] = useState('')
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleString())

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    fetch('/api/analytics/hospitals')
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          const { hospitals, hospitalDRG, yearlyPoolDetails: yearlyDetails = [], drgCatalog = [], boxPlotStats: bStats = [] } = result.data
          const uniqueDRGs = drgCatalog.length ? drgCatalog : []
          setDrgList(uniqueDRGs)
          setYearlyPoolDetails(yearlyDetails)
          setBoxPlotStats(bStats)

          const mapped = hospitals.map(h => {
            const tier = normalizeTier(h.tier || h.final_tier)
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
      .filter((row) => selectedYear === '23-25' ? true : String(row.policyYear) === String(selectedYear))
      .sort((a, b) => {
        if (a.policyYear !== b.policyYear) return b.policyYear - a.policyYear
        return String(a._id.drg).localeCompare(String(b._id.drg))
      })
  }, [yearlyPoolDetails, hospital, selectedYear])

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

  const groupedHospitalData = useMemo(() => {
    if (!hospital || drgGroupMode === 'detailed') return null
    const groups = {}
    Object.entries(hospital.drgs).forEach(([fullName, data]) => {
      const cat = getSubCategory(fullName)
      if (!groups[cat]) {
        groups[cat] = {
          avgClaim: 0, claimCount: 0, poolAmount: 0, claimRequestAmount: 0,
          reimbursedAmount: 0, penaltyAmount: 0, usagePct: 0,
          statusZone: 'Normal', enforceQuota: false, totalAvgClaimSum: 0, count: 0, name: cat
        }
      }
      const g = groups[cat]
      g.claimCount += data.claimCount
      g.poolAmount += data.poolAmount
      g.claimRequestAmount += data.claimRequestAmount
      g.reimbursedAmount += data.reimbursedAmount
      g.penaltyAmount += data.penaltyAmount
      if (data.avgClaim > 0) {
        g.totalAvgClaimSum += data.avgClaim
        g.count += 1
      }
      if (data.enforceQuota) g.enforceQuota = true
    })
    Object.keys(groups).forEach(cat => {
      const g = groups[cat]
      if (g.count > 0) g.avgClaim = Math.round(g.totalAvgClaimSum / g.count)
      if (g.poolAmount > 0) g.usagePct = (g.claimRequestAmount / g.poolAmount) * 100
      if (g.penaltyAmount > 0) g.statusZone = 'Penalty'
      else if (g.usagePct > 100) g.statusZone = 'Buffer'
    })
    return groups
  }, [hospital, drgGroupMode])

  const chartLabels = useMemo(() => {
    if (drgGroupMode === 'detailed') return drgList
    return [...new Set(drgList.map(getSubCategory))]
  }, [drgList, drgGroupMode])

  /* ── Build chart for single hospital ────────── */
  const hospitalPolicyCompareConfig = useMemo(() => {
    if (!hospital) return { type: 'bar', data: { labels: [], datasets: [] } }
    const filteredDRGs = drgList.filter(drg => hospital.drgs[drg])
    return {
      type: 'bar',
      data: {
        labels: filteredDRGs.map(shortenDRG),
        datasets: [
          {
            label: 'Insurer Paid (RM)',
            data: filteredDRGs.map(drg => hospital.drgs[drg].claimRequestAmount),
            backgroundColor: filteredDRGs.map(drg => CATEGORY_COLORS[getDRGCategory(drg)]),
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const drg = filteredDRGs[ctx.dataIndex]
                return ` [${getDRGCategory(drg)}] RM ${ctx.raw.toLocaleString()}`
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, title: { display: true, text: 'Claim Amount (RM)' } }
        }
      }
    }
  }, [hospital, drgList])

  const hospitalPoolConfig = useMemo(() => {
    if (!hospital || !chartLabels.length) return null
    const sourceData = drgGroupMode === 'category' ? groupedHospitalData : hospital.drgs
    return {
      type: 'bar',
      data: {
        labels: chartLabels.map(shortenDRG),
        datasets: [
          {
            label: 'Allocation',
            data: chartLabels.map((drg) => Math.round(sourceData[drg]?.poolAmount || 0)),
            backgroundColor: 'rgba(149, 165, 166, 0.6)',
            borderRadius: 4
          },
          {
            label: 'Request',
            data: chartLabels.map((drg) => Math.round(sourceData[drg]?.claimRequestAmount || 0)),
            backgroundColor: 'rgba(243, 156, 18, 0.7)',
            borderRadius: 4
          },
          {
            label: 'Actual Reimbursed',
            data: chartLabels.map((drg) => Math.round(sourceData[drg]?.reimbursedAmount || 0)),
            backgroundColor: POLICY_COLORS.china,
            borderRadius: 4
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: `${hospital.name} — Allocation Tracking (RM)` }
        },
        scales: {
          x: { title: { display: true, text: 'Amount (RM)' } },
          y: {
            ticks: { font: { size: 11, weight: 'bold' } },
            grid: { display: false }
          }
        },
        barPercentage: 0.8,
        categoryPercentage: 0.9
      }
    }
  }, [hospital, chartLabels, drgGroupMode, groupedHospitalData])

  const hospitalPenaltyConfig = useMemo(() => {
    if (!hospital || !chartLabels.length) return null
    const sourceData = drgGroupMode === 'category' ? groupedHospitalData : hospital.drgs
    return {
      type: 'bar',
      data: {
        labels: chartLabels.map(shortenDRG),
        datasets: [
          {
            label: 'Penalty Amount',
            data: chartLabels.map((drg) => Math.round(sourceData[drg]?.penaltyAmount || 0)),
            backgroundColor: 'rgba(192, 57, 43, 0.8)',
            borderRadius: 4
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: `${hospital.name} — Penalty Distribution (RM)` }
        },
        scales: {
          x: { title: { display: true, text: 'Penalty (RM)' } },
          y: {
            ticks: { font: { size: 11, weight: 'bold' } },
            grid: { display: false }
          }
        },
        barPercentage: 0.8,
        categoryPercentage: 0.9
      }
    }
  }, [hospital, chartLabels, drgGroupMode, groupedHospitalData])

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
      <div className="grid grid-2" style={{ marginBottom: '1rem', gridTemplateColumns: isMobile ? '1fr' : undefined }}>
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
      {/* ── HEADER ────────────────────────────────────────────────── */}
      <div className="card animate-in" style={{ marginBottom: '1.25rem', padding: '1.25rem', background: 'linear-gradient(135deg, var(--accent) 0%, #3b82f6 100%)', color: 'white', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, color: 'white', fontSize: 'var(--font-size-2xl)' }}>🇨🇳 China Quota Implementation</h1>
            <p style={{ opacity: 0.9, fontSize: 'var(--font-size-sm)' }}>Alternative Method: Hospital Money-Pool Governance</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div className="input-label" style={{ marginBottom: '0.35rem', color: 'rgba(255,255,255,0.95)', fontWeight: 600 }}>📅 Policy Year</div>
              <select
                className="input"
                style={{ background: '--bg-primary', border: 'none', color: 'var(--text-primary)', padding: '0.5rem 0.85rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="23-25" style={{ color: 'var(--text-primary)' }}>Baseline (23-25)</option>
                <option value="2023" style={{ color: 'var(--text-primary)' }}>2023 (Collection)</option>
                <option value="2024" style={{ color: 'var(--text-primary)' }}>2024 (Enforced)</option>
                <option value="2025" style={{ color: 'var(--text-primary)' }}>2025 (Enforced)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="tabs animate-in" style={{ marginBottom: '1.25rem' }}>
        <button className={`tab ${viewMode === 'byHospital' ? 'active' : ''}`} onClick={() => setViewMode('byHospital')}>🏥 By Hospital</button>
        <button className={`tab ${viewMode === 'byDRG' ? 'active' : ''}`} onClick={() => setViewMode('byDRG')}>📋 By DRG</button>
        <button className={`tab ${viewMode === 'tiers' ? 'active' : ''}`} onClick={() => setViewMode('tiers')}>🏆 Hospital Tiers</button>
      </div>

      {viewMode === 'byHospital' && (
        <div className="grid grid-3" style={{ marginBottom: '1.25rem', gap: '1rem' }}>
          <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
            <div className="input-label" style={{ marginBottom: '0.25rem' }}>Search Hospital</div>
            <button
              className="input combobox-trigger"
              style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onClick={() => {
                setTempHospitalId(selectedHospital);
                setIsHospitalModalOpen(true);
              }}
            >
              <span>{hospital?.name || 'Select Hospital'}</span>
              <span style={{ opacity: 0.5 }}>⚙️ Change</span>
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <div className="input-label" style={{ marginBottom: '0.25rem' }}>DRG Resolution</div>
            <select className="input" value={drgGroupMode} onChange={e => setDrgGroupMode(e.target.value)} style={{ width: '100%' }}>
              <option value="detailed">Individual DRGs (15)</option>
              <option value="category">Grouped Categories (5)</option>
            </select>
          </div>
        </div>
      )}

      {/* ── BY HOSPITAL VIEW ───────────────────────────────── */}
      {viewMode === 'byHospital' && hospital && (
        <div className="animate-in">
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h4 style={{ color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px' }}>
              China Quota Implementation (Alternative Method)
            </h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ width: '100%' }}>
              <ChartComponent config={hospitalPoolConfig} height={600} />
            </div>
            <div className="card" style={{ width: '100%' }}>
              <ChartComponent config={hospitalPenaltyConfig} height={600} />
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0 }}>📋 Allocation & Usage Breakdown</h4>
              <div className="badge badge-primary">{selectedYear} Analysis</div>
            </div>
            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    {selectedYear === '23-25' && <th>Year</th>}
                    <th>DRG Category</th>
                    <th>Allocation (RM)</th>
                    <th>Claim Request (RM)</th>
                    <th>Actual Claim (RM)</th>
                    <th>Penalty (RM)</th>
                    <th>Usage %</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedYear === '23-25'
                    ? yearlyPoolDetails.filter(d => d._id.hospital === hospital.name).sort((a, b) => a.policyYear - b.policyYear || a._id.drg.localeCompare(b._id.drg))
                    : (drgGroupMode === 'category' ? Object.values(groupedHospitalData) : drgList.filter(d => hospital.drgs[d]).map(d => ({ ...hospital.drgs[d], name: d })))
                  ).map((d, i) => (
                    <tr key={i}>
                      {selectedYear === '23-25' && <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{d.policyYear}</td>}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="badge" style={{ background: CATEGORY_COLORS[getDRGCategory(d.name || d._id?.drg)], color: 'white', fontSize: '10px' }}>
                            {getDRGCategory(d.name || d._id?.drg).charAt(0)}
                          </span>
                          {shortenDRG(d.name || d._id?.drg)}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{(selectedYear === '2023' || d.policyYear === 2023) ? 'None (Baseline)' : (d.poolAmount ? `RM ${d.poolAmount.toLocaleString()}` : '0')}</td>
                      <td>RM {d.claimRequestAmount.toLocaleString()}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>RM {d.reimbursedAmount.toLocaleString()}</td>
                      <td style={{ color: d.penaltyAmount > 0 ? 'var(--danger)' : 'inherit' }}>RM {d.penaltyAmount.toLocaleString()}</td>
                      <td><UsageBar pct={d.usagePct} /></td>
                      <td>
                        <span className={`badge ${zoneToBadge(d.statusZone)}`}>
                          {(selectedYear === '2023' || d.policyYear === 2023) ? 'Observation' : d.statusZone}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── BY DRG VIEW ────────────────────────────────────── */}
      {viewMode === 'byDRG' && (
        <div className="animate-in">
          <div className="grid grid-2" style={{ marginBottom: '1.25rem', gap: '1rem' }}>
            <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
              <div className="input-label" style={{ marginBottom: '0.25rem' }}>Select DRG focus</div>
              <select className="input" value={selectedDRG} onChange={e => setSelectedDRG(e.target.value)} style={{ width: '100%' }}>
                {drgList.map(d => <option key={d} value={d}>{shortenDRG(d)}</option>)}
              </select>
            </div>
            <div>
              <div className="input-label" style={{ marginBottom: '0.25rem' }}>Comparison Mode</div>
              <div className="tabs" style={{ marginBottom: 0 }}>
                <button className={`tab ${policyToggle === 'china' ? 'active' : ''}`} onClick={() => setPolicyToggle('china')}>🇨🇳 CN</button>
                <button className={`tab ${policyToggle === 'singapore' ? 'active' : ''}`} onClick={() => setPolicyToggle('singapore')}>🇸🇬 SG</button>
                <button className={`tab ${policyToggle === 'both' ? 'active' : ''}`} onClick={() => setPolicyToggle('both')}>🔄 Both</button>
              </div>
            </div>
          </div>

          {/* 1. Comparison Bar Chart (Top 20 Hospitals) */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <ChartComponent config={drgChartConfig} height={500} />
          </div>

          {/* 2. AgCharts Box Plot */}
          <h4 style={{ marginBottom: '1.25rem' }}>🏆 Inter-Hospital Performance Comparison</h4>
          <div style={{ height: '400px', width: '100%' }}>
            <AgCharts options={{
              data: [1, 2].map(tier => {
                const s = boxPlotStats.find(st => st._id.drg === selectedDRG && st._id.tier === tier && st._id.year === parseInt(selectedYear === '23-25' ? '2025' : selectedYear))
                return {
                  tierLabel: `Tier ${tier}`,
                  min: s?.min || 0,
                  q1: s?.q1 || 0,
                  median: s?.median || 0,
                  q3: s?.q3 || 0,
                  max: s?.max || 0
                }
              }),
              title: { text: `${shortenDRG(selectedDRG)} — Distribution` },
              series: [
                {
                  type: "box-plot",
                  direction: "horizontal",
                  yName: "Claim Amount (RM)",
                  xKey: "tierLabel",
                  xName: "Hospital Tier",
                  minKey: "min",
                  q1Key: "q1",
                  medianKey: "median",
                  q3Key: "q3",
                  maxKey: "max",
                  fill: 'rgba(52, 152, 219, 0.2)',
                  stroke: 'var(--accent)',
                  whisker: { stroke: 'var(--text-primary)' }
                }
              ],
              axes: [
                { type: 'category', position: 'left' },
                { type: 'number', position: 'bottom', title: { text: 'Amount (RM)' } }
              ]
            }} />
          </div>

          {selectedYear === '2024' || selectedYear === '2025' ? (() => {
            const baseYear = parseInt(selectedYear) - 1;
            const relevantStats = boxPlotStats.filter(s => s._id.drg === selectedDRG && s._id.year === baseYear);
            const baseVal = relevantStats.length > 0
              ? Math.round(relevantStats.reduce((acc, s) => acc + s.median, 0) / relevantStats.length)
              : 0;
            const riskAdjuster = 1.05;
            const regionalWeight = 1.02;
            const finalQuota = Math.round(baseVal * riskAdjuster * regionalWeight);

            return (
              <div className="card" style={{ marginBottom: '1.25rem', borderLeft: '4px solid var(--accent)' }}>
                <h4 style={{ marginBottom: '1.5rem' }}>🧠 Quota Allocation Decision Engine — Real-time Logic</h4>
                <div className="grid grid-5" style={{ gap: '1rem', textAlign: 'center' }}>
                  {[
                    { step: '01', title: 'Historical Base', val: `RM ${baseVal.toLocaleString()}`, desc: `Based on ${baseYear} Median.` },
                    { step: '02', title: 'Risk Adjuster', val: `× ${riskAdjuster}`, desc: 'Actuarial inflation buffer.' },
                    { step: '03', title: 'Regional Weight', val: `× ${regionalWeight}`, desc: 'Urban cost adjustment.' },
                    { step: '04', title: 'Final Quota', val: `RM ${finalQuota.toLocaleString()}`, desc: 'Approved money-pool per case.' },
                    { step: '05', title: 'Enforcement', val: 'ACTIVE', desc: 'Live claims monitoring.' }
                  ].map((s, idx) => (
                    <div key={idx} style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--accent)', marginBottom: '0.4rem' }}>STEP {s.step}</div>
                      <div style={{ fontWeight: 700, fontSize: '11px', marginBottom: '0.2rem' }}>{s.title}</div>
                      <div style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 800, marginBottom: '0.3rem' }}>{s.val}</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', lineHeight: 1.2 }}>{s.desc}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '1.25rem', padding: '0.75rem', background: 'rgba(46, 204, 113, 0.05)', borderRadius: '8px', border: '1px dashed var(--success)', fontSize: '11px', textAlign: 'center' }}>
                  <strong>Policy Decision:</strong> The calculated quota of <strong>RM {finalQuota.toLocaleString()}</strong> is the baseline for all claims in {selectedYear} for {shortenDRG(selectedDRG)}.
                </div>
              </div>
            );
          })() : (
            <div className="card" style={{ marginBottom: '1.25rem', textAlign: 'center', opacity: 0.6 }}>
              <p>Decision engine unavailable for Baseline/Observation years (2023).</p>
            </div>
          )}

          <div className="card">
            <h4 style={{ marginBottom: '0.75rem' }}>📋 Hospital Performance Breakdown — {shortenDRG(selectedDRG)}</h4>
            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    {selectedYear === '23-25' && <th>Year</th>}
                    <th>Hospital</th><th>Tier</th><th>Region</th><th>Allocation (RM)</th><th>Claim Request (RM)</th><th>Actual Claim (RM)</th><th>Penalty (RM)</th><th>Usage %</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {yearlyPoolDetails.filter(d =>
                    d._id.drg === selectedDRG && (selectedYear === '23-25' ? true : d.policyYear.toString() === selectedYear)
                  ).sort((a, b) => a.policyYear - b.policyYear).map((d, i) => {
                    const h = allHospitals.find(x => x.name === d._id.hospital)
                    return (
                      <tr key={i}>
                        {selectedYear === '23-25' && <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{d.policyYear}</td>}
                        <td style={{ fontWeight: 600 }}>{d._id.hospital}</td>
                        <td><span className={`badge ${h?.tier === 1 ? 'badge-success' : 'badge-danger'}`}>T{h?.tier || 2}</span></td>
                        <td>{h?.region || 'Other'}</td>
                        <td style={{ fontWeight: 600 }}>{(selectedYear === '2023' || d.policyYear === 2023) ? 'None' : `RM ${d.poolAmount.toLocaleString()}`}</td>
                        <td>RM {d.claimRequestAmount.toLocaleString()}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 600 }}>RM {d.reimbursedAmount.toLocaleString()}</td>
                        <td style={{ color: d.penaltyAmount > 0 ? 'var(--danger)' : 'inherit' }}>RM {d.penaltyAmount.toLocaleString()}</td>
                        <td><UsageBar pct={d.usagePct} /></td>
                        <td><span className={`badge ${zoneToBadge(d.statusZone)}`}>{(selectedYear === '2023' || d.policyYear === 2023) ? 'Observation' : d.statusZone}</span></td>
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
          <div className="grid grid-2" style={{ marginBottom: '1.25rem', gridTemplateColumns: isMobile ? '1fr' : undefined }}>
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

          <div className="card">
            <h4 style={{ marginBottom: '0.75rem' }}>📋 All Hospitals by Tier</h4>
            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
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
                        <td><span className={`badge ${h.tier === 1 ? 'badge-success' : 'badge-danger'}`}>T{h.tier}</span></td>
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

      {/* ── Hospital Selection Modal ────────────────────────────── */}
      {isHospitalModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content animate-in" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: 'var(--font-size-lg)' }}>🏥 Select Hospital</h3>
              <button className="modal-close" onClick={() => setIsHospitalModalOpen(false)}>×</button>
            </div>

            <div className="modal-body" style={{ padding: '1rem' }}>
              <div className="combobox-wrapper" style={{ marginBottom: '1rem' }}>
                <input
                  className="input combobox-input"
                  placeholder="Search name or region..."
                  autoFocus
                  value={hospitalSearch}
                  onChange={(e) => setHospitalSearch(e.target.value)}
                />
                <span className="combobox-icon">🔍</span>
              </div>

              <div className="combobox-list" style={{ maxHeight: '350px' }}>
                {hospitalSuggestions.length ? hospitalSuggestions.map((h) => (
                  <button
                    key={h.id}
                    className={`combobox-item ${tempHospitalId === h.id ? 'selected' : ''}`}
                    style={{ padding: '0.75rem' }}
                    onClick={() => setTempHospitalId(h.id)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{h.name}</span>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{h.region}</span>
                    </div>
                    <div className={`badge ${h.tier === 1 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '10px' }}>T{h.tier}</div>
                  </button>
                )) : (
                  <div className="combobox-empty">No hospitals found.</div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '1rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsHospitalModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" style={{ minWidth: '80px' }} onClick={() => {
                setSelectedHospital(tempHospitalId);
                const h = allHospitals.find(x => x.id === tempHospitalId);
                if (h) setHospitalSearch(h.name);
                setIsHospitalModalOpen(false);
              }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
