import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000, // 45 second timeout for route analysis
})

export const analyzeRoute = (source, destination, departureTime) =>
  api.post('/api/analyze-route', { source, destination, departureTime }, { timeout: 45000 })

export const createShipment = (shipmentData) =>
  api.post('/api/create-shipment', shipmentData, { timeout: 15000 })

export const simulateDisruption = (shipmentId) =>
  api.post(`/api/simulate-disruption/${shipmentId}`, {}, { timeout: 10000 })

export const getShipment = (shipmentId) =>
  api.get(`/api/shipment/${shipmentId}`, { timeout: 10000 })

export const deleteShipment = (shipmentId) =>
  api.delete(`/api/shipment/${shipmentId}`, { timeout: 10000 })

// New location & status tracking APIs
export const updateLocation = (shipmentId, latitude, longitude, driverStatus) =>
  api.put(`/api/update-location/${shipmentId}`, { latitude, longitude, driverStatus }, { timeout: 10000 })

// NEW: Driver location ping for real-time tracking with breadcrumbs
export const updateDriverLocation = (shipmentId, lat, lng) =>
  api.post('/api/update-location', { shipmentId, lat, lng }, { timeout: 10000 })

export const changeRoute = (shipmentId, newRoute, reason) =>
  api.post(`/api/change-route/${shipmentId}`, { newRoute, reason }, { timeout: 15000 })

export const updateDriverStatus = (shipmentId, status, reason) =>
  api.post(`/api/update-driver-status/${shipmentId}`, { status, reason }, { timeout: 10000 })

export const requestReroute = (shipmentId, currentLatitude, currentLongitude, reason) =>
  api.post(`/api/request-reroute/${shipmentId}`, { 
    currentLatitude, 
    currentLongitude, 
    reason 
  }, { timeout: 10000 })

// New reroute request system
export const submitRerouteRequest = (shipmentId, driverId, driverName, reason, locationText, coordinates) =>
  api.post('/api/request-reroute', { 
    shipmentId, 
    driverId, 
    driverName, 
    reason, 
    locationText, 
    coordinates 
  }, { timeout: 10000 })

export const approveReroute = (requestId, shipmentId) =>
  api.post('/api/approve-reroute', { requestId, shipmentId }, { timeout: 30000 })

// NEW: Location tracking for accurate delivery status
export const updateShipmentLocation = (shipmentId, latitude, longitude, timestamp) =>
  api.put(`/api/update-location/${shipmentId}`, { latitude, longitude, timestamp }, { timeout: 10000 })

export default api
