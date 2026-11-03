import React from 'react'
import { Outlet } from 'react-router-dom'
import { NavigationRail } from './NavigationRail'
import { TopBar } from './TopBar'

export const AppShell: React.FC = () => {
  return (
    <div className="min-h-screen flex bg-[#F7F3F0] text-[#121212] font-sans antialiased">
      {/* 240px Fixed Left Sidebar */}
      <NavigationRail />

      {/* Main Workspace Frame */}
      <div className="ml-[240px] flex-1 flex flex-col min-h-screen min-w-0">
        {/* 64px Top Search & Provenance Bar */}
        <TopBar />

        {/* Viewport Workspace */}
        <main className="flex-1 w-full max-w-[1200px] p-8 mx-auto" data-testid="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
