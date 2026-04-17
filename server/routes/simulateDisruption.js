import { db } from '../config/firebase.js'
import { collection, doc, getDoc, updateDoc } from 'firebase/firestore'

export const simulateDisruptionHandler = async (req, res) => {
  try {
    const { shipmentId } = req.params

    if (!shipmentId) {
      return res.status(400).json({ error: 'Shipment ID is required' })
    }

    const shipmentsCollection = collection(db, 'shipments')
    const shipmentRef = doc(shipmentsCollection, shipmentId)
    const shipmentSnap = await getDoc(shipmentRef)

    if (!shipmentSnap.exists()) {
      return res.status(404).json({ error: 'Shipment not found' })
    }

    const currentData = shipmentSnap.data()
    const originalETA = new Date(currentData.selectedRoute.eta)
    const delayedETA = new Date(originalETA.getTime() + 2 * 60 * 60 * 1000) // +2 hours

    const updateData = {
      currentRisk: 'High',
      status: 'Delayed',
      riskReason: 'Heavy rain detected + traffic surge on current route',
      updatedETA: delayedETA.toISOString(),
      suggestedRoute: 'Switch to alternate Route C for safer transit',
      disruptionSimulatedAt: new Date().toISOString(),
    }

    await updateDoc(shipmentRef, updateData)

    console.log(`⚠️ Disruption simulated for shipment: ${shipmentId}`)

    res.json({
      success: true,
      shipmentId,
      updates: updateData,
    })
  } catch (error) {
    console.error('Simulate disruption error:', error)
    res.status(500).json({ error: error.message })
  }
}
