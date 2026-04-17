import { db } from '../config/firebase.js'
import { doc, getDoc, updateDoc } from 'firebase/firestore'

/**
 * Helper: Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(coord1, coord2) {
  if (!coord1 || !coord2) return 0
  
  const R = 6371 // Earth's radius in km
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export const updateShipmentLocationHandler = async (req, res) => {
  try {
    const { shipmentId } = req.params
    const { latitude, longitude, timestamp } = req.body

    if (!shipmentId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Missing required fields: shipmentId, latitude, longitude' })
    }

    // Fetch current shipment
    const shipmentRef = doc(db, 'shipments', shipmentId)
    const shipmentSnapshot = await getDoc(shipmentRef)

    if (!shipmentSnapshot.exists()) {
      return res.status(404).json({ error: 'Shipment not found' })
    }

    const shipment = shipmentSnapshot.data()
    const currentLocation = { lat: latitude, lng: longitude }
    const destinationLocation = shipment.destinationLocation || {
      lat: shipment.selectedRoute?.coordinates?.[shipment.selectedRoute.coordinates.length - 1]?.lat || 0,
      lng: shipment.selectedRoute?.coordinates?.[shipment.selectedRoute.coordinates.length - 1]?.lng || 0,
    }

    // Calculate distance to destination
    const distanceToDestination = calculateDistance(currentLocation, destinationLocation)
    const DELIVERY_THRESHOLD_KM = 0.5 // Consider delivered if within 0.5 km of destination

    // Determine delivery status based on location AND time
    let deliveryStatus = 'in_progress'
    let isDelivered = false
    let deliveredAt = null

    const currentTime = new Date(timestamp || new Date()).getTime()
    const etaTime = new Date(shipment.selectedRoute?.eta).getTime()

    if (distanceToDestination <= DELIVERY_THRESHOLD_KM) {
      // Shipment has reached destination
      isDelivered = true
      deliveredAt = new Date().toISOString()

      if (currentTime <= etaTime) {
        deliveryStatus = 'delivered' // On time
      } else {
        deliveryStatus = 'delivered_late' // Late delivery
      }
    } else if (currentTime > etaTime) {
      // Shipment is delayed but not yet delivered
      deliveryStatus = 'delayed'
    }

    console.log(`📍 Location Update - Shipment ${shipmentId}:`, {
      currentLocation,
      destinationLocation,
      distanceToDestination: `${distanceToDestination.toFixed(2)} km`,
      deliveryStatus,
      isDelivered,
    })

    // Update shipment with new location and status
    await updateDoc(shipmentRef, {
      currentLocation: {
        lat: latitude,
        lng: longitude,
        timestamp: new Date().toISOString(),
      },
      deliveryStatus,
      isDelivered,
      deliveredAt,
      distanceToDestination: parseFloat(distanceToDestination.toFixed(2)),
    })

    res.json({
      success: true,
      shipmentId,
      deliveryStatus,
      isDelivered,
      distanceToDestination: parseFloat(distanceToDestination.toFixed(2)),
      currentLocation,
      destinationLocation,
    })
  } catch (error) {
    console.error('Update location error:', error)
    res.status(500).json({ error: error.message })
  }
}
