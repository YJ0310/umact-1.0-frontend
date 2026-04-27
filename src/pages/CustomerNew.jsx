import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

/* ══════════════════════════════════════════════════════════════
   DATA / CONSTANTS
   ══════════════════════════════════════════════════════════════ */
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - i)
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const daysInMonth = (m, y) => new Date(y, m, 0).getDate()

const HEIGHT_RANGES = [
  { label: 'Below 150cm', min: 140, max: 150 },
  { label: '150 – 155 cm', min: 150, max: 155 },
  { label: '155 – 160 cm', min: 155, max: 160 },
  { label: '160 – 165 cm', min: 160, max: 165 },
  { label: '165 – 170 cm', min: 165, max: 170 },
  { label: '170 – 175 cm', min: 170, max: 175 },
  { label: '175 – 180 cm', min: 175, max: 180 },
  { label: '180 – 185 cm', min: 180, max: 185 },
  { label: '185 – 190 cm', min: 185, max: 190 },
  { label: 'Above 190 cm', min: 190, max: 200 },
]

const WEIGHT_RANGES = [
  { label: 'Below 45 kg', min: 35, max: 45 },
  { label: '45 – 50 kg', min: 45, max: 50 },
  { label: '50 – 55 kg', min: 50, max: 55 },
  { label: '55 – 60 kg', min: 55, max: 60 },
  { label: '60 – 65 kg', min: 60, max: 65 },
  { label: '65 – 70 kg', min: 65, max: 70 },
  { label: '70 – 75 kg', min: 70, max: 75 },
  { label: '75 – 80 kg', min: 75, max: 80 },
  { label: '80 – 90 kg', min: 80, max: 90 },
  { label: '90 – 100 kg', min: 90, max: 100 },
  { label: '100 – 110 kg', min: 100, max: 110 },
  { label: 'Above 110 kg', min: 110, max: 130 },
]

const HEALTH_CONDITIONS = [
  { id: 'hypertension', label: '🩺 High blood pressure', desc: 'Taking medication for blood pressure' },
  { id: 'diabetes', label: '💉 Diabetes', desc: 'Type 1 or Type 2' },
  { id: 'heart', label: '❤️ Heart disease', desc: 'Any heart-related condition' },
  { id: 'respiratory', label: '🫁 Asthma / Breathing problems', desc: 'Chronic breathing conditions' },
  { id: 'kidney', label: '🫘 Kidney disease', desc: 'Chronic kidney condition' },
  { id: 'cancer', label: '🎗️ Cancer', desc: 'Current or past diagnosis' },
  { id: 'none', label: '✅ None of the above', desc: 'I am generally healthy' },
]

const STATES = [
  { name: 'Johor', region: 'Southern' },
  { name: 'Kedah', region: 'Northern' },
  { name: 'Kelantan', region: 'Eastern' },
  { name: 'Melaka', region: 'Southern' },
  { name: 'Negeri Sembilan', region: 'Southern' },
  { name: 'Pahang', region: 'Eastern' },
  { name: 'Perak', region: 'Northern' },
  { name: 'Perlis', region: 'Northern' },
  { name: 'Pulau Pinang', region: 'Northern' },
  { name: 'Sabah', region: 'East Malaysia' },
  { name: 'Sarawak', region: 'East Malaysia' },
  { name: 'Selangor', region: 'Central' },
  { name: 'Terengganu', region: 'Eastern' },
  { name: 'W.P. Kuala Lumpur', region: 'Central' },
  { name: 'W.P. Putrajaya', region: 'Central' },
  { name: 'W.P. Labuan', region: 'East Malaysia' },
]

const PLANS = [
  { name: 'Basic', range: 'RM 120 – 350', point: '🛡️ Essential coverage for everyday medical needs', color: '#55A868' },
  { name: 'Silver', range: 'RM 280 – 650', point: '⭐ Wider hospital network & specialist access', color: '#4C72B0' },
  { name: 'Gold', range: 'RM 450 – 1,100', point: '🏆 Comprehensive coverage with higher annual limits', color: '#DD8452', popular: true },
  { name: 'Platinum', range: 'RM 800 – 2,000', point: '💎 Premium protection — private wards & zero co-pay options', color: '#8172B2' },
]

