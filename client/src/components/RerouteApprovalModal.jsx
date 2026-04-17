import React, { useState } from 'react'
import { collection, doc, updateDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { approveReroute } from '../utils/api'

const RerouteApprovalModal = ({ request, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newRoute, setNewRoute] = useState(null)
  const [routeTransition, setRouteTransition] = useState(null)
  const [approved, setApproved] = useState(false)

  const formatRequestedAt = (requestedAt) => {
    if (!requestedAt) return 'Unknown time'

    if (typeof requestedAt?.toDate === 'function') {
      return requestedAt.toDate().toLocaleString()
    }

    const parsed = new Date(requestedAt)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString()
    }

    return 'Unknown time'
  }

  const handleApprove = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await approveReroute(request.id, request.shipmentId)

      if (response.data.success) {
        setNewRoute(response.data.newRoute)
        setRouteTransition({
          previousRoute: response.data.excludedCurrentRoute ? `Route ${response.data.excludedCurrentRoute}` : 'Current route',
          newRoute: response.data.newRoute?.name || response.data.newRoute?.id || 'New route',
        })
        setApproved(true)
        
        // Automatically close modal after 2 seconds
        setTimeout(() => {
          onClose()
          onSuccess?.()
        }, 2000)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve reroute')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    setLoading(true)
    setError('')

    try {
      const rerouteRequestsCollection = collection(db, 'rerouteRequests')
      const requestRef = doc(rerouteRequestsCollection, request.id)
      
      await updateDoc(requestRef, { status: 'rejected' })
      
      onClose()
      onSuccess?.()
    } catch (err) {
      setError('Failed to reject request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-2xl border border-gray-700 max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-accent">Review Reroute Request</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        {approved && newRoute ? (
          // Success State
          <div className="space-y-4">
            <div className="p-4 rounded bg-green-900 bg-opacity-30 border border-green-500">
              <p className="text-green-300 font-bold mb-2">✅ Reroute Approved!</p>
              <p className="text-sm text-green-200">New route has been assigned to the driver.</p>
            </div>

            <div className="bg-gray-700 rounded p-4 space-y-2">
              {routeTransition && (
                <div className="flex justify-between text-sm pb-2 border-b border-gray-600">
                  <span className="text-gray-400">Route Change:</span>
                  <span className="text-white font-bold">
                    {routeTransition.previousRoute} -&gt; {routeTransition.newRoute}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">New ETA:</span>
                <span className="text-white font-bold">
                  {new Date(newRoute.updatedETA).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Risk Score:</span>
                <span className={`font-bold ${newRoute.riskScore < 0.3 ? 'text-green-400' : newRoute.riskScore < 0.6 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {(newRoute.riskScore * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Distance:</span>
                <span className="text-white">{newRoute.distance} km</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-accent hover:bg-accent-dark text-black rounded font-bold"
            >
              Done
            </button>
          </div>
        ) : (
          // Request Review State
          <div className="space-y-6">
            {/* Request Details */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Shipment ID:</span>
                <span className="text-white font-mono">{request.shipmentId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Driver Name:</span>
                <span className="text-white font-bold">{request.driverName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Reason:</span>
                <span className="text-yellow-300 font-semibold">{request.reason}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Location:</span>
                <span className="text-white">{request.locationText}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Requested At:</span>
                <span className="text-white">
                  {formatRequestedAt(request.requestedAt)}
                </span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-red-400 text-sm bg-red-900 bg-opacity-30 p-3 rounded">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-700">
              <button
                onClick={handleReject}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold disabled:opacity-50"
              >
                {loading ? '⟳ Processing...' : '✕ Reject'}
              </button>
              <button
                onClick={handleApprove}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? '⟳ Analyzing...' : '✓ Approve & Reroute'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RerouteApprovalModal
