/**
 * Cloudinary utility functions for image optimization
 *
 * This module provides helper functions to generate optimized Cloudinary URLs
 * with transformations for responsive images, performance, and quality.
 *
 * Cloud name: southland-organics
 */

// =============================================================================
// TYPES
// =============================================================================

export type CropMode = 'fill' | 'fit' | 'scale' | 'thumb' | 'crop' | 'pad' | 'limit' | 'lfill' | 'mfit';
export type Gravity = 'auto' | 'face' | 'faces' | 'center' | 'north' | 'south' | 'east' | 'west' | 'north_east' | 'north_west' | 'south_east' | 'south_west';
export type ImageFormat = 'auto' | 'webp' | 'avif' | 'jpg' | 'png' | 'gif';
export type Quality = number | 'auto' | 'auto:best' | 'auto:good' | 'auto:eco' | 'auto:low';

/** Effect types supported by Cloudinary */
export type ImageEffect =
  | 'blur' | 'blur:100' | 'blur:200' | 'blur:500' | 'blur:1000'
  | 'grayscale' | 'sepia' | 'saturation:50' | 'saturation:150'
  | 'brightness:50' | 'brightness:150'
  | 'contrast:50' | 'contrast:150'
  | 'sharpen' | 'unsharp_mask'
  | 'pixelate' | 'pixelate:5' | 'pixelate:10'
  | 'vignette' | 'oil_paint'
  | 'art:athena' | 'art:audrey' | 'art:aurora' | 'art:daguerre' | 'art:eucalyptus'
  | 'art:fes' | 'art:frost' | 'art:hairspray' | 'art:hokusai' | 'art:incognito'
  | 'art:linen' | 'art:peacock' | 'art:primavera' | 'art:quartz' | 'art:red_rock'
  | 'art:refresh' | 'art:sizzle' | 'art:sonnet' | 'art:ukulele' | 'art:zorro';

export interface CloudinaryTransformOptions {
  width?: number;
  height?: number;
  crop?: CropMode;
  quality?: Quality;
  format?: ImageFormat;
  gravity?: Gravity;
  fetchFormat?: 'auto';
  dpr?: number | 'auto';
  /** Apply image effects */
  effect?: ImageEffect | ImageEffect[];
  /** Border (e.g., '2px_solid_rgb:44883e') */
  border?: string;
  /** Radius for rounded corners (e.g., 'max' for circle, or number) */
  radius?: number | 'max';
  /** Background color for transparent images */
  background?: string;
  /** Overlay text or image */
  overlay?: string;
  /** Named transformation preset */
  transformation?: string;
  /** Raw transformation string for advanced use */
  rawTransformation?: string;
}

export interface ResponsiveImageSet {
  src: string;
  srcset: string;
  sizes?: string;
}

