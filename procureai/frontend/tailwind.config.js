/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // ── Design tokens from original CSS variables ──────────────────────────
      colors: {
        bg: {
          base:    '#080b0f',
          surface: '#0d1117',
          raised:  '#131920',
          hover:   '#181f28',
          active:  '#1c2430',
        },
        text: {
          primary:   '#dde3ec',
          secondary: '#7a8799',
          muted:     '#404c5a',
          label:     '#4e5d6e',
        },
        accent: {
          DEFAULT: '#4d8ef5',
          hover:   '#5a9aff',
        },
        risk: {
          critical: '#f04f43',
          high:     '#e09a2e',
          medium:   '#c9b93a',
          low:      '#27a862',
        },
        // Semantic soft backgrounds
        'risk-critical-soft':  'rgba(240,79,67,.12)',
        'risk-high-soft':      'rgba(224,154,46,.12)',
        'risk-medium-soft':    'rgba(201,185,58,.10)',
        'risk-low-soft':       'rgba(39,168,98,.12)',
        'accent-soft':         'rgba(59,125,216,.12)',
      },
      fontFamily: {
        ui:   ['Onest', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '7px',
        lg: '10px',
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.07)',
        md:      'rgba(255,255,255,0.11)',
        lg:      'rgba(255,255,255,0.18)',
      },
      width: { sidebar: '228px' },
      height: { topbar: '50px' },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
