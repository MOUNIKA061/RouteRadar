import React from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Polyline, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet icon issue in Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const RouteAnalysisMap = ({ routes }) => {
  if (!routes || routes.length === 0) return null

  // Find first valid route with coordinates
  let positions = []
  for (const route of routes) {
    if (route.coordinates && Array.isArray(route.coordinates)) {
      // Filter valid coordinate pairs
      const validCoords = route.coordinates.filter(
        (coord) => Array.isArray(coord) && coord.length >= 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number'
      )
      if (validCoords.length > 0) {
        positions = validCoords.map((coord) => [coord[1], coord[0]])
        break
      }
    }
  }

  if (positions.length === 0) {
    return <div className="mt-6 rounded-lg bg-red-900/20 border border-red-700 p-4 text-red-300">No valid map data available</div>
  }

  // Calculate center
  const center = [
    positions.reduce((sum, pos) => sum + pos[0], 0) / positions.length,
    positions.reduce((sum, pos) => sum + pos[1], 0) / positions.length,
  ]

  const routeColors = ['#22c55e', '#eab308', '#ef4444'] // green, yellow, red

  return (
    <div className="mt-6 rounded-lg overflow-hidden border border-gray-800 h-96">
      <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        {routes.map((route, idx) => {
          // Safely handle coordinates
          const routeCoords = route.coordinates || []
          const validCoords = routeCoords.filter(
            (coord) => Array.isArray(coord) && coord.length >= 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number'
          )
          
          if (validCoords.length === 0) return null
          
          const positions = validCoords.map((coord) => [coord[1], coord[0]])
          return (
            <Polyline
              key={idx}
              positions={positions}
              color={routeColors[idx % routeColors.length]}
              weight={idx === 0 ? 4 : 2}
              opacity={idx === 0 ? 1 : 0.5}
            />
          )
        })}
      </MapContainer>
    </div>
  )
}

export default RouteAnalysisMap
