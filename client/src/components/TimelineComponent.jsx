import React from 'react'

export default function TimelineComponent({ history = [] }) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        <p>No history available</p>
      </div>
    )
  }

  // Sort by timestamp descending (most recent first)
  const sortedHistory = [...history].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  )

  const getStatusColor = (status) => {
    const lowerStatus = status?.toLowerCase() || ''
    switch (lowerStatus) {
      case 'created':
        return 'bg-blue-500'
      case 'in transit':
      case 'upcoming':
        return 'bg-yellow-500'
      case 'delayed':
        return 'bg-red-500'
      case 'delivered':
        return 'bg-green-500'
      case 'routechanged':
        return 'bg-purple-500'
      case 'driverstatuschanged':
        return 'bg-indigo-500'
      case 'inactive':
        return 'bg-orange-500'
      case 'rerouterequested':
        return 'bg-pink-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusBgLight = (status) => {
    const lowerStatus = status?.toLowerCase() || ''
    switch (lowerStatus) {
      case 'created':
        return 'bg-blue-50'
      case 'in transit':
      case 'upcoming':
        return 'bg-yellow-50'
      case 'delayed':
        return 'bg-red-50'
      case 'delivered':
        return 'bg-green-50'
      case 'routechanged':
        return 'bg-purple-50'
      case 'driverstatuschanged':
        return 'bg-indigo-50'
      case 'inactive':
        return 'bg-orange-50'
      case 'rerouterequested':
        return 'bg-pink-50'
      default:
        return 'bg-gray-50'
    }
  }

  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch (e) {
      return isoString
    }
  }

  return (
    <div className="relative">
      {/* Timeline container */}
      <div className="space-y-6">
        {sortedHistory.map((event, index) => (
          <div key={index} className="flex gap-4">
            {/* Timeline dot and connector */}
            <div className="flex flex-col items-center">
              {/* Dot */}
              <div
                className={`w-6 h-6 rounded-full ${getStatusColor(
                  event.status
                )} border-4 border-gray-900 shadow-lg relative z-10`}
              />
              {/* Connecting line (only if not last item) */}
              {index < sortedHistory.length - 1 && (
                <div className="w-1 h-12 bg-gray-600 mt-2" />
              )}
            </div>

            {/* Event content */}
            <div className={`flex-1 p-4 rounded-lg ${getStatusBgLight(event.status)} border-l-4 ${
              event.status?.toLowerCase() === 'delayed' 
                ? 'border-red-500' 
                : event.status?.toLowerCase() === 'delivered'
                ? 'border-green-500'
                : event.status?.toLowerCase() === 'created'
                ? 'border-blue-500'
                : 'border-yellow-500'
            }`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 capitalize flex items-center gap-2">
                    {event.status?.toLowerCase() === 'routechanged' && '🔄'}
                    {event.status?.toLowerCase() === 'driverstatuschanged' && '👤'}
                    {event.status?.toLowerCase() === 'inactive' && '⏸️'}
                    {event.status?.toLowerCase() === 'rerouterequested' && '🚨'}
                    {event.status || 'Unknown'}
                  </h4>
                  <p className="text-sm text-gray-700 mt-1">
                    {event.message || event.note || 'No additional information'}
                  </p>
                  
                  {/* Route Change Details */}
                  {event.status?.toLowerCase() === 'routechanged' && event.previousRoute && event.newRoute && (
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-red-100 p-2 rounded">
                        <p className="font-bold text-red-800">Previous</p>
                        <p className="text-red-700">{event.previousRoute.name}</p>
                        <p className="text-red-600">{event.previousRoute.distance} km</p>
                      </div>
                      <div className="bg-green-100 p-2 rounded">
                        <p className="font-bold text-green-800">New Route</p>
                        <p className="text-green-700">{event.newRoute.name}</p>
                        <p className="text-green-600">{event.newRoute.distance} km</p>
                      </div>
                    </div>
                  )}

                  {/* Location Info */}
                  {event.location && (
                    <p className="text-xs text-gray-600 mt-2">
                      📍 Location: [{event.location.latitude.toFixed(2)}, {event.location.longitude.toFixed(2)}]
                    </p>
                  )}

                  {/* Current Location Info for Reroute */}
                  {event.currentLocation && (
                    <p className="text-xs text-gray-600 mt-2">
                      📍 Current: [{event.currentLocation.latitude.toFixed(2)}, {event.currentLocation.longitude.toFixed(2)}]
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2 italic">
                {formatDate(event.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
