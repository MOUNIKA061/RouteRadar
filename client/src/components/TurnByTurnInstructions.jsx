import React, { useState } from 'react'

const TurnByTurnInstructions = ({ route = null, isVisible = true }) => {
  const [expandedStep, setExpandedStep] = useState(null)

  if (!isVisible || !route) {
    return null
  }

  // Use real turnpoints from backend, or generate mock if not available
  const generateInstructions = () => {
    // ✅ PRIORITY 1: Use real turnpoints from backend
    if (route.turnpoints && Array.isArray(route.turnpoints) && route.turnpoints.length > 0) {
      console.log(`✅ Using ${route.turnpoints.length} real turnpoints from backend`)
      return [
        {
          number: 0,
          text: 'Start your journey',
          distance: '0 km',
          duration: '0 min',
          icon: '📍',
          detail: 'Begin from pickup location'
        },
        ...route.turnpoints.map((turn, idx) => ({
          number: idx + 1,
          text: turn.instruction || `Turn ${idx + 1}`,
          distance: `+${(turn.distance / 1000).toFixed(2)} km`,
          duration: `+${Math.round(turn.duration / 60)} min`,
          icon: '🛣️',
          detail: `Distance from start: ${(turn.distanceFromStart / 1000).toFixed(1)} km | Duration: ${Math.round(turn.durationFromStart / 60)} min`
        })),
        {
          number: (route.turnpoints?.length || 0) + 1,
          text: 'Arrive at destination',
          distance: `Total: ${route.distance} km`,
          duration: `Total: ${route.duration} min`,
          icon: '🎯',
          detail: 'You have arrived at your destination'
        }
      ]
    }

    // ✅ FALLBACK: Generate mock instructions if no turnpoints
    console.warn('⚠️ No turnpoints found, generating mock instructions')
    if (!route.coordinates || route.coordinates.length < 2) {
      return []
    }

    const totalDistance = parseFloat(route.distance)
    const totalDuration = parseInt(route.duration)

    // Segment the route into meaningful waypoints
    const segmentCount = Math.min(8, Math.ceil(totalDistance / 50))
    const coordsPerSegment = Math.floor(route.coordinates.length / segmentCount)

    const instructions = [
      {
        number: 1,
        text: 'Start route from your location',
        distance: '0 km',
        duration: '0 min',
        icon: '📍',
        detail: 'Begin your journey from the pickup location'
      },
    ]

    // Add intermediate segments
    for (let i = 1; i < segmentCount; i++) {
      const progressPercent = (i / segmentCount) * 100
      const segmentDistance = (totalDistance * (i / segmentCount)).toFixed(1)
      const segmentDuration = Math.round(totalDuration * (i / segmentCount))

      const highwayNames = ['NH65', 'NH16', 'ORR', 'JNTU Road', 'Miyapur Road']
      const actions = ['Continue', 'Merge', 'Turn left onto', 'Turn right onto', 'Take exit towards']
      const landmarks = ['Vijayawada', 'Rajahmundry', 'Visakhapatnam', 'Krishna River', 'Godavari River']

      instructions.push({
        number: i + 1,
        text: `${actions[i % actions.length]} ${highwayNames[i % highwayNames.length]} towards ${landmarks[i % landmarks.length]}`,
        distance: `+${segmentDistance} km`,
        duration: `+${segmentDuration} min`,
        icon: '🛣️',
        detail: `Progress: ${Math.round(progressPercent)}% | Cumulative: ${segmentDistance} km`
      })
    }

    // Add destination
    instructions.push({
      number: segmentCount + 1,
      text: 'Arrive at destination',
      distance: `Total: ${totalDistance} km`,
      duration: `Total: ${totalDuration} min`,
      icon: '🎯',
      detail: 'You have arrived at your destination'
    })

    return instructions
  }

  const instructions = generateInstructions()

  return (
    <div className="rounded-lg overflow-hidden border" style={{
      backgroundColor: '#0d1f3c',
      borderColor: '#1e3a5f',
      maxHeight: '600px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 py-3" style={{ color: 'white' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">📋 Route Instructions</h3>
            <p className="text-xs mt-1 opacity-90">{route.distance} km | {route.duration} min | Risk: {route.riskLevel}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{route.name}</p>
          </div>
        </div>
      </div>

      {/* Instructions List */}
      <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(600px - 80px)' }}>
        {instructions.map((instruction, idx) => (
          <div
            key={idx}
            className="border-b cursor-pointer transition hover:bg-blue-950"
            style={{
              borderColor: '#1e3a5f',
              backgroundColor: expandedStep === idx ? '#1e3a5f' : 'transparent'
            }}
            onClick={() => setExpandedStep(expandedStep === idx ? null : idx)}
          >
            <div className="p-4 flex items-start gap-4">
              {/* Step Number Circle */}
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{
                  backgroundColor: idx === 0 ? '#22c55e' : idx === instructions.length - 1 ? '#ef4444' : '#3b82f6',
                  color: 'white'
                }}>
                  {instruction.number}
                </div>
              </div>

              {/* Instruction Details */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm leading-tight">
                  {instruction.icon} {instruction.text}
                </p>
                <div className="flex gap-4 mt-2 text-xs" style={{ color: '#8ba3c4' }}>
                  <span>📍 {instruction.distance}</span>
                  <span>⏱️ {instruction.duration}</span>
                </div>

                {/* Expanded Detail */}
                {expandedStep === idx && (
                  <div className="mt-3 p-3 rounded text-xs" style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderLeft: '3px solid #3b82f6',
                    color: '#93c5fd'
                  }}>
                    {instruction.detail}
                  </div>
                )}
              </div>

              {/* Expand Arrow */}
              <div className="flex-shrink-0 mt-1" style={{ color: '#8ba3c4' }}>
                <span className="text-sm">{expandedStep === idx ? '▼' : '▶'}</span>
              </div>
            </div>

            {/* Vertical Line Connector */}
            {idx < instructions.length - 1 && (
              <div className="absolute left-0 pl-4 ml-3 border-l-2" style={{
                borderColor: '#1e3a5f',
                height: '20px'
              }}></div>
            )}
          </div>
        ))}
      </div>

      {/* Summary Footer */}
      <div className="bg-gray-900 px-4 py-3 border-t" style={{ borderColor: '#1e3a5f' }}>
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <p style={{ color: '#8ba3c4' }}>Total Distance</p>
            <p className="font-bold text-white">{route.distance} km</p>
          </div>
          <div>
            <p style={{ color: '#8ba3c4' }}>Estimated Time</p>
            <p className="font-bold text-white">{route.duration} min</p>
          </div>
          <div>
            <p style={{ color: '#8ba3c4' }}>Risk Level</p>
            <p className={`font-bold ${
              route.riskLevel === 'High' ? 'text-red-400' :
              route.riskLevel === 'Medium' ? 'text-yellow-400' :
              'text-green-400'
            }`}>{route.riskLevel}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TurnByTurnInstructions
