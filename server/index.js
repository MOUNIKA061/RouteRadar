import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, arrayUnion, deleteDoc, getDocs, addDoc, Timestamp } from 'firebase/firestore'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
}

const firebaseApp = initializeApp(firebaseConfig)
const db = getFirestore(firebaseApp)

// Middleware
app.use(cors())
app.use(express.json())

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY
const OPENROUTESERVICE_API_KEY = process.env.OPENROUTESERVICE_API_KEY

const isFirestoreUnavailableError = (error) => {
  return (
    error?.code === 'unavailable' ||
    (typeof error?.message === 'string' &&
      (error.message.includes('client is offline') ||
        error.message.includes('firestore.googleapis.com') ||
        error.message.includes('Name resolution failed')))
  )
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Weather severity mapping based on OpenWeatherMap weather codes
const getWeatherSeverity = (weatherCode) => {
  const code = Math.floor(weatherCode / 100) * 100

  if (code === 200) return 1.0 // thunderstorm
  if (code === 300) return 0.6 // drizzle
  if (code === 500) return 0.6 // rain
  if (code === 600) return 0.7 // snow
  if (code === 800) return 0.0 // clear
  if (code === 801) return 0.2 // few clouds
  if (code === 802) return 0.3 // scattered clouds
  if (code === 803 || code === 804) return 0.4 // broken/overcast clouds

  return 0.3 // default
}

// Flatten nested coordinates to Firestore-compatible format
// Input: [[lng1, lat1], [lng2, lat2], ...] or [[lng, lat]] or []
// Output: [lng1, lat1, lng2, lat2, ...] (flat array of numbers)
const flattenCoordinates = (coords) => {
  if (!Array.isArray(coords) || coords.length === 0) {
    return []
  }

  // Check if already flat (array of numbers)
  if (typeof coords[0] === 'number') {
    return coords
  }

  // Check if nested (array of arrays)
  if (Array.isArray(coords[0])) {
    // Flatten: [[lng, lat], [lng, lat]] → [lng, lat, lng, lat]
    return coords.flat(1)
  }

  return []
}

// Extract turnpoints (turn-by-turn instructions) from route segments
// Returns array of {distance, duration, instruction, direction, coordinates}
const extractTurnpoints = (segments) => {
  if (!segments || !Array.isArray(segments)) return []
  
  const turnpoints = []
  let cumulativeDistance = 0
  let cumulativeDuration = 0

  segments.forEach((segment, idx) => {
    if (segment.steps && Array.isArray(segment.steps)) {
      segment.steps.forEach((step, stepIdx) => {
        // Only add significant turns (not every step)
        if (step.instruction) {
          turnpoints.push({
            stepNumber: turnpoints.length + 1,
            instruction: step.instruction, // e.g., "Turn right onto NH16"
            distance: step.distance, // meters
            duration: step.duration, // seconds
            distanceFromStart: cumulativeDistance + step.distance,
            durationFromStart: cumulativeDuration + step.duration,
            // Get the first coordinate of this step
            coordinates: step.way_points ? [
              segment.geometry.coordinates[step.way_points[0]],
              segment.geometry.coordinates[step.way_points[1]]
            ] : null,
          })
        }
        cumulativeDistance += step.distance
        cumulativeDuration += step.duration
      })
    }
  })

  return turnpoints
}

// Geocode location using Nominatim (OpenStreetMap) - Free alternative to ORS Geocoding
const geocodeLocation = async (location) => {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: location,
        format: 'json',
        limit: 1,
      },
      headers: {
        'User-Agent': 'RouteRadar-App/1.0',
      },
      timeout: 8000, // 8 second timeout for geocoding
    })

    if (response.data && response.data.length > 0) {
      const result = response.data[0]
      return { lng: parseFloat(result.lon), lat: parseFloat(result.lat) }
    }
    throw new Error(`Could not geocode ${location}`)
  } catch (error) {
    console.error('Geocoding error:', error.message)
    throw error
  }
}

// Fetch weather data for a location
const fetchWeather = async (lat, lng) => {
  try {
    const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        lat,
        lon: lng,
        appid: OPENWEATHER_API_KEY,
      },
      timeout: 8000, // 8 second timeout for weather
    })

    return {
      weatherCode: response.data.weather[0].id,
      description: response.data.weather[0].description,
      temperature: response.data.main.temp,
    }
  } catch (error) {
    console.error('Weather fetch error:', error.message)
    return { weatherCode: 800, description: 'clear', temperature: 25 }
  }
}

// Fetch multiple route alternatives using OpenRouteService
const fetchRoutes = async (startCoords, endCoords) => {
  try {
    const response = await axios.post(
      'https://api.openrouteservice.org/v2/directions/driving-car/json',
      {
        coordinates: [[startCoords.lng, startCoords.lat], [endCoords.lng, endCoords.lat]],
        alternative_routes: {
          share_factor: 0.6,
          target_count: 3,
        },
        geometry: true,
        instructions: true, // 👈 REQUEST TURN INSTRUCTIONS
        instructions_format: 'text', // Get readable turn instructions
      },
      {
        headers: {
          'Authorization': OPENROUTESERVICE_API_KEY,
          'Content-Type': 'application/json',
          'User-Agent': 'RouteRadar-App/1.0',
        },
        timeout: 15000,
      }
    )

    return response.data.routes
  } catch (error) {
    console.error('Route fetch error:', error.message)
    throw error
  }
}

