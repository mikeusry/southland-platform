/** Litter Life, Big Ole Bird, ZeroPoint. Not Hen Helper. */
export const COMMERCIAL_HOUSE_HANDLES = [
  'poultry-litter-amendment',
  'poultry-probiotic',
  'zeropoint-industrial',
] as const

export function isCommercialHouseHandle(handle: string): boolean {
  return (COMMERCIAL_HOUSE_HANDLES as readonly string[]).includes(handle)
}
