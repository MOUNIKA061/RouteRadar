import { db } from '../config/firebase.js'
import { collection, doc, getDoc } from 'firebase/firestore'

export const getShipmentHandler = async (req, res) => {
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

    res.json(shipmentSnap.data())
  } catch (error) {
    console.error('Get shipment error:', error)
    res.status(500).json({ error: error.message })
  }
}
