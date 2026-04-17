import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet icon issue in Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const OptimalRouteMap = ({ 
  routes = [], 
  selectedRouteId = null, 
  sourceAddress = '', 
  sourceCity = '',
  destinationAddress = '', 
  destinationCity = '' 
}) => {
  const mapRef = useRef(null)

  if (!routes || routes.length === 0) {
    return (
      <div className="mt-6 rounded-lg bg-red-900/20 border border-red-700 p-4 text-red-300">
        ⚠️ No route data available
      </div>
    )
  }

  // Find the selected route or use the first one
  const selectedRoute = selectedRouteId 
    ? routes.find(r => r.name === selectedRouteId) 
    : routes[0]

  if (!selectedRoute || !selectedRoute.coordinates || selectedRoute.coordinates.length === 0) {
    return (
      <div className="mt-6 rounded-lg bg-red-900/20 border border-red-700 p-4 text-red-300">
        ⚠️ Selected route has no geometry data
      </div>
    )
  }

  // Convert coordinates from [lng, lat] to [lat, lng] for Leaflet
  // AND ensure all coordinates are valid before adding to positions array
  const positions = selectedRoute.coordinates
    .filter(coord => {
      // Check if coordinate is an array with 2+ elements
      if (!Array.isArray(coord) || coord.length < 2) return false
      // Check if both are numbers
      if (typeof coord[0] !== 'number' || typeof coord[1] !== 'number') return false
      // Check if not NaN or Infinity
      if (!isFinite(coord[0]) || !isFinite(coord[1])) return false
      return true
    })
    .map(coord => [coord[1], coord[0]]) // Convert [lng, lat] to [lat, lng]

  if (positions.length === 0) {
    return (
      <div className="mt-6 rounded-lg bg-red-900/20 border border-red-700 p-4 text-red-300">
        ⚠️ No valid coordinates found in route
      </div>
    )
  }

  // Calculate center point as average of all positions
  const center = [
    positions.reduce((sum, pos) => sum + pos[0], 0) / positions.length,
    positions.reduce((sum, pos) => sum + pos[1], 0) / positions.length,
  ]

  // Get start and end points
  const startPoint = positions[0]
  const endPoint = positions[positions.length - 1]

  // Debug logging
  console.log('🗺️ OptimalRouteMap Rendering:', {
    selectedRoute: selectedRoute.name,
    coordinatesCount: selectedRoute.coordinates.length,
    validPositionsCount: positions.length,
    startPoint,
    endPoint,
    center,
    distance: selectedRoute.distance,
    duration: selectedRoute.duration,
  })

  return (
    <div className="mt-6 rounded-lg overflow-hidden border border-gray-800 h-96 bg-gray-900">
      <MapContainer center={center} zoom={8} style={{ height: '100%', width: '100%' }} ref={mapRef}>
        {/* Base Map Layer */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Main Route Polyline - BLUE, Road-snapped geometry */}
        <Polyline
          positions={positions}
          color="#378ADD"
          weight={5}
          opacity={0.85}
          lineCap="round"
          lineJoin="round"
        />

        {/* Start Marker - Pickup Address */}
        <Marker position={startPoint}>
          <Popup>
            <div className="text-sm">
              <p className="font-bold text-green-600">📍 PICKUP</p>
              <p className="text-sm">{sourceAddress}</p>
              <p className="text-xs text-gray-600">{sourceCity}</p>
              <p className="text-xs text-gray-500 mt-1">Start of Route</p>
            </div>
          </Popup>
        </Marker>

        {/* End Marker - Drop-off Address */}
        <Marker position={endPoint}>
          <Popup>
            <div className="text-sm">
              <p className="font-bold text-red-600">🎯 DROP-OFF</p>
              <p className="text-sm">{destinationAddress}</p>
              <p className="text-xs text-gray-600">{destinationCity}</p>
              <p className="text-xs text-gray-500 mt-1">End of Route</p>
            </div>
          </Popup>
        </Marker>

        {/* Intermediate waypoints - Optional visualization */}
        {positions.length > 2 && (
          <>
            {/* Show a marker at 25% progress */}
            {positions[Math.floor(positions.length * 0.25)] && (
              <Marker 
                position={positions[Math.floor(positions.length * 0.25)]}
                title="25% Progress"
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold">🛣️ Progress: 25%</p>
                    <p>Distance: {(selectedRoute.distance * 0.25).toFixed(2)} km</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Show a marker at 50% progress (midpoint) */}
            {positions[Math.floor(positions.length * 0.5)] && (
              <Marker 
                position={positions[Math.floor(positions.length * 0.5)]}
                title="50% - Midpoint"
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold">🛣️ Midpoint: 50%</p>
                    <p>Distance: {(selectedRoute.distance * 0.5).toFixed(2)} km</p>
                    <p>Time: {Math.floor(selectedRoute.duration * 0.5)} min</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Show a marker at 75% progress */}
            {positions[Math.floor(positions.length * 0.75)] && (
              <Marker 
                position={positions[Math.floor(positions.length * 0.75)]}
                title="75% Progress"
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold">🛣️ Progress: 75%</p>
                    <p>Distance: {(selectedRoute.distance * 0.75).toFixed(2)} km</p>
                  </div>
                </Popup>
              </Marker>
            )}
          </>
        )}
      </MapContainer>

      {/* Info Banner Below Map */}
      <div className="bg-gray-800 px-4 py-3 text-sm" style={{ color: '#8ba3c4' }}>
        <div className="flex justify-between items-center">
          <div>
            <span className="font-bold text-white">Route: {selectedRoute.name}</span>
            <span className="ml-4">📍 {selectedRoute.distance} km</span>
            <span className="ml-4">⏱️ {selectedRoute.duration} min</span>
          </div>
          <div className={`px-3 py-1 rounded text-xs font-bold ${
            selectedRoute.riskLevel === 'High' ? 'bg-red-500 text-white' :
            selectedRoute.riskLevel === 'Medium' ? 'bg-yellow-500 text-black' :
            'bg-green-500 text-black'
          }`}>
            {selectedRoute.riskLevel} Risk
          </div>
        </div>
      </div>
    </div>
  )
}

export default OptimalRouteMap
