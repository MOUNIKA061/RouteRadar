import React from 'react'
import { useAuth } from '../context/AuthContext'
import ProtectedRoute from '../components/ProtectedRoute'
import ShipmentHistory from '../components/ShipmentHistory'

const ShipmentsPage = () => {
  return (
    <div className="min-h-screen pt-4 pb-16 px-4 md:px-8" style={{ backgroundColor: '#0a1628' }}>
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2" style={{ color: '#4CAF50' }}>
            📋 Shipment History
          </h1>
          <p className="text-gray-500">Track all your shipments with detailed status and travel history</p>
        </div>

        {/* Shipment History Component */}
        <ShipmentHistory />
      </div>
    </div>
  )
}

export default ShipmentsPage
