/**
 * Form Submission API Endpoint
 *
 * POST /api/form/submit
 *
 * Receives form data from contact + distribution pages,
 * sends branded email via SendGrid.
 *
 * Routing:
 *   Contact form  → mike@southlandorganics.com + success@southlandorganics.com
 *   Distribution  → mike@southlandorganics.com only
 */

import type { APIRoute } from 'astro'

interface FormPayload {
  formType: 'contact' | 'distribution'
  firstName: string
  lastName: string
  email: string
  phone?: string
  department?: string
  message?: string
  // Distribution-specific
  company?: string
  businessType?: string
  productInterest?: string
  location?: string
}

const SENDGRID_API = 'https://api.sendgrid.com/v3/mail/send'

// Southland brand colors
const BRAND = {
  darkGreen: '#2C5234',
  lightGreen: '#44883E',
  text: '#191D21',
  secondary: '#686363',
  bgLight: '#f8faf8',
  border: '#e2e8e0',
}

function brandWrap(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${BRAND.bgLight};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bgLight};padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:${BRAND.darkGreen};padding:24px 32px;border-radius:12px 12px 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#fff;font-size:20px;font-weight:700;letter-spacing:0.5px;">Southland Organics</td>
              <td align="right" style="color:rgba(255,255,255,0.6);font-size:12px;text-transform:uppercase;letter-spacing:1px;">${title}</td>
            </tr>
          </table>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#ffffff;padding:32px;border-left:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#fafafa;padding:20px 32px;border-radius:0 0 12px 12px;border:1px solid ${BRAND.border};border-top:none;">
          <p style="margin:0;font-size:12px;color:${BRAND.secondary};text-align:center;">
            Southland Organics &middot; 189 Luke Road, Bogart, GA 30622 &middot; 800-608-3755<br>
            <a href="https://southlandorganics.com" style="color:${BRAND.lightGreen};text-decoration:none;">southlandorganics.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildContactEmail(data: FormPayload): string {
  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND.darkGreen};">New Contact Form Submission</h2>
    <p style="margin:0 0 24px;color:${BRAND.secondary};font-size:14px;">Submitted from southlandorganics.com/contact/</p>
    <table style="border-collapse:collapse;width:100%;">
      ${row('Name', `${data.firstName} ${data.lastName}`)}
      ${row('Email', `<a href="mailto:${escapeHtml(data.email)}" style="color:${BRAND.lightGreen};">${escapeHtml(data.email)}</a>`)}
      ${row('Phone', data.phone || 'N/A')}
      ${row('Topic', formatDepartment(data.department))}
    </table>
    ${
      data.message
        ? `
    <div style="margin-top:24px;padding:16px 20px;background:${BRAND.bgLight};border-left:4px solid ${BRAND.lightGreen};border-radius:0 8px 8px 0;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${BRAND.secondary};text-transform:uppercase;letter-spacing:0.5px;">Message</p>
      <p style="margin:0;color:${BRAND.text};white-space:pre-wrap;line-height:1.6;">${escapeHtml(data.message)}</p>
    </div>`
        : ''
    }`
  return brandWrap('Contact', body)
}

function buildDistributionEmail(data: FormPayload): string {
  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;color:${BRAND.darkGreen};">New Dealer / Distribution Inquiry</h2>
    <p style="margin:0 0 24px;color:${BRAND.secondary};font-size:14px;">Submitted from southlandorganics.com/distribution/</p>
    <table style="border-collapse:collapse;width:100%;">
      ${row('Name', `${data.firstName} ${data.lastName}`)}
      ${row('Email', `<a href="mailto:${escapeHtml(data.email)}" style="color:${BRAND.lightGreen};">${escapeHtml(data.email)}</a>`)}
      ${row('Phone', data.phone || 'N/A')}
      ${row('Company', escapeHtml(data.company || 'N/A'))}
      ${row('Business Type', formatBusinessType(data.businessType))}
      ${row('Product Interest', formatProductInterest(data.productInterest))}
      ${row('Location', escapeHtml(data.location || 'N/A'))}
    </table>
    ${
      data.message
        ? `
    <div style="margin-top:24px;padding:16px 20px;background:${BRAND.bgLight};border-left:4px solid ${BRAND.lightGreen};border-radius:0 8px 8px 0;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${BRAND.secondary};text-transform:uppercase;letter-spacing:0.5px;">About Their Business</p>
      <p style="margin:0;color:${BRAND.text};white-space:pre-wrap;line-height:1.6;">${escapeHtml(data.message)}</p>
    </div>`
        : ''
    }`
  return brandWrap('Dealer Inquiry', body)
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 14px;border-bottom:1px solid ${BRAND.border};font-weight:600;color:${BRAND.text};font-size:14px;width:140px;vertical-align:top;">${label}</td>
    <td style="padding:10px 14px;border-bottom:1px solid ${BRAND.border};color:${BRAND.text};font-size:14px;">${value}</td>
  </tr>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDepartment(dept?: string): string {
  const map: Record<string, string> = {
    poultry: 'Poultry Products & Support',
    lawn: 'Lawn & Garden Products',
    turf: 'Turf Professional Solutions',
    dealer: 'Becoming a Dealer',
    distribution: 'Distribution & Wholesale',
    order: 'Order Status & Shipping',
    other: 'Something Else',
  }
  return dept ? map[dept] || dept : 'N/A'
}

