import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../config/firebase'
import { analyzeRoute, createShipment, deleteShipment, simulateDisruption } from '../utils/api'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import OptimalRouteMap from '../components/OptimalRouteMap'
import TurnByTurnInstructions from '../components/TurnByTurnInstructions'
import RerouteNotifications from '../components/RerouteNotifications'

const Dashboard = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { user } = useAuth()

  // Form state
  const [sourceCity, setSourceCity] = useState('Hyderabad')
  const [sourceAddress, setSourceAddress] = useState('')
  const [destinationCity, setDestinationCity] = useState('Visakhapatnam')
  const [destinationAddress, setDestinationAddress] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [cargoType, setCargoType] = useState('General')
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [consignorName, setConsignorName] = useState('')
  const [consigneeName, setConsigneeName] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')

  // Route analysis state
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [loading, setLoading] = useState(false)

  // Shipments state - filtered by current user
  const [shipments, setShipments] = useState([])

  // Real-time listener for shipments created by current user
  useEffect(() => {
    if (!user?.uid) return

    const q = query(collection(db, 'shipments'), where('createdBy', '==', user.uid))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allShips = []
      snapshot.forEach((doc) => {
        allShips.push({ id: doc.id, ...doc.data() })
      })
      
      // Filter for active shipments only
      // A shipment is active if it hasn't reached destination yet
      const activeShips = allShips.filter((shipment) => {
        // NEW LOGIC: Check location-based delivery status, not just time
        
        // If shipment is already delivered (location reached destination), exclude it
        if (shipment.isDelivered) {
          return false
        }
        
        // If delivery status is completed states, exclude from active
        const completedStatuses = ['delivered', 'delivered_late']
        if (completedStatuses.includes(shipment.deliveryStatus)) {
          return false
        }
        
        // If status field explicitly says completed/cancelled, exclude
        const status = shipment.status?.toLowerCase() || 'in transit'
        const excludedStatuses = ['completed', 'cancelled', 'rejected']
        if (excludedStatuses.includes(status)) {
          return false
        }
        
        // Everything else is active (In Transit or Delayed)
        return true
      })
      
      console.log('✅ Shipments loaded from Firestore:', {
        totalInDb: allShips.length,
        activeShipments: activeShips.length,
        shipmentDetails: activeShips.map(s => ({
          id: s.shipmentId,
          sourceCity: s.sourceCity || 'MISSING',
          destinationCity: s.destinationCity || 'MISSING',
          consignorName: s.consignorName || 'MISSING',
          driverName: s.driverName || 'MISSING',
          vehicleNumber: s.vehicleNumber || 'MISSING',
          allKeys: Object.keys(s),
        }))
      })
      
      // Debug: Show first shipment in detail
      if (activeShips.length > 0) {
        console.log('📊 FIRST SHIPMENT DETAILED:', activeShips[0])
      }
      
      setShipments(activeShips)
    })

    return () => unsubscribe()
  }, [user?.uid])

  const handleAnalyzeRoute = async () => {
    if (!sourceCity || !destinationCity || !departureTime) {
      showToast('Please fill in source city, destination city, and departure time', 'error')
      return
    }

    setLoading(true)
    showToast('⏳ Analyzing route... (may take 10-30 seconds)', 'info')
    
    try {
      const response = await analyzeRoute(sourceCity, destinationCity, departureTime)
      setRoutes(response.data.routes)
      setSelectedRoute(null)
      showToast('✅ Route analysis complete! Select your preferred route.', 'success')
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        showToast('Request timed out. Please check internet connection.', 'error')
      } else {
        showToast(error.message || 'Failed to analyze route', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateShipment = async () => {
    if (
      !sourceCity ||
      !sourceAddress ||
      !destinationCity ||
      !destinationAddress ||
      !selectedRoute ||
      !driverName ||
      !driverPhone ||
      !vehicleNumber ||
      !consignorName ||
      !consigneeName ||
      !invoiceNumber
    ) {
      showToast('Please fill in all shipment details including exact addresses and select a route', 'error')
      return
    }

    setLoading(true)
    try {
      // Debug: Log selectedRoute
      console.log('🚀 Sending selectedRoute to backend:', {
        name: selectedRoute.name,
        hasCoordinates: !!selectedRoute.coordinates,
        coordinatesLength: selectedRoute.coordinates?.length || 0,
        coordinates: selectedRoute.coordinates?.slice(0, 3), // Show first 3 coords
      })

      // Debug: Log exactly what we're sending
      console.log('📤 SENDING TO API:', {
        sourceCity,
        sourceAddress,
        destinationCity,
        destinationAddress,
        driverName,
        vehicleNumber,
        consignorName,
        consigneeName,
        invoiceNumber,
        selectedRouteId: selectedRoute?.id,
      })

      const response = await createShipment({
        sourceCity,
        sourceAddress,
        destinationCity,
        destinationAddress,
        cargoType,
        driverName,
        driverPhone,
        vehicleNumber,
        consignorName,
        consigneeName,
        invoiceNumber,
        selectedRoute,
        departureTime,
        createdBy: user.uid,
      })
      
      console.log('✅ Backend Response:', response.data)
      console.log('📊 Response has sourceCity?', !!response.data?.sourceCity)

      const shipmentId = response.data.shipmentId
      console.log('✅ Shipment created successfully!', {
        shipmentId,
        hasData: !!response.data,
        responseKeys: Object.keys(response.data),
      })
      
      const driverLink = `${window.location.origin}/driver/${shipmentId}`
      console.log('🔗 Driver Link Generated:', driverLink)
      
      const whatsappMessage = `🚚 RouteRadar Alert: Follow this optimized route from ${sourceAddress}, ${sourceCity} to ${destinationAddress}, ${destinationCity}. View your shipment here: ${driverLink}`
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`

      showToast(`✅ Shipment created! ID: ${shipmentId}`, 'success')

      // Reset form
      setSourceCity('Hyderabad')
      setSourceAddress('')
      setDestinationCity('Visakhapatnam')
      setDestinationAddress('')
      setDepartureTime('')
      setCargoType('General')
      setDriverName('')
      setDriverPhone('')
      setVehicleNumber('')
      setConsignorName('')
      setConsigneeName('')
      setInvoiceNumber('')
      setRoutes([])
      setSelectedRoute(null)

      // Open WhatsApp
      window.open(whatsappUrl, '_blank')
    } catch (error) {
      console.error('❌ Shipment creation failed:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      })
      
      // Show detailed error message
      if (error.response?.data?.missingFields) {
        showToast(`❌ Missing fields: ${error.response.data.missingFields.join(', ')}`, 'error')
      } else {
        showToast(error.response?.data?.error || error.message || 'Failed to create shipment', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
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

  const handleSimulateDisruption = async (shipmentId) => {
    if (!window.confirm('Simulate disruption on this route? The system will analyze new alternatives and switch to the safest route.')) {
      return
    }

    try {
      showToast('🔄 Analyzing alternative routes...', 'info')
      const response = await simulateDisruption(shipmentId)
      
      showToast(
        `✅ Rerouting Complete!\nSwitched from ${response.data.disruption.oldRoute} to ${response.data.disruption.newRoute}\n🎯 Risk Reduced by: ${response.data.disruption.riskReduction}`,
        'success'
      )
    } catch (error) {
      showToast(error.message || 'Failed to simulate disruption', 'error')
    }
  }

  return (
    <div className="min-h-screen text-white pt-4 pb-16" style={{ backgroundColor: '#0a1628' }}>
      {/* Warning Banner */}
      {shipments.some((s) => s.currentRisk === 'High') && (
        <div className="mb-6 p-4 rounded-lg font-bold text-center" style={{ backgroundColor: '#eab308', color: '#000' }}>
          ⚠️ WARNING: {shipments.filter((s) => s.currentRisk === 'High').length} shipment(s) have HIGH RISK status!
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Two Column Layout */}
        <div style={{ display: 'flex', gap: '24px' }}>
          {/* LEFT COLUMN - 65% - Create Delivery Form */}
          <div style={{ flex: '0 0 65%' }}>
            {/* Form Card */}
            <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: '#0d1f3c', border: '1px solid #1e3a5f' }}>
              <h2 className="text-2xl font-bold mb-6" style={{ color: '#4CAF50' }}>
                Create Delivery
              </h2>

              <div className="space-y-4">
                {/* Row 1: Source City & Address */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#8ba3c4' }}>
                      📍 Source City
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Hyderabad"
                      value={sourceCity}
                      onChange={(e) => setSourceCity(e.target.value)}
                      className="w-full rounded px-3 py-2 text-white focus:outline-none transition"
                      style={{
                        backgroundColor: '#0a1628',
                        borderColor: '#1e3a5f',
                        border: '1px solid #1e3a5f',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#4CAF50')}
                      onBlur={(e) => (e.target.style.borderColor = '#1e3a5f')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#8ba3c4' }}>
                      📮 Pickup Address (Street/Building)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Plot 42, Gachibowli, Beside IKEA"
                      value={sourceAddress}
                      onChange={(e) => setSourceAddress(e.target.value)}
                      className="w-full rounded px-3 py-2 text-white focus:outline-none transition"
                      style={{
                        backgroundColor: '#0a1628',
                        borderColor: '#1e3a5f',
                        border: '1px solid #1e3a5f',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#4CAF50')}
                      onBlur={(e) => (e.target.style.borderColor = '#1e3a5f')}
                    />
                  </div>
                </div>

                {/* Row 2: Destination City & Address */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#8ba3c4' }}>
                      🎯 Destination City
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Visakhapatnam"
                      value={destinationCity}
                      onChange={(e) => setDestinationCity(e.target.value)}
                      className="w-full rounded px-3 py-2 text-white focus:outline-none transition"
                      style={{
                        backgroundColor: '#0a1628',
                        borderColor: '#1e3a5f',
                        border: '1px solid #1e3a5f',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#4CAF50')}
                      onBlur={(e) => (e.target.style.borderColor = '#1e3a5f')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#8ba3c4' }}>
                      🏪 Drop-off Address (Street/Shop/Number)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Shop #5, Rajolibanda Main Street"
                      value={destinationAddress}
                      onChange={(e) => setDestinationAddress(e.target.value)}
                      className="w-full rounded px-3 py-2 text-white focus:outline-none transition"
                      style={{
                        backgroundColor: '#0a1628',
                        borderColor: '#1e3a5f',
                        border: '1px solid #1e3a5f',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#4CAF50')}
                      onBlur={(e) => (e.target.style.borderColor = '#1e3a5f')}
                    />
                  </div>
                </div>

                {/* Row 3: Departure & Cargo */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#8ba3c4' }}>
                      Departure Time
                    </label>
                    <input
                      type="datetime-local"
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                      className="w-full rounded px-3 py-2 text-white focus:outline-none transition"
                      style={{
                        backgroundColor: '#0a1628',
                        borderColor: '#1e3a5f',
                        border: '1px solid #1e3a5f',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#4CAF50')}
                      onBlur={(e) => (e.target.style.borderColor = '#1e3a5f')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#8ba3c4' }}>
                      Cargo Type
                    </label>
                    <select
                      value={cargoType}
                      onChange={(e) => setCargoType(e.target.value)}
                      className="w-full rounded px-3 py-2 text-white focus:outline-none transition"
                      style={{
                        backgroundColor: '#0a1628',
                        borderColor: '#1e3a5f',
                        border: '1px solid #1e3a5f',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#4CAF50')}
                      onBlur={(e) => (e.target.style.borderColor = '#1e3a5f')}
                    >
                      <option>General</option>
                      <option>Pharmaceutical</option>
                      <option>Perishable</option>
                      <option>Electronics</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#8ba3c4' }}>
                      Driver Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Ravi Kumar"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full rounded px-3 py-2 text-white focus:outline-none transition"
                      style={{
                        backgroundColor: '#0a1628',
                        borderColor: '#1e3a5f',
                        border: '1px solid #1e3a5f',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#4CAF50')}
                      onBlur={(e) => (e.target.style.borderColor = '#1e3a5f')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#8ba3c4' }}>
                      Driver Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="+91 XXXXX XXXXX"
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      className="w-full rounded px-3 py-2 text-white focus:outline-none transition"
                      style={{
                        backgroundColor: '#0a1628',
                        borderColor: '#1e3a5f',
                        border: '1px solid #1e3a5f',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#4CAF50')}
                      onBlur={(e) => (e.target.style.borderColor = '#1e3a5f')}
                    />
                  </div>
                </div>

                {/* Row 4: Vehicle & Invoice */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#8ba3c4' }}>
                      Vehicle Number
                    </label>
                    <input
                      type="text"
                      placeholder="TS09AB1234"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      className="w-full rounded px-3 py-2 text-white focus:outline-none transition"
                      style={{
                        backgroundColor: '#0a1628',
                        borderColor: '#1e3a5f',
                        border: '1px solid #1e3a5f',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#4CAF50')}
                      onBlur={(e) => (e.target.style.borderColor = '#1e3a5f')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#8ba3c4' }}>
                      Invoice / PO Number
                    </label>
                    <input
                      type="text"
                      placeholder="INV-2026-00142"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full rounded px-3 py-2 text-white focus:outline-none transition"
                      style={{
                        backgroundColor: '#0a1628',
                        borderColor: '#1e3a5f',
                        border: '1px solid #1e3a5f',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#4CAF50')}
                      onBlur={(e) => (e.target.style.borderColor = '#1e3a5f')}
                    />
                  </div>
                </div>

                {/* Row 5: Consignor & Consignee */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#8ba3c4' }}>
                      Consignor Name
                    </label>
                    <input
                      type="text"
                      placeholder="Sender / Company"
                      value={consignorName}
                      onChange={(e) => setConsignorName(e.target.value)}
                      className="w-full rounded px-3 py-2 text-white focus:outline-none transition"
                      style={{
                        backgroundColor: '#0a1628',
                        borderColor: '#1e3a5f',
                        border: '1px solid #1e3a5f',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#4CAF50')}
                      onBlur={(e) => (e.target.style.borderColor = '#1e3a5f')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#8ba3c4' }}>
                      Consignee Name
                    </label>
                    <input
                      type="text"
                      placeholder="Receiver"
                      value={consigneeName}
                      onChange={(e) => setConsigneeName(e.target.value)}
                      className="w-full rounded px-3 py-2 text-white focus:outline-none transition"
                      style={{
                        backgroundColor: '#0a1628',
                        borderColor: '#1e3a5f',
                        border: '1px solid #1e3a5f',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#4CAF50')}
                      onBlur={(e) => (e.target.style.borderColor = '#1e3a5f')}
                    />
                  </div>
                </div>

                {/* Analyze Route Button */}
                <button
                  onClick={handleAnalyzeRoute}
                  disabled={loading}
                  className="w-full font-bold py-3 rounded transition disabled:opacity-50"
                  style={{ backgroundColor: '#4CAF50', color: '#0a1628' }}
                >
                  {loading ? 'Analyzing...' : '📍 Analyze Route'}
                </button>
              </div>
            </div>

            {/* Route Cards */}
            {routes.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-4" style={{ color: '#4CAF50' }}>
                  Select a Route
                </h3>
                <div className="space-y-3">
                  {routes.map((route, idx) => (
                    <div
                      key={route.name}
                      className="rounded-lg p-4 cursor-pointer transition"
                      style={{
                        backgroundColor: '#0d1f3c',
                        borderColor: selectedRoute?.name === route.name ? '#4CAF50' : '#1e3a5f',
                        border: '2px solid',
                      }}
                      onClick={() => setSelectedRoute(route)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-lg" style={{ color: '#fff' }}>
                          Route {String.fromCharCode(65 + idx)}
                        </span>
                        <span
                          className="px-3 py-1 rounded text-sm font-bold text-black"
                          style={{
                            backgroundColor:
                              route.riskColor === 'green'
                                ? '#4CAF50'
                                : route.riskColor === 'yellow'
                                  ? '#FFD700'
                                  : '#ef4444',
                          }}
                        >
                          {route.riskLevel} Risk
                        </span>
                      </div>
                      <p className="text-sm mb-2" style={{ color: '#8ba3c4' }}>
                        📏 {route.distance} km • ⏱️ {route.duration} mins ETA
                      </p>
                      <p className="text-xs mb-3" style={{ color: '#8ba3c4' }}>
                        {route.riskReason}
                      </p>
                      <button
                        onClick={() => setSelectedRoute(route)}
                        className="w-full rounded py-2 font-semibold transition"
                        style={{ backgroundColor: '#4CAF50', color: '#0a1628' }}
                      >
                        Select Route
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create Shipment Button */}
            {routes.length > 0 && selectedRoute && (
              <button
                onClick={handleCreateShipment}
                disabled={loading}
                className="w-full font-bold py-3 rounded transition disabled:opacity-50 mb-6"
                style={{ backgroundColor: '#4CAF50', color: '#0a1628' }}
              >
                {loading ? 'Creating...' : '✅ Create Shipment & Send to Driver'}
              </button>
            )}

            {/* Map View */}
            {routes.length > 0 && (
              <OptimalRouteMap 
                routes={routes} 
                selectedRouteId={selectedRoute?.name}
                sourceAddress={sourceAddress}
                sourceCity={sourceCity}
                destinationAddress={destinationAddress}
                destinationCity={destinationCity}
              />
            )}

            {/* Turn-by-Turn Instructions - Display when route is selected */}
            {selectedRoute && (
              <div className="mt-6">
                <TurnByTurnInstructions 
                  route={selectedRoute} 
                  isVisible={true}
                />
              </div>
            )}
          </div>

          {/* RIGHT COLUMN - 35% - Split into Reroute Requests (top) and Active Shipments (bottom) */}
          <div style={{ flex: '0 0 35%' }}>
            <div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '20px',
                alignItems: 'stretch',
                height: '100%'
              }}
            >
              {/* Reroute Notifications Box */}
              <div 
                className="rounded-lg" 
                style={{ 
                  flex: 1,
                  backgroundColor: '#0d1f3c', 
                  border: '1px solid #1e3a5f',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'auto'
                }}
              >
                <RerouteNotifications />
              </div>

              {/* Active Shipments Box */}
              <div 
                className="rounded-lg" 
                style={{ 
                  flex: 1,
                  backgroundColor: '#0d1f3c', 
                  border: '1px solid #1e3a5f',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'auto'
                }}
              >
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex justify-between items-center" style={{ color: '#4CAF50' }}>
                    Active Shipments
                    <span className="text-sm font-normal" style={{ color: '#8ba3c4' }}>({shipments.length})</span>
                  </h3>

                  {shipments.length === 0 ? (
                    <p style={{ color: '#8ba3c4' }} className="text-center py-8">
                      No active shipments yet. Create one to get started!
                    </p>
                  ) : (
                    <>
                      <div className="space-y-3 mb-4">
                        {shipments.slice(0, 3).map((shipment) => (
                          <div key={shipment.id} className="rounded-lg p-3" style={{ backgroundColor: '#0a1628', border: '1px solid #1e3a5f' }}>
                            {/* High Risk Warning */}
                            {shipment.currentRisk === 'High' && (
                              <div className="mb-2 p-2 rounded text-xs font-bold text-center" style={{ backgroundColor: '#ef4444', color: '#fff' }}>
                                ⚠️ HIGH RISK
                              </div>
                            )}

                            {/* Route Info */}
                            <p className="text-xs font-bold mb-1" style={{ color: '#4CAF50' }}>
                              📍 {shipment.sourceCity || shipment.source || 'Unknown'} → {shipment.destinationCity || shipment.destination || 'Unknown'}
                            </p>

                            {/* Driver & Vehicle */}
                            <p className="text-xs mb-2" style={{ color: '#8ba3c4' }}>
                              👤 {shipment.driverName || 'N/A'} • 🚗 {shipment.vehicleNumber || 'N/A'}
                            </p>

                            {/* Status & Risk */}
                            <div className="flex gap-2 mb-2">
                              <span
                                className="px-2 py-1 rounded text-xs font-bold"
                                style={{
                                  backgroundColor: shipment.currentRisk === 'Low' ? '#4CAF50' : shipment.currentRisk === 'Medium' ? '#FFD700' : '#ef4444',
                                  color: '#000',
                                }}
                              >
                                {shipment.currentRisk} Risk
                              </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-3 gap-2">
                              <button
                                onClick={() => navigate(`/driver/${shipment.id}`)}
                                className="rounded py-2 text-xs font-bold transition"
                                style={{ backgroundColor: '#4CAF50', color: '#000' }}
                              >
                                🗺️ Open Driver Live
                              </button>
                              <button
                                onClick={() => navigate(`/pass/${shipment.id}`)}
                                className="rounded py-2 text-xs font-bold transition"
                                style={{ borderColor: '#4CAF50', border: '1px solid #4CAF50', color: '#4CAF50' }}
                              >
                                📋 View
                              </button>
                              <button
                                onClick={() => handleDeleteShipment(shipment.id)}
                                className="rounded py-2 text-xs font-bold transition hover:opacity-80"
                                style={{ backgroundColor: '#ef4444', color: '#fff' }}
                                title="Delete shipment"
                              >
                                ❌
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {shipments.length > 3 && (
                        <button
                          onClick={() => navigate('/shipments')}
                          className="w-full rounded py-2 text-xs font-bold transition"
                          style={{ borderColor: '#4CAF50', border: '1px solid #4CAF50', color: '#fff', backgroundColor: '#4CAF50' }}
                        >
                          View All Shipments →
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

export default Dashboard
