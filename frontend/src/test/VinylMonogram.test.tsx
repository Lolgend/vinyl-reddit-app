import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VinylMonogram } from '../components/VinylMonogram'
import { getInitials, getSwatchColor } from '../utils/monogram'

describe('VinylMonogram', () => {
  it('extracts two-character initials from multi-word names', () => {
    expect(getInitials('The Dark Side')).toBe('TD')
    expect(getInitials('Abbey Road')).toBe('AR')
  })

  it('extracts first two letters from single-word names', () => {
    expect(getInitials('Pink')).toBe('PI')
    expect(getInitials('Radiohead')).toBe('RA')
  })

  it('provides a deterministic color swatch from palette', () => {
    const palette = ['#9B6DFF', '#68D391', '#ECC94B', '#E5E0DA', '#FFFFFF']
    const color1 = getSwatchColor('album-123')
    const color2 = getSwatchColor('album-123')
    expect(color1).toBe(color2)
    expect(palette).toContain(color1)
  })

  it('renders monogram with SVG grooves and initials', () => {
    render(<VinylMonogram name="Random Access Memories" entityId="daft-punk-ram" size={48} />)
    const monogram = screen.getByTestId('vinyl-monogram')
    expect(monogram).toBeInTheDocument()
    expect(monogram).toHaveClass('rounded-full')
    expect(screen.getByText('RA')).toBeInTheDocument()
  })

  it('supports square sleeve framing when shape="square"', () => {
    render(
      <VinylMonogram
        name="Random Access Memories"
        entityId="daft-punk-ram"
        size={68}
        shape="square"
      />
    )
    const monogram = screen.getByTestId('vinyl-monogram')
    expect(monogram).toHaveClass('rounded-[6px]')
    expect(monogram).not.toHaveClass('rounded-full')
  })
})