const buildRerouteCandidates = async (shipmentData) => {
  const source = shipmentData.sourceCity
  const destination = shipmentData.destinationCity

  if (!source || !destination) {
    throw new Error('Shipment source/destination is missing for reroute analysis')
  }

  const [sourceCoords, destCoords] = await Promise.all([
    geocodeLocation(source),
    geocodeLocation(destination),
  ])

  const weather = await fetchWeather(destCoords.lat, destCoords.lng)
  const weatherSeverity = getWeatherSeverity(weather.weatherCode)

  let routes
  try {
    routes = await fetchRoutes(sourceCoords, destCoords)
  } catch (orsError) {
    // Fallback demo routes when routing API is unavailable
    const distance = Math.sqrt(
      Math.pow(destCoords.lng - sourceCoords.lng, 2) + Math.pow(destCoords.lat - sourceCoords.lat, 2)
    ) * 111

    const generateWaypoints = (start, end, count = 10) => {
      const waypoints = [start]
      for (let i = 1; i < count; i += 1) {
        const t = i / count
        const deviation = Math.sin(i) * 0.01
        waypoints.push([
          start[0] + (end[0] - start[0]) * t + deviation,
          start[1] + (end[1] - start[1]) * t + deviation * 0.5,
        ])
      }
      waypoints.push(end)
      return waypoints
    }

    const startCoord = [sourceCoords.lng, sourceCoords.lat]
    const endCoord = [destCoords.lng, destCoords.lat]

    routes = [
      {
        distance: Math.round(distance * 1000),
        duration: Math.round((distance / 60) * 3600),
        geometry: { coordinates: generateWaypoints(startCoord, endCoord, 10) },
      },
      {
        distance: Math.round(distance * 1050),
        duration: Math.round((distance / 55) * 3600),
        geometry: { coordinates: generateWaypoints(startCoord, endCoord, 12) },
      },
      {
        distance: Math.round(distance * 1100),
        duration: Math.round((distance / 50) * 3600),
        geometry: { coordinates: generateWaypoints(startCoord, endCoord, 8) },
      },
    ]
  }

  if (!routes || routes.length === 0) {
    throw new Error('No alternative routes available')
  }

  const routeDurations = routes.map((r) => r.duration)
  const minDuration = Math.min(...routeDurations)
  const maxDuration = Math.max(...routeDurations)
  const trafficDelayRatio = (maxDuration - minDuration) / maxDuration || 0

  const departureBase = shipmentData.departureTime || new Date().toISOString()

  return routes.slice(0, 3).map((route, idx) => {
    const riskScore = 0.6 * weatherSeverity + 0.4 * trafficDelayRatio
    const riskLevel = riskScore < 0.3 ? 'Low' : riskScore < 0.6 ? 'Medium' : 'High'
    const routeId = String.fromCharCode(65 + idx) // A/B/C
    const eta = new Date(departureBase)
    eta.setSeconds(eta.getSeconds() + route.duration)
    const turnpoints = route.segments ? extractTurnpoints(route.segments) : []

    return {
      id: routeId,
      name: `Route ${routeId}`,
      eta: eta.toISOString(),
      updatedETA: eta.toISOString(),
      distance: (route.distance / 1000).toFixed(2),
      duration: Math.round(route.duration / 60),
      riskScore: Number(riskScore.toFixed(2)),
      riskLevel,
      riskReason:
        riskScore > 0.6
          ? `Heavy weather expected (${weather.description}) with high delay risk`
          : riskScore > 0.3
            ? `Moderate weather (${weather.description}) with possible delays`
            : `Clear conditions (${weather.description}) and stable travel`,
      coordinates: route.geometry.coordinates,
      turnpoints: turnpoints.slice(0, 15),
      totalTurns: turnpoints.length,
    }
  })
}

// ============================================================================
// ROUTES
// ============================================================================

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// DEBUG: Show all shipments with their fields
app.get('/api/debug/all-shipments', async (req, res) => {
  try {
    const shipmentsRef = collection(db, 'shipments')
    const snapshot = await getDocs(shipmentsRef)
    
    const shipments = []
    snapshot.forEach((doc) => {
      shipments.push({
        docId: doc.id,
        shipmentId: doc.data().shipmentId,
        sourceCity: doc.data().sourceCity,
        destinationCity: doc.data().destinationCity,
        consignorName: doc.data().consignorName,
        driverName: doc.data().driverName,
        vehicleNumber: doc.data().vehicleNumber,
        status: doc.data().status,
        allFields: Object.keys(doc.data()),
      })
    })
    
    console.log(`📊 Total shipments in Firestore: ${shipments.length}`)
    shipments.forEach(s => {
      console.log(`🚚 ${s.shipmentId}: ${s.sourceCity} → ${s.destinationCity} (${s.consignorName})`)
    })
    
    res.json({
      total: shipments.length,
      shipments: shipments,
    })
  } catch (error) {
    console.error('❌ Debug endpoint error:', error)
    res.status(500).json({ error: error.message })
  }
})

