import type { NavItem, NavChild } from '@southland/ui-schema'

interface StaticHeaderProps {
  logoUrl: string
  logoAlt: string
  navigation: NavItem[]
}

function groupChildren(children: NavChild[]) {
  const hasGroups = children.some((c) => c.group)
  if (!hasGroups) return null
  const groups: Record<string, NavChild[]> = {}
  for (const child of children) {
    const key = child.group || ''
    if (!groups[key]) groups[key] = []
    groups[key].push(child)
  }
  return Object.entries(groups)
}

const isPrimary = (label: string) => label.startsWith('Shop All')

/**
 * CSS-only header for static rendering via renderToStaticMarkup().
 * Used by HTMLRewriter to inject into Shopify pages.
 *
 * Unlike Header.tsx (React), this uses:
 * - CSS group-hover for desktop dropdowns (no useState)
 * - data-sl-* attributes for vanilla JS mobile menu toggle
 * - data-sl-nav-href for client-side active highlighting
 * - Inline styles for mega-menu grid (no Tailwind dependency)
 */
export function StaticHeader({ logoUrl, logoAlt, navigation }: StaticHeaderProps) {
  return (
    <header className="sl-header sticky top-0 z-50 border-b border-gray-100 bg-white">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-[75px] items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex-shrink-0">
            <img src={logoUrl} alt={logoAlt} className="h-12 w-auto" />
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden items-center md:flex">
            {navigation.map((item) => {
              const hasChildren = item.children && item.children.length > 0
              const grouped = hasChildren ? groupChildren(item.children!) : null
              return (
                <div key={item.label} className="group relative">
                  <a
                    href={item.href}
                    data-sl-nav-href={item.href}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.75rem 1rem',
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: '#191d21',
                      textDecoration: 'none',
                      transition: 'color 0.15s',
                    }}
                    className="sl-nav-link"
                  >
                    {item.label}
                    {hasChildren && (
                      <svg
                        style={{ marginLeft: '0.25rem', width: '1rem', height: '1rem' }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    )}
                  </a>
                  {hasChildren && (
                    <div
                      className="sl-mega-wrapper"
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '100%',
                        zIndex: 50,
                        paddingTop: '0.25rem',
                        display: 'none',
                      }}
                    >
                      {grouped ? (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '0 3rem',
                            padding: '1rem 1.5rem',
                            borderRadius: '0.5rem',
                            boxShadow: '0 18px 45px rgba(15, 23, 42, 0.15)',
                            background: '#fff',
                            minWidth: '420px',
                          }}
                        >
                          {grouped.map(([groupName, children]) => (
                            <div key={groupName}>
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.08em',
                                  color: '#6b7280',
                                  marginBottom: '0.75rem',
                                  display: 'block',
                                }}
                              >
                                {groupName}
                              </span>
                              {children.map((child) => (
                                <a
                                  key={child.label}
                                  href={child.href}
                                  className="sl-mega-link"
                                  style={{
                                    display: 'block',
                                    padding: '0.3rem 0.5rem',
                                    margin: '0 -0.5rem',
                                    fontSize: '0.9375rem',
                                    color: isPrimary(child.label) ? '#2c5234' : '#111827',
                                    fontWeight: isPrimary(child.label) ? 600 : 400,
                                    textDecoration: 'none',
                                    borderRadius: '0.25rem',
                                    transition: 'color 0.15s, background 0.15s',
                                  }}
                                >
                                  {child.label}
                                </a>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          style={{
                            minWidth: '220px',
                            borderRadius: '0.5rem',
                            boxShadow: '0 18px 45px rgba(15, 23, 42, 0.15)',
                            background: '#fff',
                            padding: '1rem 1.5rem',
                          }}
                        >
                          {item.children!.map((child) => (
                            <a
                              key={child.label}
                              href={child.href}
                              className="sl-mega-link"
                              style={{
                                display: 'block',
                                padding: '0.3rem 0.5rem',
                                margin: '0 -0.5rem',
                                fontSize: '0.9375rem',
                                color: '#111827',
                                textDecoration: 'none',
                                borderRadius: '0.25rem',
                                transition: 'color 0.15s, background 0.15s',
                              }}
                            >
                              {child.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Right side icons */}
          <div className="flex items-center space-x-2">
            {/* Account — redirects to Shopify-hosted customer account */}
            <a
              href="https://shop.southlandorganics.com/account"
              className="text-shopify-text hover:text-shopify-accent p-2 transition-colors"
              aria-label="Account"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </a>

            {/* Search */}
            <a
              href="/search"
              className="text-shopify-text hover:text-shopify-accent p-2 transition-colors"
              aria-label="Search"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </a>

            {/* Cart */}
            <a
              href="/cart"
              className="text-shopify-text hover:text-shopify-accent relative p-2 transition-colors"
              aria-label="Cart"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </a>

            {/* Mobile menu button */}
            <button
              data-sl-menu-toggle
              className="text-shopify-text hover:text-shopify-title p-2 transition-colors md:hidden"
              aria-label="Menu"
            >
              <svg
                data-sl-icon-open
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              <svg
                data-sl-icon-close
                className="hidden h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation - hidden by default, toggled via JS */}
      <nav
        data-sl-mobile-menu
        className="hidden max-h-[calc(100vh-75px)] overflow-y-auto border-t border-gray-100 bg-white md:hidden"
      >
        <div className="px-4 py-4">
          {navigation.map((item) => {
            const grouped = item.children ? groupChildren(item.children) : null
            return (
              <div key={item.label} className="border-b border-gray-100 last:border-0">
                <a
                  href={item.href}
                  data-sl-nav-href={item.href}
                  className="text-shopify-text block py-3 text-base font-semibold"
                >
                  {item.label}
                </a>
                {item.children && (
                  <div className="pb-3 pl-4">
                    {grouped
                      ? grouped.map(([groupName, children]) => (
                          <div key={groupName} style={{ marginBottom: '0.75rem' }}>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                color: '#6b7280',
                                marginBottom: '0.25rem',
                                display: 'block',
                              }}
                            >
                              {groupName}
                            </span>
                            {children.map((child) => (
                              <a
                                key={child.label}
                                href={child.href}
                                style={{
                                  display: 'block',
                                  padding: '0.375rem 0',
                                  fontSize: '0.875rem',
                                  color: isPrimary(child.label) ? '#2c5234' : '#686363',
                                  fontWeight: isPrimary(child.label) ? 600 : 400,
                                  textDecoration: 'none',
                                }}
                              >
                                {child.label}
                              </a>
                            ))}
                          </div>
                        ))
                      : item.children.map((child) => (
                          <a
                            key={child.label}
                            href={child.href}
                            className="text-shopify-secondary-text hover:text-shopify-accent block py-2 text-sm transition-colors"
                          >
                            {child.label}
                          </a>
                        ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Inline CSS for hover states (no Tailwind dependency) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
.sl-nav-link:hover { color: #44883e !important; }
.group:hover .sl-mega-wrapper { display: block !important; }
.sl-mega-link:hover { color: #2c5234 !important; background: #f3f4f6 !important; }
`,
        }}
      />
    </header>
  )
}
