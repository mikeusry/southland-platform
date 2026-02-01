import { useState } from 'react';
import type { NavItem } from '@southland/ui-schema';

interface HeaderProps {
  logoUrl: string;
  logoAlt: string;
  navigation: NavItem[];
  currentPath?: string;
}

function NavDropdown({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <a
        href={item.href}
        className={`inline-flex items-center px-4 py-3 text-base font-semibold transition-colors ${
          isActive
            ? 'text-shopify-accent'
            : 'text-shopify-text hover:text-shopify-accent'
        }`}
      >
        {item.label}
        {hasChildren && (
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </a>
      {hasChildren && isOpen && (
        <div className="absolute top-full left-0 pt-1 z-50">
          <div className="bg-white shadow-lg border border-gray-200 py-2 min-w-[220px] rounded">
            {item.children!.map((child) => (
              <a
                key={child.label}
                href={child.href}
                className="block px-4 py-2.5 text-sm text-shopify-text hover:bg-gray-50 hover:text-shopify-accent transition-colors"
              >
                {child.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Header({ logoUrl, logoAlt, navigation, currentPath }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isItemActive = (item: NavItem) => {
    if (!currentPath) return false;
    if (item.href === currentPath) return true;
    if (item.label === 'Home' && currentPath === '/') return true;
    return currentPath.startsWith(item.href) && item.href !== '/';
  };

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[75px]">
          {/* Logo */}
          <a href="https://southlandorganics.com" className="flex-shrink-0">
            <img
              src={logoUrl}
              alt={logoAlt}
              className="h-12 w-auto"
            />
          </a>

          {/* Desktop Navigation - centered */}
          <nav className="hidden md:flex items-center space-x-2">
            {navigation.map((item) => (
              <NavDropdown
                key={item.label}
                item={item}
                isActive={isItemActive(item)}
              />
            ))}
          </nav>

          {/* Right side icons */}
          <div className="flex items-center space-x-2">
            {/* Account */}
            <a
              href="https://southlandorganics.com/account/login"
              className="p-2 text-shopify-text hover:text-shopify-accent transition-colors"
              aria-label="Account"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </a>

            {/* Search */}
            <a
              href="https://southlandorganics.com/search"
              className="p-2 text-shopify-text hover:text-shopify-accent transition-colors"
              aria-label="Search"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </a>

            {/* Cart */}
            <a
              href="https://southlandorganics.com/cart"
              className="p-2 text-shopify-text hover:text-shopify-accent transition-colors relative"
              aria-label="Cart"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </a>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-shopify-text hover:text-shopify-title transition-colors"
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="md:hidden border-t border-gray-100 bg-white max-h-[calc(100vh-75px)] overflow-y-auto">
          <div className="px-4 py-4">
            {navigation.map((item) => (
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
                  <div className="pl-4 pb-3">
                    {item.children.map((child) => (
                      <a
                        key={child.label}
                        href={child.href}
                        className="block py-2 text-sm text-shopify-secondary-text hover:text-shopify-accent transition-colors"
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
