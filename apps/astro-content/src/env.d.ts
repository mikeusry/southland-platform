/// <reference types="astro/client" />

/**
 * Global type declarations for analytics and tracking
 */

interface PointDogPixel {
  track: (event: string, properties?: Record<string, any>) => void;
  identify: (userId: string, traits?: Record<string, any>) => void;
  page: (properties?: Record<string, any>) => void;
}

interface Window {
  /** point.dog analytics pixel */
  pdPixel?: PointDogPixel;

  /** point.dog pixel configuration */
  pdPixelConfig?: {
    brandId: string;
    endpoint: string;
  };

  /** Google Tag Manager dataLayer */
  dataLayer?: Array<Record<string, any>>;
}
