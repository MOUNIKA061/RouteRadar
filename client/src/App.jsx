import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useToast, ToastContainer, ToastProvider } from './components/Toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import ShipmentsPage from './pages/ShipmentsPage'
import DriverView from './pages/DriverView'
import ShipmentPass from './pages/ShipmentPass'
import Login from './pages/Login'
import Register from './pages/Register'

function AppContent() {
  const { toasts, removeToast } = useToast()

  console.log('✅ App.jsx is rendering')

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <Routes>
        {/* Public routes - no navbar */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected routes with navbar */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <>
                <Navbar />
                <Dashboard />
              </>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/shipments"
          element={
            <ProtectedRoute>
              <>
                <Navbar />
                <ShipmentsPage />
              </>
            </ProtectedRoute>
          }
        />
        
        {/* Public driver and pass routes */}
        <Route path="/driver/:shipmentId" element={<DriverView />} />
        <Route path="/pass/:shipmentId" element={<ShipmentPass />} />
        
        {/* Catch-all - redirect to login if not authenticated, else redirect to dashboard */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  )
}

function App() {
  console.log('✅ App component mounted')
  
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
