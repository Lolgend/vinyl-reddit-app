import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { NavigationRail } from './NavigationRail'
import { TopBar } from './TopBar'

export const AppShell: React.FC = () => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-canvas text-ink-primary font-sans antialiased">
      {/* 240px Fixed Left Sidebar (off-canvas drawer below lg) */}
      <NavigationRail
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />

      {/* Main Workspace Frame */}
      <div className="ml-0 lg:ml-[240px] flex-1 flex flex-col min-h-screen min-w-0">
        {/* 64px Top Search & Provenance Bar */}
        <TopBar
          isMobileNavOpen={isMobileNavOpen}
          onOpenMobileNav={() => setIsMobileNavOpen((prev) => !prev)}
        />

        {/* Viewport Workspace */}
        <main
          className="flex-1 w-full max-w-[1200px] p-4 sm:p-6 lg:p-8 mx-auto"
          data-testid="main-content"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
