/**
 * Cart Shipping Warning — Pre-Checkout Interception
 *
 * Injected via HTMLRewriter on all proxied Shopify pages.
 * Self-gates on /cart pathname. Fetches Shopify cart data,
 * calls Nexus shipping estimate API, renders warning banner
 * when shipping is expensive.
 *
 * < 4KB minified. Zero dependencies.
 */
;(function () {
  'use strict'

  // Only run on the cart page
  if (window.location.pathname !== '/cart') return

  var API_URL = 'https://nexus.southlandorganics.com/api/public/shipping-estimate'
  var LS_ZIP_KEY = 'sl_ship_zip'
  var SS_DISMISS_KEY = 'sl_ship_banner_dismissed'
  var ROOT_ID = 'sl-ship-warning-root'
  var TIMEOUT_MS = 6000
  function log() {}

  // Skip if already dismissed this session
  if (sessionStorage.getItem(SS_DISMISS_KEY) === '1') {
    log('Banner dismissed this session, skipping')
    return
  }

  // -----------------------------------------------------------------------
  // DOM helpers
  // -----------------------------------------------------------------------

  function el(tag, attrs, children) {
    var node = document.createElement(tag)
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'style' && typeof attrs[k] === 'object') {
          Object.assign(node.style, attrs[k])
        } else if (k.indexOf('on') === 0) {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k])
        } else {
          node.setAttribute(k, attrs[k])
        }
      })
    }
    if (children) {
      ;(Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (typeof c === 'string') node.appendChild(document.createTextNode(c))
        else if (c) node.appendChild(c)
      })
    }
    return node
  }

  // -----------------------------------------------------------------------
  // Find insertion target
  // -----------------------------------------------------------------------

  function findTarget() {
    // Try known Shopify cart selectors (most specific first)
    // The Southland theme uses .section--cart-page as the main cart container
    var selectors = [
      '.section--cart-page',
      '.cart__additional--right',
      '.cart__ctas',
      '.cart__footer',
      '[data-cart-footer]',
      'form[action="/checkout"]',
      'form[action="/cart"]',
      '.checkout__button',
    ]
    for (var i = 0; i < selectors.length; i++) {
      var target = document.querySelector(selectors[i])
      if (target) {
        log('Found target:', selectors[i])
        return target
      }
    }
    // Last resort: find any checkout link in <main>
    var main = document.querySelector('main')
    if (main) {
      var checkoutLink = main.querySelector('a[href="/checkout"]')
      if (checkoutLink) {
        log('Found target: checkout link in main')
        return checkoutLink.parentElement || checkoutLink
      }
    }
    log('No target found — bailing')
    return null
  }

  // -----------------------------------------------------------------------
  // Styles
  // -----------------------------------------------------------------------

  var COLORS = {
    dealer_suggest: { border: '#2C5234', bg: '#f0f7f2', text: '#1a3a22' },
    dealer_redirect: { border: '#d97706', bg: '#fffbeb', text: '#92400e' },
    ltl_suggest: { border: '#2563eb', bg: '#eff6ff', text: '#1e40af' },
  }

  var BASE_STYLE = {
    fontFamily: '"Open Sans", system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    lineHeight: '1.5',
    padding: '16px 20px',
    marginBottom: '16px',
    borderRadius: '8px',
    borderLeft: '4px solid',
    position: 'relative',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  }

  function btnStyle(bg, color) {
    return {
      display: 'inline-block',
      padding: '8px 16px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: '13px',
      fontWeight: '600',
      textDecoration: 'none',
      textAlign: 'center',
      backgroundColor: bg,
      color: color,
      marginRight: '8px',
      marginTop: '8px',
    }
  }

  // -----------------------------------------------------------------------
  // Banner rendering
  // -----------------------------------------------------------------------

  function renderBanner(data) {
    var rec = data.analysis.recommendation
    log('Recommendation:', rec, data.analysis)
    if (rec === 'proceed' || !COLORS[rec]) return null

    var c = COLORS[rec]
    var est = data.estimate
    var dealer = data.nearbyDealers && data.nearbyDealers[0]
    var rate = est ? '$' + est.lowestRate.toFixed(0) : ''
    var pct = data.analysis.shippingPctOfCart
      ? data.analysis.shippingPctOfCart + '%'
      : ''

    var style = Object.assign({}, BASE_STYLE, {
      borderLeftColor: c.border,
      backgroundColor: c.bg,
      color: c.text,
    })

    // Dismiss button
    var dismiss = el(
      'button',
      {
        style: {
          position: 'absolute',
          top: '8px',
          right: '12px',
          background: 'none',
          border: 'none',
          fontSize: '18px',
          cursor: 'pointer',
          color: c.text,
          opacity: '0.6',
          padding: '0',
          lineHeight: '1',
        },
        onClick: function () {
          sessionStorage.setItem(SS_DISMISS_KEY, '1')
          var root = document.getElementById(ROOT_ID)
          if (root) root.remove()
        },
      },
      '\u00d7'
    )

    var content

    if (rec === 'dealer_suggest') {
      content = el('div', { style: style }, [
        dismiss,
        el('div', { style: { fontWeight: '700', marginBottom: '4px', fontSize: '15px' } }, 'Local pickup available'),
        el(
          'div',
          { style: { marginBottom: '8px' } },
          'Estimated shipping: ' + rate + (pct ? ' (' + pct + ' of your order)' : '')
        ),
        dealer
          ? el(
              'div',
              { style: { marginBottom: '12px' } },
              'Available at ' +
                dealer.name +
                ' (' +
                dealer.distance_miles +
                ' mi away)'
            )
          : null,
        el('div', null, [
          el(
            'a',
            {
              href: '/store-locator/',
              target: '_blank',
              style: btnStyle(c.border, '#fff'),
            },
            'View pickup locations'
          ),
          el(
            'button',
            {
              style: btnStyle('transparent', c.text),
              onClick: function () {
                goToCheckout()
              },
            },
            'Continue to checkout'
          ),
        ]),
      ])
    } else if (rec === 'dealer_redirect') {
      content = el('div', { style: style }, [
        dismiss,
        el(
          'div',
          { style: { fontWeight: '700', marginBottom: '4px', fontSize: '15px' } },
          'Shipping on this order is ' + rate
        ),
        el(
          'div',
          { style: { marginBottom: '4px' } },
          "That's " + pct + ' of your order total.'
        ),
        dealer
          ? el('div', { style: { marginBottom: '4px', fontWeight: '600' } }, [
              document.createTextNode(
                'Save by picking up at ' + dealer.name
              ),
            ])
          : null,
        dealer
          ? el(
              'div',
              {
                style: {
                  marginBottom: '12px',
                  fontSize: '13px',
                  opacity: '0.85',
                },
              },
              dealer.city +
                ', ' +
                dealer.state +
                ' \u2014 ' +
                dealer.distance_miles +
                ' miles away' +
                (dealer.phone ? ' \u2014 ' + dealer.phone : '')
            )
          : null,
        el('div', null, [
          el(
            'a',
            {
              href: '/store-locator/',
              target: '_blank',
              style: btnStyle(c.border, '#fff'),
            },
            'View pickup locations'
          ),
          el(
            'button',
            {
              style: btnStyle('transparent', c.text),
              onClick: function () {
                goToCheckout()
              },
            },
            'Continue to checkout'
          ),
        ]),
      ])
    } else if (rec === 'ltl_suggest') {
      var pkgInfo = est
        ? est.packages +
          ' package' +
          (est.packages > 1 ? 's' : '') +
          ', ' +
          Math.round(est.totalWeightLb) +
          ' lbs'
        : 'multiple packages'
      content = el('div', { style: style }, [
        dismiss,
        el(
          'div',
          { style: { fontWeight: '700', marginBottom: '4px', fontSize: '15px' } },
          'Large order \u2014 freight may save you money'
        ),
        el(
          'div',
          { style: { marginBottom: '4px' } },
          pkgInfo
        ),
        el(
          'div',
          { style: { marginBottom: '12px' } },
          'Freight shipping often costs less per pound for orders this size.'
        ),
        el('div', null, [
          el(
            'a',
            {
              href: '/contact/',
              style: btnStyle(c.border, '#fff'),
            },
            'Get a freight quote'
          ),
          el(
            'button',
            {
              style: btnStyle('transparent', c.text),
              onClick: function () {
                goToCheckout()
              },
            },
            'Use standard shipping'
          ),
        ]),
      ])
    }

    return content
  }

  function goToCheckout() {
    // Try clicking the native checkout button first
    var btn =
      document.querySelector('.checkout__button .button') ||
      document.querySelector('[name="checkout"]') ||
      document.querySelector('input[name="checkout"]')
    if (btn) {
      btn.click()
      return
    }
    window.location = '/checkout'
  }

  // -----------------------------------------------------------------------
  // Failure micro-message
  // -----------------------------------------------------------------------

  function renderFailureMessage() {
    return el(
      'div',
      {
        style: {
          padding: '10px 16px',
          color: '#6b7280',
          fontSize: '13px',
          fontFamily: '"Open Sans", system-ui, sans-serif',
        },
      },
      'Shipping estimate unavailable \u2014 you\u2019ll see rates at checkout.'
    )
  }

  // -----------------------------------------------------------------------
  // ZIP input widget
  // -----------------------------------------------------------------------

  function renderZipInput(onSubmit) {
    var c = COLORS.dealer_suggest

    var input = el('input', {
      type: 'text',
      maxlength: '5',
      placeholder: 'ZIP code',
      style: {
        width: '80px',
        padding: '6px 10px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        fontFamily: 'inherit',
        textAlign: 'center',
        marginRight: '8px',
      },
    })

    var btn = el(
      'button',
      {
        style: btnStyle(c.border, '#fff'),
        onClick: function () {
          var zip = input.value.replace(/\D/g, '')
          if (zip.length === 5) {
            localStorage.setItem(LS_ZIP_KEY, zip)
            onSubmit(zip)
          }
        },
      },
      'Check rates'
    )

    var wrapper = el(
      'div',
      {
        style: Object.assign({}, BASE_STYLE, {
          borderLeftColor: '#9ca3af',
          backgroundColor: '#f9fafb',
          color: '#374151',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '4px',
        }),
      },
      [
        el(
          'span',
          { style: { marginRight: '8px', fontSize: '14px' } },
          'Check shipping costs for your area:'
        ),
        input,
        btn,
      ]
    )

    // Also handle Enter key
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        btn.click()
      }
    })

    return wrapper
  }

  // -----------------------------------------------------------------------
  // API call
  // -----------------------------------------------------------------------

  function fetchEstimate(items, zip, subtotal, cb) {
    var controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null
    var timer = controller
      ? setTimeout(function () {
          controller.abort()
        }, TIMEOUT_MS)
      : null

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items,
        destinationZip: zip,
        cartSubtotal: subtotal,
      }),
      signal: controller ? controller.signal : undefined,
    })
      .then(function (res) {
        if (timer) clearTimeout(timer)
        if (!res.ok) throw new Error('HTTP ' + res.status)
        return res.json()
      })
      .then(function (data) {
        log('API response:', data)
        cb(null, data)
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer)
        log('API error:', err)
        cb(err, null)
      })
  }

  // -----------------------------------------------------------------------
  // Main
  // -----------------------------------------------------------------------

  function init() {
    log('init() called')
    var target = findTarget()
    if (!target) return // Silently bail — never break the cart

    // Create root container
    var root = el('div', { id: ROOT_ID, style: { width: '100%' } })

    // Insert strategy depends on what we found:
    // - For the cart section container, append inside it (bottom, above footer)
    // - For specific checkout elements, insert before them
    if (target.classList.contains('section--cart-page')) {
      // Find checkout link or notes area within the section to insert before
      var checkout = target.querySelector('a[href="/checkout"]')
      var insertPoint = checkout ? checkout.closest('.row, .col-12, div') : null
      if (insertPoint && insertPoint !== target) {
        insertPoint.parentNode.insertBefore(root, insertPoint)
        log('Inserted before checkout area')
      } else {
        target.appendChild(root)
        log('Appended to section--cart-page')
      }
    } else {
      target.parentNode.insertBefore(root, target)
      log('Inserted before target')
    }

    // Fetch Shopify cart
    log('Fetching /cart.js...')
    fetch('/cart.js', { credentials: 'same-origin' })
      .then(function (r) {
        return r.json()
      })
      .then(function (cart) {
        log('Cart:', cart.item_count, 'items, $' + (cart.total_price / 100))
        if (!cart || !cart.item_count) {
          log('Empty cart — skipping')
          return
        }

        var items = cart.items.map(function (item) {
          return {
            sku: item.sku || item.variant_id.toString(),
            quantity: item.quantity,
            grams: item.grams || 0,
          }
        })
        var subtotal = cart.total_price / 100 // Shopify stores in cents

        // Get saved ZIP or Cloudflare geolocation hint
        var savedZip = localStorage.getItem(LS_ZIP_KEY) || ''
        var script = document.querySelector('script[data-cf-zip]')
        var cfZip = script ? script.getAttribute('data-cf-zip') || '' : ''
        var zip = savedZip || cfZip
        log('ZIP:', zip, '(saved:', savedZip, 'cf:', cfZip + ')')

        if (zip && /^\d{5}$/.test(zip)) {
          // Auto-fetch with known ZIP
          showLoading(root)
          fetchEstimate(items, zip, subtotal, function (err, data) {
            root.innerHTML = ''
            if (err || !data) {
              root.appendChild(renderFailureMessage())
              return
            }
            var banner = renderBanner(data)
            if (banner) root.appendChild(banner)
          })
        } else {
          // Show ZIP input
          root.appendChild(
            renderZipInput(function (zip) {
              root.innerHTML = ''
              showLoading(root)
              fetchEstimate(items, zip, subtotal, function (err, data) {
                root.innerHTML = ''
                if (err || !data) {
                  root.appendChild(renderFailureMessage())
                  return
                }
                var banner = renderBanner(data)
                if (banner) root.appendChild(banner)
              })
            })
          )
        }
      })
      .catch(function (err) {
        log('Cart fetch failed:', err)
      })
  }

  function showLoading(root) {
    root.innerHTML = ''
    root.appendChild(
      el(
        'div',
        {
          style: {
            padding: '12px 16px',
            color: '#6b7280',
            fontSize: '13px',
            fontFamily: '"Open Sans", system-ui, sans-serif',
          },
        },
        'Checking shipping rates\u2026'
      )
    )
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