export interface PlaceholderOptions {
  /** Type of placeholder */
  type: 'blur' | 'color' | 'pixelate' | 'vectorize' | 'predominant';
  /** For color placeholder, the hex color */
  color?: string;
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Gets the Cloudinary cloud name from environment variables
 * Falls back to import.meta.env for Astro build-time access
 */
export function getCloudName(): string {
  const cloudName =
    import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME ||
    (typeof process !== 'undefined' ? process.env.PUBLIC_CLOUDINARY_CLOUD_NAME : null);

  if (!cloudName) {
    console.warn('PUBLIC_CLOUDINARY_CLOUD_NAME is not set. Using placeholder.');
    return 'demo';
  }

  return cloudName;
}

/**
 * Builds a Cloudinary URL with specified transformations
 *
 * @param publicId - The public ID of the image in Cloudinary
 * @param options - Transformation options
 * @returns Complete Cloudinary URL
 *
 * @example
 * buildCloudinaryUrl('podcast/episode-01-thumbnail', { width: 800, quality: 'auto' })
 * buildCloudinaryUrl('hero', { width: 1600, effect: 'blur:500' })
 */
export function buildCloudinaryUrl(
  publicId: string,
  options: CloudinaryTransformOptions = {}
): string {
  const cloudName = getCloudName();
  const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload`;

  const transformations: string[] = [];

  // Named transformation preset
  if (options.transformation) {
    transformations.push(`t_${options.transformation}`);
  }

  // Basic transforms
  if (options.width) transformations.push(`w_${options.width}`);
  if (options.height) transformations.push(`h_${options.height}`);
  if (options.crop) transformations.push(`c_${options.crop}`);
  if (options.quality) transformations.push(`q_${options.quality}`);
  if (options.format) transformations.push(`f_${options.format}`);

  // Gravity (only for applicable crop modes)
  const gravityApplicableCrops = ['fill', 'lfill', 'thumb', 'crop'];
  if (options.gravity && (!options.crop || gravityApplicableCrops.includes(options.crop))) {
    transformations.push(`g_${options.gravity}`);
  }

  if (options.fetchFormat) transformations.push(`f_${options.fetchFormat}`);
  if (options.dpr) transformations.push(`dpr_${options.dpr}`);

  // Effects
  if (options.effect) {
    const effects = Array.isArray(options.effect) ? options.effect : [options.effect];
    effects.forEach(e => transformations.push(`e_${e}`));
  }

  // Style transforms
  if (options.border) transformations.push(`bo_${options.border}`);
  if (options.radius !== undefined) transformations.push(`r_${options.radius}`);
  if (options.background) transformations.push(`b_${options.background}`);
  if (options.overlay) transformations.push(`l_${options.overlay}`);

  // Raw transformation for advanced use
  if (options.rawTransformation) {
    transformations.push(options.rawTransformation);
  }

  // Auto format and quality if not specified
  if (!options.format && !options.fetchFormat) {
    transformations.push('f_auto');
  }
  if (!options.quality) {
    transformations.push('q_auto');
  }

  const transformString = transformations.length > 0
    ? `${transformations.join(',')}/`
    : '';

  const encodedPublicId = publicId.replace(/ /g, '%20');
  return `${baseUrl}/${transformString}${encodedPublicId}`;
}

/**
 * Generates a low-quality placeholder URL for blur-up technique
 */
export function buildPlaceholderUrl(
  publicId: string,
  options: PlaceholderOptions = { type: 'blur' }
): string {
  const baseOptions: CloudinaryTransformOptions = {
    width: 20,
    quality: 'auto:low',
    format: 'auto',
  };

  switch (options.type) {
    case 'blur':
      return buildCloudinaryUrl(publicId, { ...baseOptions, effect: 'blur:1000' });
    case 'pixelate':
      return buildCloudinaryUrl(publicId, { ...baseOptions, effect: 'pixelate:10' });
    case 'color':
      // Return a 1x1 pixel with the specified color
      return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect fill='%23${options.color || 'f5f5f5'}' width='1' height='1'/%3E%3C/svg%3E`;
    case 'predominant':
      return buildCloudinaryUrl(publicId, { ...baseOptions, effect: 'blur:1000', width: 1, height: 1, crop: 'scale' });
    default:
      return buildCloudinaryUrl(publicId, baseOptions);
  }
}

/**
 * Generates a responsive image set with srcset and sizes
 */
export function getCloudinaryResponsiveSet(
  publicId: string,
  widths: number[] = [400, 800, 1200, 1600],
  options: CloudinaryTransformOptions = {}
): ResponsiveImageSet {
  const srcsetParts = widths.map(width => {
    const url = buildCloudinaryUrl(publicId, { ...options, width });
    return `${url} ${width}w`;
  });

  const defaultWidth = widths[Math.floor(widths.length / 2)];
  const src = buildCloudinaryUrl(publicId, { ...options, width: defaultWidth });

  const sizes = options.width
    ? `${options.width}px`
    : '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 1200px';

  return {
    src,
    srcset: srcsetParts.join(', '),
    sizes
  };
}

/**
 * Generates srcset for high-DPI displays
 */