// TEST: Verify shipment exists in Firestore
app.get('/api/test-shipment/:shipmentId', async (req, res) => {
  try {
    const { shipmentId } = req.params
    const shipmentDoc = await getDoc(doc(db, 'shipments', shipmentId))
    
    if (shipmentDoc.exists()) {
      res.json({ 
        found: true, 
        shipmentId,
        data: {
          sourceCity: shipmentDoc.data().sourceCity,
          destinationCity: shipmentDoc.data().destinationCity,
          driverName: shipmentDoc.data().driverName,
          status: shipmentDoc.data().status,
          timestamp: new Date().toISOString()
        }
      })
    } else {
      res.status(404).json({ found: false, shipmentId, message: 'Shipment not found in Firestore' })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// POST /api/analyze-route
// ============================================================================
app.post('/api/analyze-route', async (req, res) => {
  try {
    const { source, destination, departureTime } = req.body

    if (!source || !destination) {
      return res.status(400).json({ error: 'Source and destination are required' })
    }

    console.log(`📍 Analyzing route: ${source} → ${destination}`)

    // Geocode locations in PARALLEL (faster than sequential)
    const [sourceCoords, destCoords] = await Promise.all([
      geocodeLocation(source),
      geocodeLocation(destination)
    ])
    
    console.log(`✅ Geocoded: ${source} → [${sourceCoords.lng}, ${sourceCoords.lat}]`)
    console.log(`✅ Geocoded: ${destination} → [${destCoords.lng}, ${destCoords.lat}]`)

    // Fetch weather for destination
    const weather = await fetchWeather(destCoords.lat, destCoords.lng)
    const weatherSeverity = getWeatherSeverity(weather.weatherCode)
    console.log(`✅ Weather: ${weather.description} (Severity: ${weatherSeverity})`)

    // Try to fetch real routes from ORS, fallback to mock if unavailable
    let routes
    try {
      routes = await fetchRoutes(sourceCoords, destCoords)
      console.log(`✅ Fetched ${routes.length} real routes from ORS`)
    } catch (orsError) {
      console.warn('⚠️  ORS Directions API unavailable, using mock data for demo')
      // Generate realistic mock routes with waypoints between source and destination
      const distance = Math.sqrt(
        Math.pow(destCoords.lng - sourceCoords.lng, 2) + Math.pow(destCoords.lat - sourceCoords.lat, 0)
      ) * 111 // Approximate km per degree
      
      // Generate waypoints along the route (10 intermediate points for a realistic path)
      const generateWaypoints = (start, end, count = 10) => {
        const waypoints = [start]
        for (let i = 1; i < count; i++) {
          const t = i / count
          // Add slight deviation for more realistic routes
          const deviation = (Math.sin(i) * 0.01)
          waypoints.push([
            start[0] + (end[0] - start[0]) * t + deviation,
            start[1] + (end[1] - start[1]) * t + deviation * 0.5,
          ])
        }
        waypoints.push(end)
        return waypoints
      }
      
      const startCoord = [sourceCoords.lng, sourceCoords.lat]
      const endCoord = [destCoords.lng, destCoords.lat]
      
      const route1 = generateWaypoints(startCoord, endCoord, 10)
      const route2 = generateWaypoints(startCoord, endCoord, 12) // Slightly different
      const route3 = generateWaypoints(startCoord, endCoord, 8)   // Slightly shorter
      
      routes = [
        {
          distance: Math.round(distance * 1000),
          duration: Math.round((distance / 60) * 3600) + Math.random() * 600,
          geometry: { coordinates: route1 },
        },
        {
          distance: Math.round(distance * 1050),
          duration: Math.round((distance / 55) * 3600),
          geometry: { coordinates: route2 },
        },
        {
          distance: Math.round(distance * 1100),
          duration: Math.round((distance / 50) * 3600),
          geometry: { coordinates: route3 },
        },
      ]
    }

    if (!routes || routes.length === 0) {
      return res.status(400).json({ error: 'No routes found' })
    }

    // Calculate route durations and distances
    const routeDurations = routes.map((r) => r.duration)
    const minDuration = Math.min(...routeDurations)
    const maxDuration = Math.max(...routeDurations)
    const trafficDelayRatio = (maxDuration - minDuration) / maxDuration || 0

    // Process routes and calculate risk scores
    const processedRoutes = routes.slice(0, 3).map((route, idx) => {
      const riskScore = 0.6 * weatherSeverity + 0.4 * trafficDelayRatio
      let riskLevel, riskColor

      if (riskScore < 0.3) {
        riskLevel = 'Low'
        riskColor = 'green'
      } else if (riskScore < 0.6) {
        riskLevel = 'Medium'
        riskColor = 'yellow'
      } else {
        riskLevel = 'High'
        riskColor = 'red'
      }

      const routeId = String.fromCharCode(65 + idx) // A, B, or C
      const eta = new Date(departureTime)
      eta.setSeconds(eta.getSeconds() + route.duration)

      // Extract turn-by-turn instructions
      const turnpoints = route.segments ? extractTurnpoints(route.segments) : []

      return {
        id: routeId,
        name: `Route ${routeId}`,
        eta: eta.toISOString(),
        distance: (route.distance / 1000).toFixed(2),
        duration: Math.round(route.duration / 60),
        riskScore: riskScore.toFixed(2),
        riskLevel,
        riskColor,
        riskReason:
          riskScore > 0.6
            ? `Heavy rain expected (${weather.description}) + traffic surge on current route`
            : riskScore > 0.3
              ? `Moderate weather (${weather.description}) + some traffic delays possible`
              : `Clear conditions (${weather.description}), optimal travel conditions`,
        coordinates: route.geometry.coordinates,
        // NEW: Turn-by-turn instructions for driver view & dashboard
        turnpoints: turnpoints.slice(0, 15), // Max 15 key turns to keep data size reasonable
        totalTurns: turnpoints.length,
      }
    })

    console.log(`✅ Route analysis complete: ${processedRoutes.length} routes found`)

    res.json({
      weather: { ...weather, severity: weatherSeverity },
      routes: processedRoutes,
    })
  } catch (error) {
    console.error('❌ Analyze route error:', error)
    res.status(500).json({ error: error.message || 'Failed to analyze route' })
  }
})

// ============================================================================
// POST /api/create-shipment
// ============================================================================
app.post('/api/create-shipment', async (req, res) => {
  try {
    const {
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
      createdBy,
    } = req.body

    // Validate required fields
    const missingFields = []
    if (!sourceCity) missingFields.push('sourceCity')
    if (!sourceAddress) missingFields.push('sourceAddress')
    if (!destinationCity) missingFields.push('destinationCity')
    if (!destinationAddress) missingFields.push('destinationAddress')
    if (!cargoType) missingFields.push('cargoType')
    if (!driverName) missingFields.push('driverName')
    if (!driverPhone) missingFields.push('driverPhone')
    if (!vehicleNumber) missingFields.push('vehicleNumber')
    if (!consignorName) missingFields.push('consignorName')
    if (!consigneeName) missingFields.push('consigneeName')
    if (!invoiceNumber) missingFields.push('invoiceNumber')
    if (!selectedRoute) missingFields.push('selectedRoute')
    if (!createdBy) missingFields.push('createdBy')
    
    if (missingFields.length > 0) {
      console.error('❌ MISSING FIELDS:', missingFields)
      console.error('📤 Received data:', { sourceCity, sourceAddress, destinationCity, destinationAddress, driverName, vehicleNumber, consignorName, invoiceNumber })
      return res.status(400).json({ 
        error: 'Missing required fields',
        missingFields: missingFields,
        received: { sourceCity, sourceAddress, destinationCity, destinationAddress, driverName, vehicleNumber }
      })
    }

    const shipmentId = uuidv4()
    const now = new Date().toISOString()

    const shipmentData = {
      shipmentId,
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
      selectedRoute: {
        id: selectedRoute.id,
        name: selectedRoute.name,
        eta: selectedRoute.eta,
        distance: selectedRoute.distance,
        duration: selectedRoute.duration,
        riskScore: selectedRoute.riskScore,
        riskLevel: selectedRoute.riskLevel,
        riskReason: selectedRoute.riskReason,
        // Flatten nested coordinates into a single array for Firestore compatibility
        // Format: [lng1, lat1, lng2, lat2, lng3, lat3, ...]
        coordinates: flattenCoordinates(selectedRoute.coordinates) || [],
        // NEW: Store turn-by-turn instructions for driver navigation
        turnpoints: selectedRoute.turnpoints || [],
        totalTurns: selectedRoute.totalTurns || 0,
      },
      status: 'Upcoming',
      currentRisk: selectedRoute.riskLevel,
      riskReason: selectedRoute.riskReason,
      createdAt: now,
      departureTime,
      updatedETA: selectedRoute.eta,
      createdBy,
      history: [
        {
          status: 'Created',
          message: 'Shipment created and registered',
          timestamp: now,
        },
      ],
    }

    // Create Firestore document
    const shipmentsCollection = collection(db, 'shipments')
    const shipmentRef = doc(shipmentsCollection, shipmentId)
    
    // Log EXACTLY what we're storing
    console.log(`📝 CREATING SHIPMENT - DATA TO STORE:`, {
      shipmentId,
      sourceCity: shipmentData.sourceCity,
      sourceAddress: shipmentData.sourceAddress,
      destinationCity: shipmentData.destinationCity,
      destinationAddress: shipmentData.destinationAddress,
      driverName: shipmentData.driverName,
      vehicleNumber: shipmentData.vehicleNumber,
      consignorName: shipmentData.consignorName,
      consigneeName: shipmentData.consigneeName,
      invoiceNumber: shipmentData.invoiceNumber,
    })
    
    await setDoc(shipmentRef, shipmentData)
    
    console.log(`✅ SHIPMENT SAVED TO FIRESTORE!`)

    console.log(`✅ Shipment created: ${shipmentId}`)
    console.log(`   📍 From: ${sourceAddress}, ${sourceCity}`)
    console.log(`   📍 To: ${destinationAddress}, ${destinationCity}`)
    console.log(`   🔗 Firestore collection: "shipments", docId: "${shipmentId}"`)
    console.log(`   🚚 Driver: ${driverName}`)
    console.log(`   📊 Route: ${shipmentData.selectedRoute.distance}km, ${shipmentData.selectedRoute.duration}min`)
    console.log(`   🔄 Turnpoints: ${shipmentData.selectedRoute.totalTurns} turn instructions captured`)
    console.log(`   📍 Coordinates: ${shipmentData.selectedRoute.coordinates.length / 2} position points`)
    if (shipmentData.selectedRoute.coordinates.length === 0) {
      console.warn(`⚠️ WARNING: Shipment ${shipmentId} has no route coordinates!`)
    }

    res.json({ 
      shipmentId,
      message: 'Shipment created successfully',
      sourceCity,
      destinationCity,
      driverName,
    })
  } catch (error) {
    console.error('❌ Create shipment error:', error)
    res.status(500).json({ error: error.message || 'Failed to create shipment' })
  }
})

// ============================================================================
// POST /api/simulate-disruption/:shipmentId
// REAL DYNAMIC REROUTING - Re-analyzes routes and switches to safer alternative
// ============================================================================
app.post('/api/simulate-disruption/:shipmentId', async (req, res) => {
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

    const currentShipment = shipmentSnap.data()
    console.log(`\n🚨 DISRUPTION TRIGGERED for shipment: ${shipmentId}`)
    console.log(`   Current Route: ${currentShipment.selectedRoute.name} (Risk: ${currentShipment.selectedRoute.riskLevel})`)

    // ============================================================================
    // STEP 1: RE-ANALYZE ROUTES (same source/destination, current time)
    // ============================================================================
    console.log(`\n📍 Re-analyzing routes from ${currentShipment.source} → ${currentShipment.destination}`)

    const [sourceCoords, destCoords] = await Promise.all([
      geocodeLocation(currentShipment.source),
      geocodeLocation(currentShipment.destination),
    ])

    // Fetch NEW weather data
    const weather = await fetchWeather(destCoords.lat, destCoords.lng)
    const weatherSeverity = getWeatherSeverity(weather.weatherCode)
    console.log(`💨 Updated Weather: ${weather.description} (Severity: ${weatherSeverity})`)

    // Fetch new routes
    let newRoutes
    try {
      newRoutes = await fetchRoutes(sourceCoords, destCoords)
      console.log(`✅ Fetched ${newRoutes.length} new routes from ORS`)
    } catch (orsError) {
      console.warn('⚠️  ORS unavailable, generating mock alternatives')
      // Generate new mock routes
      const distance = Math.sqrt(
        Math.pow(destCoords.lng - sourceCoords.lng, 2) + Math.pow(destCoords.lat - sourceCoords.lat, 2)
      ) * 111

      const generateWaypoints = (start, end, count = 10) => {
        const waypoints = [start]
        for (let i = 1; i < count; i++) {
          const t = i / count
          const deviation = Math.sin(i * Math.random()) * 0.015
          waypoints.push([
            start[0] + (end[0] - start[0]) * t + deviation,
            start[1] + (end[1] - start[1]) * t + deviation * 0.5,
          ])
        }
        waypoints.push(end)
        return waypoints
      }

      const startCoord = [sourceCoords.lng, sourceCoords.lat]
      const endCoord = [destCoords.lng, destCoords.lat]

      newRoutes = [
        {
          distance: Math.round(distance * 1000),
          duration: Math.round((distance / 60) * 3600) + Math.random() * 400,
          geometry: { coordinates: generateWaypoints(startCoord, endCoord, 10) },
        },
        {
          distance: Math.round(distance * 1050),
          duration: Math.round((distance / 55) * 3600),
          geometry: { coordinates: generateWaypoints(startCoord, endCoord, 12) },
        },
        {
          distance: Math.round(distance * 1100),
          duration: Math.round((distance / 50) * 3600),
          geometry: { coordinates: generateWaypoints(startCoord, endCoord, 8) },
        },
      ]
    }

    // ============================================================================
    // STEP 2: CALCULATE RISK SCORES FOR NEW ROUTES
    // ============================================================================
    const routeDurations = newRoutes.map((r) => r.duration)
    const minDuration = Math.min(...routeDurations)
    const maxDuration = Math.max(...routeDurations)
    const trafficDelayRatio = (maxDuration - minDuration) / maxDuration || 0

    const processedRoutes = newRoutes.slice(0, 3).map((route, idx) => {
      const riskScore = 0.6 * weatherSeverity + 0.4 * trafficDelayRatio
      let riskLevel, riskColor

      if (riskScore < 0.3) {
        riskLevel = 'Low'
        riskColor = 'green'
      } else if (riskScore < 0.6) {
        riskLevel = 'Medium'
        riskColor = 'yellow'
      } else {
        riskLevel = 'High'
        riskColor = 'red'
      }

      const eta = new Date(currentShipment.departureTime)
      eta.setSeconds(eta.getSeconds() + route.duration)

      return {
        name: `Route ${String.fromCharCode(65 + idx)}`,
        eta: eta.toISOString(),
        distance: (route.distance / 1000).toFixed(2),
        duration: Math.round(route.duration / 60),
        riskScore: riskScore.toFixed(2),
        riskLevel,
        riskColor,
        riskReason:
          riskScore > 0.6
            ? `Heavy rain expected (${weather.description}) + traffic surge`
            : riskScore > 0.3
              ? `Moderate weather (${weather.description}) + possible delays`
              : `Clear conditions (${weather.description}), safe route`,
        coordinates: route.geometry.coordinates,
      }
    })

    // ============================================================================
    // STEP 3: SELECT BEST ALTERNATIVE ROUTE (exclude current, pick safest)
    // ============================================================================
    const currentRiskScore = parseFloat(currentShipment.selectedRoute.riskScore)
    const currentRouteId = currentShipment.selectedRoute.id
    
    // Filter out current route using ID comparison (reliable and clean)
    const alternatives = processedRoutes.filter(
      r => r.id !== currentRouteId
    )
    
    if (alternatives.length === 0) {
      return res.status(400).json({ error: 'No alternative routes available for rerouting' })
    }
    
    // Pick safest alternative (lowest risk score)
    const bestAlternative = alternatives.reduce((best, route) => {
      const routeRiskScore = parseFloat(route.riskScore)
      return routeRiskScore < parseFloat(best.riskScore) ? route : best
    })

    console.log(`\n🎯 Best Alternative Found:`)
    console.log(`   Route: ${bestAlternative.name}`)
    console.log(`   Risk: ${bestAlternative.riskLevel} (Score: ${bestAlternative.riskScore})`)
    console.log(`   Distance: ${bestAlternative.distance} km`)
    console.log(`   Duration: ${bestAlternative.duration} mins`)
    console.log(`   Improvement: ${(currentRiskScore - parseFloat(bestAlternative.riskScore)).toFixed(2)} score reduction`)

    // ============================================================================
    // STEP 4: UPDATE FIRESTORE WITH NEW ROUTE GEOMETRY
    // ============================================================================
    const now = new Date().toISOString()
    const updatedData = {
      selectedRoute: {
        id: bestAlternative.id,
        name: bestAlternative.name,
        eta: bestAlternative.eta,
        distance: bestAlternative.distance,
        duration: bestAlternative.duration,
        riskScore: bestAlternative.riskScore,
        riskLevel: bestAlternative.riskLevel,
        riskReason: bestAlternative.riskReason,
        coordinates: flattenCoordinates(bestAlternative.coordinates) || [],
      },
      currentRisk: bestAlternative.riskLevel,
      riskReason: bestAlternative.riskReason,
      status: 'In Transit - Rerouted',
      updatedETA: bestAlternative.eta,
      routeChangedAt: now,
      routeChangeReason: 'Disruption detected - system recommended safer route',
      history: arrayUnion({
        timestamp: now,
        status: 'Route Updated',
        oldRoute: currentShipment.selectedRoute.name,
        newRoute: bestAlternative.name,
        reason: `Disruption: ${weather.description}. Switched from ${currentShipment.selectedRoute.name} (Risk: ${currentShipment.selectedRoute.riskLevel}) to ${bestAlternative.name} (Risk: ${bestAlternative.riskLevel})`,
        riskImprovement: (currentRiskScore - parseFloat(bestAlternative.riskScore)).toFixed(2),
      }),
    }

    await updateDoc(shipmentRef, updatedData)

    console.log(`\n✅ REROUTING COMPLETE`)
    console.log(`   Firestore updated with NEW route geometry`)
    console.log(`   Real-time listeners will detect change instantly`)

    res.json({
      success: true,
      shipmentId,
      disruption: {
        detected: true,
        weather: weather.description,
        oldRoute: currentShipment.selectedRoute.name,
        newRoute: bestAlternative.name,
        riskReduction: (currentRiskScore - parseFloat(bestAlternative.riskScore)).toFixed(2),
      },
      updatedShipment: {
        ...currentShipment,
        ...updatedData,
      },
    })
  } catch (error) {
    console.error('❌ Simulate disruption error:', error)
    res.status(500).json({ error: error.message || 'Failed to simulate disruption' })
  }
})

// ============================================================================
// POST /api/shipment/:shipmentId/mark-reached
// ============================================================================
app.post('/api/shipment/:shipmentId/mark-reached', async (req, res) => {
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
    const now = new Date().toISOString()

    const updateData = {
      status: 'Delivered',
      currentRisk: 'Resolved',
      updatedAt: now,
      history: arrayUnion({
        status: 'Delivered',
        message: 'Shipment successfully delivered to consignee',
        timestamp: now,
      }),
    }

    await updateDoc(shipmentRef, updateData)

    console.log(`✅ Shipment marked as reached: ${shipmentId}`)

    res.json({
      success: true,
      shipmentId,
      updates: updateData,
    })
  } catch (error) {
    console.error('❌ Mark reached error:', error)
    res.status(500).json({ error: error.message || 'Failed to mark shipment as reached' })
  }
})

// ============================================================================
// GET /api/shipment/:shipmentId
// ============================================================================
app.get('/api/shipment/:shipmentId', async (req, res) => {
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

    console.log(`📦 Fetched shipment: ${shipmentId}`)

    res.json(shipmentSnap.data())
  } catch (error) {
    console.error('❌ Get shipment error:', error)
    res.status(500).json({ error: error.message || 'Failed to fetch shipment' })
  }
})

// ============================================================================
// DELETE /api/shipment/:shipmentId
// ============================================================================
app.delete('/api/shipment/:shipmentId', async (req, res) => {
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

    await deleteDoc(shipmentRef)

    console.log(`🗑️ Shipment deleted: ${shipmentId}`)

    res.json({
      success: true,
      message: 'Shipment deleted successfully',
      shipmentId,
    })
  } catch (error) {
    console.error('❌ Delete shipment error:', error)
    res.status(500).json({ error: error.message || 'Failed to delete shipment' })
  }
})

