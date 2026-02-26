/**
 * ImageGallery — React island for PDP product image gallery.
 *
 * Shows a large main image with thumbnail strip below.
 * Clicking a thumbnail swaps the main image.
 */

import { useState } from 'react'
import type { ProductImage } from '@southland/shopify-storefront'

interface Props {
  images: ProductImage[]
  productTitle: string
}

export default function ImageGallery({ images, productTitle }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg bg-gray-100">
        <svg
          className="h-24 w-24 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    )
  }

  const activeImage = images[activeIndex]

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <img
          src={activeImage.url}
          alt={activeImage.altText || productTitle}
          width={activeImage.width}
          height={activeImage.height}
          className="h-auto w-full object-contain"
          style={{ aspectRatio: '1 / 1' }}
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`flex-shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                index === activeIndex
                  ? 'border-brand-green-dark'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
              aria-label={`View image ${index + 1}`}
            >
              <img
                src={image.url}
                alt={image.altText || `${productTitle} image ${index + 1}`}
                width={80}
                height={80}
                loading="lazy"
                className="h-20 w-20 object-contain"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
