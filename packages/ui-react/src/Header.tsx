import { useState, useEffect } from 'react'
import type { NavItem, NavChild } from '@southland/ui-schema'

interface HeaderProps {
  logoUrl: string
  logoAlt: string
  navigation: NavItem[]
  currentPath?: string
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

const megaStyles = {
  panel: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0 3rem',
    padding: '1rem 1.5rem',
    borderRadius: '0.5rem',
    boxShadow: '0 18px 45px rgba(15, 23, 42, 0.15)',
    background: '#fff',
    minWidth: '420px',
  } as const,
  label: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#6b7280',
    marginBottom: '0.75rem',
    display: 'block',
  } as const,
  link: {
    display: 'block',
    padding: '0.3rem 0.5rem',
    margin: '0 -0.5rem',
    fontSize: '0.9375rem',
    color: '#111827',
    textDecoration: 'none',
    borderRadius: '0.25rem',
    transition: 'color 0.15s, background 0.15s',
  } as const,
  linkPrimary: {
    fontWeight: 600,
    color: '#2c5234',
  } as const,
}

function MegaLink({ child }: { child: NavChild }) {
  const [hovered, setHovered] = useState(false)
  const primary = isPrimary(child.label)
  return (
    <a
      href={child.href}
      style={{
        ...megaStyles.link,
        ...(primary ? megaStyles.linkPrimary : {}),
        ...(hovered ? { color: '#2c5234', background: '#f3f4f6' } : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {child.label}
    </a>
  )
}

function NavDropdown({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const hasChildren = item.children && item.children.length > 0
  const grouped = hasChildren ? groupChildren(item.children!) : null

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <a
        href={item.href}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          fontSize: '1rem',
          fontWeight: 600,
          transition: 'color 0.15s',
          color: isActive ? '#44883e' : '#191d21',
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.color = '#44883e'
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.color = '#191d21'
        }}
      >
        {item.label}
        {hasChildren && (
          <svg
            style={{
              marginLeft: '0.25rem',
              width: '1rem',
              height: '1rem',
              transition: 'transform 0.2s',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </a>
      {hasChildren && isOpen && (
        <div style={{ position: 'absolute', left: 0, top: '100%', zIndex: 50, paddingTop: '0.25rem' }}>
          {grouped ? (
            <div style={megaStyles.panel}>
              {grouped.map(([groupName, children]) => (
                <div key={groupName}>
                  <span style={megaStyles.label}>{groupName}</span>
                  {children.map((child) => (
                    <MegaLink key={child.label} child={child} />
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
                <MegaLink key={child.label} child={child} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Header({ logoUrl, logoAlt, navigation, currentPath }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  // Read cart count from localStorage on mount + listen for cart-changed events
  useEffect(() => {
    // Read persisted count (set by cart.ts on every mutation)
    try {
      const stored = localStorage.getItem('southland_cart_count')
      if (stored) setCartCount(parseInt(stored, 10) || 0)
    } catch {}

    function handleCartChanged(e: Event) {
      const cart = (e as CustomEvent).detail as { totalQuantity?: number } | null
      const count = cart?.totalQuantity ?? 0
      setCartCount(count)
      try { localStorage.setItem('southland_cart_count', String(count)) } catch {}
    }

    window.addEventListener('cart-changed', handleCartChanged)
    return () => window.removeEventListener('cart-changed', handleCartChanged)
  }, [])

  const isItemActive = (item: NavItem) => {
    if (!currentPath) return false
    if (item.href === currentPath) return true
    if (item.label === 'Home' && currentPath === '/') return true
    return currentPath.startsWith(item.href) && item.href !== '/'
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-[75px] items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex-shrink-0">
            <img src={logoUrl} alt={logoAlt} className="h-12 w-auto" />
          </a>

          {/* Desktop Navigation - centered */}
          <nav className="hidden items-center md:flex">
            {navigation.map((item) => (
              <NavDropdown key={item.label} item={item} isActive={isItemActive(item)} />
            ))}
          </nav>

          {/* Right side icons */}
          <div className="flex items-center space-x-2">
            {/* Account — redirects to Shopify-hosted customer account */}
            <a
              href="https://shop.southlandorganics.com/account"
              className="p-2 text-shopify-text transition-colors hover:text-shopify-accent"
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
              className="p-2 text-shopify-text transition-colors hover:text-shopify-accent"
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
              className="relative p-2 text-shopify-text transition-colors hover:text-shopify-accent"
              aria-label={cartCount > 0 ? `Cart (${cartCount} items)` : 'Cart'}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              {cartCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-green-dark text-[10px] font-bold text-white"
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </a>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-shopify-text transition-colors hover:text-shopify-title md:hidden"
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="max-h-[calc(100vh-75px)] overflow-y-auto border-t border-gray-100 bg-white md:hidden">
          <div className="px-4 py-4">
            {navigation.map((item) => {
              const grouped = item.children ? groupChildren(item.children) : null
              return (
                <div key={item.label} className="border-b border-gray-100 last:border-0">
                  <a
                    href={item.href}
                    className={`block py-3 text-base font-semibold ${
                      isItemActive(item) ? 'text-shopify-accent' : 'text-shopify-text'
                    }`}
                  >
                    {item.label}
                  </a>
                  {item.children && (
                    <div className="pb-3 pl-4">
                      {grouped
                        ? grouped.map(([groupName, children]) => (
                            <div key={groupName} className="mb-3">
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
                              className="block py-2 text-sm text-shopify-secondary-text transition-colors hover:text-shopify-accent"
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
      )}
    </header>
  )
}