export function getDprSrcset(
  publicId: string,
  baseWidth: number,
  options: CloudinaryTransformOptions = {},
  dprs: number[] = [1, 1.5, 2, 3]
): string {
  return dprs.map(dpr => {
    const url = buildCloudinaryUrl(publicId, {
      ...options,
      width: Math.round(baseWidth * dpr),
      dpr: 1 // We're handling DPR manually via width
    });
    return `${url} ${dpr}x`;
  }).join(', ');
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generates a Cloudinary thumbnail URL
 */
export function getCloudinaryThumbnail(
  publicId: string,
  size: number = 200
): string {
  return buildCloudinaryUrl(publicId, {
    width: size,
    height: size,
    crop: 'thumb',
    gravity: 'auto',
    quality: 'auto',
    format: 'auto'
  });
}

/**
 * Generates a Cloudinary hero image URL
 */
export function getCloudinaryHero(
  publicId: string,
  width: number = 1600
): string {
  return buildCloudinaryUrl(publicId, {
    width,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    format: 'auto'
  });
}

// =============================================================================
// SOUTHLAND-SPECIFIC HELPERS
// =============================================================================

/**
 * Cloudinary Folder Structure for Southland Organics
 *
 * All Southland assets are organized under these paths:
 *
 * Southland Website/
 * ├── Southland Branding/      # Logos, brand assets, icons
 * │   ├── logos/               # Logo variations (primary, white, black)
 * │   ├── icons/               # UI icons, favicons
 * │   └── patterns/            # Brand patterns, textures
 * ├── podcast/                 # Ag & Culture Podcast assets
 * │   ├── episodes/            # Episode thumbnails
 * │   ├── guests/              # Guest headshots
 * │   └── covers/              # Podcast cover art
 * ├── products/                # Product images
 * ├── team/                    # Team member photos
 * ├── blog/                    # Blog post images
 * └── heroes/                  # Hero/banner images
 */

/** Base folder for Southland Organics images in Cloudinary */
export const SOUTHLAND_FOLDER = 'Southland Website';

/** Branding assets subfolder */
export const BRANDING_FOLDER = `${SOUTHLAND_FOLDER}/Southland Branding`;

/**
 * Helper function to build public ID with Southland base folder
 */
export function getSouthlandImageId(imagePath: string): string {
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  return `${SOUTHLAND_FOLDER}/${cleanPath}`;
}

/**
 * Helper function to build public ID for branding assets
 */
export function getBrandingImageId(imagePath: string): string {
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  return `${BRANDING_FOLDER}/${cleanPath}`;
}

/**
 * Convenience function to build URL for Southland images
 */
export function buildSouthlandUrl(
  imagePath: string,
  options: CloudinaryTransformOptions = {}
): string {
  return buildCloudinaryUrl(getSouthlandImageId(imagePath), options);
}

/**
 * Convenience function to build URL for branding assets
 */
export function buildBrandingUrl(
  imagePath: string,
  options: CloudinaryTransformOptions = {}
): string {
  return buildCloudinaryUrl(getBrandingImageId(imagePath), options);
}

/**
 * Get logo URL by variant
 * Logos are in Southland Website/Southland Branding/logos/
 * Icons are in Southland Website/Southland Branding/icons/
 *
 * Available variants:
 * - primary: logos/Primary_Logo_CMYK_sglfaj (png)
 * - horizontal: logos/Southland_Organics_Horizontal_womxky (svg)
 * - horizontalPng: logos/Southland_Organics_Horizontal_yymno6 (png)
 * - square: logos/Southland_Primary_Square_Logo_sertzs (png)
 * - icon: icons/Icon_qgeqxn (png)
 * - iconSvg: icons/Southland_Icon_Icon_xwytez (svg)
 * - black: icons/Southland_Logo_-_Black_ajmlea (svg)
 */
export function getLogoUrl(
  variant: 'primary' | 'horizontal' | 'horizontalPng' | 'square' | 'icon' | 'iconSvg' | 'black' = 'primary',
  options: CloudinaryTransformOptions = {}
): string {
  const logoMap = {
    primary: 'logos/Primary_Logo_CMYK_sglfaj',
    horizontal: 'logos/Southland_Organics_Horizontal_womxky',
    horizontalPng: 'logos/Southland_Organics_Horizontal_yymno6',
    square: 'logos/Southland_Primary_Square_Logo_sertzs',
    icon: 'icons/Icon_qgeqxn',
    iconSvg: 'icons/Southland_Icon_Icon_xwytez',
    black: 'icons/Southland_Logo_-_Black_ajmlea'
  };
  return buildBrandingUrl(logoMap[variant], { format: 'auto', ...options });
}

/**
 * Generates a podcast episode thumbnail URL (16:9 aspect ratio)
 */
export function getEpisodeThumbnail(
  episodeSlug: string,
  width: number = 400
): string {
  return buildSouthlandUrl(`podcast/episodes/${episodeSlug}`, {
    width,
    height: Math.round(width * 9 / 16),
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    format: 'auto'
  });
}

/**
 * Generates a guest profile image URL (square, face-focused)
 */
export function getGuestImage(
  guestSlug: string,
  size: number = 200
): string {
  return buildSouthlandUrl(`podcast/guests/${guestSlug}`, {
    width: size,
    height: size,
    crop: 'thumb',
    gravity: 'face',
    quality: 'auto',
    format: 'auto'
  });
}

/**
 * Generates an avatar image URL (circular)
 */
export function getAvatarUrl(
  publicId: string,
  size: number = 64
): string {
  return buildCloudinaryUrl(publicId, {
    width: size,
    height: size,
    crop: 'thumb',
    gravity: 'face',
    radius: 'max',
    quality: 'auto',
    format: 'auto'
  });
}

/**
 * Generates a hero banner URL with optional overlay
 */
export function getHeroBannerUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    darken?: boolean;
  } = {}
): string {
  const { width = 1920, height = 600, darken = false } = options;

  return buildCloudinaryUrl(publicId, {
    width,
    height,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto:good',
    format: 'auto',
    effect: darken ? 'brightness:70' : undefined
  });
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validates that a public ID is not empty
 */
export function validatePublicId(publicId: string): boolean {
  if (!publicId || typeof publicId !== 'string' || publicId.trim() === '') {
    console.error('CloudinaryImage: publicId is required and must be a non-empty string');
    return false;
  }
  return true;
}

/**
 * Validates image dimensions
 */
export function validateDimensions(width?: number, height?: number): boolean {
  if (width !== undefined && (typeof width !== 'number' || width <= 0)) {
    console.error('CloudinaryImage: width must be a positive number');
    return false;
  }
  if (height !== undefined && (typeof height !== 'number' || height <= 0)) {
    console.error('CloudinaryImage: height must be a positive number');
    return false;
  }
  return true;
}

// =============================================================================
// PRELOAD HELPERS
// =============================================================================

/**
 * Generates a preload link element for critical images
 * Use in <head> for LCP images
 */
export function getPreloadLink(
  publicId: string,
  options: CloudinaryTransformOptions = {}
): { href: string; as: string; type: string; imagesrcset?: string; imagesizes?: string } {
  const url = buildCloudinaryUrl(publicId, options);

  return {
    href: url,
    as: 'image',
    type: 'image/webp', // Cloudinary auto-serves WebP when f_auto is used
  };
}

/**
 * Generates preload link with responsive srcset
 */
export function getResponsivePreloadLink(
  publicId: string,
  widths: number[] = [400, 800, 1200, 1600],
  options: CloudinaryTransformOptions = {}
): { href: string; as: string; imagesrcset: string; imagesizes: string } {
  const responsiveSet = getCloudinaryResponsiveSet(publicId, widths, options);

  return {
    href: responsiveSet.src,
    as: 'image',
    imagesrcset: responsiveSet.srcset,
    imagesizes: responsiveSet.sizes || '100vw'
  };
}
