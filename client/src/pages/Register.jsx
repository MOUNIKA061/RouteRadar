import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { useToast } from '../components/Toast'

const Register = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  const handleRegister = async (e) => {
    e.preventDefault()

    if (!email || !password || !confirmPassword) {
      showToast('Please fill in all fields', 'error')
      return
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters long', 'error')
      return
    }

    setLoading(true)
    try {
      const auth = getAuth()
      await createUserWithEmailAndPassword(auth, email, password)
      showToast('Account created successfully!', 'success')
      navigate('/')
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <img src="/logo.png" alt="RouteRadar Logo" className="w-16 h-16 rounded-full object-cover border-2 border-green-400" />
            <h1 className="text-3xl font-bold text-lime-green">RouteRadar</h1>
          </div>
          <p className="text-gray-400 text-lg text-center">Detect Delays Before They Happen</p>
        </div>

        {/* Register Card */}
        <div className="bg-gray-900 rounded-lg p-8 border border-lime-green/30">
          <h2 className="text-2xl font-bold mb-6 text-lime-green">Create Account</h2>

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-lime-green transition"
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-lime-green transition"
              />
            </div>

            {/* Confirm Password Input */}
            <div>
              <label className="block text-sm font-medium mb-2">Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-lime-green transition"
              />
            </div>

            {/* Register Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-lime-green hover:bg-lime-500 disabled:opacity-50 text-navy font-bold py-3 rounded transition"
            >
              {loading ? 'Creating Account...' : 'Register'}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-lime-green hover:text-lime-500 font-bold">
                Login
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-8">
          Smart Logistics Coordination for India
        </p>
      </div>
    </div>
  )
}

export default Register
