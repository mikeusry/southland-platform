/**
 * Product path for an AI search result URL.
 * The handle is the last non-empty path segment after the query and hash are removed.
 * Returns null when there is no usable handle, so the page can skip the link.
 */
export function productSearchHref(url: string): string | null {
  const withoutQueryOrHash = url.split(/[?#]/)[0] ?? ''
  const path = withoutQueryOrHash.replace(/^[a-z][a-z\d+.-]*:\/\/[^/]*/i, '')
  const handle = path
    .split('/')
    .filter((segment) => segment.length > 0)
    .at(-1)
  if (!handle) return null
  return `/products/${handle}/`
}
