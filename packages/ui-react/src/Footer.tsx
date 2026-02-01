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

// Payment method icons
const paymentIcons = {
  amex: (
    <svg className="h-8 w-auto" viewBox="0 0 38 24" fill="none">
      <rect width="38" height="24" rx="3" fill="#006FCF"/>
      <path d="M10.5 16.5L8 11.5H9.5L11 14.5L12.5 11.5H14L11.5 16.5H10.5ZM14 16.5V11.5H15.5V16.5H14ZM16 14C16 12.5 17 11.5 18.5 11.5C20 11.5 21 12.5 21 14C21 15.5 20 16.5 18.5 16.5C17 16.5 16 15.5 16 14ZM17.5 14C17.5 14.75 18 15.25 18.5 15.25C19 15.25 19.5 14.75 19.5 14C19.5 13.25 19 12.75 18.5 12.75C18 12.75 17.5 13.25 17.5 14ZM21.5 16.5V11.5H23L25 14.5V11.5H26.5V16.5H25L23 13.5V16.5H21.5Z" fill="white"/>
    </svg>
  ),
  apple: (
    <svg className="h-8 w-auto" viewBox="0 0 38 24" fill="none">
      <rect width="38" height="24" rx="3" fill="black"/>
      <path d="M19 7.5C17.5 7.5 16.5 8.5 16.5 10V10.5H15V12H16.5V16.5H18V12H19.5L19.75 10.5H18V10.25C18 9.75 18.25 9.5 18.75 9.5H20V7.5H19Z" fill="white"/>
    </svg>
  ),
  discover: (
    <svg className="h-8 w-auto" viewBox="0 0 38 24" fill="none">
      <rect width="38" height="24" rx="3" fill="#FF6000"/>
      <circle cx="19" cy="12" r="5" fill="white"/>
    </svg>
  ),
  gpay: (
    <svg className="h-8 w-auto" viewBox="0 0 38 24" fill="none">
      <rect width="38" height="24" rx="3" fill="white" stroke="#E5E5E5"/>
      <path d="M19 8C16.8 8 15 9.8 15 12C15 14.2 16.8 16 19 16C21.2 16 23 14.2 23 12C23 9.8 21.2 8 19 8Z" fill="#4285F4"/>
    </svg>
  ),
  paypal: (
    <svg className="h-8 w-auto" viewBox="0 0 38 24" fill="none">
      <rect width="38" height="24" rx="3" fill="#003087"/>
      <path d="M15 16.5L16.5 8.5H19C20.5 8.5 21.5 9.5 21.5 11C21.5 13 20 14 18 14H17L16.5 16.5H15Z" fill="white"/>
    </svg>
  ),
  shopify: (
    <svg className="h-8 w-auto" viewBox="0 0 38 24" fill="none">
      <rect width="38" height="24" rx="3" fill="#96BF48"/>
      <path d="M19 7L22 12L19 17L16 12L19 7Z" fill="white"/>
    </svg>
  ),
  visa: (
    <svg className="h-8 w-auto" viewBox="0 0 38 24" fill="none">
      <rect width="38" height="24" rx="3" fill="#1A1F71"/>
      <path d="M16 15.5L17.5 8.5H19.5L18 15.5H16ZM23 8.5L21 13L20.5 8.5H18.5L20.5 15.5H22.5L26 8.5H23Z" fill="white"/>
    </svg>
  ),
};

// Default molecules pattern from Cloudinary
const DEFAULT_MOLECULES_URL = 'https://res.cloudinary.com/southland-organics/image/upload/f_auto,q_auto/Southland%20Website/Southland%20Branding/patterns/top_molecules_green_zeewhr';

// Default white logo from Cloudinary (horizontal white version)
const DEFAULT_WHITE_LOGO_URL = 'https://res.cloudinary.com/southland-organics/image/upload/f_auto,q_auto,w_300/Southland%20Website/Southland%20Branding/logos/Southland_Organics_Horizontal_yymno6';

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
      {/* Main footer - Green with molecules pattern */}
      <div
        className="relative"
        style={{
          backgroundColor: '#44883e',
          backgroundImage: `url(${patternUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
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
                className="h-32 w-auto"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </a>
          </div>

          {/* Three column layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 text-white">
            {/* Left column - Company info + Social */}
            <div className="text-center md:text-left">
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
              <div className="mt-8">
                <h4 className="font-semibold text-lg mb-4">Let's Be Social</h4>
                <div className="flex justify-center md:justify-start gap-4">
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

            {/* Middle column - Navigate */}
            <div className="text-center">
              <h3 className="font-semibold text-lg mb-4">Navigate</h3>
              <ul className="space-y-2">
                {visibleColumns.flatMap(col => col.links).slice(0, 12).map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-white/90 text-sm hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right column - Product Specialties */}
            <div className="text-center md:text-right">
              <h3 className="font-semibold text-lg mb-4">Product Specialties</h3>
              <ul className="space-y-2">
                <li><a href="https://www.southlandorganics.com/" className="text-white/90 text-sm hover:text-white transition-colors">Home</a></li>
                <li><a href="https://www.southlandorganics.com/collections/poultry" className="text-white/90 text-sm hover:text-white transition-colors">Poultry</a></li>
                <li><a href="https://www.southlandorganics.com/collections/turf" className="text-white/90 text-sm hover:text-white transition-colors">Lawn & Garden</a></li>
                <li><a href="https://www.southlandorganics.com/collections/waste" className="text-white/90 text-sm hover:text-white transition-colors">Septic & Waste</a></li>
                <li><a href="https://www.southlandorganics.com/collections/pig-and-swine-supplements" className="text-white/90 text-sm hover:text-white transition-colors">Swine</a></li>
                <li><a href="https://www.southlandorganics.com/pages/why-southland" className="text-white/90 text-sm hover:text-white transition-colors">About</a></li>
              </ul>

              {/* Sam.Gov section */}
              <div className="mt-8">
                <h4 className="font-semibold text-lg mb-2">Sam.Gov</h4>
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
            {/* Payment icons */}
            <div className="flex items-center gap-2">
              {Object.entries(paymentIcons).map(([name, icon]) => (
                <div key={name} className="opacity-80 hover:opacity-100 transition-opacity">
                  {icon}
                </div>
              ))}
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
