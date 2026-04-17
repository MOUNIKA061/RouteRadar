import { db } from '../config/firebase.js'
import { collection, addDoc, Timestamp } from 'firebase/firestore'

export const requestRerouteHandler = async (req, res) => {
  try {
    const { shipmentId, driverId, driverName, reason, locationText, coordinates } = req.body

    // Validate required fields
    if (!shipmentId || !driverId || !driverName || !reason || !locationText) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Create reroute request document
    const rerouteRequestsCollection = collection(db, 'rerouteRequests')
    const newRequest = {
      shipmentId,
      driverId,
      driverName,
      reason,
      locationText,
      coordinates: coordinates || { lat: 0, lng: 0 },
      requestedAt: Timestamp.now(),
      status: 'pending',
      newRoute: null,
    }

    const docRef = await addDoc(rerouteRequestsCollection, newRequest)

    console.log(`📍 Reroute request created: ${docRef.id} for shipment ${shipmentId}`)

    res.json({
      success: true,
      requestId: docRef.id,
      request: newRequest,
    })
  } catch (error) {
    console.error('Request reroute error:', error)
    res.status(500).json({ error: error.message })
  }
}
