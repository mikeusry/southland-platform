/** Plain-text excerpt for meta description from Shopify policy HTML */
export function metaDescriptionFromPolicyHtml(html: string, maxLength = 160): string {
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= maxLength) return text
  const truncated = text.slice(0, maxLength - 3).trimEnd()
  const lastSpace = truncated.lastIndexOf(' ')
  const safe = lastSpace > maxLength * 0.6 ? truncated.slice(0, lastSpace) : truncated
  return `${safe}...`
}
