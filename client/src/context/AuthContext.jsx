import React, { createContext, useContext, useEffect, useState } from 'react'
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    console.log('✅ AuthProvider: Setting up auth listener')
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        console.log('✅ Auth state changed:', currentUser ? currentUser.email : 'No user')
        setUser(currentUser)
        setLoading(false)
      },
      (err) => {
        console.error('❌ Auth error:', err)
        setError(err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const logout = async () => {
    try {
      const auth = getAuth()
      await signOut(auth)
      setUser(null)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
