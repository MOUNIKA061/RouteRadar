import React from 'react'

const ActiveShipmentsPanel = ({ shipments, onSimulateDisruption, onRequestReroute }) => {
  // Calculate display status based on location and time
  const getDisplayStatus = (shipment) => {
    if (shipment.deliveryStatus === 'delayed') {
      return { label: '⏱️ Delayed', color: 'text-red-400', bgColor: 'bg-red-900' }
    }
    return { label: '🚗 In Transit', color: 'text-green-400', bgColor: 'bg-green-900' }
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 h-fit sticky top-8">
      <h2 className="text-xl font-bold mb-4 text-accent">📦 Active Shipments</h2>

      {shipments.length === 0 ? (
        <p className="text-gray-500">No active shipments yet</p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {shipments.map((shipment) => {
            const displayStatus = getDisplayStatus(shipment)
            return (
              <div
                key={shipment.shipmentId}
                className={`p-4 rounded border-l-4 ${
                  shipment.currentRisk === 'High'
                    ? 'border-red-500 bg-red-900 bg-opacity-20'
                    : shipment.currentRisk === 'Medium'
                      ? 'border-yellow-500 bg-yellow-900 bg-opacity-20'
                      : 'border-green-500 bg-green-900 bg-opacity-20'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    {/* ROUTE DISPLAY - GUARANTEED TO SHOW */}
                    <p className="text-base font-bold text-green-300 mb-2">
                      📍 {shipment.sourceCity || 'Unknown'} → {shipment.destinationCity || 'Unknown'}
                    </p>
                    
                    {/* Driver & Vehicle - ALWAYS SHOW */}
                    <p className="text-sm font-bold text-gray-300">
                      👤 {shipment.driverName || 'N/A'} • 🚗 {shipment.vehicleNumber || 'N/A'}
                    </p>
                    
                    {/* Sender Company - optional */}
                    {shipment.consignorName && (
                      <p className="text-xs text-blue-300 font-semibold mt-1">
                        🏢 {shipment.consignorName}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold text-black ${
                        shipment.currentRisk === 'High'
                          ? 'bg-red-500'
                          : shipment.currentRisk === 'Medium'
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                      }`}
                    >
                      {shipment.currentRisk} Risk
                    </span>
                    <span className={`text-xs font-semibold ${displayStatus.color}`}>
                      {displayStatus.label}
                    </span>
                  </div>
                </div>

                {shipment.deliveryStatus === 'delayed' && (
                  <p className="text-xs text-red-300 mb-2">
                    ⚠️ Delivery delayed — consider rerouting
                  </p>
                )}

                <p className="text-xs text-gray-400 mb-2">
                  ETA: {new Date(shipment.updatedETA).toLocaleTimeString()}
                </p>

                {shipment.distanceToDestination !== undefined && (
                  <p className="text-xs text-gray-400 mb-2">
                    📍 {shipment.distanceToDestination.toFixed(2)} km to destination
                  </p>
                )}

                <button
                  onClick={() => onRequestReroute?.(shipment)}
                  className="w-full text-xs bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-2 rounded transition"
                >
                  🔄 Request Reroute
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ActiveShipmentsPanel
