import { db } from '../config/firebase.js'
import { collection, doc, setDoc } from 'firebase/firestore'
import { v4 as uuidv4 } from 'uuid'

export const createShipmentHandler = async (req, res) => {
  try {
    const {
      sourceCity,
      sourceAddress,
      destinationCity,
      destinationAddress,
      cargoType,
      driverName,
      vehicleNumber,
      consignorName,
      consigneeName,
      invoiceNumber,
      selectedRoute,
      departureTime,
    } = req.body

    if (
      !sourceCity ||
      !sourceAddress ||
      !destinationCity ||
      !destinationAddress ||
      !cargoType ||
      !driverName ||
      !vehicleNumber ||
      !consignorName ||
      !consigneeName ||
      !invoiceNumber ||
      !selectedRoute
    ) {
      return res.status(400).json({ error: 'Missing required fields. Please include source and destination addresses.' })
    }

    // Debug logging
    console.log(`📦 Creating shipment with route:`, {
      routeName: selectedRoute.name,
      sourceLocation: `${sourceAddress}, ${sourceCity}`,
      destinationLocation: `${destinationAddress}, ${destinationCity}`,
      hasCoordinates: !!selectedRoute.coordinates,
      coordinatesLength: selectedRoute.coordinates?.length || 0,
    })

    const shipmentId = uuidv4()

    const shipmentData = {
      shipmentId,
      sourceCity,
      sourceAddress,
      destinationCity,
      destinationAddress,
      fullSourceAddress: `${sourceAddress}, ${sourceCity}`,
      fullDestinationAddress: `${destinationAddress}, ${destinationCity}`,
      cargoType,
      driverName,
      vehicleNumber,
      consignorName,
      consigneeName,
      invoiceNumber,
      selectedRoute: {
        name: selectedRoute.name,
        id: selectedRoute.name, // For reference tracking
        eta: selectedRoute.eta,
        distance: selectedRoute.distance,
        duration: selectedRoute.duration,
        riskScore: selectedRoute.riskScore,
        riskLevel: selectedRoute.riskLevel,
        riskReason: selectedRoute.riskReason,
        coordinates: selectedRoute.coordinates,
        // NEW: Store formatted polyline for map display
        routePolyline: selectedRoute.routePolyline || [],
      },
      status: 'In Transit',
      currentRisk: selectedRoute.riskLevel,
      riskReason: selectedRoute.riskReason,
      createdAt: new Date().toISOString(),
      departureTime,
      updatedETA: selectedRoute.eta,
      // NEW: Location tracking for accurate delivery status
      currentLocation: {
        lat: selectedRoute.coordinates?.[0]?.lat || 0,
        lng: selectedRoute.coordinates?.[0]?.lng || 0,
        name: sourceAddress,
        city: sourceCity,
        timestamp: new Date().toISOString(),
      },
      destinationLocation: {
        lat: selectedRoute.coordinates?.[selectedRoute.coordinates.length - 1]?.lat || 0,
        lng: selectedRoute.coordinates?.[selectedRoute.coordinates.length - 1]?.lng || 0,
        name: destinationAddress,
        city: destinationCity,
      },
      // Delivery tracking
      deliveredAt: null,
      deliveryStatus: 'in_progress', // in_progress | delayed | delivered | delivered_late
      isDelivered: false,
      // NEW: Real-time location fields for driver tracking
      currentLat: selectedRoute.coordinates?.[0]?.lat || 0,
      currentLng: selectedRoute.coordinates?.[0]?.lng || 0,
      breadcrumbs: [],
      lastUpdated: new Date().toISOString(),
    }

    // Debug: Log what we're saving
    console.log(`✅ Saving to Firestore with coordinates:`, {
      coordinatesLength: shipmentData.selectedRoute.coordinates?.length || 0,
      hasCoordinates: !!shipmentData.selectedRoute.coordinates,
      fullSourceAddress: shipmentData.fullSourceAddress,
      fullDestinationAddress: shipmentData.fullDestinationAddress,
    })

    const shipmentsCollection = collection(db, 'shipments')
    const shipmentRef = doc(shipmentsCollection, shipmentId)
    await setDoc(shipmentRef, shipmentData)

    console.log(`✅ Shipment created: ${shipmentId}`)

    res.json({ shipmentId, shipmentData })
  } catch (error) {
    console.error('Create shipment error:', error)
    res.status(500).json({ error: error.message })
  }
}
