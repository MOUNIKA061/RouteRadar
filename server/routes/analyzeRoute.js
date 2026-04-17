import axios from 'axios'

const OPENROUTE_API_KEY = process.env.OPENROUTESERVICE_API_KEY
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY

// Weather severity mapping based on OpenWeatherMap weather codes
const getWeatherSeverity = (weatherCode) => {
  const code = Math.floor(weatherCode / 100) * 100
  
  if (code === 200) return 1.0  // thunderstorm
  if (code === 300) return 0.6  // drizzle
  if (code === 500) return 0.6  // rain
  if (code === 600) return 0.7  // snow
  if (code === 800) return 0.0  // clear
  if (code === 801) return 0.2  // few clouds
  if (code === 802) return 0.3  // scattered clouds
  if (code === 803 || code === 804) return 0.4  // broken/overcast clouds
  
  return 0.3  // default
}

// Geocode location using OpenRouteService
const geocodeLocation = async (location) => {
  try {
    const response = await axios.get('https://api.openrouteservice.org/geocode/search', {
      params: {
        api_key: OPENROUTE_API_KEY,
        text: location,
        size: 1,
      },
    })
    
    if (response.data.features && response.data.features.length > 0) {
      const coords = response.data.features[0].geometry.coordinates
      return { lng: coords[0], lat: coords[1] }
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
      'https://api.openrouteservice.org/v2/directions/driving-car',
      {
        coordinates: [[startCoords.lng, startCoords.lat], [endCoords.lng, endCoords.lat]],
        alternative_routes: {
          share_factor: 0.6,
          targets: 3,
        },
        geometry: true,
      },
      {
        headers: {
          Authorization: OPENROUTE_API_KEY,
        },
      }
    )
    
    return response.data.routes
  } catch (error) {
    console.error('Route fetch error:', error.message)
    throw error
  }
}

export const analyzeRouteHandler = async (req, res) => {
  try {
    const { source, destination, departureTime } = req.body

    if (!source || !destination) {
      return res.status(400).json({ error: 'Source and destination are required' })
    }

    console.log(`Analyzing route: ${source} → ${destination}`)

    // Geocode locations
    const sourceCoords = await geocodeLocation(source)
    const destCoords = await geocodeLocation(destination)

    // Fetch weather for destination
    const weather = await fetchWeather(destCoords.lat, destCoords.lng)
    const weatherSeverity = getWeatherSeverity(weather.weatherCode)

    // Fetch routes
    const routes = await fetchRoutes(sourceCoords, destCoords)

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

      const eta = new Date(departureTime)
      eta.setSeconds(eta.getSeconds() + route.duration)

      // IMPORTANT: route.geometry.coordinates contains ALL points from OpenRouteService
      // This is the FULL geometry that makes the route look like Google Maps
      const geometryPoints = route.geometry.coordinates

      // Convert ORS coordinates [lng, lat] to {lat, lng} format for Google Maps/Leaflet
      const routePolyline = geometryPoints.map(([lng, lat]) => ({
        lat,
        lng,
      }))

      const routeObj = {
        name: `Route ${String.fromCharCode(65 + idx)}`,
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
        // CRITICAL: Keep the full geometry from OpenRouteService
        // This is what makes the map look like real road navigation
        coordinates: geometryPoints,
        // ALT FORMAT: Also provide {lat, lng} object format for flexibility
        routePolyline,
      }
      console.log(`✅ Route ${routeObj.name}: FULL GEOMETRY - ${geometryPoints.length} precise road points`)
      console.log(`   Distance: ${(route.distance / 1000).toFixed(2)} km | Duration: ${Math.round(route.duration / 60)} min`)
      return routeObj
    })

    console.log(`📍 Returning ${processedRoutes.length} routes with coordinates`)
    res.json({
      weather: { ...weather, severity: weatherSeverity },
      routes: processedRoutes,
    })
  } catch (error) {
    console.error('Analyze route error:', error)
    res.status(500).json({ error: error.message })
  }
}
