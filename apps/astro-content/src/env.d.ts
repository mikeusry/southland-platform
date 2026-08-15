/// <reference types="astro/client" />

/**
 * Global type declarations for analytics and tracking
 */

interface PointDogIdentity {
  email_hash: string | null
  phone_hash: string | null
  shopify_customer_id: string | null
}

interface PointDogPixel {
  track: (event: string, properties?: Record<string, any>) => void

  /**
   * Hand the pixel a plaintext identity at the anonymous→known moment
   * (newsletter signup, quiz, lead form). Hashes locally before anything is
   * sent, persists to the `_pd_eh` cookie, and stamps every later event on
   * this device. Await it before track() — identify must land first or the
   * event attaches to a profile with no email. Added in pixel v2.3.0.
   */
  identify: (traits: {
    email?: string
    phone?: string
    shopify_customer_id?: string
  }) => Promise<PointDogIdentity>

  /** Read the currently stored identity (hashes only). */
  identity?: () => PointDogIdentity
}

interface Window {
  /** point.dog analytics pixel */
  pdPixel?: PointDogPixel

  /** point.dog pixel configuration */
  pdPixelConfig?: {
    brandId: string
    endpoint: string
  }

  /** Google Tag Manager dataLayer */
  dataLayer?: Array<Record<string, any>>

  /** Meta Pixel */
  fbq?: (...args: any[]) => void

  /** Shared PageView eventID for fbq ↔ CAPI pairing */
  __pdPageViewEventId?: string
}
