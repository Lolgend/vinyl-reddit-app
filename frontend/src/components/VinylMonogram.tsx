import React from 'react'
import { getInitials, getSwatchColor } from '../utils/monogram'

interface VinylMonogramProps {
  name: string
  entityId?: string
  size?: number
  className?: string
}

export const VinylMonogram: React.FC<VinylMonogramProps> = ({
  name,
  entityId,
  size = 40,
  className = '',
}) => {
  const initials = getInitials(name)
  const swatchBg = getSwatchColor(entityId || name)

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full border-[1.5px] border-[#121212] overflow-hidden select-none shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: '#121212',
      }}
      title={name}
      data-testid="vinyl-monogram"
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        {/* Vinyl outer disc */}
        <circle cx="50" cy="50" r="48" fill="#18181B" stroke="#121212" strokeWidth="2" />
        {/* Concentric sound grooves */}
        <circle cx="50" cy="50" r="42" fill="none" stroke="#27272A" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="36" fill="none" stroke="#27272A" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="#27272A" strokeWidth="1.5" />
        {/* Center label */}
        <circle
          cx="50"
          cy="50"
          r="24"
          fill={swatchBg}
          stroke="#121212"
          strokeWidth="2"
        />
        {/* Center spindle hole */}
        <circle cx="50" cy="50" r="4" fill="#121212" />
      </svg>
      {/* 2-Character Initials */}
      <span
        className="relative z-10 font-bold font-grotesk tracking-tight text-[#121212] pointer-events-none"
        style={{ fontSize: `${Math.round(size * 0.28)}px` }}
      >
        {initials}
      </span>
    </div>
  )
}
