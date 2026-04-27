import { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Link, NavLink, useLocation } from 'react-router-dom'
import Landing from './pages/Landing'
import CustomerNew from './pages/CustomerNew'
import CustomerDashboard from './pages/CustomerDashboard'
import InsurerDashboard from './pages/InsurerDashboard'
import HospitalDashboard from './pages/HospitalDashboard'
import PresentationDashboard from './pages/PresentationDashboard'

// ── Theme Context ─────────────────────────────────────────────
export const ThemeContext = createContext()

export function useTheme() {
  return useContext(ThemeContext)
}

// ── Navbar ────────────────────────────────────────────────────
function Navbar() {
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => { setMenuOpen(false) }, [location])

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">R</span>
          RiskByte
        </Link>

        <button className="mobile-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? '✕' : '☰'}
        </button>

        <ul className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          <li><NavLink to="/get-quote" className={({isActive}) => isActive ? 'active' : ''}>💎 Get Quote</NavLink></li>
          <li><NavLink to="/dashboard" className={({isActive}) => isActive ? 'active' : ''}>📊 My Dashboard</NavLink></li>
          <li><NavLink to="/insurer" className={({isActive}) => isActive ? 'active' : ''}>🏢 Insurer</NavLink></li>
          <li><NavLink to="/hospital" className={({isActive}) => isActive ? 'active' : ''}>🏥 Hospital</NavLink></li>
          <li><NavLink to="/presentation" className={({isActive}) => isActive ? 'active' : ''}>🎯 Presentation</NavLink></li>
          <li>
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </li>
        </ul>
      </div>
    </nav>
  )
}

// ── App ──────────────────────────────────────────────────────
function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('rb-theme') || 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('rb-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <Navbar />
      <main className="page">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/get-quote" element={<CustomerNew />} />
          <Route path="/dashboard" element={<CustomerDashboard />} />
          <Route path="/insurer" element={<InsurerDashboard />} />
          <Route path="/hospital" element={<HospitalDashboard />} />
          <Route path="/presentation" element={<PresentationDashboard />} />
        </Routes>
      </main>
    </ThemeContext.Provider>
  )
}

export default App
