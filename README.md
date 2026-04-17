# RouteRadar - Smart Logistics Coordination System

A comprehensive full-stack web application for optimizing logistics routes in the Indian market using real-time weather data, traffic analysis, and AI-driven risk scoring.

## 🚀 Features

### SME Dashboard (`/`)
- **Delivery Creation Form:** Source/destination cities, departure time, cargo type, driver info
- **Route Analysis:** 3 route alternatives with risk scoring
- **Real-Time Monitoring:** Watch active shipments with live status updates
- **Disruption Simulation:** Test system response to weather/traffic alerts
- **WhatsApp Integration:** Send driver links directly via WhatsApp

### Driver Mobile View (`/driver/:shipmentId`)
- **Real-Time Route Display:** Live map with Leaflet + OpenStreetMap
- **Navigation Assistance:** Start navigation in Google Maps
- **Risk Alerts:** Immediate alerts when route conditions change
- **Shipment Details:** Complete cargo and vehicle information
- **Responsive Design:** Optimized for mobile devices

### Digital Shipment Pass (`/pass/:shipmentId`)
- **Professional Pass Design:** Official-looking checkpoint verification document
- **QR Code Verification:** Scannable code for authorities
- **Real-Time Updates:** Live status changes reflected on the pass
- **Print Ready:** Can be printed or shared digitally
- **No Authentication:** Fully public for checkpoint verification

### Real-Time Disruption System
- **Live Weather Integration:** OpenWeatherMap API for destination weather
- **Traffic Delay Detection:** Multi-route analysis for traffic patterns
- **Risk Scoring Algorithm:**
  - Weather severity: 0-1 scale based on weather codes
  - Traffic delay ratio: Calculated from route duration variance
  - Final score: `(0.6 × weather) + (0.4 × traffic)`
- **Auto Notifications:** Driver and SME both notified on risk changes

## 🛠️ Tech Stack

- **Frontend:** React.js + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** Firebase Firestore (real-time)
- **Maps:** Leaflet.js + OpenStreetMap (free)
- **Routing:** OpenRouteService API (geocoding + directions)
- **Weather:** OpenWeatherMap API
- **QR Code:** qrcode.react

## 📦 Installation

### Prerequisites
- Node.js (v16+) and npm
- Firebase project with Firestore enabled
- API keys from:
  - OpenWeatherMap
  - OpenRouteService
  - Firebase (already configured)

### Frontend Setup

```bash
cd client
npm install
cp .env.example .env  # Already configured
npm run dev
```

The frontend will start at `http://localhost:5173`

### Backend Setup

```bash
cd server
npm install
cp .env.example .env  # Already configured
node server.js
```

The backend will start at `http://localhost:5000`

## 📋 Environment Variables

### client/.env
```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_BACKEND_URL=http://localhost:5000
```

### server/.env
```
OPENWEATHER_API_KEY=your_openweather_key
OPENROUTESERVICE_API_KEY=your_openrouteservice_key
PORT=5000
```

## 🎯 API Endpoints

### POST /api/analyze-route
Analyzes possible routes between source and destination.

**Request:**
```json
{
  "source": "Hyderabad",
  "destination": "Visakhapatnam",
  "departureTime": "2024-01-15T10:00:00"
}
```

**Response:**
```json
{
  "weather": {
    "weatherCode": 800,
    "description": "clear",
    "temperature": 25,
    "severity": 0
  },
  "routes": [
    {
      "name": "Route A",
      "eta": "2024-01-15T14:30:00",
      "distance": "234.5",
      "duration": 270,
      "riskScore": "0.12",
      "riskLevel": "Low",
      "riskReason": "Clear conditions, optimal travel",
      "coordinates": [[79.865, 17.365], ...]
    }
  ]
}
```

### POST /api/create-shipment
Creates a new shipment and stores it in Firestore.

**Request:**
```json
{
  "source": "Hyderabad",
  "destination": "Visakhapatnam",
  "cargoType": "Electronics",
  "driverName": "Raj Kumar",
  "vehicleNumber": "KA-01-AB-1234",
  "consignorName": "TechShip Logistics",
  "consigneeName": "Metro Retail",
  "invoiceNumber": "INV-2024-001",
  "selectedRoute": {...},
  "departureTime": "2024-01-15T10:00:00"
}
```

