# RouteRadar - Quick Start Guide

## 🚀 Application is LIVE!

Your RouteRadar application is now fully built and running!

### Access Points

- **Frontend / SME Dashboard:** http://localhost:5173
- **Backend API:** http://localhost:5000
- **API Health Check:** http://localhost:5000/api/health

---

## 📱 Full Feature Walkthrough

### 1️⃣ **Dashboard (SME View) - `/`**

**What you can do:**
- Fill in delivery details (Source, Destination, Departure Time, Cargo Type)
- Click "📍 Analyze Route" - Backend analyzes 3 routes with:
  - Weather data from OpenWeatherMap
  - Traffic analysis from OpenRouteService
  - Risk scoring: `(0.6 × weather) + (0.4 × traffic)`
- Select one of the 3 routes (Route A/B/C with risk badges)
- Fill in shipment details (Driver, Vehicle, Consignor/Consignee, Invoice)
- Click "✅ Create Shipment & Send to Driver"
- WhatsApp link opens automatically with driver link
- Active shipments panel on the right shows all live shipments with risk levels
- "Simulate Disruption" button to test real-time updates

**Key Features:**
- ✅ Real-time Firestore listener shows all active shipments
- ✅ Live risk level updates
- ✅ Route visualization with 3-color Leaflet map (green/yellow/red)
- ✅ Professional UI with dark navy theme and orange accents

---

### 2️⃣ **Driver Mobile View - `/driver/:shipmentId`**

**Accessed via:**
- WhatsApp link sent by SME
- Clicking "View Driver Link" from dashboard
- Manually entering the URL

**What the driver sees:**
- Current shipment ID (bold, large text)
- Route from Source → Destination
- Cargo details
- Live ETA (updates in real-time)
- Current risk level (Low/Medium/High with color badges)
- ⚠️ Alert banner when risk is Medium or High
- Leaflet map showing the actual route polyline
- Buttons:
  - 🗺️ "Start Navigation" - Opens Google Maps directions
  - ♻️ "Update Navigation" - Visible only when risk is High
  - 📋 "View Shipment Pass" - Navigate to digital pass

**Mobile Optimized:**
- ✅ Full responsive design
- ✅ Touch-friendly buttons
- ✅ Large text for easy reading while driving
- ✅ Real-time updates via Firestore onSnapshot

---

### 3️⃣ **Digital Shipment Pass - `/pass/:shipmentId`**

**Accessed via:**
- Driver view button
- Directly via URL
- No authentication required (fully public)

**Professional Design:**
- ✅ Official-looking checkpoint verification document
- ✅ Large shipment ID (bold, prominent)
- ✅ All cargo details (Type, Origin, Destination)
- ✅ Vehicle info (Number, Driver name)
- ✅ Party details (Consignor/Consignee, Invoice)
- ✅ Timing info (Departure, ETA, Risk level)
- ✅ **QR CODE** - Scannable for verification
- ✅ "✅ Verified by RouteRadar" stamp
- ✅ "Share Pass" button - Copy URL to clipboard
- ✅ Print-ready with print stylesheet
- ✅ Real-time updates (status changes reflected instantly)

**For Police/Checkpoint:**
- Scan QR code to verify authenticity
- Check shipment ID and status
- No special equipment needed

---

### 4️⃣ **Real-Time Disruption Simulation**

**Test the disruption system:**
1. Create a shipment from dashboard
2. Go back to dashboard
3. Find the active shipment in the right panel
4. Click "Simulate Disruption"
5. Watch in real-time:
   - ✅ Dashboard updates with ⚠️ warning
   - ✅ Risk level changes to "High"
   - ✅ Status changes to "Delayed"
   - ✅ ETA increases by 2 hours
   - ✅ Driver view shows alert banner
   - ✅ Pass reflects updated status

---

## 🧪 Testing Scenarios

### Scenario 1: Complete Order Flow
```
1. Dashboard → Fill form
2. "Analyze Route" → Select route
3. Fill shipment details
4. "Create Shipment" → WhatsApp pops up
5. Copy driver link from WhatsApp
6. Paste in new tab → Driver View
7. Click "View Shipment Pass" → Digital Pass
8. Scan QR code (it works!)
```

### Scenario 2: Disruption Alert
```
1. Create shipment (leaves it in Active Shipments)
2. Click "Simulate Disruption"
3. Watch both:
   - Dashboard: Risk badge turns red
   - Driver view: Alert banner appears
4. Status changes to "Delayed"
```

### Scenario 3: Paper-Free Checkpoint
```
1. Driver: Click "View Shipment Pass"
2. Police Officer: Scan QR code
3. System: Opens verified digital pass
4. Can print it or show on screen
```

---

## 🗂️ Project Structure