/* ── Helpers ───────────────────────────────────────────────── */
function calcAge(y, m, d) {
  if (!y || !m || !d) return null
  const today = new Date()
  const born = new Date(y, m - 1, d)
  let age = today.getFullYear() - born.getFullYear()
  const monthDiff = today.getMonth() - born.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) age--
  return age
}

function calcBmiRange(hIdx, wIdx) {
  if (hIdx === null || wIdx === null) return null
  const h = HEIGHT_RANGES[hIdx]
  const w = WEIGHT_RANGES[wIdx]
  const bmiLow = w.min / ((h.max / 100) ** 2)
  const bmiHigh = w.max / ((h.min / 100) ** 2)
  return { low: Math.round(bmiLow * 10) / 10, high: Math.round(bmiHigh * 10) / 10 }
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return { label: 'Underweight', color: '#3498db' }
  if (bmi < 25) return { label: 'Normal', color: '#2ecc71' }
  if (bmi < 30) return { label: 'Overweight', color: '#f0a530' }
  if (bmi < 40) return { label: 'Obese', color: '#e74c3c' }
  return { label: 'Severely Obese', color: '#c0392b' }
}

function calcPremium(data) {
  const basePremiums = { Basic: 2400, Silver: 4800, Gold: 7800, Platinum: 14400 }
  let premium = basePremiums[data.planType] || 4800
  const age = data.age || 30
  const ageScore = Math.min(age / 84, 1)
  premium *= (1 + ageScore * 0.75)
  const avgBmi = data.bmiRange ? (data.bmiRange.low + data.bmiRange.high) / 2 : 24
  if (avgBmi >= 30 && avgBmi < 40) premium *= 1.12
  else if (avgBmi >= 40) premium *= 1.28
  if (data.smoker === 'Yes') premium *= 1.18
  const condCount = data.conditions.filter(c => c !== 'none').length
  premium *= (1 + condCount * 0.10)
  const regionFactors = { Central: 1.12, Southern: 1.0, Northern: 0.96, Eastern: 0.92, 'East Malaysia': 0.88 }
  premium *= regionFactors[data.regionKey] || 1.0
  const annual = Math.round(premium)
  return { monthly: Math.round(annual / 12), annual }
}

/* ══════════════════════════════════════════════════════════════
   STEP DEFINITIONS
   ══════════════════════════════════════════════════════════════ */
const STEP_KEYS = ['dob', 'gender', 'body', 'smoke', 'health', 'state', 'plan']