**Response:**
```json
{
  "shipmentId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "shipmentData": {...}
}
```

### POST /api/simulate-disruption/:shipmentId
Simulates a weather/traffic disruption for testing.

**Response:**
```json
{
  "success": true,
  "shipmentId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "updates": {
    "currentRisk": "High",
    "status": "Delayed",
    "riskReason": "Heavy rain detected + traffic surge"
  }
}
```

### GET /api/shipment/:shipmentId
Fetches shipment data from Firestore.

## 🎨 UI Components

### Dashboard
- Delivery form with smart defaults
- 3-route analysis with visual comparison
- Active shipments panel with risk indicators
- Real-time Leaflet map showing routes

### Driver View
- Mobile-first design
- Full-screen Leaflet map
- Risk alert banner
- Direct Google Maps integration
- "View Shipment Pass" quick link

### Shipment Pass
- Official-looking checkpoint document
- Large shipment ID for easy reference
- All cargo/vehicle details
- QR code for verification
- Printable format with print stylesheet
- Verified by RouteRadar stamp

## 🚀 Deployment

### Frontend (Vercel)
```bash
cd client
npm run build
# Deploy dist/ folder to Vercel
```

### Backend (Railway)
```bash
cd server
npm install
# Set environment variables on Railway
git push Railway main
```

## 📊 Firestore Collection Structure

### shipments collection
```
{
  shipmentId: UUID,
  source: string,
  destination: string,
  cargoType: string,
  driverName: string,
  vehicleNumber: string,
  consignorName: string,
  consigneeName: string,
  invoiceNumber: string,
  selectedRoute: {
    name: string,
    eta: ISO8601 string,
    distance: string,
    duration: number,
    riskScore: string,
    riskLevel: string,
    riskReason: string,
    coordinates: [[lng, lat], ...]
  },
  status: "In Transit" | "Delayed" | "Delivered",
  currentRisk: "Low" | "Medium" | "High",
  riskReason: string,
  createdAt: ISO8601 string,
  departureTime: ISO8601 string,
  updatedETA: ISO8601 string,
  disruptionSimulatedAt?: ISO8601 string,
  suggestedRoute?: string
}
```

## 🔐 Security Considerations

- ✅ No sensitive keys in version control (all in .env)
- ✅ Firebase Firestore rules should restrict creation to authenticated users
- ✅ Backend validates all input before database operations
- ✅ Shipment pass is public by design (no auth required)
- ✅ CORS enabled only for frontend origin

## 📱 Mobile Responsiveness

- ✅ Driver view fully responsive
- ✅ Pass page mobile-optimized
- ✅ Dashboard responsive on tablets
- ✅ Touch-friendly buttons and inputs
- ✅ Map fully functional on mobile

## 🧪 Testing the Demo

1. **Start Backend & Frontend**
   ```bash
   # Terminal 1 - Backend
   cd server && node server.js

   # Terminal 2 - Frontend
   cd client && npm run dev
   ```

2. **Create a Shipment**
   - Go to Dashboard at `http://localhost:5173`
   - Fill in source/destination
   - Click "Analyze Route"
   - Select a route
   - Fill in shipment details
   - Click "Create Shipment"
   - Send via WhatsApp

3. **View Driver Experience**
   - Click driver link or navigate to `/driver/{shipmentId}`
   - See real-time route and risk updates

4. **Verify Shipment Pass**
   - Click "View Shipment Pass" from driver view
   - Scan QR code (opens same URL)
   - Print or share the pass

5. **Test Disruption Simulation**
   - Go back to Dashboard
   - Click "Simulate Disruption" on active shipment
   - Watch both dashboard and driver view update in real-time

## 🎯 Key Achievements

- ✅ Full-stack React + Node.js application
- ✅ Real-time Firestore data synchronization
- ✅ Weather and traffic API integration
- ✅ Advanced risk scoring algorithm
- ✅ Professional digital shipment pass with QR code
- ✅ Mobile-optimized driver view
- ✅ WhatsApp integration
- ✅ Fully functional without authentication
- ✅ Production-ready deployment setup
- ✅ Comprehensive API documentation

## 📞 Support

For issues or feature requests, please contact the development team or submit an issue.

---

**RouteRadar** - Smart Logistics Coordination System for India