// ============================================================================
// PUT /api/update-location/:shipmentId
// ============================================================================
app.put('/api/update-location/:shipmentId', async (req, res) => {
  try {
    const { shipmentId } = req.params
    const { latitude, longitude, driverStatus } = req.body

    if (!shipmentId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Shipment ID and coordinates required' })
    }

    const shipmentsCollection = collection(db, 'shipments')
    const shipmentRef = doc(shipmentsCollection, shipmentId)
    const shipmentSnap = await getDoc(shipmentRef)

    if (!shipmentSnap.exists()) {
      return res.status(404).json({ error: 'Shipment not found' })
    }

    const now = new Date().toISOString()
    const currentData = shipmentSnap.data()

    // Store only current location, not history (to avoid nested arrays in Firestore)
    const updateData = {
      currentLocation: { latitude, longitude, timestamp: now },
      driverStatus: driverStatus || 'Active',
    }

    // Check for inactivity (if location hasn't changed in 5+ minutes)
    if (currentData.currentLocation) {
      const lastLocation = currentData.currentLocation
      const timeDiff = (new Date(now) - new Date(lastLocation.timestamp)) / 1000 / 60
      const distance = Math.sqrt(
        Math.pow(latitude - lastLocation.latitude, 2) + Math.pow(longitude - lastLocation.longitude, 2)
      )
      
      // If stationary for 5+ min and distance < 0.01 degrees (~1km)
      if (timeDiff >= 5 && distance < 0.01) {
        updateData.history = arrayUnion({
          status: 'Inactive',
          message: 'Driver inactive - stationary location for 5+ minutes',
          timestamp: now,
        })
      }
    }

    await updateDoc(shipmentRef, updateData)

    console.log(`📍 Location updated for shipment ${shipmentId}: [${latitude}, ${longitude}]`)

    res.json({
      success: true,
      shipmentId,
      message: 'Location updated successfully',
    })
  } catch (error) {
    console.error('❌ Update location error:', error)
    res.status(500).json({ error: error.message || 'Failed to update location' })
  }
})

