import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
import L from 'leaflet'
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useToast } from '../components/Toast'
import TimelineComponent from '../components/TimelineComponent'
import { updateLocation, updateDriverStatus, submitRerouteRequest, updateDriverLocation } from '../utils/api'

// Fix Leaflet icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const DriverView = () => {
  const { shipmentId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [shipment, setShipment] = useState(null)
  const [loading, setLoading] = useState(true)
  const previousRouteIdRef = useRef(null)
  
  // GPS & Location tracking
  const [gpsEnabled, setGpsEnabled] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [driverStatus, setDriverStatus] = useState('Active')
  const [lastLocationUpdate, setLastLocationUpdate] = useState(null)
  const [inactiveTime, setInactiveTime] = useState(0)

  // Track previous route ID to detect changes
  const [previousRouteId, setPreviousRouteId] = useState(null)

  // Real-time Firestore listener
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'shipments', shipmentId), (doc) => {
      if (doc.exists()) {
        const data = doc.data()
        // Debug logging
        console.log('📦 Shipment loaded from Firestore:', {
          shipmentId: data.shipmentId,
          driverName: data.driverName,
          sourceCity: data.sourceCity,
          destinationCity: data.destinationCity,
          routeId: data.selectedRoute?.id,
          hasSelectedRoute: !!data.selectedRoute,
          hasCoordinates: !!data.selectedRoute?.coordinates,
          coordinatesLength: data.selectedRoute?.coordinates?.length || 0,
          hasTurnpoints: !!data.selectedRoute?.turnpoints,
          turnpointsCount: data.selectedRoute?.turnpoints?.length || 0,
          totalTurns: data.selectedRoute?.totalTurns || 0,
        })
        setShipment(data)
      } else {
        console.error('❌ Shipment not found:', shipmentId)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [shipmentId])

  // Detect route changes and show notification
  useEffect(() => {
    if (!shipment || !shipment.selectedRoute) return

    const currentRouteId = shipment.selectedRoute.id
    const previousRouteId = previousRouteIdRef.current
    
    // If route ID exists and changed (not on initial load)
    if (previousRouteId && previousRouteId !== currentRouteId) {
      console.log(`🔄 ROUTE CHANGED: ${previousRouteId} → ${currentRouteId}`)
      showToast(
        `🔄 Route updated to ${currentRouteId}\n⚠️ ${shipment.selectedRoute.riskLevel} Risk - ${shipment.selectedRoute.riskReason}`,
        'warning'
      )
    }
    
    // Update ref for next comparison
    previousRouteIdRef.current = currentRouteId
  }, [shipment?.selectedRoute?.id, showToast])

  // GPS Tracking
  useEffect(() => {
    if (!gpsEnabled || !shipmentId) return

    const sendLocation = () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords
            setCurrentLocation({ latitude, longitude })
            setLastLocationUpdate(new Date())
            
            try {
              // Send location to new real-time tracking endpoint
              await updateDriverLocation(shipmentId, latitude, longitude)
              console.log(`📍 Location sent: [${latitude}, ${longitude}]`)
            } catch (error) {
              console.error('Location update error:', error)
            }
          },
          (error) => {
            console.error('Geolocation error:', error)
            showToast('Unable to get location. Check permissions.', 'error')
          }
        )
      }
    }

    // Send location immediately
    sendLocation()

    // Then send every 30 seconds
    const interval = setInterval(sendLocation, 30000)
    return () => clearInterval(interval)
  }, [gpsEnabled, shipmentId, showToast])

  // Inactivity Detection
  useEffect(() => {
    if (!lastLocationUpdate) return

    const interval = setInterval(() => {
      const timeSinceUpdate = (new Date() - lastLocationUpdate) / 1000 / 60
      setInactiveTime(Math.floor(timeSinceUpdate))
      
      // If inactive for 5+ minutes, auto-update driver status
      if (timeSinceUpdate >= 5 && driverStatus === 'Active') {
        console.log('⏸️ Driver inactive for 5+ minutes')
        showToast('⏸️ You appear to be inactive', 'warning')
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [lastLocationUpdate, driverStatus, showToast])

  if (loading) {
    return (
      <div className="min-h-screen bg-navy text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold">Loading shipment...</p>
        </div>
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="min-h-screen bg-navy text-white flex items-center justify-center">
        <p className="text-red-500">Shipment not found</p>
      </div>
    )
  }

  const riskColor =
    shipment.currentRisk === 'High'
      ? 'red'
      : shipment.currentRisk === 'Medium'
        ? 'yellow'
        : 'green'
  const riskBgColor =
    shipment.currentRisk === 'High'
      ? 'bg-red-500'
      : shipment.currentRisk === 'Medium'
        ? 'bg-yellow-500'
        : 'bg-green-500'

  const handleStartNavigation = () => {
    if (!shipment.selectedRoute) {
      showToast('No route data available', 'error')
      return
    }
    
    try {
      let lat, lng
      
      // Try multiple coordinate formats
      if (shipment.selectedRoute.routePolyline && shipment.selectedRoute.routePolyline.length > 0) {
        // Use routePolyline format: {lat, lng}
        const lastPoint = shipment.selectedRoute.routePolyline[shipment.selectedRoute.routePolyline.length - 1]
        if (lastPoint && typeof lastPoint.lat === 'number' && typeof lastPoint.lng === 'number') {
          lat = lastPoint.lat
          lng = lastPoint.lng
        }
      }
      
      // Fallback to coordinates array format: [lng, lat]
      if (!lat || !lng) {
        if (!shipment.selectedRoute.coordinates || shipment.selectedRoute.coordinates.length === 0) {
          showToast('Route coordinates not available', 'error')
          return
        }
        
        const coords = shipment.selectedRoute.coordinates.filter(c => c && Array.isArray(c) && c.length >= 2)
        if (coords.length === 0) {
          showToast('Invalid coordinate format in route data', 'error')
          console.error('No valid coordinates found:', shipment.selectedRoute.coordinates)
          return
        }
        
        const lastCoord = coords[coords.length - 1]
        lng = lastCoord[0]
        lat = lastCoord[1]
      }
      
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        showToast('Coordinates must be numbers', 'error')
        return
      }
      
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      window.open(mapsUrl, '_blank')
      showToast('✅ Opening Google Maps...', 'success')
    } catch (error) {
      console.error('Navigation error:', error)
      showToast('Failed to open navigation: ' + error.message, 'error')
    }
  }

  const handleViewPass = () => {
    navigate(`/pass/${shipmentId}`)
  }

  const handleToggleGPS = async () => {
    if (!gpsEnabled) {
      if ('geolocation' in navigator) {
        setGpsEnabled(true)
        showToast('📍 GPS tracking enabled - Updates every 30 seconds', 'success')
      } else {
        showToast('Geolocation not supported by your device', 'error')
      }
    } else {
      setGpsEnabled(false)
      showToast('📍 GPS tracking disabled', 'info')
    }
  }

  const handleStatusChange = async (newStatus) => {
    try {
      await updateDriverStatus(shipmentId, newStatus, `Driver changed status to: ${newStatus}`)
      setDriverStatus(newStatus)
      showToast(`👤 Status updated to: ${newStatus}`, 'success')
    } catch (error) {
      showToast('Failed to update status: ' + error.message, 'error')
    }
  }

  const handleRequestReroute = async () => {
    if (!currentLocation) {
      showToast('GPS location required for reroute. Enable GPS first.', 'error')
      return
    }

    if (!window.confirm('Request reroute from your current location? The system will suggest an alternative route.')) {
      return
    }

    try {
      const reason = prompt('Why do you need a reroute? (e.g., "Route blocked", "Heavy traffic")')
      if (!reason || !reason.trim()) return

      const locationText = `Lat ${currentLocation.latitude.toFixed(5)}, Lng ${currentLocation.longitude.toFixed(5)}`

      await submitRerouteRequest(
        shipmentId,
        shipment?.driverId || shipment?.driverPhone || shipment?.driverName || `driver-${shipmentId}`,
        shipment?.driverName || 'Driver',
        reason.trim(),
        locationText,
        { lat: currentLocation.latitude, lng: currentLocation.longitude }
      )

      showToast('🚨 Reroute request submitted to notifications', 'success')
    } catch (error) {
      const backendMessage = error.response?.data?.error
      showToast('Failed to request reroute: ' + (backendMessage || error.message), 'error')
    }
  }

  // Map coordinates - convert from flat array [lng, lat, lng, lat, ...] to nested [lat, lng] arrays for Leaflet
  const coordinatesFlat = shipment.selectedRoute?.coordinates || []
  
  // Unflatten: [lng1, lat1, lng2, lat2] → [[lng1, lat1], [lng2, lat2]]
  const coordinatesNested = []
  for (let i = 0; i < coordinatesFlat.length; i += 2) {
    if (typeof coordinatesFlat[i] === 'number' && typeof coordinatesFlat[i + 1] === 'number') {
      coordinatesNested.push([coordinatesFlat[i], coordinatesFlat[i + 1]])
    }
  }
  
  // Convert from [lng, lat] to [lat, lng] for Leaflet
  const positions = coordinatesNested.map((coord) => {
    if (Array.isArray(coord) && coord.length >= 2) {
      return [coord[1], coord[0]] // Convert [lng, lat] to [lat, lng]
    }
    return null
  }).filter(p => p !== null)
  
  // Log for debugging
  console.log('🗺️ Map Debug:', {
    coordinatesFlatLength: coordinatesFlat.length,
    coordinatesNested: coordinatesNested.length,
    positionsCount: positions.length,
    firstCoordFlat: coordinatesFlat.slice(0, 4),
    firstCoordNested: coordinatesNested[0],
    firstPosition: positions[0],
  })
  
  // Calculate center as average of all positions
  const center = positions.length > 0 
    ? [
        positions.reduce((sum, pos) => sum + pos[0], 0) / positions.length,
        positions.reduce((sum, pos) => sum + pos[1], 0) / positions.length
      ]
    : [17.3, 78.4] // Hyderabad default

  return (
    <div className="min-h-screen text-white pb-32" style={{ backgroundColor: '#0a1628' }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-3xl font-bold" style={{ color: '#4CAF50' }}>🚚 Driver Navigation</h1>
          <div className="ml-auto flex items-center gap-4">
            {shipment?.selectedRoute && (
              <div className="text-sm px-3 py-1 rounded-full" style={{ backgroundColor: '#1e40af', color: '#3b82f6' }}>
                Current Route: <span className="font-bold">{shipment.selectedRoute.id}</span>
              </div>
            )}
            <p className="text-gray-400">Shipment ID: {shipment.shipmentId?.slice(0, 12)}...</p>
          </div>
        </div>

        {/* Two-column layout: Map (70%) + Details (30%) on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT: MAP - 70% */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Route Updated Banner - Show prominently when changed */}
            {shipment?.status === 'In Transit - Rerouted' && (
              <div className="rounded-lg p-4 mb-4 border-l-4 animate-pulse" style={{
                backgroundColor: 'rgba(34,197,94,0.15)',
                borderColor: '#22c55e'
              }}>
                <p className="font-bold flex items-center gap-2" style={{ color: '#86efac' }}>
                  🔄 Route Updated
                </p>
                <p className="text-sm mt-1" style={{ color: '#86efac' }}>
                  System switched you to Route {shipment.selectedRoute?.id} due to disruption
                </p>
                <p className="text-xs mt-2" style={{ color: '#86efac' }}>
                  ✅ New ETA: {new Date(shipment.updatedETA).toLocaleString()}
                </p>
              </div>
            )}
            
            {/* Risk Alert Banner */}
            {(shipment.currentRisk === 'Medium' || shipment.currentRisk === 'High') && (
              <div className="rounded-lg p-4 mb-4 border-l-4" style={{
                backgroundColor: shipment.currentRisk === 'High' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                borderColor: shipment.currentRisk === 'High' ? '#ef4444' : '#eab308'
              }}>
                <p className="font-bold flex items-center gap-2" style={{
                  color: shipment.currentRisk === 'High' ? '#fca5a5' : '#fde047'
                }}>
                  ⚠️ {shipment.currentRisk} Risk Alert
                </p>
                <p className="text-sm mt-2" style={{ color: shipment.currentRisk === 'High' ? '#fca5a5' : '#fde047' }}>
                  {shipment.riskReason}
                </p>
                {shipment.suggestedRoute && (
                  <p className="text-xs mt-2 font-semibold" style={{ color: shipment.currentRisk === 'High' ? '#fca5a5' : '#fde047' }}>
                    💡 {shipment.suggestedRoute}
                  </p>
                )}
              </div>
            )}

            {/* Map Container - 70% of screen */}
            {positions && positions.length > 0 ? (
              <div className="rounded-lg overflow-hidden border" style={{ borderColor: '#1e3a5f', height: '500px', backgroundColor: '#0d1f3c' }}>
                <MapContainer center={center} zoom={8} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  
                  {/* Layer 1: Planned Route Polyline - BLUE */}
                  <Polyline 
                    positions={positions} 
                    color="#378ADD"
                    weight={4} 
                    opacity={0.8}
                  />
                  
                  {/* Layer 2: Breadcrumb Trail - AMBER DASHED (driver's actual path) */}
                  {shipment.breadcrumbs && shipment.breadcrumbs.length > 1 && (
                    <Polyline 
                      positions={shipment.breadcrumbs.map(bc => [bc.lat, bc.lng])}
                      color="#EF9F27"
                      weight={3}
                      opacity={0.7}
                      dashArray="5, 5"
                    />
                  )}
                  
                  {/* Layer 3: Live Truck Marker - Current Position */}
                  {shipment.currentLat && shipment.currentLng && (
                    <Marker position={[shipment.currentLat, shipment.currentLng]}>
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold">🚚 Current Location</p>
                          <p className="text-xs text-gray-600">[{shipment.currentLat.toFixed(4)}, {shipment.currentLng.toFixed(4)}]</p>
                          <p className="text-xs text-gray-600">Last Update: {new Date(shipment.lastUpdated).toLocaleTimeString()}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  
                  {/* Start Marker */}
                  {positions.length > 0 && (
                    <Marker position={positions[0]}>
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold">🟢 Pickup: {shipment.sourceAddress}</p>
                          <p className="text-xs text-gray-600">{shipment.sourceCity}</p>
                          <p className="text-xs text-gray-600">Departure: {new Date(shipment.departureTime).toLocaleString()}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  
                  {/* End Marker */}
                  {positions.length > 0 && (
                    <Marker position={positions[positions.length - 1]}>
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold">🔴 Drop-off: {shipment.destinationAddress}</p>
                          <p className="text-xs text-gray-600">{shipment.destinationCity}</p>
                          <p className="text-xs text-gray-600">ETA: {new Date(shipment.updatedETA).toLocaleString()}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>
            ) : (
              <div className="rounded-lg overflow-hidden border p-8 text-center" style={{ borderColor: '#1e3a5f', height: '500px', backgroundColor: '#0d1f3c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <div>
                  <p className="text-yellow-400 mb-2 text-lg font-bold">⚠️ Route Map Unavailable</p>
                  <p className="text-gray-400 text-sm mb-4">The route coordinates were not stored when this shipment was created.</p>
                  <p className="text-gray-500 text-xs mb-2">Shipment ID: {shipment.shipmentId}</p>
                  <p className="text-gray-500 text-xs mb-2">📍 From: {shipment.sourceAddress}, {shipment.sourceCity}</p>
                  <p className="text-gray-500 text-xs mb-6">🎯 To: {shipment.destinationAddress}, {shipment.destinationCity}</p>
                  <button
                    onClick={() => showToast('Route recalculation coming soon. Contact support.', 'info')}
                    className="px-4 py-2 rounded text-sm font-bold bg-yellow-600 hover:bg-yellow-700 text-white transition"
                  >
                    🔄 Recalculate Route (Coming Soon)
                  </button>
                  <p className="text-gray-600 text-xs mt-4">However, the route details below are still accurate.</p>
                </div>
              </div>
            )}

            {/* Route Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-lg" style={{ backgroundColor: '#0d1f3c', border: '1px solid #1e3a5f' }}>
              <div>
                <p className="text-xs" style={{ color: '#8ba3c4' }}>📍 Distance</p>
                <p className="text-lg font-bold text-white">{shipment.selectedRoute?.distance || 'N/A'} km</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: '#8ba3c4' }}>⏱️ Duration</p>
                <p className="text-lg font-bold text-white">{shipment.selectedRoute?.duration || 'N/A'} min</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: '#8ba3c4' }}>📊 Risk Score</p>
                <p className="text-lg font-bold text-white">{shipment.selectedRoute?.riskScore || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: '#8ba3c4' }}>🎯 Cargo</p>
                <p className="text-lg font-bold text-white">{shipment.cargoType}</p>
              </div>
            </div>
          </div>

          {/* RIGHT: DETAILS - 30% */}
          <div className="space-y-4">
            
            {/* Status Card */}
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#0d1f3c', border: '1px solid #1e3a5f' }}>
              <p className="text-xs" style={{ color: '#8ba3c4' }}>Current Status</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-2xl font-bold">{shipment.status}</p>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  shipment.currentRisk === 'High' ? 'bg-red-500 text-white' :
                  shipment.currentRisk === 'Medium' ? 'bg-yellow-500 text-black' :
                  'bg-green-500 text-black'
                }`}>
                  {shipment.currentRisk} Risk
                </span>
              </div>
            </div>

            {/* Route Info Card */}
            <div className="p-4 rounded-lg space-y-3" style={{ backgroundColor: '#0d1f3c', border: '1px solid #1e3a5f' }}>
              <div>
                <p className="text-xs" style={{ color: '#8ba3c4' }}>📍 Pickup Location</p>
                <p className="font-bold text-sm">{shipment.sourceAddress || 'N/A'}</p>
                <p className="text-xs" style={{ color: '#8ba3c4' }}>{shipment.sourceCity}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: '#8ba3c4' }}>🎯 Drop-off Location</p>
                <p className="font-bold text-sm">{shipment.destinationAddress || 'N/A'}</p>
                <p className="text-xs" style={{ color: '#8ba3c4' }}>{shipment.destinationCity}</p>
              </div>
              <div className="pt-2 border-t" style={{ borderColor: '#1e3a5f' }}>
                <p className="text-xs" style={{ color: '#8ba3c4' }}>ETA</p>
                <p className="font-bold text-sm">{new Date(shipment.updatedETA).toLocaleString()}</p>
              </div>
            </div>

            {/* Shipment Details Card */}
            <div className="p-4 rounded-lg space-y-2 text-sm" style={{ backgroundColor: '#0d1f3c', border: '1px solid #1e3a5f' }}>
              <div>
                <p className="text-xs" style={{ color: '#8ba3c4' }}>Driver</p>
                <p className="font-bold">{shipment.driverName}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: '#8ba3c4' }}>Vehicle</p>
                <p className="font-bold">{shipment.vehicleNumber}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: '#8ba3c4' }}>From (Consignor)</p>
                <p className="font-bold text-xs">{shipment.consignorName}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: '#8ba3c4' }}>To (Consignee)</p>
                <p className="font-bold text-xs">{shipment.consigneeName}</p>
              </div>
              <div className="pt-2 border-t" style={{ borderColor: '#1e3a5f' }}>
                <p className="text-xs" style={{ color: '#8ba3c4' }}>Invoice</p>
                <p className="font-mono text-xs">{shipment.invoiceNumber}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Turn-by-Turn Instructions Section */}
        <div className="mt-8 p-6 rounded-lg" style={{ backgroundColor: '#0d1f3c', border: '1px solid #1e3a5f' }}>
          <h3 className="text-xl font-bold mb-4" style={{ color: '#4CAF50' }}>🛣️ Turn-by-Turn Directions</h3>
          
          {shipment.selectedRoute?.turnpoints && shipment.selectedRoute.turnpoints.length > 0 ? (
            <div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {shipment.selectedRoute.turnpoints.map((turn, idx) => (
                  <div key={idx} className="p-3 rounded border-l-4" style={{ backgroundColor: '#0a1628', borderColor: '#378ADD' }}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-blue-400">Step {turn.stepNumber}: {turn.instruction}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          📍 Distance: {(turn.distance / 1000).toFixed(2)} km | ⏱️ Duration: {Math.round(turn.duration / 60)} min
                        </p>
                        <p className="text-xs" style={{ color: '#8ba3c4' }} >
                          From start: {(turn.distanceFromStart / 1000).toFixed(1)} km | {Math.round(turn.durationFromStart / 60)} min
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-4">
                📊 Total turns: {shipment.selectedRoute.totalTurns || shipment.selectedRoute.turnpoints.length}
              </p>
            </div>
          ) : (
            <div className="p-4 rounded" style={{ backgroundColor: '#0a1628', borderColor: '#ff9800', border: '1px solid #ff9800' }}>
              <p className="text-sm text-yellow-400">
                ⚠️ No turnpoints available. 
                <br />Route: {shipment.selectedRoute?.name || 'N/A'}
                <br />Distance: {shipment.selectedRoute?.distance || 'N/A'} km
                <br />Duration: {shipment.selectedRoute?.duration || 'N/A'} min
              </p>
              <details className="mt-2 text-xs text-gray-400">
                <summary>Debug Info</summary>
                <pre className="mt-2 p-2 rounded" style={{ backgroundColor: '#0a0f18', overflow: 'auto' }}>
                  {JSON.stringify(shipment.selectedRoute, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>

        {/* Timeline Section - Full Width */}
        {shipment.history && shipment.history.length > 0 && (
          <div className="mt-8 p-6 rounded-lg" style={{ backgroundColor: '#0d1f3c', border: '1px solid #1e3a5f' }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: '#4CAF50' }}>📅 Shipment Timeline</h3>
            <TimelineComponent history={shipment.history} />
          </div>
        )}

        {/* Sticky Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 p-4 z-50" style={{ backgroundColor: '#0a1628', borderTop: '1px solid #1e3a5f' }}>
          <div className="max-w-6xl mx-auto">
            {/* Top Row - Main Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
              <button
                onClick={handleStartNavigation}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded transition text-sm"
              >
                🗺️ Start Navigation
              </button>
              <button
                onClick={handleViewPass}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded transition text-sm"
              >
                📋 View Pass
              </button>
              <button
                onClick={handleToggleGPS}
                className={`font-bold py-2 px-3 rounded transition text-sm ${
                  gpsEnabled
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-gray-600 hover:bg-gray-700'
                } text-white`}
              >
                📍 {gpsEnabled ? 'GPS ON' : 'GPS OFF'}
              </button>
              <button
                onClick={handleRequestReroute}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded transition text-sm"
              >
                🚨 Request Reroute
              </button>
            </div>

            {/* Bottom Row - Status Controls */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <button
                onClick={() => handleStatusChange('Active')}
                className={`font-bold py-2 px-3 rounded transition text-xs ${
                  driverStatus === 'Active'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}
              >
                ✅ Active
              </button>
              <button
                onClick={() => handleStatusChange('Break')}
                className={`font-bold py-2 px-3 rounded transition text-xs ${
                  driverStatus === 'Break'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}
              >
                ☕ Break
              </button>
              <button
                onClick={() => handleStatusChange('Sleep')}
                className={`font-bold py-2 px-3 rounded transition text-xs ${
                  driverStatus === 'Sleep'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}
              >
                😴 Sleep
              </button>
              <div className="bg-gray-800 rounded px-3 py-2 text-xs text-gray-400 flex items-center justify-between">
                <span>Inactive: {inactiveTime} min</span>
                {currentLocation && (
                  <span className="text-green-500 font-bold">📍 Located</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DriverView
