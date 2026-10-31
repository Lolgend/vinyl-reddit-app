import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from './components/AppShell'
import { DemandDashboard } from './pages/DemandDashboard'
import { DirectoryExplorer } from './pages/DirectoryExplorer'
import { AlbumDetail } from './pages/AlbumDetail'
import { ReleaseDetail } from './pages/ReleaseDetail'
import { ArtistDetail } from './pages/ArtistDetail'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
})

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DemandDashboard />} />
            <Route path="directory" element={<DirectoryExplorer />} />
            <Route path="albums/:albumId" element={<AlbumDetail />} />
            <Route path="releases/:releaseId" element={<ReleaseDetail />} />
            <Route path="artists/:artistId" element={<ArtistDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
