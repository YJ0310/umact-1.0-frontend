import { useState, useEffect } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { jwtDecode } from 'jwt-decode'
import { useNavigate } from 'react-router-dom'
import { useAlert } from '../components/AlertProvider'
export default function CustomerDashboard() {
  const navigate = useNavigate()
  const { showAlert } = useAlert()
  const [signedIn, setSignedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [userData, setUserData] = useState(null)
  
  const [showClaim, setShowClaim] = useState(false)
  const [claimSubmitted, setClaimSubmitted] = useState(false)
  const [claimForm, setClaimForm] = useState({ type: 'Medical', hospital: '', drg: '', amount: '', date: '', desc: '' })
  const [submittingClaim, setSubmittingClaim] = useState(false)
  const [claimReceipts, setClaimReceipts] = useState([])
  const [hospitals, setHospitals] = useState([])
  const [drgs, setDrgs] = useState([])
  const [listsLoading, setListsLoading] = useState(false)
  const [requestUploads, setRequestUploads] = useState({})
  const [editingRequestId, setEditingRequestId] = useState(null)
  const [editPayload, setEditPayload] = useState({})
  const [requestSubmitting, setRequestSubmitting] = useState(false)

  const processLogin = async (decoded) => {
    setLoading(true)
    try {
      const loginRes = await fetch('/api/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decoded)
      })
      const data = await loginRes.json()

      if (data.success) {
        localStorage.setItem('google_profile', JSON.stringify(decoded))
        localStorage.setItem('google_uid', decoded.sub)
        localStorage.setItem('customer_account_ready', 'true')
        sessionStorage.removeItem('pending_quote_id')
        setUserData({ ...data, googleProfile: decoded })
        setSignedIn(true)
        return
      }

      if (data.code === 'NO_PROFILE') {
        const pendingQuoteId = sessionStorage.getItem('pending_quote_id')
        if (pendingQuoteId) {
          const regRes = await fetch('/api/customer/register-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...decoded, quoteId: pendingQuoteId })
          })
          const regData = await regRes.json()

          if (regData.success) {
            sessionStorage.removeItem('pending_quote_id')
            const retryRes = await fetch('/api/customer/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(decoded)
            })
            const retryData = await retryRes.json()
            if (retryData.success) {
              localStorage.setItem('google_profile', JSON.stringify(decoded))
              localStorage.setItem('google_uid', decoded.sub)
              localStorage.setItem('customer_account_ready', 'true')
              setUserData({ ...retryData, googleProfile: decoded })
              setSignedIn(true)
              return
            }
          }
        }

        showAlert('No onboarding data found. Please complete quote first for initial profile collection.', 'warning')
        localStorage.removeItem('google_profile')
        localStorage.removeItem('google_uid')
        localStorage.removeItem('customer_account_ready')
        setSignedIn(false)
        setUserData(null)
        navigate('/get-quote')
        return
      }

      showAlert(data.error || 'Sign in failed. Please try again.', 'error')
    } catch (err) {
      console.error('Login flow error:', err)
      showAlert('Network error during sign in. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem('google_profile')
    if (saved) {
      try {
        processLogin(JSON.parse(saved))
      } catch (err) {}
    }
  }, [])

  useEffect(() => {
    if (!signedIn) return
    const loadLists = async () => {
      setListsLoading(true)
      try {
        const [hospRes, drgRes] = await Promise.all([
          fetch('/api/analytics/hospitals/list'),
          fetch('/api/analytics/drgs')
        ])
        const hospData = await hospRes.json()
        const drgData = await drgRes.json()
        if (hospData?.success) setHospitals(hospData.hospitals || [])
        if (drgData?.success) setDrgs(drgData.drgs || [])
      } catch (err) {
        showAlert('Failed to load hospital/DRG lists.', 'error')
      } finally {
        setListsLoading(false)
      }
    }
    loadLists()
  }, [signedIn, showAlert])

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

  const getRequestId = (request) => request?._id?.$oid || request?._id || ''

  const statusBadgeClass = (status) => {
    if (status === 'approved') return 'badge-success'
    if (status === 'denied' || status === 'cancelled') return 'badge-danger'
    if (status === 'reviewed') return 'badge-primary'
    return 'badge-warning'
  }

  const typeLabel = (type) => {
    if (type === 'plan_change') return 'Plan Change'
    if (type === 'biodata_change') return 'Biodata Change'
    if (type === 'cancel_policy') return 'Cancel Policy'
    if (type === 'checkup_verify') return 'Checkup Verification'
    if (type === 'claim') return 'Claim Request'
    return type || 'Request'
  }

  const startEditRequest = (request) => {
    setEditingRequestId(getRequestId(request))
    setEditPayload({
      hospitalName: request?.payload?.hospitalName || '',
      drg: request?.payload?.drg || '',
      claimAmount: request?.payload?.claimAmount || '',
      admissionDate: request?.payload?.admissionDate || '',
      description: request?.payload?.description || ''
    })
  }

  const submitEditRequest = async () => {
    if (!editingRequestId) return
    setRequestSubmitting(true)
    try {
      const res = await fetch(`/api/customer/request/${editingRequestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid: userData?.googleProfile?.sub,
          payload: editPayload
        })
      })
      const data = await res.json()
      if (data.success) {
        showAlert('Request updated.', 'success')
        setEditingRequestId(null)
        if (userData?.googleProfile) processLogin(userData.googleProfile)
      } else {
        showAlert(data.error || 'Failed to update request.', 'error')
      }
    } catch (err) {
      showAlert('Network error while updating request.', 'error')
    } finally {
      setRequestSubmitting(false)
    }
  }

  const cancelRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/customer/request/${requestId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseUid: userData?.googleProfile?.sub })
      })
      const data = await res.json()
      if (data.success) {
        showAlert('Request cancelled.', 'success')
        if (userData?.googleProfile) processLogin(userData.googleProfile)
      } else {
        showAlert(data.error || 'Failed to cancel request.', 'error')
      }
    } catch (err) {
      showAlert('Network error while cancelling request.', 'error')
    }
  }

  const uploadAdditionalFiles = async (requestId) => {
    const files = requestUploads[requestId] || []
    if (!files.length) {
      showAlert('Please select files to upload.', 'warning')
      return
    }
    setRequestSubmitting(true)
    const formData = new FormData()
    formData.append('firebaseUid', userData?.googleProfile?.sub)
    files.forEach((file) => formData.append('files', file))
    try {
      const res = await fetch(`/api/customer/request/${requestId}/attachments`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        showAlert('Files uploaded. Request returned to pending.', 'success')
        if (userData?.googleProfile) processLogin(userData.googleProfile)
      } else {
        showAlert(data.error || 'Failed to upload files.', 'error')
      }
    } catch (err) {
      showAlert('Network error while uploading files.', 'error')
    } finally {
      setRequestSubmitting(false)
    }
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

  // Show loading skeleton while hospitals/DRGs lists are loading
  if (listsLoading) {
    return (
      <div className="page-container">
        <div style={{maxWidth: 900}}>
          <div className="card animate-in" style={{marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div style={{flex: 1}}>
              <div className="skeleton skeleton-text" style={{maxWidth: '300px', marginBottom: '0.5rem'}} />
              <div className="skeleton skeleton-text" style={{maxWidth: '200px'}} />
            </div>
            <button className="btn btn-ghost btn-sm" disabled style={{opacity: 0.5}}>Sign Out</button>
          </div>

          <div className="card card-accent animate-in" style={{marginBottom: '1.25rem', animationDelay: '0.1s'}}>
            <div className="skeleton skeleton-text" style={{maxWidth: '200px', marginBottom: '0.75rem'}} />
            <div className="skeleton skeleton-text" style={{maxWidth: '150px'}} />
          </div>

          <div className="stats-row animate-in" style={{animationDelay: '0.2s'}}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card card-stat">
                <div className="skeleton skeleton-text" style={{maxWidth: '50px', marginBottom: '0.5rem'}} />
                <div className="skeleton skeleton-text" style={{maxWidth: '80px', marginBottom: '0.5rem'}} />
                <div className="skeleton skeleton-text" style={{maxWidth: '60px'}} />
              </div>
            ))}
          </div>

          <div className="card animate-in" style={{animationDelay: '0.3s', marginBottom: '1.25rem'}}>
            <div className="skeleton skeleton-text" style={{maxWidth: '150px', marginBottom: '1rem'}} />
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton skeleton-text" style={{marginBottom: '0.75rem'}} />
            ))}
          </div>

          <div className="card animate-in" style={{animationDelay: '0.35s'}}>
            <div className="skeleton skeleton-text" style={{maxWidth: '150px', marginBottom: '1rem'}} />
            {[1, 2].map((i) => (
              <div key={i} className="skeleton skeleton-text" style={{marginBottom: '0.75rem'}} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (showClaim && !claimSubmitted) {
    const handleSubmitClaim = async () => {
      if (!claimForm.hospital || !claimForm.amount || !claimForm.drg) {
        showAlert('Please select hospital, DRG, and amount.', 'warning')
        return
      }
      setSubmittingClaim(true)
      const formData = new FormData()
      formData.append('firebaseUid', userData?.googleProfile?.sub || 'demo-user-123')
      formData.append('hospitalName', claimForm.hospital)
      formData.append('drg', claimForm.drg)
      formData.append('admissionType', claimForm.type)
      formData.append('admissionDate', claimForm.date)
      formData.append('claimAmount', claimForm.amount)
      formData.append('description', claimForm.desc)
      formData.append('planType', userData?.user?.planType || 'Basic')
      claimReceipts.forEach((file) => formData.append('receipts', file))

      try {
        const res = await fetch('/api/customer/claim', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.success) {
          setClaimSubmitted(true)
          showAlert('Claim request submitted.', 'success')
          if (userData?.googleProfile) processLogin(userData.googleProfile) // Refresh data
        } else showAlert(`Error: ${data.error}`, 'error')
      } catch (err) {
        showAlert('Network error while submitting claim.', 'error')
      }
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
            <input
              className="input"
              list="hospital-list"
              placeholder="Search hospital name"
              value={claimForm.hospital}
              onChange={e => setClaimForm(f => ({...f, hospital: e.target.value}))}
            />
            <datalist id="hospital-list">
              {hospitals.map((h) => (
                <option key={h._id || h.hospital_name} value={h.hospital_name} />
              ))}
            </datalist>
          </div>
          <div className="input-group" style={{marginBottom: '1rem'}}>
            <label className="input-label">DRG (15 Core)</label>
            <select className="input" value={claimForm.drg} onChange={e => setClaimForm(f => ({...f, drg: e.target.value}))}>
              <option value="">Select DRG</option>
              {drgs.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {listsLoading && <div className="skeleton skeleton-text" style={{marginTop: '0.5rem'}} />}
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
          <div className="input-group" style={{marginBottom: '1.5rem'}}>
            <label className="input-label">Receipts (PDF or images)</label>
            <input
              className="input"
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={(e) => setClaimReceipts(Array.from(e.target.files || []))}
            />
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

  const { user, claims, requests, googleProfile } = userData || {}

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
          localStorage.removeItem('customer_account_ready');
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
                <tr><th>Date</th><th>Hospital</th><th>DRG</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {claims.map((c, i) => (
                  <tr key={i}>
                    <td>{new Date(c.submitted_at || c.created_at).toLocaleDateString()}</td>
                    <td>{c.payload?.hospitalName || 'General Hospital'}</td>
                    <td>{c.payload?.drg || 'N/A'}</td>
                    <td style={{fontWeight: 600}}>RM {Number(c.payload?.claimAmount || 0).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass(c.status)}`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{color: 'var(--text-muted)'}}>No claims filed yet this year.</p>
          )}
        </div>
      </div>

      {/* Requests Board */}
      <div className="card animate-in" style={{animationDelay: '0.35s', marginBottom: '1.25rem'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
          <h3>Request Board</h3>
          <div style={{fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)'}}>
            Pending requests can be edited or cancelled
          </div>
        </div>
        <div className="table-wrapper">
          {requests?.length > 0 ? (
            <table>
              <thead>
                <tr><th>Type</th><th>Status</th><th>Submitted</th><th>Notes</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const requestId = getRequestId(r)
                  const canEdit = r.status === 'pending' && r.type === 'claim'
                  const canCancel = ['pending', 'reviewed'].includes(r.status)
                  const canUpload = r.status === 'reviewed'
                  return (
                    <tr key={requestId}>
                      <td>{typeLabel(r.type)}</td>
                      <td><span className={`badge ${statusBadgeClass(r.status)}`}>{r.status}</span></td>
                      <td>{new Date(r.created_at || r.submitted_at).toLocaleDateString()}</td>
                      <td>{r.review?.note || r.review?.decision || '-'}</td>
                      <td style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                        {canEdit && (
                          <button className="btn btn-ghost btn-sm" onClick={() => startEditRequest(r)}>
                            Edit
                          </button>
                        )}
                        {canCancel && (
                          <button className="btn btn-ghost btn-sm" onClick={() => cancelRequest(requestId)}>
                            Cancel
                          </button>
                        )}
                        {canUpload && (
                          <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                            <input
                              className="input"
                              type="file"
                              multiple
                              accept="image/*,.pdf"
                              onChange={(e) =>
                                setRequestUploads((prev) => ({
                                  ...prev,
                                  [requestId]: Array.from(e.target.files || [])
                                }))
                              }
                              style={{maxWidth: 160}}
                            />
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => uploadAdditionalFiles(requestId)}
                              disabled={requestSubmitting}
                            >
                              Upload
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p style={{color: 'var(--text-muted)'}}>No requests yet. Start with a new claim.</p>
          )}
        </div>

        {editingRequestId && (
          <div className="card" style={{marginTop: '1rem'}}>
            <h4 style={{marginBottom: '1rem'}}>Edit Claim Request</h4>
            <div className="input-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem'}}>
              <div className="input-group">
                <label className="input-label">Hospital</label>
                <input
                  className="input"
                  list="hospital-list"
                  value={editPayload.hospitalName || ''}
                  onChange={(e) => setEditPayload((p) => ({ ...p, hospitalName: e.target.value }))}
                />
              </div>
              <div className="input-group">
                <label className="input-label">DRG</label>
                <select
                  className="input"
                  value={editPayload.drg || ''}
                  onChange={(e) => setEditPayload((p) => ({ ...p, drg: e.target.value }))}
                >
                  <option value="">Select DRG</option>
                  {drgs.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Claim Amount (RM)</label>
                <input
                  className="input"
                  type="number"
                  value={editPayload.claimAmount || ''}
                  onChange={(e) => setEditPayload((p) => ({ ...p, claimAmount: e.target.value }))}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Admission Date</label>
                <input
                  className="input"
                  type="date"
                  value={editPayload.admissionDate || ''}
                  onChange={(e) => setEditPayload((p) => ({ ...p, admissionDate: e.target.value }))}
                />
              </div>
              <div className="input-group" style={{gridColumn: '1 / -1'}}>
                <label className="input-label">Description</label>
                <textarea
                  className="input"
                  rows={3}
                  value={editPayload.description || ''}
                  onChange={(e) => setEditPayload((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
            </div>
            <div style={{display: 'flex', gap: '0.75rem', marginTop: '1rem'}}>
              <button className="btn btn-primary" onClick={submitEditRequest} disabled={requestSubmitting}>
                Save Changes
              </button>
              <button className="btn btn-ghost" onClick={() => setEditingRequestId(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
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

