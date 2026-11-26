export const DEFAULT_VARIANT_LABEL = 'Standard Pressing'

/**
 * Formats a nullable or whitespace-only variant string using the DESIGN.md §5 fallback.
 */
export function formatVariantLabel(variant?: string | null): string {
  return variant?.trim() || DEFAULT_VARIANT_LABEL
}
