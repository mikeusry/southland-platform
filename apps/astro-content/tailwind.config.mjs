/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
    // Tremor.so components
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Shopify theme tokens (exact match to southlandorganics.com)
        'shopify': {
          'bg': '#ffffff',
          'text': '#191d21',
          'title': '#2c5234',
          'secondary-bg': '#efefef',
          'secondary-text': '#686363',
          'link': '#44883e',
          'accent': '#44883e',
          'accent-hover': '#2c5234',
          'alert': '#ef5600',
        },
        // Legacy Southland colors (kept for backwards compatibility)
        'southland': {
          'green': '#44883e',      // Updated to match Shopify
          'green-dark': '#2c5234', // Updated to match Shopify
          'green-light': '#44883e',
        },
        'brand': {
          'primary': '#44883e',    // Updated to match Shopify
          'white': '#ffffff',
          'gray': '#efefef',       // Updated to match Shopify
          'gray-dark': '#686363',  // Updated to match Shopify
        }
      },
      fontFamily: {
        'sans': ['"Open Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        'heading': ['"Eveleth Dot"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'shopify-sm': '13px',
        'shopify-base': '16px',
        'shopify-md': '24px',
        'shopify-lg': '38px',
      },
      maxWidth: {
        'shopify': '1400px',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: '#191d21',
            a: {
              color: '#44883e',
              '&:hover': {
                color: '#2c5234',
              },
            },
            'h1, h2, h3, h4': {
              color: '#2c5234',
              fontFamily: '"Eveleth Dot", system-ui, sans-serif',
            },
          },
        },
      },
    },
  },
  plugins: [],
};
