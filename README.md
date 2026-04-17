# RouteRadar

RouteRadar is a full-stack logistics coordination app for handling shipment planning, live tracking, and disruption-driven rerouting workflows.

## Problem
Logistics teams often plan a route once and then struggle to react when weather, traffic, or road issues appear during transit. Drivers and dispatchers need a shared, real-time view to reduce delays and confusion.

## Solution
RouteRadar provides:
- Route analysis before shipment creation
- Live shipment tracking and status updates
- Driver-facing route and shipment view
- Reroute request + dispatcher approval workflow
- Digital shipment pass for checkpoint verification

## Current Product Status (Honest)
- Implemented: disruption simulation, reroute request creation, dispatcher approval, and route switching to a better alternative route.
- Implemented: approved reroute excludes the current route and selects the best available candidate by lower risk, then shorter duration.
- Limitation: rerouting is approval-driven, not fully autonomous background AI replanning.

## Key Features

### SME / Dispatcher Dashboard
- Create shipments with source and destination city/address details
- Analyze multiple routes with weather and traffic-aware risk scoring
- View active shipments and shipment history
- Trigger disruption simulation for testing operational response
- Approve driver reroute requests

### Driver View
- Access shipment using a shareable driver link
- View route map and shipment details
- Request reroute with reason and location context
- Receive updated route after dispatcher approval

### Digital Shipment Pass
- Public shipment pass link for verification
- QR code-based access
- Printable format for checkpoint usage

## Tech Stack
- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js, Express
- Database: Firebase Firestore
- Maps: Leaflet + OpenStreetMap
- Routing/Geocoding: OpenRouteService + Nominatim
- Weather: OpenWeatherMap

## Architecture
- client: React app (dashboard, driver view, pass)
- server: Express API (route analysis, shipment lifecycle, reroute logic)
- firestore collections: shipments, rerouteRequests

## Demo / Proof
Add these before sharing with recruiters:
- 30-60 second demo video showing:
  1) shipment creation
  2) disruption trigger
  3) reroute request
  4) dispatcher approval
  5) updated route on driver side
- 3-5 screenshots:
  - dashboard
  - route analysis map
  - driver view
  - reroute notification
  - shipment pass

## Live Links Format
After deployment:
- User side: https://YOUR_FRONTEND_DOMAIN/
- Driver side: https://YOUR_FRONTEND_DOMAIN/driver/SHIPMENT_ID
- Shipment pass: https://YOUR_FRONTEND_DOMAIN/pass/SHIPMENT_ID

## Quick Start (Local)

### Prerequisites
- Node.js 16+
- npm
- Firebase project with Firestore enabled
- API keys for OpenWeatherMap and OpenRouteService

### 1) Install Dependencies

At project root:
- npm install

In client:
- cd client
- npm install

In server:
- cd server
- npm install

### 2) Configure Environment Files
Create:
- client/.env (copy from client/.env.example)
- server/.env (copy from server/.env.example)

Required client variables:
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_BACKEND_URL

Required server variables:
- OPENWEATHER_API_KEY
- OPENROUTESERVICE_API_KEY
- PORT
- FIREBASE_API_KEY
- FIREBASE_AUTH_DOMAIN
- FIREBASE_PROJECT_ID
- FIREBASE_STORAGE_BUCKET
- FIREBASE_MESSAGING_SENDER_ID
- FIREBASE_APP_ID

### 3) Run Development
Option A (single command from root):
- npm run dev

Option B (separate terminals):
- Terminal 1: cd server ; npm run dev
- Terminal 2: cd client ; npm run dev

Default local URLs:
- Frontend: http://localhost:5173
- Backend health: http://localhost:5000/api/health

## API Overview
- POST /api/analyze-route
- POST /api/create-shipment
- GET /api/shipment/:shipmentId
- POST /api/simulate-disruption/:shipmentId
- POST /api/request-reroute
- POST /api/request-reroute/:shipmentId
- POST /api/approve-reroute
- GET /api/health

## Deployment

### Frontend (Vercel)
- Set root directory to client
- Build command: npm run build
- Output: dist
- Add environment variables from client/.env.example
- Ensure VITE_BACKEND_URL points to deployed backend

### Backend (Render or Railway)
- Deploy server folder as a web service
- Build command: npm install
- Start command: npm start
- Add environment variables from server/.env.example

### SPA Routing
client/vercel.json includes rewrite to index.html so direct route refresh works for:
- /driver/:shipmentId
- /pass/:shipmentId

## Security Checklist
- Do not commit .env files
- Rotate and revoke any previously exposed API key
- Restrict CORS to frontend domain(s) in production
- Use Firestore security rules (least privilege)
- Validate all backend inputs

## Recruiter-Friendly Checklist
Before sending this repo:
- Add hosted frontend link
- Add hosted backend health endpoint
- Add demo video link
- Add screenshots in docs/assets
- Confirm no secrets in git history

## Future Improvements
- Fully automatic reroute without manual dispatcher approval
- Background ETA recalculation based on live traffic intervals
- Route confidence scoring with historical shipment data
- Role-based access control for operations teams

---
RouteRadar focuses on practical logistics operations and transparent behavior over exaggerated claims.
