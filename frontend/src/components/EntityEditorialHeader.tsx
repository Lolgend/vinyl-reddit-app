import React from 'react'
import { VinylMonogram } from './VinylMonogram'
import {
  PILL_BUTTON_ACTIVE_CLASS,
  PILL_BUTTON_BASE_CLASS,
  PILL_BUTTON_INACTIVE_CLASS,
} from '../utils/uiClasses'

export type HypeWindow = '24H' | '7D' | '1M'

const WINDOW_OPTIONS: HypeWindow[] = ['24H', '7D', '1M']

export interface EntityEditorialHeaderProps {
  entityLabel: 'ALBUM' | 'RELEASE' | 'ARTIST'
  activeWindow: HypeWindow
  onWindowChange: (w: HypeWindow) => void
  backLinks: React.ReactNode
  monogram: {
    name: string
    entityId: string
    shape: 'circle' | 'square'
  }
  children: React.ReactNode
}

/**
 * Monochrome editorial super-header, Hype Window pill switcher, and masthead card
 * shared across Album, Release, and Artist detail pages.
 */
export const EntityEditorialHeader: React.FC<EntityEditorialHeaderProps> = ({
  entityLabel,
  activeWindow,
  onWindowChange,
  backLinks,
  monogram,
  children,
}) => {
  return (
    <div className="flex flex-col gap-6">
      {backLinks && <div>{backLinks}</div>}

      <div
        className="border-b-[3px] border-[#121212] pb-3 flex flex-wrap items-end justify-between gap-3"
        data-testid="entity-super-header"
      >
        <span className="font-grotesk font-bold text-4xl sm:text-5xl uppercase tracking-tighter text-[#121212] leading-none">
          {entityLabel}
        </span>

        <div
          role="group"
          aria-label="Hype Window"
          className="flex items-center gap-1 p-1 bg-canvas rounded-full border-strong shrink-0"
        >
          {WINDOW_OPTIONS.map((w) => {
            const isActive = activeWindow === w
            return (
              <button
                key={w}
                type="button"
                data-window={w}
                aria-pressed={isActive}
                onClick={() => onWindowChange(w)}
                className={`${PILL_BUTTON_BASE_CLASS} ${
                  isActive ? PILL_BUTTON_ACTIVE_CLASS : PILL_BUTTON_INACTIVE_CLASS
                }`}
              >
                {w}
              </button>
            )
          })}
        </div>
      </div>

      <div
        className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
        data-testid="entity-masthead"
      >
        <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
          <VinylMonogram
            name={monogram.name}
            entityId={monogram.entityId}
            size={68}
            shape={monogram.shape}
          />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  )
}
