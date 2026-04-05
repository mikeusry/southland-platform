import { useState } from 'react'
import {
  isBot,
  submitLead,
  trackEmailSubmitted,
  trackRepFormOpened,
  trackRepFormSubmitted,
} from '../../lib/leadCapture'

interface TalkToRepProps {
  /** Product name to pre-fill */
  productName: string
  /** Shopify product handle */
  productHandle: string
  /** Whether this is a commercial/B2B product page */
  isCommercial?: boolean
}

export default function TalkToRep({
  productName,
  productHandle,
  isCommercial = false,
}: TalkToRepProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function handleOpen() {
    setIsOpen(true)
    trackRepFormOpened('talk_to_rep', 'button')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    if (isBot(fd)) return

    setSubmitting(true)

    const email = fd.get('email') as string
    const firstName = fd.get('first_name') as string
    const lastName = fd.get('last_name') as string
    const phone = fd.get('phone') as string
    const company = fd.get('company') as string
    const message = fd.get('message') as string

    trackRepFormSubmitted('talk_to_rep', productName, !!company)
    trackEmailSubmitted('talk_to_rep', !!phone, !!firstName)

    submitLead({
      leadType: 'lead_magnet',
      formType: isCommercial ? 'distribution' : 'contact',
      email,
      firstName: firstName || null,
      lastName: lastName || null,
      phone: phone || null,
      company: company || null,
      message: `Product inquiry: ${productName} (${productHandle}). ${message || ''}`.trim(),
    })

    setSubmitted(true)
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
        <svg
          className="mx-auto h-8 w-8 text-[#44883E]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="mt-2 font-heading text-sm uppercase text-[#2C5234]">
          We&apos;ll be in touch!
        </p>
        <p className="mt-1 text-xs text-gray-600">
          We&apos;ll reach out about {productName} within 2 business hours.
        </p>
      </div>
    )
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-[#2C5234] px-4 py-2.5 text-sm font-semibold text-[#2C5234] transition-colors hover:bg-[#2C5234] hover:text-white"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        Get Application Help
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#2C5234]">Get help with {productName}</h4>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input name="website" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="rep-first-name"
              className="mb-1 block text-xs font-semibold text-gray-700"
            >
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              id="rep-first-name"
              name="first_name"
              type="text"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
            />
          </div>
          <div>
            <label
              htmlFor="rep-last-name"
              className="mb-1 block text-xs font-semibold text-gray-700"
            >
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              id="rep-last-name"
              name="last_name"
              type="text"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="rep-email" className="mb-1 block text-xs font-semibold text-gray-700">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="rep-email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rep-phone" className="mb-1 block text-xs font-semibold text-gray-700">
              Phone {isCommercial && <span className="text-red-500">*</span>}
            </label>
            <input
              id="rep-phone"
              name="phone"
              type="tel"
              required={isCommercial}
              placeholder="Optional"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
            />
          </div>
          <div>
            <label htmlFor="rep-company" className="mb-1 block text-xs font-semibold text-gray-700">
              Company {isCommercial && <span className="text-red-500">*</span>}
            </label>
            <input
              id="rep-company"
              name="company"
              type="text"
              required={isCommercial}
              placeholder={isCommercial ? '' : 'Optional'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="rep-message" className="mb-1 block text-xs font-semibold text-gray-700">
            Message
          </label>
          <textarea
            id="rep-message"
            name="message"
            rows={2}
            defaultValue={`I have a question about ${productName}`}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#44883E] focus:outline-none focus:ring-1 focus:ring-[#44883E]"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-[#2C5234] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-800 disabled:opacity-50"
        >
          {submitting ? 'Sending...' : 'Send Message'}
        </button>

        <p className="text-center text-xs text-gray-400">
          Average response: under 2 business hours
        </p>
      </form>
    </div>
  )
}
