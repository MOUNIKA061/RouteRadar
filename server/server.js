import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

dotenv.config()

import { analyzeRouteHandler } from './routes/analyzeRoute.js'
import { createShipmentHandler } from './routes/createShipment.js'
import { simulateDisruptionHandler } from './routes/simulateDisruption.js'
import { getShipmentHandler } from './routes/getShipment.js'
import { requestRerouteHandler } from './routes/requestReroute.js'
import { approveRerouteHandler } from './routes/approveReroute.js'
import { updateShipmentLocationHandler } from './routes/updateShipmentLocation.js'
import { updateDriverLocationHandler } from './routes/updateDriverLocation.js'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

// Routes
app.post('/api/analyze-route', analyzeRouteHandler)
app.post('/api/create-shipment', createShipmentHandler)
app.post('/api/simulate-disruption/:shipmentId', simulateDisruptionHandler)
app.post('/api/request-reroute', requestRerouteHandler)
app.post('/api/approve-reroute', approveRerouteHandler)
app.get('/api/shipment/:shipmentId', getShipmentHandler)
app.put('/api/update-location/:shipmentId', updateShipmentLocationHandler)
app.post('/api/update-location', updateDriverLocationHandler)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' })
})

app.listen(PORT, () => {
  console.log(`🚀 RouteRadar Server running on http://localhost:${PORT}`)
})
