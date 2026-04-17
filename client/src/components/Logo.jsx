import React from 'react'

const Logo = ({ size = 'md' }) => {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className={`${sizeMap[size]} fill-current`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Heart-shaped pin background */}
      <defs>
        <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#cddc39" />
          <stop offset="100%" stopColor="#7cb342" />
        </linearGradient>
      </defs>

      {/* Heart shape (location pin) */}
      <path
        d="M50 85 C25 65, 15 50, 15 40 C15 28, 25 20, 32 20 C38 20, 45 25, 50 32 C55 25, 62 20, 68 20 C75 20, 85 28, 85 40 C85 50, 75 65, 50 85 Z"
        fill="url(#heartGradient)"
      />

      {/* Radar circles */}
      <circle cx="50" cy="42" r="18" fill="none" stroke="white" strokeWidth="2" opacity="0.8" />
      <circle cx="50" cy="42" r="12" fill="none" stroke="white" strokeWidth="1.5" opacity="0.6" />
      <circle cx="50" cy="42" r="6" fill="none" stroke="white" strokeWidth="1" opacity="0.4" />

      {/* Center dot */}
      <circle cx="50" cy="42" r="3" fill="white" />

      {/* Signal waves */}
      <path
        d="M62 32 Q68 28, 72 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M62 42 Q70 42, 78 42"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M62 52 Q68 56, 72 60"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Radar needle/pointer */}
      <line x1="50" y1="42" x2="65" y2="27" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export default Logo
