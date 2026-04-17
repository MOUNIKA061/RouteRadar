import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { deleteShipment } from '../utils/api'
import { useToast } from './Toast'
import TimelineComponent from './TimelineComponent'

const ShipmentHistory = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)

    // Create query: filter by user + sort by createdAt descending
    const shipmentsRef = collection(db, 'shipments')
    
    // Try with orderBy first, if it fails, fall back to just where
    let q = query(
      shipmentsRef,
      where('createdBy', '==', user.uid),
      orderBy('createdAt', 'desc')
    )

    // Subscribe to real-time updates with error handling
    let unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        setShipments(data)
        setLoading(false)
      },
      (error) => {
        console.error('Firestore query error with orderBy:', error)
        
        // Fallback: query without orderBy
        if (error.code === 'failed-precondition') {
          console.log('Retrying query without orderBy...')
          const fallbackQ = query(
            shipmentsRef,
            where('createdBy', '==', user.uid)
          )
          
          unsubscribe = onSnapshot(
            fallbackQ,
            (snapshot) => {
              const data = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              setShipments(data)
              setLoading(false)
            },
            (fallbackError) => {
              console.error('Fallback query error:', fallbackError)
              setLoading(false)
              setShipments([])
            }
          )
        } else {
          setLoading(false)
          setShipments([])
        }
      }
    )

    // Cleanup listener on unmount
    return () => unsubscribe()
  }, [user])

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A'
    const date = new Date(isoString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateOnly = (isoString) => {
    if (!isoString) return 'N/A'
    const date = new Date(isoString)
    return date.toLocaleDateString()
  }

  const formatTimeOnly = (isoString) => {
    if (!isoString) return 'N/A'
    const date = new Date(isoString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getRiskBadgeColor = (riskLevel) => {
    switch (riskLevel) {
      case 'High':
        return 'bg-red-500 text-black'
      case 'Medium':
        return 'bg-yellow-500 text-black'
      case 'Low':
        return 'bg-green-500 text-black'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'Upcoming':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
      case 'In Transit':
        return 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
      case 'Delivered':
        return 'bg-green-500/20 text-green-300 border border-green-500/50'
      case 'Disrupted':
        return 'bg-red-500/20 text-red-300 border border-red-500/50'
      default:
        return 'bg-gray-500/20 text-gray-300 border border-gray-500/50'
    }
  }

  const getAutoStatus = (departureTime, updatedETA) => {
    const now = new Date()
    const departure = new Date(departureTime)
    const eta = new Date(updatedETA)

    if (now >= departure && now < eta) {
      return 'In Transit'
    } else if (now >= eta) {
      return 'Delivered'
    }
    return 'Upcoming'
  }

  const handleDeleteShipment = async (shipmentId) => {
    if (!window.confirm('Are you sure you want to delete this shipment? This action cannot be undone.')) {
      return
    }

    try {
      await deleteShipment(shipmentId)
      showToast('✅ Shipment deleted successfully', 'success')
    } catch (error) {
      showToast(error.message || 'Failed to delete shipment', 'error')
    }
  }

  // Separate shipments
  const presentShipments = shipments.filter(s => {
    const status = getAutoStatus(s.departureTime, s.updatedETA)
    return status === 'Upcoming' || status === 'In Transit'
  })

  const pastShipments = shipments.filter(s => {
    const status = getAutoStatus(s.departureTime, s.updatedETA)
    return status === 'Delivered'
  })

  const ShipmentCard = ({ shipment, isPast = false }) => {
    const autoStatus = getAutoStatus(shipment.departureTime, shipment.updatedETA)
    
    return (
      <div className="rounded-lg border border-gray-700 p-6 mb-4 transition-all hover:border-gray-600" style={{ backgroundColor: '#0d1f3c' }}>
        {/* High Risk Warning */}
        {shipment.currentRisk === 'High' && (
          <div className="mb-4 flex items-center gap-2 bg-red-900/50 border border-red-700 rounded-lg p-3">
            <span className="text-lg">⚠️</span>
            <p className="text-red-300 text-sm font-semibold">High Risk: {shipment.riskReason}</p>
          </div>
        )}

        {/* Header Row: ID, Route, Status */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            {/* Main Route Display */}
            <p className="text-lg font-bold text-white mb-2">
              📍 {shipment.sourceCity || '?'} → {shipment.destinationCity || '?'}
            </p>
            
            {/* Sender Information */}
            <div className="mb-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide">📤 From (Sender)</p>
              <p className="text-sm text-blue-300 font-semibold">{shipment.consignorName || 'Sender N/A'}</p>
              <p className="text-xs text-gray-400">{shipment.sourceAddress || 'Address N/A'}</p>
            </div>
            
            {/* Receiver Information */}
            <div className="mb-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide">📥 To (Receiver)</p>
              <p className="text-sm text-green-300 font-semibold">{shipment.consigneeName || 'Receiver N/A'}</p>
              <p className="text-xs text-gray-400">{shipment.destinationAddress || 'Address N/A'}</p>
            </div>
            
            {/* Shipment ID and Invoice */}
            <p className="text-xs font-mono text-gray-600 mt-2">ID: {shipment.shipmentId?.slice(0, 12)}... | Invoice: {shipment.invoiceNumber || 'N/A'}</p>
          </div>
          
          <div className="flex gap-2 ml-4">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRiskBadgeColor(shipment.currentRisk)}`}>
              {shipment.currentRisk} Risk
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(autoStatus)}`}>
              {autoStatus}
            </span>
          </div>
        </div>

        {/* Shipment Details Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-700">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Shipment ID</p>
            <p className="text-gray-200 font-semibold text-sm">{shipment.shipmentId}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Driver</p>
            <p className="text-gray-200 font-semibold text-sm">{shipment.driverName}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Vehicle</p>
            <p className="text-gray-200 font-semibold text-sm">{shipment.vehicleNumber}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Cargo Type</p>
            <p className="text-gray-200 font-semibold text-sm">{shipment.cargoType}</p>
          </div>
        </div>

        {/* Date and Time Information */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-700">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Start Date</p>
            <p className="text-gray-200 font-semibold text-sm">{formatDateOnly(shipment.departureTime)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Start Time</p>
            <p className="text-gray-200 font-semibold text-sm">{formatTimeOnly(shipment.departureTime)}</p>
          </div>
          {isPast && (
            <>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Delivered Date</p>
                <p className="text-gray-200 font-semibold text-sm">{formatDateOnly(shipment.updatedETA)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Delivered Time</p>
                <p className="text-gray-200 font-semibold text-sm">{formatTimeOnly(shipment.updatedETA)}</p>
              </div>
            </>
          )}
          {!isPast && (
            <>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Expected Arrival</p>
                <p className="text-gray-200 font-semibold text-sm">{formatDateOnly(shipment.updatedETA)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">ETA</p>
                <p className="text-gray-200 font-semibold text-sm">{formatTimeOnly(shipment.updatedETA)}</p>
              </div>
            </>
          )}
        </div>

        {/* Route Details */}
        {shipment.selectedRoute && (
          <div className="bg-gray-800/50 rounded-lg p-3 mb-4 border border-gray-700">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide">Distance</p>
                <p className="text-blue-400 font-bold">{shipment.selectedRoute.distance} km</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide">Duration</p>
                <p className="text-blue-400 font-bold">{shipment.selectedRoute.duration} min</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide">Risk Score</p>
                <p className="text-blue-400 font-bold">{shipment.selectedRoute.riskScore}</p>
              </div>
            </div>
          </div>
        )}

        {/* Shipment History Timeline */}
        {shipment.history && shipment.history.length > 0 && (
          <div className="mb-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-3 font-semibold">📅 Shipment Timeline</p>
            <TimelineComponent history={shipment.history} />
          </div>
        )}

        {/* Fallback when no history */}
        {(!shipment.history || shipment.history.length === 0) && (
          <div className="mb-4 p-3 bg-gray-800/30 rounded-lg border border-gray-700">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-2 font-semibold">📅 Shipment Timeline</p>
            <p className="text-gray-400 text-sm">No history events recorded yet</p>
          </div>
        )}

        {/* Metadata Footer */}
        <div className="pt-4 border-t border-gray-700 flex gap-2">
          <button
            onClick={() => navigate(`/driver/${shipment.id}`)}
            className="flex-1 py-2 px-3 rounded text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition"
          >
            🗺️ View Driver Map
          </button>
          <button
            onClick={() => navigate(`/pass/${shipment.id}`)}
            className="flex-1 py-2 px-3 rounded text-xs font-bold border border-blue-500 text-blue-400 hover:bg-blue-500/10 transition"
          >
            📋 View Pass
          </button>
          <button
            onClick={() => handleDeleteShipment(shipment.id)}
            className="py-2 px-3 rounded text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition"
            title="Delete shipment"
          >
            ❌
          </button>
        </div>

        {/* Metadata Footer */}
        <p className="text-gray-600 text-xs mt-3">
          Created: {formatDate(shipment.createdAt)}
        </p>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#0a1628' }} className="rounded-lg">
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin">
            <div className="w-8 h-8 border-4 border-gray-700 border-t-green-500 rounded-full"></div>
          </div>
        </div>
      ) : (
        <>
          {/* Present Shipments Section */}
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white mb-2" style={{ color: '#4CAF50' }}>
                🚚 Present Shipments
              </h3>
              <p className="text-gray-500 text-sm">Active and upcoming deliveries</p>
            </div>

            {presentShipments.length === 0 ? (
              <div className="text-center py-8 mb-8">
                <p className="text-gray-500 text-sm">No active shipments</p>
              </div>
            ) : (
              <div className="mb-8">{presentShipments.map((shipment) => <ShipmentCard key={shipment.id} shipment={shipment} isPast={false} />)}</div>
            )}
          </div>

          {/* Divider */}
          {presentShipments.length > 0 && pastShipments.length > 0 && (
            <div className="my-8 border-t border-gray-700"></div>
          )}

          {/* Past Shipments Section */}
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white mb-2" style={{ color: '#8ba3c4' }}>
                ✅ Past Shipments
              </h3>
              <p className="text-gray-500 text-sm">Completed and delivered shipments</p>
            </div>

            {pastShipments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No past shipments</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2">{pastShipments.map((shipment) => <ShipmentCard key={shipment.id} shipment={shipment} isPast={true} />)}</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ShipmentHistory
