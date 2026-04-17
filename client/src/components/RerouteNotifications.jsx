import React, { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
import RerouteApprovalModal from './RerouteApprovalModal'

const RerouteNotifications = ({ hideBackground = false }) => {
  const [requests, setRequests] = useState([])
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [loading, setLoading] = useState(true)

  const formatRequestedTime = (requestedAt) => {
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

  const formatLocation = (request) => {
    if (request.locationText?.trim()) {
      return request.locationText
    }

    if (typeof request.coordinates?.lat === 'number' && typeof request.coordinates?.lng === 'number') {
      return `Lat ${request.coordinates.lat.toFixed(5)}, Lng ${request.coordinates.lng.toFixed(5)}`
    }

    return 'Location not provided'
  }

  useEffect(() => {
    // Listen to pending reroute requests in real-time
    const rerouteRequestsCollection = collection(db, 'rerouteRequests')
    const pendingQuery = query(
      rerouteRequestsCollection,
      where('status', '==', 'pending')
    )

    const unsubscribe = onSnapshot(
      pendingQuery,
      (snapshot) => {
        const requestsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        requestsList.sort((a, b) => {
          const aTime = a.requestedAt?.seconds || new Date(a.requestedAt || 0).getTime() / 1000 || 0
          const bTime = b.requestedAt?.seconds || new Date(b.requestedAt || 0).getTime() / 1000 || 0
          return bTime - aTime
        })

        setRequests(requestsList)
        setLoading(false)
      },
      (error) => {
        console.error('Error fetching reroute requests:', error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const handleApprovalSuccess = () => {
    setSelectedRequest(null)
    // Requests will automatically update via onSnapshot
  }

  if (loading) {
    return (
      <div className="p-6 text-gray-400 text-sm">
        Loading notifications...
      </div>
    )
  }

  return (
    <>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-accent flex items-center gap-2">
            🔔 Reroute Requests
            {requests.length > 0 && (
              <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                {requests.length}
              </span>
            )}
          </h2>
        </div>

        {requests.length === 0 ? (
          <p className="text-gray-500 text-sm">No pending requests</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {requests.map((request) => (
              <div
                key={request.id}
                className="p-4 rounded border-l-4 border-yellow-500 bg-yellow-900 bg-opacity-20 hover:bg-opacity-30 transition cursor-pointer"
                onClick={() => setSelectedRequest(request)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs font-bold text-gray-200">
                      📦 Shipment: {request.shipmentId || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      👤 {request.driverName || 'Unknown driver'}
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-500 text-black">
                    {(request.status || 'pending').toUpperCase()}
                  </span>
                </div>

                <p className="text-xs text-gray-300 mb-1">
                  🕒 {formatRequestedTime(request.requestedAt)}
                </p>
                <p className="text-xs text-gray-300 mb-1">
                  📍 {formatLocation(request)}
                </p>
                <p className="text-xs text-gray-400 mb-2">
                  ⚠️ {request.reason || 'No reason provided'}
                </p>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedRequest(request)
                  }}
                  className="w-full text-xs bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-1 rounded transition"
                >
                  ✓ Review
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedRequest && (
        <RerouteApprovalModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onSuccess={handleApprovalSuccess}
        />
      )}
    </>
  )
}

export default RerouteNotifications