/* ══════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function CustomerNew() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [data, setData] = useState({
    dobYear: '', dobMonth: '', dobDay: '',
    gender: '',
    heightIdx: null, weightIdx: null,
    smoker: '',
    conditions: [],
    state: '', regionKey: '',
    planType: 'Gold',
  })
  const [showResult, setShowResult] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showVerify, setShowVerify] = useState(false)
  const [premiums, setPremiums] = useState(null)
  const [pricingModel, setPricingModel] = useState(null)
  const [planEstimates, setPlanEstimates] = useState([])
  const [quoteMessage, setQuoteMessage] = useState('')

  const [quoteId, setQuoteId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  const age = useMemo(() => calcAge(Number(data.dobYear), Number(data.dobMonth), Number(data.dobDay)), [data.dobYear, data.dobMonth, data.dobDay])
  const bmiRange = useMemo(() => calcBmiRange(data.heightIdx, data.weightIdx), [data.heightIdx, data.weightIdx])
  const stepKey = STEP_KEYS[step]
  const isLastStep = step === STEP_KEYS.length - 1

  const canProceed = (() => {
    switch (stepKey) {
      case 'dob': return age !== null && age >= 0 && age <= 120
      case 'gender': return !!data.gender
      case 'body': return data.heightIdx !== null && data.weightIdx !== null
      case 'smoke': return !!data.smoker
      case 'health': return data.conditions.length > 0
      case 'state': return !!data.state
      case 'plan': return !!data.planType
      default: return false
    }
  })()

  const handleNext = async () => {
    if (isLastStep) {
      setLoading(true)
      try {
        const uid = localStorage.getItem('google_uid') || null
        const hasRegisteredAccount = localStorage.getItem('customer_account_ready') === 'true' && Boolean(uid)
        const payload = {
          dobYear: Number(data.dobYear),
          dobMonth: Number(data.dobMonth),
          dobDay: Number(data.dobDay),
          gender: data.gender,
          heightRange: HEIGHT_RANGES[data.heightIdx],
          weightRange: WEIGHT_RANGES[data.weightIdx],
          smoker: data.smoker,
          conditions: data.conditions,
          state: data.state,
          region: data.regionKey,
          planType: data.planType,
          firebaseUid: uid,
          previewOnly: hasRegisteredAccount
        }
        const res = await fetch('/api/customer/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const result = await res.json()
        if (result.success) {
          setPremiums(result.premiums)
          setQuoteId(result.quoteId || null)
          setPricingModel(result.model || null)
          setPlanEstimates(result.planEstimates || [])
          setQuoteMessage(result.message || '')
          if (result.quoteId) {
            sessionStorage.setItem('pending_quote_id', result.quoteId)
          }
        } else {
          console.error("Failed to get quote", result.error)
          // Fallback to local
          setPremiums(calcPremium({ ...data, age, bmiRange }))
          setPricingModel(null)
          setPlanEstimates([])
          setQuoteMessage('Using fallback estimate. Please retry for model-driven explanation.')
        }
      } catch (e) {
        console.error("API error", e)
        setPremiums(calcPremium({ ...data, age, bmiRange }))
        setPricingModel(null)
        setPlanEstimates([])
        setQuoteMessage('Using fallback estimate due to network error.')
      }
      setLoading(false)
      setShowResult(true)
    } else {
      setStep(s => s + 1)
    }
  }

  const handleBack = () => {
    if (showResult) { setShowResult(false); setShowVerify(false); setUploadSuccess(false) }
    else if (step > 0) setStep(s => s - 1)
  }

  const handleCheckupUpload = async (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    setUploading(true)
    const formData = new FormData()
    formData.append('quoteId', quoteId)
    formData.append('firebaseUid', localStorage.getItem('google_uid') || 'demo-user-123') 
    
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i])
    }

    try {
        const res = await fetch('/api/customer/checkup', {
            method: 'POST',
            body: formData
        })
        const result = await res.json()
        if (result.success) {
            setUploadSuccess(true)
        } else {
            alert('Upload failed: ' + result.error)
        }
    } catch (error) {
        console.error('Upload Error', error)
        alert('Upload failed due to network error')
    }
    setUploading(false)
  }

  const toggleCondition = (id) => {
    if (id === 'none') {
      setData(d => ({ ...d, conditions: d.conditions.includes('none') ? [] : ['none'] }))
    } else {
      setData(d => {
        let next = d.conditions.filter(c => c !== 'none')
        next = next.includes(id) ? next.filter(c => c !== id) : [...next, id]
        return { ...d, conditions: next }
      })
    }
  }

  const condCount = data.conditions.filter(c => c !== 'none').length
  const selectedState = STATES.find(s => s.name === data.state)

  const handleContinueToDashboard = () => {
    const hasRegisteredAccount = localStorage.getItem('customer_account_ready') === 'true'
    if (hasRegisteredAccount) {
      navigate('/dashboard')
      return
    }

    if (!quoteId) {
      alert('Please calculate and save a quote first before sign in.')
      return
    }

    sessionStorage.setItem('pending_quote_id', quoteId)
    navigate('/dashboard')
  }

  /* ── RESULT ──────────────────────────────────────────────── */
  if (showResult && premiums) {
    const avgBmi = bmiRange ? (bmiRange.low + bmiRange.high) / 2 : 24
    const bmiCat = bmiCategory(avgBmi)
    const factors = pricingModel?.reasons || []
    const hasRegisteredAccount = localStorage.getItem('customer_account_ready') === 'true'

    return (
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="animate-in" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '3rem' }}>📋</span>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', marginTop: '0.5rem' }}>Your Estimated Premium</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Based on the information you provided</p>
        </div>

        {/* Price Card */}
        <div className="card animate-in" style={{ animationDelay: '0.1s' }}>
          <div className="price-display">
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              {data.planType} Plan — Estimated Monthly Premium
            </div>
            <div className="price-value">RM {premiums.monthly.toLocaleString()}</div>
            <div className="price-period">/month (est.)</div>
            <div style={{ marginTop: '0.5rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              ≈ RM {premiums.annual.toLocaleString()} /year
            </div>
            {pricingModel?.riskScore !== undefined && (
              <div style={{ marginTop: '0.6rem', fontSize: 'var(--font-size-sm)' }}>
                Risk score: <strong>{pricingModel.riskScore}/100 ({pricingModel.riskBand})</strong>
              </div>
            )}
          </div>
        </div>

        {/* Why this price */}
        <div className="card animate-in" style={{ animationDelay: '0.2s', marginTop: '1rem' }}>
          <h4 style={{ marginBottom: '0.75rem' }}>📊 Why this price?</h4>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Backend model explanation for your personalized premium:
          </p>
          {factors.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {factors.map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: f.direction === 'up' ? 'var(--danger-light)' : 'var(--success-light)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)' }}>
                  <span>{f.label}</span>
                  <strong style={{ color: f.direction === 'up' ? 'var(--danger)' : 'var(--success)' }}>
                    {f.impactAnnual >= 0 ? '+' : ''}RM {Math.abs(f.impactAnnual).toLocaleString()} /year
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '0.5rem 0.75rem', background: 'var(--success-light)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
              ✅ Model explanation unavailable. Please retry for full transparency.
            </div>
          )}
          {quoteMessage && (
            <p style={{ marginTop: '0.75rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{quoteMessage}</p>
          )}
        </div>

        {planEstimates.length > 0 && (
          <div className="card animate-in" style={{ animationDelay: '0.25s', marginTop: '1rem' }}>
            <h4 style={{ marginBottom: '0.75rem' }}>⚡ Real-time Plan Estimates</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              {planEstimates.map(plan => (
                <div key={plan.name} style={{ padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontWeight: 700 }}>{plan.name}</div>
                  <div style={{ fontSize: 'var(--font-size-sm)' }}>RM {plan.monthly.toLocaleString()} /month</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    RM {plan.monthlyRange.min.toLocaleString()} - {plan.monthlyRange.max.toLocaleString()} /month
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verification CTA */}
        {!showVerify ? (
          <div className="card animate-in" style={{ animationDelay: '0.3s', marginTop: '1rem', textAlign: 'center', background: 'var(--accent-light)', borderColor: 'var(--accent)' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>🔍 Get Your Verified Price</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '1rem', lineHeight: 1.7 }}>
              This is an <strong>estimated price</strong> based on your self-reported information.
              To get your <strong>actual confirmed premium</strong>, we need to verify your health data 
              through a medical checkup report.
            </p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.7 }}>
              The checkup verifies: <strong>actual BMI, blood pressure, smoking markers, chronic conditions</strong> — 
              if your actual health is better than what you reported, your price could be <strong>significantly lower</strong>.
            </p>
            <button className="btn btn-primary" onClick={() => setShowVerify(true)}>
              Upload Medical Checkup →
            </button>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.75rem', lineHeight: 1.5 }}>
              ⚠️ Disclaimer: This is a prototype demonstration. In production, the verified price would become your actual binding premium.
              Medical checkup verification is valid for 12 months — after that, a new checkup is required or the premium reverts to standard rates.
            </p>
          </div>
        ) : uploadSuccess ? (
          <div className="card animate-in" style={{ marginTop: '1rem', textAlign: 'center', background: 'var(--success-light)', borderColor: 'var(--success)' }}>
            <span style={{ fontSize: '3rem' }}>🎉</span>
            <h4 style={{ marginBottom: '0.5rem', color: 'var(--success)' }}>Documents Uploaded!</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '1rem' }}>
              Your checkup documents have been received and are pending review by the insurer.
            </p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              We will notify you once your premium is verified.
            </p>
          </div>
        ) : (
          <div className="card animate-in" style={{ marginTop: '1rem' }}>
            <h4 style={{ marginBottom: '0.75rem' }}>📎 Upload Medical Checkup</h4>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Upload your recent medical checkup as PDF or photos (max 5 files, 10 MB each).
              This will verify your actual health data:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', fontSize: 'var(--font-size-sm)' }}>
              {['✅ Date of birth', '✅ Actual BMI', '✅ Blood pressure', '✅ Smoking markers', '✅ Chronic conditions', '✅ Blood tests'].map((item, i) => (
                <div key={i} style={{ padding: '0.4rem 0.6rem', background: 'var(--success-light)', borderRadius: 'var(--radius-sm)' }}>{item}</div>
              ))}
            </div>
            <label style={{ display: 'block', border: '2px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '2rem', textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer', marginBottom: '1rem', opacity: uploading ? 0.6 : 1 }}>
              <input type="file" multiple accept=".pdf,image/*" onChange={handleCheckupUpload} disabled={uploading || !quoteId} style={{ display: 'none' }} />
              <span style={{ fontSize: '2rem' }}>{uploading ? '⏳' : '📄'}</span>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '0.5rem' }}>
                {uploading ? 'Uploading...' : <>Drag & drop or click to upload<br />PDF, JPG, PNG • Max 5 files • 10 MB each</>}
              </p>
            </label>
            <div style={{ padding: '0.75rem', background: 'var(--warning-light)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
              ⏳ <strong>Validity:</strong> Medical checkup verification lasts <strong>12 months</strong>. 
              After expiry, a new checkup is required or the premium will revert to unverified (higher) rates.
            </div>
          </div>
        )}

        {/* Quick Benefits */}
        <div className="card animate-in" style={{ animationDelay: '0.4s', marginTop: '1rem' }}>
          <h4 style={{ marginBottom: '0.75rem' }}>✨ What's included in your {data.planType} plan</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: 'var(--font-size-sm)' }}>
            {[
              data.planType === 'Platinum' && '✅ Private ward accommodation',
              data.planType !== 'Basic' && '✅ Specialist consultation coverage',
              '✅ Surgical & medical claims',
              '✅ Emergency treatment',
              data.planType === 'Gold' || data.planType === 'Platinum' ? '✅ Higher annual limits (up to RM 150,000)' : '✅ Standard annual limits',
              '✅ Access to DRG-benchmarked hospital network',
            ].filter(Boolean).map((b, i) => (
              <div key={i} style={{ padding: '0.35rem 0' }}>{b}</div>
            ))}
          </div>
        </div>

        {/* Profile Summary */}
        <div className="card animate-in" style={{ animationDelay: '0.5s', marginTop: '1rem' }}>
          <h4 style={{ marginBottom: '0.75rem' }}>Your Profile</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1rem', fontSize: 'var(--font-size-sm)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Age</span><span>{age} years old</span>
            <span style={{ color: 'var(--text-muted)' }}>Gender</span><span>{data.gender}</span>
            <span style={{ color: 'var(--text-muted)' }}>Height</span><span>{data.heightIdx !== null ? HEIGHT_RANGES[data.heightIdx].label : '—'}</span>
            <span style={{ color: 'var(--text-muted)' }}>Weight</span><span>{data.weightIdx !== null ? WEIGHT_RANGES[data.weightIdx].label : '—'}</span>
            <span style={{ color: 'var(--text-muted)' }}>BMI range</span>
            <span>{bmiRange ? `${bmiRange.low} – ${bmiRange.high}` : '—'} <span style={{ color: bmiCat.color }}>({bmiCat.label})</span></span>
            <span style={{ color: 'var(--text-muted)' }}>Smoker</span><span>{data.smoker === 'Yes' ? '🚬 Yes' : '✅ No'}</span>
            <span style={{ color: 'var(--text-muted)' }}>Health</span><span>{condCount > 0 ? `${condCount} condition(s)` : 'None reported'}</span>
            <span style={{ color: 'var(--text-muted)' }}>State</span><span>{data.state}</span>
            <span style={{ color: 'var(--text-muted)' }}>Plan</span><span className="badge badge-primary">{data.planType}</span>
          </div>
        </div>

        {hasRegisteredAccount && (
          <div className="card animate-in" style={{ marginTop: '1rem', background: 'var(--warning-light)', borderColor: 'var(--warning)' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>ℹ️ Existing Account Mode</h4>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              Your account is already registered. New quote inputs here are preview-only and do not update your policy profile.
              To request plan/state/BMI changes, submit a request to your insurer.
            </p>
          </div>
        )}

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleBack}>← Back</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleContinueToDashboard}>
            {hasRegisteredAccount ? 'Go to Dashboard →' : 'Sign In to Continue →'}
          </button>
        </div>
      </div>
    )
  }

  /* ── LOADING ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚙️</div>
          <h2 style={{ marginBottom: '1rem' }}>Calculating Your Premium...</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Our AI model is analysing your risk profile using machine learning.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[90, 75, 48, 60].map((w, i) => (
              <div key={i} className="skeleton" style={{ height: i === 2 ? 48 : 16, width: `${w}%`, margin: '0 auto' }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ── STEPS ───────────────────────────────────────────────── */
  return (
    <div className="container" style={{ maxWidth: 540 }}>
      {/* Progress dots */}
      <div className="stepper">
        {STEP_KEYS.map((_, i) => (
          <div key={i} className={`step-dot ${i === step ? 'active' : i < step ? 'completed' : ''}`} />
        ))}
      </div>

      <div className="step-card animate-in" key={step}>

        {/* ── DOB ── */}
        {stepKey === 'dob' && (<>
          <h2>When were you born?</h2>
          <p>Pick your date of birth — no need to calculate anything!</p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 1.5fr', gap: '0.5rem' }}>
            <select className="input" value={data.dobDay} onChange={e => setData({ ...data, dobDay: e.target.value })} style={{ textAlign: 'center' }}>
              <option value="">Day</option>
              {Array.from({ length: data.dobMonth && data.dobYear ? daysInMonth(Number(data.dobMonth), Number(data.dobYear)) : 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
            <select className="input" value={data.dobMonth} onChange={e => setData({ ...data, dobMonth: e.target.value })} style={{ textAlign: 'center' }}>
              <option value="">Month</option>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select className="input" value={data.dobYear} onChange={e => setData({ ...data, dobYear: e.target.value })} style={{ textAlign: 'center' }}>
              <option value="">Year</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {age !== null && age >= 0 && (
            <div className="animate-fade" style={{ marginTop: '1rem', textAlign: 'center', fontSize: 'var(--font-size-2xl)', fontWeight: 800 }}>
              You are <span style={{ color: 'var(--accent)' }}>{age}</span> years old
            </div>
          )}
        </>)}

        {/* ── GENDER ── */}
        {stepKey === 'gender' && (<>
          <h2>What is your gender?</h2>
          <p>This helps us tailor your coverage options.</p>
          <div className="option-grid">
            {['Male', 'Female'].map(g => (
              <div key={g} className={`option-card ${data.gender === g ? 'selected' : ''}`} onClick={() => setData({ ...data, gender: g })}>
                <span style={{ fontSize: '2rem' }}>{g === 'Male' ? '👨' : '👩'}</span>
                <span className="option-title">{g}</span>
              </div>
            ))}
          </div>
        </>)}

        {/* ── BODY (height + weight) ── */}
        {stepKey === 'body' && (<>
          <h2>Your height & weight range</h2>
          <p>Just pick the closest range — no exact numbers needed.</p>
          <div style={{ marginBottom: '1rem' }}>
            <div className="input-label" style={{ marginBottom: '0.4rem' }}>📏 Height range</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
              {HEIGHT_RANGES.map((r, i) => (
                <div key={i} className={`option-card ${data.heightIdx === i ? 'selected' : ''}`}
                  onClick={() => setData({ ...data, heightIdx: i })} style={{ padding: '0.6rem 0.5rem', minHeight: 'auto' }}>
                  <span className="option-title" style={{ fontSize: 'var(--font-size-sm)' }}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="input-label" style={{ marginBottom: '0.4rem' }}>⚖️ Weight range</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
              {WEIGHT_RANGES.map((r, i) => (
                <div key={i} className={`option-card ${data.weightIdx === i ? 'selected' : ''}`}
                  onClick={() => setData({ ...data, weightIdx: i })} style={{ padding: '0.6rem 0.5rem', minHeight: 'auto' }}>
                  <span className="option-title" style={{ fontSize: 'var(--font-size-sm)' }}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>
          {bmiRange && (
            <div className="animate-fade" style={{ marginTop: '1rem', textAlign: 'center', padding: '0.75rem', background: 'var(--accent-light)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Estimated BMI range</span>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: bmiCategory((bmiRange.low + bmiRange.high) / 2).color }}>
                {bmiRange.low} – {bmiRange.high} &nbsp;
                <span style={{ fontSize: 'var(--font-size-sm)' }}>({bmiCategory((bmiRange.low + bmiRange.high) / 2).label})</span>
              </div>
            </div>
          )}
        </>)}

        {/* ── SMOKE ── */}
        {stepKey === 'smoke' && (<>
          <h2>Do you currently smoke?</h2>
          <p>This includes cigarettes, vape, or any tobacco products.</p>
          <div className="option-grid">
            {[{ val: 'No', icon: '✅', desc: 'Non-smoker' }, { val: 'Yes', icon: '🚬', desc: 'Current smoker' }].map(o => (
              <div key={o.val} className={`option-card ${data.smoker === o.val ? 'selected' : ''}`} onClick={() => setData({ ...data, smoker: o.val })}>
                <span style={{ fontSize: '2rem' }}>{o.icon}</span>
                <span className="option-title">{o.desc}</span>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            * Your smoking status will be verified through the medical checkup. Honest answers help us give you a more accurate estimate now.
          </p>
        </>)}

        {/* ── HEALTH CONDITIONS ── */}
        {stepKey === 'health' && (<>
          <h2>Do you have any of these?</h2>
          <p>Select all that apply — or choose "None" if you're generally healthy.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {HEALTH_CONDITIONS.map(c => (
              <div key={c.id}
                className={`option-card ${data.conditions.includes(c.id) ? 'selected' : ''}`}
                onClick={() => toggleCondition(c.id)}
                style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: '0.75rem', textAlign: 'left', padding: '0.75rem 1rem' }}>
                <span style={{ fontSize: '1.25rem', minWidth: 28 }}>{data.conditions.includes(c.id) ? '☑️' : '⬜'}</span>
                <div>
                  <div className="option-title" style={{ fontSize: 'var(--font-size-base)' }}>{c.label}</div>
                  <div className="option-desc">{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            * Conditions will be confirmed by your medical checkup report.
          </p>
        </>)}

        {/* ── STATE ── */}
        {stepKey === 'state' && (<>
          <h2>Where do you live?</h2>
          <p>Pick your state in Malaysia.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
            {STATES.map(s => (
              <div key={s.name}
                className={`option-card ${data.state === s.name ? 'selected' : ''}`}
                onClick={() => setData({ ...data, state: s.name, regionKey: s.region })}
                style={{ padding: '0.6rem 0.5rem', minHeight: 'auto' }}>
                <span className="option-title" style={{ fontSize: 'var(--font-size-sm)' }}>{s.name}</span>
                <span className="option-desc">{s.region}</span>
              </div>
            ))}
          </div>
        </>)}

        {/* ── PLAN ── */}
        {stepKey === 'plan' && (<>
          <h2>Choose your plan</h2>
          <p>Estimated monthly cost range. Final price depends on your profile.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {PLANS.map(p => (
              <div key={p.name}
                className={`option-card ${data.planType === p.name ? 'selected' : ''}`}
                onClick={() => setData({ ...data, planType: p.name })}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', padding: '1rem', position: 'relative' }}>
                {p.popular && <div className="badge badge-warning" style={{ position: 'absolute', top: -8, right: 8, fontSize: '0.65rem' }}>Most Popular</div>}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 'var(--font-size-lg)', color: p.color }}>{p.name}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{p.point}</div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap' }}>
                  {p.range}<br /><span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-muted)' }}>/month est.</span>
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            ⚠️ Prices shown are indicative ranges only. Your actual premium will be personalised based on your complete risk profile.
          </p>
        </>)}

        {/* ── ACTIONS ── */}
        <div className="step-actions" style={{ marginTop: '1.5rem' }}>
          {step > 0 && <button className="btn btn-secondary" onClick={handleBack}>← Back</button>}
          <button className="btn btn-primary" onClick={handleNext} disabled={!canProceed} style={{ flex: 1 }}>
            {isLastStep ? 'Calculate My Price →' : 'Continue →'}
          </button>
        </div>
      </div>

      <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
        Step {step + 1} of {STEP_KEYS.length} • Your data is secure and never shared.
      </p>
    </div>
  )
}
