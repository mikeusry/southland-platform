/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        'shopify-accent': '#44883e',
        'shopify-title': '#2c5234',
        'shopify-text': '#191d21',
        'shopify-secondary-text': '#686363',
        'shopify-bg': '#ffffff',
        'shopify-secondary-bg': '#efefef',
        'shopify-alert': '#ef5600',
        'shopify-success': '#44883e',
        'shopify-border': '#e5e7eb',
      },
      fontFamily: {
        heading: ['"Eveleth Dot"', 'system-ui', 'sans-serif'],
        body: ['"Open Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      maxWidth: {
        shopify: '1400px',
      },
      height: {
        header: '75px',
      },
    },
  },
}
