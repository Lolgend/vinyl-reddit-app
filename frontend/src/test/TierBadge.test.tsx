import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TierBadge } from '../components/TierBadge'

describe('TierBadge Component', () => {
  it('renders high tier badge with green background and value', () => {
    render(<TierBadge value={85} tier="high" />)
    const badge = screen.getByText('85').closest('span')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('85')
    expect(badge).toHaveTextContent(/high/i)
    expect(badge?.className).toContain('bg-[#68D391]')
  })

  it('renders moderate tier badge with yellow background', () => {
    render(<TierBadge hypeIndex={55} tier="moderate" />)
    const badge = screen.getByText('55').closest('span')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent(/moderate/i)
    expect(badge?.className).toContain('bg-[#ECC94B]')
  })

  it('renders low tier badge with gray background', () => {
    render(<TierBadge index={20} tier="low" />)
    const badge = screen.getByText('20').closest('span')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent(/low/i)
    expect(badge?.className).toContain('bg-[#E5E0DA]')
  })
})
