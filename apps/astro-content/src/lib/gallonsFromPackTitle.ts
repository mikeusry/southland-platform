/**
 * Gallons in a Shopify pack from a variant title or Size option.
 * Quart / pint packs return null so we never show a $/gal on those.
 */

const QUART_OR_PINT = /\b(?:quart|qt|pint|pt)\b/i
const PACKED = /(\d+)\s*[x×]\s*([\d.]+)\s*(?:gallons?|gals?|g)\b/i
const SINGLE = /([\d.]+)\s*(?:gallons?|gals?|g)\b/i

export function gallonsFromPackTitle(title: string): number | null {
  const t = title.trim()
  if (!t) return null
  if (QUART_OR_PINT.test(t) && !/\bgallon/i.test(t)) return null

  const packed = t.match(PACKED)
  if (packed) {
    const n = Number(packed[1]) * Number(packed[2])
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const single = t.match(SINGLE)
  if (single) {
    const n = Number(single[1])
    return Number.isFinite(n) && n > 0 ? n : null
  }

  return null
}

export function gallonsFromVariant(variant: {
  title: string
  selectedOptions: Array<{ name: string; value: string }>
}): number | null {
  const size = variant.selectedOptions.find((o) => o.name === 'Size')?.value
  return gallonsFromPackTitle(size ?? '') ?? gallonsFromPackTitle(variant.title)
}

export function pricePerGallon(amount: number | string, gallons: number): number | null {
  if (!gallons || gallons <= 0) return null
  const n = typeof amount === 'string' ? Number(amount) : amount
  if (!Number.isFinite(n) || n <= 0) return null
  return n / gallons
}