function formatBusinessType(type?: string): string {
  const map: Record<string, string> = {
    'farm-store': 'Farm Supply Store',
    'garden-center': 'Garden Center / Nursery',
    distributor: 'Distributor',
    'co-op': 'Co-op',
    'turf-pro': 'Turf Professional / Landscaper',
    consultant: 'Agricultural Consultant',
    other: 'Other',
  }
  return type ? map[type] || type : 'N/A'
}

function formatProductInterest(interest?: string): string {
  const map: Record<string, string> = {
    poultry: 'Poultry Products',
    'lawn-garden': 'Lawn & Garden',
    waste: 'Septic & Waste Treatment',
    swine: 'Swine Products',
    multiple: 'Multiple Product Lines',
  }
  return interest ? map[interest] || interest : 'N/A'
}

export const POST: APIRoute = async ({ request }) => {
  const sendgridKey = import.meta.env.SENDGRID_API_KEY

  if (!sendgridKey) {
    console.error('SENDGRID_API_KEY not configured')
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let data: FormPayload
  try {
    data = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Validate required fields
  if (!data.firstName || !data.lastName || !data.email || !data.formType) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const isDistribution = data.formType === 'distribution'

  // Routing: contact → mike + success, distribution → mike only
  const recipients = isDistribution
    ? [{ email: 'mike@southlandorganics.com' }]
    : [{ email: 'mike@southlandorganics.com' }, { email: 'success@southlandorganics.com' }]

  const subject = isDistribution
    ? `[Dealer Inquiry] ${data.company || data.firstName + ' ' + data.lastName} — ${formatBusinessType(data.businessType)}`
    : `[Contact] ${data.firstName} ${data.lastName} — ${formatDepartment(data.department)}`

  const htmlContent = isDistribution ? buildDistributionEmail(data) : buildContactEmail(data)

  const sendgridPayload = {
    personalizations: [
      {
        to: recipients,
        subject,
      },
    ],
    from: {
      email: 'noreply@southlandorganics.com',
      name: 'Southland Organics Website',
    },
    reply_to: {
      email: data.email,
      name: `${data.firstName} ${data.lastName}`,
    },
    content: [
      {
        type: 'text/html',
        value: htmlContent,
      },
    ],
  }

  try {
    const response = await fetch(SENDGRID_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sendgridPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SendGrid error:', response.status, errorText)
      return new Response(JSON.stringify({ error: 'Failed to send message' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('SendGrid fetch error:', err)
    return new Response(JSON.stringify({ error: 'Failed to send message' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
