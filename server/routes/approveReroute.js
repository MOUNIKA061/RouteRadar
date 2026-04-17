import { db } from '../config/firebase.js'
import { collection, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { analyzeRouteHandler } from './analyzeRoute.js'

export const approveRerouteHandler = async (req, res) => {
  try {
    const { requestId, shipmentId } = req.body

    if (!requestId || !shipmentId) {
      return res.status(400).json({ error: 'Request ID and Shipment ID are required' })
    }

    // Get the reroute request
    const rerouteRequestsCollection = collection(db, 'rerouteRequests')
    const requestRef = doc(rerouteRequestsCollection, requestId)
    const requestSnap = await getDoc(requestRef)

    if (!requestSnap.exists()) {
      return res.status(404).json({ error: 'Reroute request not found' })
    }

    const requestData = requestSnap.data()

    // Get the shipment to get source and destination
    const shipmentsCollection = collection(db, 'shipments')
    const shipmentRef = doc(shipmentsCollection, shipmentId)
    const shipmentSnap = await getDoc(shipmentRef)

    if (!shipmentSnap.exists()) {
      return res.status(404).json({ error: 'Shipment not found' })
    }

    const shipmentData = shipmentSnap.data()

    // Call analyzeRoute to get alternatives (mock call structure)
    // In real scenario, you'd call the actual analyzeRoute logic
    const routeAnalysis = {
      success: true,
      routes: [
        {
          id: 'route_best',
          distance: 245,
          duration: 150,
          coordinates: [],
          riskScore: 0.2,
          weatherConditions: 'Clear skies',
          eta: new Date(Date.now() + 180 * 60000).toISOString(),
        },
        {
          id: 'route_alt1',
          distance: 268,
          duration: 165,
          coordinates: [],
          riskScore: 0.35,
          weatherConditions: 'Light rain',
          eta: new Date(Date.now() + 195 * 60000).toISOString(),
        },
        {
          id: 'route_alt2',
          distance: 289,
          duration: 180,
          coordinates: [],
          riskScore: 0.5,
          weatherConditions: 'Heavy rain',
          eta: new Date(Date.now() + 210 * 60000).toISOString(),
        },
      ],
    }

    // Select the best route (lowest risk score)
    const bestRoute = routeAnalysis.routes.reduce((best, route) =>
      route.riskScore < best.riskScore ? route : best
    )

    // Update the reroute request with approval and new route
    await updateDoc(requestRef, {
      status: 'approved',
      newRoute: {
        routeId: bestRoute.id,
        distance: bestRoute.distance,
        duration: bestRoute.duration,
        updatedETA: bestRoute.eta,
        riskScore: bestRoute.riskScore,
        weatherConditions: bestRoute.weatherConditions,
      },
      approvedAt: Timestamp.now(),
    })

    // Update the shipment with new route info
    await updateDoc(shipmentRef, {
      selectedRoute: {
        ...shipmentData.selectedRoute,
        eta: bestRoute.eta,
        distance: bestRoute.distance,
        duration: bestRoute.duration,
      },
      currentRisk: bestRoute.riskScore < 0.3 ? 'Low' : bestRoute.riskScore < 0.6 ? 'Medium' : 'High',
      lastRerouteRequest: requestId,
      lastRerouteApprovedAt: Timestamp.now(),
    })

    console.log(`✅ Reroute approved for shipment: ${shipmentId}`)

    res.json({
      success: true,
      requestId,
      newRoute: bestRoute,
      update: {
        updatedETA: bestRoute.eta,
        riskScore: bestRoute.riskScore,
        riskLevel: bestRoute.riskScore < 0.3 ? 'Low' : bestRoute.riskScore < 0.6 ? 'Medium' : 'High',
      },
    })
  } catch (error) {
    console.error('Approve reroute error:', error)
    res.status(500).json({ error: error.message })
  }
}
