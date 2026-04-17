import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()

  console.log('🔒 ProtectedRoute:', { loading, hasUser: !!user })

  if (loading) {
    return (
      <div className="min-h-screen bg-navy text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-green mx-auto mb-4"></div>
          <p className="text-xl font-bold">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    console.log('🔒 ProtectedRoute: No user, redirecting to /login')
    return <Navigate to="/login" replace />
  }

  console.log('🔒 ProtectedRoute: User authenticated, rendering children')
  return children
}

export default ProtectedRoute
