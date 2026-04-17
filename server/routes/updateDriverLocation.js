import { db } from '../config/firebase.js'
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore'

/**
 * Update driver's real-time location and breadcrumbs
 * POST /api/update-location
 * Body: { shipmentId, lat, lng }
 */
export const updateDriverLocationHandler = async (req, res) => {
  try {
    const { shipmentId, lat, lng } = req.body

    if (!shipmentId || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'Missing required fields: shipmentId, lat, lng' })
    }

    // Validate coordinate values
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Latitude and longitude must be numbers' })
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Invalid coordinate values' })
    }

    const shipmentRef = doc(db, 'shipments', shipmentId)
    const timestamp = Date.now()

    // Atomically update location and breadcrumbs
    await updateDoc(shipmentRef, {
      currentLat: lat,
      currentLng: lng,
      lastUpdated: serverTimestamp(),
      // Append to breadcrumbs array (this creates a trail of positions)
      breadcrumbs: arrayUnion({
        lat,
        lng,
        ts: timestamp,
      }),
    })

    console.log(`📍 Location updated - Shipment ${shipmentId}: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`)

    res.json({
      success: true,
      shipmentId,
      location: { lat, lng },
      timestamp,
    })
  } catch (error) {
    console.error('Update location error:', error)
    res.status(500).json({ error: error.message })
  }
}
