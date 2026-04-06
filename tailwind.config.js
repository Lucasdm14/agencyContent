/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Dark surfaces
        bg:       '#0d0d0d',
        surface:  '#161616',
        panel:    '#1e1e1e',
        hover:    '#242424',
        border:   '#2a2a2a',
        // Text
        primary:  '#ffffff',
        secondary:'#a1a1a1',
        tertiary: '#666666',
        // Accents
        accent:   '#5b6ef5',
        accentHover: '#4a5ce0',
        accentSoft: 'rgba(91,110,245,0.15)',
        // Status
        success:  '#22c55e',
        successSoft: 'rgba(34,197,94,0.12)',
        warning:  '#f59e0b',
        warningSoft: 'rgba(245,158,11,0.12)',
        danger:   '#ef4444',
        dangerSoft: 'rgba(239,68,68,0.12)',
        // Format badges
        reel:     '#e040fb',
        story:    '#f97316',
        carousel: '#06b6d4',
        post:     '#84cc16',
        video:    '#f43f5e',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        card:  '0 0 0 1px rgba(255,255,255,0.06)',
        float: '0 8px 32px rgba(0,0,0,0.4)',
        glow:  '0 0 20px rgba(91,110,245,0.2)',
      },
      fontSize: {
        '2xs': ['10px', '14px'],
      },
      animation: {
        'fade-up': 'fadeUp 0.2s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
