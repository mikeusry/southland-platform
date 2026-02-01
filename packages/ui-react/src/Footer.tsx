import type { FooterData } from '@southland/ui-schema';

interface FooterProps extends FooterData {
  /** URL for the white logo (used on green background) */
  whiteLogoUrl?: string;
  /** URL for the molecules background pattern */
  moleculesPatternUrl?: string;
  /** Company address */
  address?: string;
  /** Company phone */
  phone?: string;
}

const socialIcons: Record<string, JSX.Element> = {
  facebook: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  instagram: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"/>
    </svg>
  ),
  youtube: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  twitter: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  pinterest: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/>
    </svg>
  ),
};

// Default molecules pattern from Cloudinary
const DEFAULT_MOLECULES_URL = 'https://res.cloudinary.com/southland-organics/image/upload/f_auto,q_auto/Southland%20Website/Southland%20Branding/patterns/top_molecules_green_zeewhr';

// Default white logo from Cloudinary (square white version)
const DEFAULT_WHITE_LOGO_URL = 'https://res.cloudinary.com/southland-organics/image/upload/f_auto,q_auto,w_400/Southland%20Website/Southland%20Branding/logos/Southland_Organics_Square_White_tuwhqk';

export function Footer({
  columns,
  copyright,
  socialLinks,
  whiteLogoUrl,
  moleculesPatternUrl,
  address = '189 Luke Road\nBogart, GA 30622',
  phone = '800-608-3755'
}: FooterProps) {
  // Filter out columns with no links
  const visibleColumns = columns.filter(col => col.links && col.links.length > 0);

  const logoUrl = whiteLogoUrl || DEFAULT_WHITE_LOGO_URL;
  const patternUrl = moleculesPatternUrl || DEFAULT_MOLECULES_URL;

  return (
    <footer>
      {/* Main footer - Green with molecules pattern + parallax */}
      <div
        className="relative"
        style={{
          backgroundColor: '#44883e',
          backgroundImage: `url(${patternUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed', // Parallax effect
          backgroundBlendMode: 'soft-light',
        }}
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          {/* Centered Logo */}
          <div className="flex justify-center mb-12">
            <a href="https://southlandorganics.com" className="inline-block">
              <img
                src={logoUrl}
                alt="Southland Organics"
                className="h-40 w-auto"
              />
            </a>
          </div>

          {/* Four column layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 text-white">
            {/* Column 1 - Company info + Social */}
            <div className="text-center sm:text-left">
              <h3 className="font-semibold text-lg mb-4">Southland Organics</h3>
              <p className="text-white/90 text-sm whitespace-pre-line mb-4">
                {address}
              </p>
              <a
                href={`tel:${phone.replace(/[^0-9]/g, '')}`}
                className="text-white underline hover:text-white/80 transition-colors"
              >
                {phone}
              </a>

              {/* Social links */}
              <div className="mt-6">
                <h4 className="font-semibold text-sm mb-3">Let's Be Social</h4>
                <div className="flex justify-center sm:justify-start gap-3">
                  {socialLinks.map((social) => (
                    <a
                      key={social.platform}
                      href={social.url}
                      className="text-white hover:text-white/80 transition-colors"
                      aria-label={social.platform}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {socialIcons[social.platform] || social.icon}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 2 - Navigate */}
            <div className="text-center sm:text-left">
              <h3 className="font-semibold text-lg mb-4">Navigate</h3>
              <ul className="space-y-2">
                <li><a href="https://www.southlandorganics.com/pages/why-southland" className="text-white/90 text-sm hover:text-white transition-colors">Why Choose Southland</a></li>
                <li><a href="https://www.southlandorganics.com/pages/store-locator" className="text-white/90 text-sm hover:text-white transition-colors">Store Locator</a></li>
                <li><a href="https://www.southlandorganics.com/pages/become-a-distributor" className="text-white/90 text-sm hover:text-white transition-colors">Become a Distributor</a></li>
                <li><a href="https://www.southlandorganics.com/blogs/poultry-biosecurity" className="text-white/90 text-sm hover:text-white transition-colors">Poultry Biosecurity</a></li>
                <li><a href="https://www.southlandorganics.com/blogs/news" className="text-white/90 text-sm hover:text-white transition-colors">Blog Posts</a></li>
                <li><a href="https://www.southlandorganics.com/blogs/case-studies" className="text-white/90 text-sm hover:text-white transition-colors">Case Studies</a></li>
                <li><a href="https://www.southlandorganics.com/search" className="text-white/90 text-sm hover:text-white transition-colors">Search</a></li>
                <li><a href="https://www.southlandorganics.com/pages/contact" className="text-white/90 text-sm hover:text-white transition-colors">Contact</a></li>
                <li><a href="https://www.southlandorganics.com/pages/southland-organics-rewards" className="text-white/90 text-sm hover:text-white transition-colors">Rewards Program</a></li>
              </ul>
            </div>

            {/* Column 3 - Product Specialties */}
            <div className="text-center sm:text-left">
              <h3 className="font-semibold text-lg mb-4">Product Specialties</h3>
              <ul className="space-y-2">
                <li><a href="https://www.southlandorganics.com/" className="text-white/90 text-sm hover:text-white transition-colors">Home</a></li>
                <li><a href="https://www.southlandorganics.com/collections/poultry" className="text-white/90 text-sm hover:text-white transition-colors">Poultry</a></li>
                <li><a href="https://www.southlandorganics.com/collections/turf" className="text-white/90 text-sm hover:text-white transition-colors">Lawn & Garden</a></li>
                <li><a href="https://www.southlandorganics.com/collections/waste" className="text-white/90 text-sm hover:text-white transition-colors">Septic & Waste</a></li>
                <li><a href="https://www.southlandorganics.com/collections/pig-and-swine-supplements" className="text-white/90 text-sm hover:text-white transition-colors">Swine</a></li>
                <li><a href="https://www.southlandorganics.com/pages/why-southland" className="text-white/90 text-sm hover:text-white transition-colors">About</a></li>
              </ul>
            </div>

            {/* Column 4 - Podcast + Sam.Gov */}
            <div className="text-center sm:text-left">
              <h3 className="font-semibold text-lg mb-4">Ag & Culture Podcast</h3>
              <ul className="space-y-2">
                {visibleColumns.find(c => c.title.includes('Podcast'))?.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-white/90 text-sm hover:text-white transition-colors">
                      {link.label}
                    </a>
                  </li>
                )) || (
                  <>
                    <li><a href="/podcast/" className="text-white/90 text-sm hover:text-white transition-colors">All Episodes</a></li>
                    <li><a href="/podcast/topics/" className="text-white/90 text-sm hover:text-white transition-colors">Topics</a></li>
                    <li><a href="/podcast/guests/" className="text-white/90 text-sm hover:text-white transition-colors">Guests</a></li>
                  </>
                )}
              </ul>

              {/* Sam.Gov section */}
              <div className="mt-6">
                <h4 className="font-semibold text-sm mb-2">Sam.Gov</h4>
                <p className="text-white/80 text-xs">
                  Southland Organics is fully registered with Sam.gov!<br />
                  Entity ID: L9GTYJCHK2Q5
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar - Black background */}
      <div className="bg-black">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            {/* Payment methods - proper SVG icons */}
            <div className="flex items-center gap-2">
              {/* American Express */}
              <svg className="h-8 w-12" viewBox="0 0 50 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="50" height="32" rx="4" fill="#006FCF"/>
                <path d="M10.5 21L7 13H9.5L11.5 18L13.5 13H16L12.5 21H10.5ZM16 21V13H18V21H16ZM19 17C19 14.8 20.5 13 23 13C25.5 13 27 14.8 27 17C27 19.2 25.5 21 23 21C20.5 21 19 19.2 19 17ZM21.5 17C21.5 18.1 22.1 19 23 19C23.9 19 24.5 18.1 24.5 17C24.5 15.9 23.9 15 23 15C22.1 15 21.5 15.9 21.5 17ZM28 21V13H30.5L34 18V13H36V21H33.5L30 16V21H28ZM43 21H37V13H43V15H39.5V16H43V18H39.5V19H43V21Z" fill="white"/>
              </svg>
              {/* Apple Pay */}
              <svg className="h-8 w-12" viewBox="0 0 50 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="50" height="32" rx="4" fill="#000"/>
                <path d="M17.2 10.5C17.7 9.9 18 9.1 17.9 8.3C17.1 8.4 16.2 8.8 15.7 9.4C15.2 10 14.8 10.8 14.9 11.6C15.8 11.7 16.6 11.1 17.2 10.5ZM17.9 11.8C16.7 11.7 15.7 12.5 15.1 12.5C14.5 12.5 13.6 11.8 12.6 11.8C11.3 11.8 10.1 12.6 9.4 13.8C8 16.2 9.1 19.7 10.5 21.7C11.2 22.7 12 23.8 13.1 23.8C14.1 23.7 14.5 23.1 15.7 23.1C16.9 23.1 17.2 23.8 18.3 23.7C19.4 23.7 20.1 22.7 20.8 21.7C21.6 20.6 21.9 19.5 21.9 19.4C21.9 19.4 19.7 18.5 19.7 16C19.7 13.8 21.5 12.8 21.6 12.7C20.5 11.1 18.8 11.8 17.9 11.8ZM28 10.7V23.6H30.2V18.6H33.6C36.7 18.6 38.9 16.5 38.9 14.6C38.9 12.7 36.8 10.7 33.7 10.7H28ZM30.2 12.6H33C35.1 12.6 36.6 13.4 36.6 14.6C36.6 15.8 35.1 16.7 33 16.7H30.2V12.6ZM43.6 23.7C45.1 23.7 46.5 22.9 47.1 21.6H47.2V23.6H49.2V16.4C49.2 14 47.3 12.4 44.4 12.4C41.7 12.4 39.7 14 39.6 16.1H41.6C41.8 15.1 42.8 14.3 44.3 14.3C46.1 14.3 47.1 15.1 47.1 16.6V17.5L43.8 17.7C40.8 17.9 39.2 19.1 39.2 20.7C39.2 22.4 40.9 23.7 43.6 23.7ZM44.2 21.9C42.7 21.9 41.5 21.2 41.5 20.1C41.5 19 42.5 18.4 44.2 18.3L47.1 18.1V19C47.1 20.7 45.8 21.9 44.2 21.9Z" fill="white"/>
              </svg>
              {/* Diners Club */}
              <svg className="h-8 w-12" viewBox="0 0 50 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="50" height="32" rx="4" fill="#0079BE"/>
                <path d="M25 6C17.3 6 11 12.3 11 20C11 24.4 17.3 26 25 26C32.7 26 39 24.4 39 20C39 12.3 32.7 6 25 6ZM18 20C18 16.1 20.7 12.9 24.3 12.2V27.8C20.7 27.1 18 23.9 18 20ZM25.7 27.8V12.2C29.3 12.9 32 16.1 32 20C32 23.9 29.3 27.1 25.7 27.8Z" fill="white"/>
              </svg>
              {/* Discover */}
              <svg className="h-8 w-12" viewBox="0 0 50 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="50" height="32" rx="4" fill="#FF6000"/>
                <ellipse cx="30" cy="16" rx="8" ry="7" fill="#FF6000" stroke="white" strokeWidth="2"/>
                <path d="M8 13H10C12.2 13 14 14.3 14 16C14 17.7 12.2 19 10 19H8V13ZM10 17.5C11.1 17.5 12 16.9 12 16C12 15.1 11.1 14.5 10 14.5H10V17.5Z" fill="white"/>
                <path d="M15 13H17V19H15V13Z" fill="white"/>
                <path d="M18 17.5C18.3 18 19 18.5 20 18.5C21 18.5 21.5 18 21.5 17.5C21.5 16.5 18 16.5 18 14.5C18 13.5 19 13 20 13C21 13 21.8 13.5 22 14L20.5 15C20.3 14.7 20 14.5 19.5 14.5C19 14.5 18.8 14.7 18.8 15C18.8 16 22.3 16 22.3 18C22.3 19 21.3 19.5 20 19.5C19 19.5 18 19 17.5 18L18 17.5Z" fill="white"/>
              </svg>
              {/* Google Pay */}
              <svg className="h-8 w-12" viewBox="0 0 50 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="50" height="32" rx="4" fill="white" stroke="#E5E5E5"/>
                <path d="M23.5 16.5V20H22V11H25.5C26.5 11 27.4 11.4 28 12C28.7 12.7 29 13.5 29 14.5C29 15.5 28.7 16.3 28 17C27.4 17.6 26.5 18 25.5 18H23.5V16.5H25.5C26 16.5 26.5 16.3 26.8 16C27.2 15.7 27.4 15.2 27.4 14.5C27.4 13.8 27.2 13.3 26.8 13C26.5 12.7 26 12.5 25.5 12.5H23.5V16.5Z" fill="#5F6368"/>
                <path d="M33.5 14C34.5 14 35.3 14.3 35.9 14.9C36.5 15.5 36.8 16.3 36.8 17.3C36.8 18.3 36.5 19.1 35.9 19.7C35.3 20.3 34.5 20.6 33.5 20.6C32.5 20.6 31.7 20.3 31.1 19.7C30.5 19.1 30.2 18.3 30.2 17.3C30.2 16.3 30.5 15.5 31.1 14.9C31.7 14.3 32.5 14 33.5 14ZM33.5 15.4C32.9 15.4 32.4 15.6 32.1 16C31.7 16.4 31.6 16.8 31.6 17.3C31.6 17.8 31.8 18.2 32.1 18.6C32.4 19 32.9 19.2 33.5 19.2C34.1 19.2 34.6 19 34.9 18.6C35.2 18.2 35.4 17.8 35.4 17.3C35.4 16.8 35.2 16.4 34.9 16C34.6 15.6 34.1 15.4 33.5 15.4Z" fill="#5F6368"/>
                <path d="M42.5 14L39.5 21.5C39 22.7 38.2 23.3 37 23.3C36.6 23.3 36.2 23.2 35.8 23.1V21.7C36.1 21.8 36.4 21.9 36.8 21.9C37.4 21.9 37.8 21.6 38 21L38.2 20.5L35.5 14H37.1L39 18.6L40.9 14H42.5Z" fill="#5F6368"/>
                <path d="M17 16.5C17 14.8 18.5 13.5 20.5 13.5C21.5 13.5 22.3 13.8 22.9 14.3L21.9 15.3C21.5 15 21 14.8 20.4 14.8C19.2 14.8 18.3 15.6 18.3 16.6C18.3 17.6 19.2 18.4 20.4 18.4C21.2 18.4 21.8 18.1 22.1 17.6H20.2V16.3H23.5V16.7C23.5 17.6 23.2 18.4 22.6 19C22 19.6 21.2 20 20.2 20C18.3 19.9 17 18.5 17 16.5Z" fill="#4285F4"/>
              </svg>
              {/* PayPal */}
              <svg className="h-8 w-12" viewBox="0 0 50 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="50" height="32" rx="4" fill="#003087"/>
                <path d="M19.5 8H24C26.5 8 28 9.5 28 11.5C28 14.5 25.5 16.5 22.5 16.5H20.5L19.5 22H16L19.5 8ZM22 14.5C23.5 14.5 25 13.5 25 12C25 11 24.5 10 23 10H21L20 14.5H22Z" fill="white"/>
                <path d="M28.5 12H33C35.5 12 37 13.5 37 15.5C37 18.5 34.5 20.5 31.5 20.5H29.5L28.5 26H25L28.5 12ZM31 18.5C32.5 18.5 34 17.5 34 16C34 15 33.5 14 32 14H30L29 18.5H31Z" fill="#009CDE"/>
              </svg>
              {/* Shop Pay */}
              <svg className="h-8 w-12" viewBox="0 0 50 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="50" height="32" rx="4" fill="#5A31F4"/>
                <path d="M13 12.5C13.3 11.5 14.3 11 15.3 11C16.7 11 17.5 11.8 17.5 13C17.5 13.5 17.3 14 17 14.3C16.7 14.6 16.3 14.8 15.8 14.8H14L13.5 17H15.3C16.3 17 17.1 17.3 17.7 17.8C18.3 18.3 18.6 19 18.6 19.8C18.6 21.5 17.3 22.8 15.3 22.8C13.5 22.8 12.3 21.8 12 20.3L14 19.8C14.1 20.5 14.6 21 15.3 21C16 21 16.5 20.5 16.5 19.8C16.5 19.1 16 18.6 15.3 18.6H12.5L14 12.5H13ZM21 22.5H19L21.5 11H23.5L24 13L26 11H28.5L24.5 15L27 22.5H24.5L23 17L21 22.5ZM31 11H33L35.5 17.5V11H37.5V22.5H35.5L33 16V22.5H31V11Z" fill="white"/>
              </svg>
              {/* Visa */}
              <svg className="h-8 w-12" viewBox="0 0 50 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="50" height="32" rx="4" fill="#1A1F71"/>
                <path d="M21 21H18L20 11H23L21 21ZM16 11L13.5 18L13 15.5L12 12C12 12 11.8 11 10.5 11H6V11.2C6 11.2 7.5 11.5 9 12.5L11.5 21H14.5L19.5 11H16ZM38 21H41L38.5 11H36C35 11 34.8 11.8 34.8 11.8L30 21H33L33.5 19.5H37.5L38 21ZM34.5 17L36 13L37 17H34.5ZM31 14L31.5 11.5C31.5 11.5 30 11 28.5 11C26.5 11 23.5 12 23.5 15C23.5 17.5 27 18 27 19.5C27 20 26.5 20.5 25.5 20.5C24 20.5 22.5 19.5 22.5 19.5L22 22C22 22 23.5 22.5 25.5 22.5C28 22.5 30 21 30 18.5C30 16 26.5 15.5 26.5 14.5C26.5 14 27 13.5 28 13.5C29 13.5 30.5 14 31 14Z" fill="white"/>
              </svg>
            </div>

            {/* Copyright and links */}
            <div className="flex flex-wrap justify-center sm:justify-end items-center gap-2 text-sm text-white/90">
              <span>{copyright}</span>
              <span className="hidden sm:inline">|</span>
              <a href="https://southlandorganics.com/pages/terms-of-service" className="hover:text-white transition-colors">
                Terms Of Use
              </a>
              <span>|</span>
              <a href="https://southlandorganics.com/pages/privacy-policy" className="hover:text-white transition-colors">
                Privacy Policy
              </a>
              <span>|</span>
              <a href="https://southlandorganics.com/pages/shipping-policy" className="hover:text-white transition-colors">
                Shipping & Returns
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
