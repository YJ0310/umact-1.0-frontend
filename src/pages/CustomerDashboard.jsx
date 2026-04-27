import { useState, useEffect } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { jwtDecode } from 'jwt-decode'
export default function CustomerDashboard() {
  const [signedIn, setSignedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [userData, setUserData] = useState(null)
  
  const [showClaim, setShowClaim] = useState(false)
  const [claimSubmitted, setClaimSubmitted] = useState(false)
  const [claimForm, setClaimForm] = useState({ type: 'Medical', hospital: '', amount: '', date: '', desc: '' })
  const [submittingClaim, setSubmittingClaim] = useState(false)

  const processLogin = (decoded) => {
    setLoading(true)
    fetch('/api/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(decoded)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          localStorage.setItem('google_profile', JSON.stringify(decoded))
          localStorage.setItem('google_uid', decoded.sub)
          setUserData({ ...data, googleProfile: decoded })
          setSignedIn(true)
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const saved = localStorage.getItem('google_profile')
    if (saved) {
      try {
        processLogin(JSON.parse(saved))
      } catch (err) {}
    }
  }, [])

  const handleLoginSuccess = (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential)
      processLogin(decoded)
    } catch (err) {
      console.error('Failed to decode token', err)
      setLoading(false)
    }
  }

  const handleLoginError = () => {
    console.error('Google Auth Failed')
  }

  if (!signedIn) {
    return (
      <div className="container" style={{maxWidth: 480}}>
        <div className="card animate-in" style={{textAlign: 'center', padding: '3rem 1.5rem'}}>
          <div style={{fontSize: '4rem', marginBottom: '1rem'}}>🔐</div>
          <h1 style={{fontSize: 'var(--font-size-2xl)', marginBottom: '0.5rem'}}>Welcome Back</h1>
          <p style={{color: 'var(--text-secondary)', marginBottom: '2rem'}}>
            Sign in to access your dashboard, view your policy, and manage claims.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
            <GoogleLogin
              onSuccess={handleLoginSuccess}
              onError={handleLoginError}
              useOneTap
              shape="pill"
            />
          </div>
          {loading && <p style={{marginTop: '1rem', color: 'var(--text-muted)'}}>Authenticating...</p>}
          <p style={{fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2rem'}}>
            Powered by Google OAuth 2.0. Your data is secure.
          </p>
        </div>
      </div>
    )
  }

  if (showClaim && !claimSubmitted) {
    const handleSubmitClaim = async () => {
      if (!claimForm.hospital || !claimForm.amount) return alert('Please enter hospital and amount')
      setSubmittingClaim(true)
      const formData = new FormData()
      formData.append('firebaseUid', userData?.googleProfile?.sub || 'demo-user-123')
      formData.append('hospitalName', claimForm.hospital)
      formData.append('admissionType', claimForm.type)
      formData.append('admissionDate', claimForm.date)
      formData.append('claimAmount', claimForm.amount)
      formData.append('description', claimForm.desc)
      formData.append('planType', userData?.user?.planType || 'Basic')

      try {
        const res = await fetch('/api/customer/claim', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.success) {
          setClaimSubmitted(true)
          if (userData?.googleProfile) processLogin(userData.googleProfile) // Refresh data
        } else alert('Error: ' + data.error)
      } catch (err) { alert('Network error') }
      setSubmittingClaim(false)
    }

    return (
      <div className="container" style={{maxWidth: 520}}>
        <button className="btn btn-ghost" onClick={() => setShowClaim(false)} style={{marginBottom: '1rem'}}>
          ← Back to Dashboard
        </button>
        <div className="card animate-in">
          <h2 style={{marginBottom: '0.5rem'}}>📝 Submit a Claim</h2>
          <p style={{color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>Fill in your claim details below.</p>
          
          <div className="input-group" style={{marginBottom: '1rem'}}>
            <label className="input-label">Type of Visit</label>
            <select className="input" value={claimForm.type} onChange={e => setClaimForm(f => ({...f, type: e.target.value}))}>
              <option>Medical</option><option>Surgical</option><option>Obstetrics</option>
            </select>
          </div>
          <div className="input-group" style={{marginBottom: '1rem'}}>
            <label className="input-label">Hospital Name</label>
            <input className="input" placeholder="e.g. Sunway Medical Centre" value={claimForm.hospital} onChange={e => setClaimForm(f => ({...f, hospital: e.target.value}))} />
          </div>
          <div className="input-group" style={{marginBottom: '1rem'}}>
            <label className="input-label">Claim Amount (RM)</label>
            <input className="input" type="number" placeholder="e.g. 15000" value={claimForm.amount} onChange={e => setClaimForm(f => ({...f, amount: e.target.value}))} />
          </div>
          <div className="input-group" style={{marginBottom: '1rem'}}>
            <label className="input-label">Admission Date</label>
            <input className="input" type="date" value={claimForm.date} onChange={e => setClaimForm(f => ({...f, date: e.target.value}))} />
          </div>
          <div className="input-group" style={{marginBottom: '1.5rem'}}>
            <label className="input-label">Description</label>
            <textarea className="input" rows={3} placeholder="Brief description..." style={{resize: 'vertical'}} value={claimForm.desc} onChange={e => setClaimForm(f => ({...f, desc: e.target.value}))} />
          </div>
          <button className="btn btn-primary btn-block" disabled={submittingClaim} onClick={handleSubmitClaim}>
            {submittingClaim ? 'Submitting...' : 'Submit Claim →'}
          </button>
        </div>
      </div>
    )
  }

  if (claimSubmitted) {
    return (
      <div className="container" style={{maxWidth: 480}}>
        <div className="card animate-in" style={{textAlign: 'center', padding: '3rem 1.5rem'}}>
          <div style={{fontSize: '4rem', marginBottom: '1rem'}}>✅</div>
          <h2 style={{marginBottom: '0.5rem'}}>Claim Submitted!</h2>
          <p style={{color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>
            Your claim has been received and is being processed. You'll be notified once it's reviewed.
          </p>
          <div className="badge badge-success" style={{marginBottom: '1.5rem'}}>Ref: CLM-2026-{Math.floor(Math.random()*9999)}</div>
          <button className="btn btn-primary" onClick={() => { setShowClaim(false); setClaimSubmitted(false) }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const { user, claims, googleProfile } = userData || {}

  // ── Dashboard ──
  return (
    <div className="container">
      <div className="dashboard-header animate-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {googleProfile?.picture && (
            <img src={googleProfile.picture} alt="Profile" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--accent)' }} />
          )}
          <div>
            <h1 style={{ marginBottom: '0.25rem' }}>👋 Welcome back{googleProfile?.given_name ? `, ${googleProfile.given_name}` : ''}!</h1>
            <p style={{color: 'var(--text-secondary)'}}>Here's your policy overview.</p>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => { 
          setSignedIn(false); 
          setUserData(null);
          localStorage.removeItem('google_profile');
          localStorage.removeItem('google_uid');
        }}>Sign Out</button>
      </div>

      {/* Policy Card */}
      <div className="card card-accent animate-in" style={{animationDelay: '0.1s', marginBottom: '1.25rem'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem'}}>
          <div>
            <div style={{opacity: 0.8, fontSize: 'var(--font-size-sm)'}}>Active Policy</div>
            <div style={{fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginTop: '0.25rem'}}>{user?.planType || 'Standard'} Plan</div>
            <div style={{opacity: 0.8, marginTop: '0.25rem'}}>UID: {googleProfile?.sub ? googleProfile.sub.substring(0, 8) + '...' : 'Unknown'}</div>
          </div>
          <div style={{textAlign: 'right'}}>
            <div style={{opacity: 0.8, fontSize: 'var(--font-size-sm)'}}>Annual Limit</div>
            <div style={{fontSize: 'var(--font-size-2xl)', fontWeight: 800}}>RM {(user?.annualLimit || 50000).toLocaleString()}</div>
            <div style={{opacity: 0.8}}>Next payment: 15 May 2026</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row animate-in" style={{animationDelay: '0.2s'}}>
        {[
          { label: 'Annual Limit', value: `RM ${(user?.annualLimit || 100000).toLocaleString()}`, icon: '🛡️' },
          { label: 'Used This Year', value: `RM ${(user?.totalUsed || 0).toLocaleString()}`, icon: '📊' },
          { label: 'Remaining', value: `RM ${(user?.remaining || 100000).toLocaleString()}`, icon: '💰' },
          { label: 'Co-payment Cap', value: `RM ${(user?.copaymentCap || 3000).toLocaleString()}`, icon: '📋' },
        ].map((s, i) => (
          <div key={i} className="card card-stat">
            <div style={{fontSize: '1.25rem'}}>{s.icon}</div>
            <div className="stat-value" style={{fontSize: 'var(--font-size-xl)'}}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Claims History */}
      <div className="card animate-in" style={{animationDelay: '0.3s', marginBottom: '1.25rem'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
          <h3>Recent Claims</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowClaim(true)}>+ New Claim</button>
        </div>
        <div className="table-wrapper">
          {claims?.length > 0 ? (
            <table>
              <thead>
                <tr><th>Date</th><th>Hospital</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {claims.map((c, i) => (
                  <tr key={i}>
                    <td>{new Date(c.submitted_at).toLocaleDateString()}</td>
                    <td>{c.hospitalName || 'General Hospital'}</td>
                    <td style={{fontWeight: 600}}>RM {c.claimAmount?.toLocaleString()}</td>
                    <td><span className={`badge badge-${c.status === 'approved' ? 'success' : 'warning'}`}>{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{color: 'var(--text-muted)'}}>No claims filed yet this year.</p>
          )}
        </div>
      </div>

      {/* Quick Tips */}
      <div className="card animate-in" style={{animationDelay: '0.4s', background: 'var(--accent-light)', borderColor: 'var(--accent)'}}>
        <h4 style={{marginBottom: '0.5rem'}}>💡 Tip: Use Tier 1 Hospitals</h4>
        <p style={{fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)'}}>
          Choosing Tier 1 (Preferred) hospitals means lower out-of-pocket costs and no FMV clipping on your claims. 
          Check the Hospital Dashboard to find cost-efficient providers near you.
        </p>
      </div>
    </div>
  )
}