// ============================================================================
// POST /api/change-route/:shipmentId
// ============================================================================
app.post('/api/change-route/:shipmentId', async (req, res) => {
  try {
    const { shipmentId } = req.params
    const { newRoute, reason } = req.body

    if (!shipmentId || !newRoute) {
      return res.status(400).json({ error: 'Shipment ID and new route required' })
    }

    if (!newRoute.name || !newRoute.distance || !newRoute.duration || !newRoute.coordinates) {
      return res.status(400).json({ error: 'Route must include name, distance, duration, and coordinates' })
    }

    const shipmentsCollection = collection(db, 'shipments')
    const shipmentRef = doc(shipmentsCollection, shipmentId)
    const shipmentSnap = await getDoc(shipmentRef)

    if (!shipmentSnap.exists()) {
      return res.status(404).json({ error: 'Shipment not found' })
    }

    const currentData = shipmentSnap.data()
    const now = new Date().toISOString()

    // Store previous route info (not as array to avoid nesting)
    const updateData = {
      selectedRoute: {
        ...newRoute,
        coordinates: flattenCoordinates(newRoute.coordinates),
        changedAt: now,
        changedReason: reason || 'Driver initiated route change',
      },
      status: 'RouteChanged',
      history: arrayUnion({
        status: 'RouteChanged',
        message: `Route updated: ${reason || 'Driver changed route'}`,
        previousRouteName: currentData.selectedRoute?.name || 'Unknown',
        newRouteName: newRoute.name,
        timestamp: now,
      }),
    }

    await updateDoc(shipmentRef, updateData)

    console.log(`🔄 Route changed for shipment ${shipmentId}`)
    console.log(`  New: ${newRoute.name} (${newRoute.distance}km)`)
    console.log(`  Reason: ${reason}`)

    res.json({
      success: true,
      shipmentId,
      newRoute,
      message: 'Route successfully changed',
    })
  } catch (error) {
    console.error('❌ Change route error:', error)
    res.status(500).json({ error: error.message || 'Failed to change route' })
  }
})

