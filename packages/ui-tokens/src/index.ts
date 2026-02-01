export const tokens = {
  colors: {
    accent: '#44883e',
    title: '#2c5234',
    text: '#191d21',
    secondaryText: '#686363',
    bg: '#ffffff',
    secondaryBg: '#efefef',
    border: '#e5e7eb',
  },
  fonts: {
    heading: '"Eveleth Dot", system-ui, sans-serif',
    body: '"Open Sans", system-ui, -apple-system, sans-serif',
  },
  layout: {
    maxWidth: '1400px',
    headerHeight: '75px',
  },
} as const;

export type Tokens = typeof tokens;