```
RouteRadar/
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx         (SME dashboard)
│   │   │   ├── DriverView.jsx        (Driver mobile view)
│   │   │   └── ShipmentPass.jsx      (Digital pass with QR)
│   │   ├── components/
│   │   │   ├── RouteAnalysisMap.jsx  (Leaflet map)
│   │   │   ├── ActiveShipmentsPanel.jsx
│   │   │   └── Toast.jsx             (Notifications)
│   │   ├── utils/
│   │   │   └── api.js                (Axios API client)
│   │   └── config/
│   │       └── firebase.js           (Firestore init)
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── .env                          (API credentials)
│
├── server/                 # Express backend
│   ├── routes/
│   │   ├── analyzeRoute.js           (Route analysis + weather + risk)
│   │   ├── createShipment.js         (Create in Firestore)
│   │   ├── simulateDisruption.js     (Test disruptions)
│   │   └── getShipment.js            (Fetch shipment)
│   ├── config/
│   │   └── firebase.js               (Firestore init)
│   ├── server.js
│   ├── package.json
│   └── .env                          (API keys)
│
└── README.md             (Full documentation)
```

---

## 🔧 Environment Variables

Set these values in local `.env` files before running the app.

### client/.env
```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_BACKEND_URL=http://localhost:5000
```

### server/.env
```
OPENWEATHER_API_KEY=your_openweather_api_key
OPENROUTESERVICE_API_KEY=your_openrouteservice_api_key
PORT=5000
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_firebase_app_id
```

---

## 🎨 Design Highlights

- **Color Scheme:**
  - Navy Background: #0f172a
  - Orange Accent: #f97316
  - Risk Colors: Green (Low), Yellow (Medium), Red (High)
  
- **Typography:**
  - Large, bold headings in orange
  - Clear hierarchy for mobile readability
  - Monospace for IDs (shipment ID, invoice)

- **Components:**
  - Dark cards with gray borders
  - Smooth transitions and hover effects
  - Toast notifications for user feedback
  - Loading states on buttons
  - Real-time updates without page refresh

---

## 📊 API Endpoints Reference

### POST /api/analyze-route
```json
{
  "source": "Hyderabad",
  "destination": "Visakhapatnam",
  "departureTime": "2024-01-15T10:00:00"
}
```
Returns 3 routes with risk scores and weather data.

### POST /api/create-shipment
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
Returns shipmentId for the new shipment.

### POST /api/simulate-disruption/:shipmentId
Simulates weather/traffic disruption (+2 hours ETA).

### GET /api/shipment/:shipmentId
Fetches current shipment data.

---

## 🚀 Deployment Ready

### Frontend Deployment (Vercel)
```bash
cd client
npm run build
# Deploy dist/ folder to Vercel
```

### Backend Deployment (Railway)
```bash
cd server
# Push to Railway with .env variables set
git push railway main
```

---

## 📞 Troubleshooting

**Issue: Frontend can't reach backend**
- Check: Backend running on port 5000
- Check: VITE_BACKEND_URL in client/.env is http://localhost:5000
- Fix: Restart both services

**Issue: Firestore write fails**
- Check: Firebase credentials in .env files
- Check: Firestore database rules allow writes
- Fix: Restart backend

**Issue: Maps not showing**
- Check: OpenStreetMap CDN is reachable
- Check: No Leaflet CSS import issues
- Fix: Hard refresh browser (Ctrl+Shift+R)

**Issue: QR code not scanning**
- Check: QR code library installed (qrcode.react@3.1.0)
- Fix: The QR encodes the full pass URL
- Try: Online QR decoder or mobile camera

---

## ✅ Feature Completion Checklist

- ✅ SME Dashboard with route analysis
- ✅ 3-route comparison with risk scoring  
- ✅ Weather integration (OpenWeatherMap)
- ✅ Traffic analysis (OpenRouteService)
- ✅ Driver mobile view with real-time updates
- ✅ Digital shipment pass with QR code
- ✅ Professional checkpoint verification document
- ✅ WhatsApp deep linking
- ✅ Real-time Firestore synchronization
- ✅ Disruption simulation system
- ✅ Leaflet + OpenStreetMap maps
- ✅ Mobile responsive design
- ✅ Tailwind CSS styling
- ✅ Toast notifications
- ✅ Error handling
- ✅ Production-ready deployment setup

---

## 🎯 Next Steps

1. **Test locally:** Visit http://localhost:5173 and create a shipment
2. **Try disruption:** Click "Simulate Disruption" to see real-time updates
3. **View driver perspective:** Use the WhatsApp link or `/driver/{id}` URL
4. **Check the pass:** Click "View Shipment Pass" and scan the QR code
5. **Deploy:** When ready, deploy frontend to Vercel and backend to Railway

---

**RouteRadar - Smart Logistics Coordination for India** 🚛🇮🇳

All features implemented exactly as specified. Production-ready. Enjoy!
