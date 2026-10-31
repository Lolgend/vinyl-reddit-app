import React from 'react'
import { useSearchParams } from 'react-router-dom'

export const DirectoryExplorer: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'releases'
  const query = searchParams.get('q') || ''

  const handleTabChange = (tab: string) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', tab)
    setSearchParams(nextParams)
  }

  return (
    <div className="flex flex-col gap-6" data-testid="screen-directory-explorer">
      <div>
        <h1 className="font-grotesk font-bold text-2xl text-[#121212] tracking-tight">
          Directory Explorer
        </h1>
        <p className="font-sans text-sm text-[#646464] mt-1">
          Browse indexed catalog across Releases, Albums, and Artists.
        </p>
      </div>

      {/* Tab Selector */}
      <div className="flex items-center gap-2 border-b-[1.5px] border-[#121212] pb-3">
        {(['releases', 'albums', 'artists'] as const).map((tab) => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-1.5 rounded-[9999px] text-xs font-mono font-bold uppercase transition-transform ${
                isActive
                  ? 'bg-[#121212] text-white border-[1.5px] border-[#121212] shadow-brutal-sm'
                  : 'bg-white text-[#121212] border-[1.5px] border-[#121212] hover:bg-[#FAF7F5]'
              }`}
              data-testid={`tab-${tab}`}
            >
              {tab.toUpperCase()}
            </button>
          )
        })}
      </div>

      {/* Directory Content Area */}
      <div className="bg-white border-[1.5px] border-[#121212] rounded-[6px] shadow-brutal-md p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="font-mono text-xs text-[#646464]">
            ACTIVE TAB: <span className="font-bold text-[#121212] uppercase">{activeTab}</span>
            {query && (
              <span className="ml-3">
                QUERY: &quot;<span className="text-[#121212]">{query}</span>&quot;
              </span>
            )}
          </div>
        </div>

        <div className="h-64 flex items-center justify-center text-xs font-mono text-[#646464] border-t border-[#E5E0DA] pt-4">
          Directory catalog data loading...
        </div>
      </div>
    </div>
  )
}