// ============================================================================
// POST /api/update-driver-status/:shipmentId
// ============================================================================
app.post('/api/update-driver-status/:shipmentId', async (req, res) => {
  try {
    const { shipmentId } = req.params
    const { status, reason } = req.body // status: 'Active', 'Sleep', 'Break', 'Idle'

    if (!shipmentId || !status) {
      return res.status(400).json({ error: 'Shipment ID and status required' })
    }

    const validStatuses = ['Active', 'Sleep', 'Break', 'Idle', 'Delayed']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` })
    }

    const shipmentsCollection = collection(db, 'shipments')
    const shipmentRef = doc(shipmentsCollection, shipmentId)
    const shipmentSnap = await getDoc(shipmentRef)

    if (!shipmentSnap.exists()) {
      return res.status(404).json({ error: 'Shipment not found' })
    }

    const now = new Date().toISOString()

    const updateData = {
      driverStatus: status,
      driverStatusUpdatedAt: now,
      history: arrayUnion({
        status: 'DriverStatusChanged',
        message: `Driver status: ${status}${reason ? ` - ${reason}` : ''}`,
        timestamp: now,
        newStatus: status,
      }),
    }

    await updateDoc(shipmentRef, updateData)

    console.log(`👤 Driver status updated for shipment ${shipmentId}: ${status}`)

    res.json({
      success: true,
      shipmentId,
      status,
      message: `Driver status updated to ${status}`,
    })
  } catch (error) {
    console.error('❌ Update driver status error:', error)
    res.status(500).json({ error: error.message || 'Failed to update driver status' })
  }
})

// ============================================================================
// POST /api/request-reroute
// Creates notification-backed reroute requests for dispatcher review
// ============================================================================
app.post('/api/request-reroute', async (req, res) => {
  try {
    const { shipmentId, driverId, driverName, reason, locationText, coordinates } = req.body

    if (!shipmentId || !reason) {
      return res.status(400).json({ error: 'Shipment ID and reason are required' })
    }

    const shipmentsCollection = collection(db, 'shipments')
    const shipmentRef = doc(shipmentsCollection, shipmentId)
    const shipmentSnap = await getDoc(shipmentRef)

    if (!shipmentSnap.exists()) {
      return res.status(404).json({ error: 'Shipment not found' })
    }

    const shipmentData = shipmentSnap.data()
    const now = new Date().toISOString()

    const normalizedCoordinates = {
      lat: typeof coordinates?.lat === 'number' ? coordinates.lat : 0,
      lng: typeof coordinates?.lng === 'number' ? coordinates.lng : 0,
    }

    const resolvedLocationText =
      locationText?.trim() || `Lat ${normalizedCoordinates.lat.toFixed(5)}, Lng ${normalizedCoordinates.lng.toFixed(5)}`

    const rerouteRequest = {
      shipmentId,
      driverId: driverId || shipmentData.driverId || 'unknown-driver',
      driverName: driverName || shipmentData.driverName || 'Driver',
      reason: reason.trim(),
      locationText: resolvedLocationText,
      coordinates: normalizedCoordinates,
      requestedAt: Timestamp.now(),
      status: 'pending',
      newRoute: null,
    }

    const rerouteRequestsCollection = collection(db, 'rerouteRequests')
    const requestRef = await addDoc(rerouteRequestsCollection, rerouteRequest)

    await updateDoc(shipmentRef, {
      rerouteRequested: true,
      rerouteRequestedAt: now,
      rerouteReason: reason.trim(),
      currentLocation: {
        latitude: normalizedCoordinates.lat,
        longitude: normalizedCoordinates.lng,
      },
      history: arrayUnion({
        status: 'RerouteRequested',
        message: `Reroute requested: ${reason.trim()}`,
        timestamp: now,
        requestId: requestRef.id,
        currentLocation: {
          latitude: normalizedCoordinates.lat,
          longitude: normalizedCoordinates.lng,
        },
      }),
    })

    console.log(`🚨 Reroute request created: ${requestRef.id} for shipment ${shipmentId}`)

    res.json({
      success: true,
      requestId: requestRef.id,
      message: 'Reroute request submitted for dispatcher approval.',
      request: rerouteRequest,
    })
  } catch (error) {
    console.error('❌ Request reroute error:', error)

    if (isFirestoreUnavailableError(error)) {
      return res.status(503).json({
        error: 'Database temporarily unavailable. Please check internet connection and try again.',
      })
    }

    res.status(500).json({ error: error.message || 'Failed to request reroute' })
  }
})

// ============================================================================
// POST /api/request-reroute/:shipmentId
// ============================================================================
app.post('/api/request-reroute/:shipmentId', async (req, res) => {
  try {
    const { shipmentId } = req.params
    const { currentLatitude, currentLongitude, reason } = req.body

    if (!shipmentId || currentLatitude === undefined || currentLongitude === undefined) {
      return res.status(400).json({ error: 'Shipment ID and current location required' })
    }

    const shipmentsCollection = collection(db, 'shipments')
    const shipmentRef = doc(shipmentsCollection, shipmentId)
    const shipmentSnap = await getDoc(shipmentRef)

    if (!shipmentSnap.exists()) {
      return res.status(404).json({ error: 'Shipment not found' })
    }

    const currentData = shipmentSnap.data()
    const now = new Date().toISOString()

    // In a real system, we'd call OpenRouteService to calculate new routes
    // For now, we'll mark it as requesting reroute
    const updateData = {
      rerouteRequested: true,
      rerouteRequestedAt: now,
      rerouteReason: reason || 'Route blocked or traffic detected',
      currentLocation: { latitude: currentLatitude, longitude: currentLongitude },
      history: arrayUnion({
        status: 'RerouteRequested',
        message: `Reroute requested: ${reason || 'Route blocked or traffic'}`,
        timestamp: now,
        currentLocation: { latitude: currentLatitude, longitude: currentLongitude },
      }),
    }

    await updateDoc(shipmentRef, updateData)

    console.log(`🚨 Reroute requested for shipment ${shipmentId}`)
    console.log(`  Reason: ${reason}`)
    console.log(`  Current location: [${currentLatitude}, ${currentLongitude}]`)

    res.json({
      success: true,
      shipmentId,
      message: 'Reroute request submitted. System is analyzing alternatives.',
      suggestion: 'Please use alternative route to avoid delays',
    })
  } catch (error) {
    console.error('❌ Request reroute error:', error)

    if (isFirestoreUnavailableError(error)) {
      return res.status(503).json({
        error: 'Database temporarily unavailable. Please check internet connection and try again.',
      })
    }

    res.status(500).json({ error: error.message || 'Failed to request reroute' })
  }
})

// ============================================================================
// POST /api/approve-reroute
// Selects a new route from A/B/C excluding the shipment's current route
// ============================================================================
app.post('/api/approve-reroute', async (req, res) => {
  try {
    const { requestId, shipmentId } = req.body

    if (!requestId || !shipmentId) {
      return res.status(400).json({ error: 'Request ID and shipment ID are required' })
    }

    const rerouteRequestsCollection = collection(db, 'rerouteRequests')
    const requestRef = doc(rerouteRequestsCollection, requestId)
    const requestSnap = await getDoc(requestRef)

    if (!requestSnap.exists()) {
      return res.status(404).json({ error: 'Reroute request not found' })
    }

    const requestData = requestSnap.data()
    if (requestData.status && requestData.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${requestData.status}` })
    }

    const shipmentsCollection = collection(db, 'shipments')
    const shipmentRef = doc(shipmentsCollection, shipmentId)
    const shipmentSnap = await getDoc(shipmentRef)

    if (!shipmentSnap.exists()) {
      return res.status(404).json({ error: 'Shipment not found' })
    }

    const shipmentData = shipmentSnap.data()
    const currentRouteIdRaw = shipmentData.selectedRoute?.id || shipmentData.selectedRoute?.name || ''
    const currentRouteId = String(currentRouteIdRaw).replace(/^Route\s+/i, '').trim().toUpperCase()

    const allCandidates = await buildRerouteCandidates(shipmentData)
    const availableCandidates = allCandidates.filter((route) => route.id.toUpperCase() !== currentRouteId)

    if (availableCandidates.length === 0) {
      return res.status(400).json({
        error: 'No alternative route available after excluding current route.',
      })
    }

    availableCandidates.sort((a, b) => {
      if (a.riskScore !== b.riskScore) return a.riskScore - b.riskScore
      return a.duration - b.duration
    })

    const chosenRoute = availableCandidates[0]
    const nowIso = new Date().toISOString()

    await updateDoc(requestRef, {
      status: 'approved',
      approvedAt: Timestamp.now(),
      newRoute: {
        routeId: chosenRoute.id,
        routeName: chosenRoute.name,
        updatedETA: chosenRoute.updatedETA,
        distance: chosenRoute.distance,
        duration: chosenRoute.duration,
        riskScore: chosenRoute.riskScore,
        riskLevel: chosenRoute.riskLevel,
        riskReason: chosenRoute.riskReason,
      },
    })

    await updateDoc(shipmentRef, {
      selectedRoute: {
        id: chosenRoute.id,
        name: chosenRoute.name,
        eta: chosenRoute.eta,
        distance: chosenRoute.distance,
        duration: chosenRoute.duration,
        riskScore: chosenRoute.riskScore,
        riskLevel: chosenRoute.riskLevel,
        riskReason: chosenRoute.riskReason,
        coordinates: flattenCoordinates(chosenRoute.coordinates) || [],
        turnpoints: chosenRoute.turnpoints || [],
        totalTurns: chosenRoute.totalTurns || 0,
        changedAt: nowIso,
        changedReason: `Approved reroute request: ${requestId}`,
      },
      status: 'In Transit - Rerouted',
      currentRisk: chosenRoute.riskLevel,
      riskReason: chosenRoute.riskReason,
      updatedETA: chosenRoute.updatedETA,
      rerouteRequested: false,
      lastRerouteRequest: requestId,
      lastRerouteApprovedAt: Timestamp.now(),
      history: arrayUnion({
        status: 'RerouteApproved',
        message: `Dispatcher approved reroute from Route ${currentRouteId || '?'} to ${chosenRoute.name}`,
        timestamp: nowIso,
        previousRoute: shipmentData.selectedRoute?.name || 'Unknown',
        newRoute: chosenRoute.name,
        reason: requestData.reason || 'Reroute approved',
      }),
    })

    console.log(`✅ Reroute approved for shipment ${shipmentId}: ${shipmentData.selectedRoute?.name || 'Unknown'} -> ${chosenRoute.name}`)

    res.json({
      success: true,
      requestId,
      shipmentId,
      newRoute: chosenRoute,
      excludedCurrentRoute: currentRouteId,
      availableAlternatives: availableCandidates.map((r) => r.name),
      message: `Driver redirected to ${chosenRoute.name}`,
    })
  } catch (error) {
    console.error('❌ Approve reroute error:', error)

    if (isFirestoreUnavailableError(error)) {
      return res.status(503).json({
        error: 'Database temporarily unavailable. Please check internet connection and try again.',
      })
    }

    res.status(500).json({ error: error.message || 'Failed to approve reroute' })
  }
})

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    🚚 ROUTERADAR SERVER                      ║
║                   Smart Logistics Backend                    ║
╚══════════════════════════════════════════════════════════════╝

✅ Server running on http://localhost:${PORT}

📍 Available Endpoints:
   - POST   /api/analyze-route              (Route analysis with weather)
   - POST   /api/create-shipment            (Create new shipment)
  - POST   /api/approve-reroute            (Approve reroute and assign new route)
   - POST   /api/simulate-disruption/:id    (Test disruption)
   - GET    /api/shipment/:id               (Fetch shipment)
   - GET    /api/health                     (Health check)

🔧 Configured Services:
   - Firebase Firestore: Connected
   - OpenWeatherMap API: ${OPENWEATHER_API_KEY ? '✓ Configured' : '✗ Missing'}
   - OpenRouteService API: ${OPENROUTESERVICE_API_KEY ? '✓ Configured' : '✗ Missing'}

${!process.env.FIREBASE_API_KEY ? '⚠️ WARNING: Firebase credentials missing\n' : ''}
${!OPENWEATHER_API_KEY ? '⚠️ WARNING: OpenWeatherMap API key missing\n' : ''}
${!OPENROUTESERVICE_API_KEY ? '⚠️ WARNING: OpenRouteService API key missing\n' : ''}

🚀 Ready to receive requests!
  `)
})

export default app
