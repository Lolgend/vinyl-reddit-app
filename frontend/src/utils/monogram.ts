const PALETTE = ['#9B6DFF', '#68D391', '#ECC94B', '#E5E0DA', '#FFFFFF']

export function getInitials(name: string): string {
  if (!name) return 'VD'
  const words = name.trim().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }
  return 'VD'
}

export function getSwatchColor(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }
  const index = Math.abs(hash) % PALETTE.length
  return PALETTE[index]
}
