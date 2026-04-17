import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="sticky top-0 z-50 border-b" style={{ backgroundColor: '#0d1f3c', borderColor: '#1e3a5f' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left: Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition">
            <img
              src="/logo.png"
              alt="RouteRadar Logo"
              className="w-8 h-8 rounded-full object-cover"
              style={{ border: '1px solid #4CAF50' }}
            />
            <span className="text-lg font-bold text-white hidden sm:inline" style={{ color: '#4CAF50' }}>
              RouteRadar
            </span>
          </Link>

          {/* Center: Navigation Links */}
          <div className="hidden sm:flex items-center gap-8">
            <Link
              to="/"
              className="transition font-medium text-sm"
              style={{
                color: isActive('/') ? '#4CAF50' : '#8ba3c4'
              }}
              onMouseEnter={(e) => !isActive('/') && (e.target.style.color = '#fff')}
              onMouseLeave={(e) => !isActive('/') && (e.target.style.color = '#8ba3c4')}
            >
              Home
            </Link>
            <Link
              to="/shipments"
              className="transition font-medium text-sm"
              style={{
                color: isActive('/shipments') ? '#4CAF50' : '#8ba3c4'
              }}
              onMouseEnter={(e) => !isActive('/shipments') && (e.target.style.color = '#fff')}
              onMouseLeave={(e) => !isActive('/shipments') && (e.target.style.color = '#8ba3c4')}
            >
              Shipments
            </Link>
          </div>

          {/* Right: User Info + Logout */}
          {user && (
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs" style={{ color: '#8ba3c4' }}>
                  Logged in as
                </p>
                <p className="text-sm font-semibold text-white truncate max-w-[200px]">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg font-medium transition text-sm"
                style={{ backgroundColor: '#ef4444', color: '#fff' }}
                onMouseEnter={(e) => (e.target.style.backgroundColor = '#dc2626')}
                onMouseLeave={(e) => (e.target.style.backgroundColor = '#ef4444')}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar
