import { Link } from 'react-router-dom'

const navCards = [
  {
    to: '/get-quote',
    icon: '💎',
    bg: 'linear-gradient(135deg, #4c6ef5, #7c3aed)',
    title: 'Get Your Quote',
    desc: 'New customer? Get a personalized insurance quote in minutes. Simple steps, transparent pricing.'
  },
  {
    to: '/dashboard',
    icon: '📊',
    bg: 'linear-gradient(135deg, #2ecc71, #27ae60)',
    title: 'My Dashboard',
    desc: 'Sign in with Google to view your policy, claims history, and make new claims.'
  },
  {
    to: '/insurer',
    icon: '🏢',
    bg: 'linear-gradient(135deg, #f0a530, #e67e22)',
    title: 'Insurer Analytics',
    desc: 'Real-time profit comparison, FMV benchmarking, and cost governance dashboard.'
  },
  {
    to: '/hospital',
    icon: '🏥',
    bg: 'linear-gradient(135deg, #3498db, #2980b9)',
    title: 'Hospital Dashboard',
    desc: 'DRG claim quota tracking for the China-model hospital governance framework.'
  },
  {
    to: '/presentation',
    icon: '🎯',
    bg: 'linear-gradient(135deg, #e74c3c, #c0392b)',
    title: 'Presentation',
    desc: 'Interactive findings dashboard. Click any insight to see exactly how it was derived.'
  },
]

export default function Landing() {
  return (
    <div className="container">
      {/* Hero */}
      <section className="hero animate-in">
        <div style={{marginBottom: '0.5rem'}}>
          <span className="badge badge-primary" style={{fontSize: '0.8rem'}}>UMACT Hackathon 2026</span>
        </div>
        <h1 className="hero-title">
          Medical Insurance<br/>
          <span className="gradient-text">Reimagined with Data</span>
        </h1>
        <p className="hero-subtitle">
          Team RiskByte's proof-of-concept for fair, transparent, and sustainable 
          healthcare financing under Malaysia's Base MHIT Plan.
        </p>
        <div style={{display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap'}}>
          <Link to="/get-quote" className="btn btn-primary btn-lg">
            Get Your Quote →
          </Link>
          <Link to="/presentation" className="btn btn-outline btn-lg">
            View Findings
          </Link>
        </div>
      </section>

      {/* Key Stats */}
      <section className="stats-row" style={{marginTop: '1rem'}}>
        {[
          { value: '20,000', label: 'Claims Analysed', icon: '📋' },
          { value: 'R² 0.962', label: 'Model Accuracy', icon: '🎯' },
          { value: 'RM 21M', label: 'Potential Savings', icon: '💰' },
          { value: '35', label: 'Hospitals Tiered', icon: '🏥' },
        ].map((s, i) => (
          <div key={i} className="card card-stat animate-in" style={{animationDelay: `${i * 0.1}s`}}>
            <div style={{fontSize: '1.5rem', marginBottom: '0.25rem'}}>{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Navigation Cards */}
      <section style={{marginTop: '2rem'}}>
        <h2 className="section-title" style={{textAlign: 'center', marginBottom: '1.5rem'}}>
          Explore the Platform
        </h2>
        <div className="grid grid-3" style={{marginBottom: '2rem'}}>
          {navCards.map((card, i) => (
            <Link to={card.to} key={i} className="nav-card animate-in" style={{animationDelay: `${i * 0.08}s`}}>
              <div className="nav-card-icon" style={{background: card.bg, borderRadius: '12px', color: 'white', fontSize: '1.5rem'}}>
                {card.icon}
              </div>
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section className="card" style={{marginBottom: '2rem', textAlign: 'center'}}>
        <h3 style={{marginBottom: '0.75rem'}}>About This Project</h3>
        <p style={{color: 'var(--text-secondary)', maxWidth: '700px', margin: '0 auto', lineHeight: 1.7}}>
          This PoC demonstrates how <strong>CatBoost-powered Fair Market Value (FMV) benchmarking</strong> and 
          <strong> data-driven hospital tiering</strong> can improve Malaysia's medical insurance ecosystem. 
          Our analysis reveals that applying FMV clipping to Tier 2 hospitals could save insurers 
          <strong> RM 45.1 million</strong> annually while reducing customer out-of-pocket costs by <strong>14.58%</strong>.
        </p>
      </section>
    </div>
  )
}
