/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Fira Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Deep tidal-water neutrals used across every signed-in surface.
        abyss: {
          950: '#04151A',
          900: '#071F26',
          850: '#0A2A32',
          800: '#0D343E',
          700: '#12454F',
          600: '#1A5A64',
          500: '#2A757D',
        },
        // Living mangrove greens — the primary brand ramp.
        tide: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
          950: '#022C22',
        },
        // Credits, money, marketplace.
        sun: {
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        sand: '#F6F8F5',
      },
      boxShadow: {
        lift: '0 1px 2px rgba(6,44,34,0.04), 0 12px 32px -12px rgba(6,44,34,0.16)',
        panel: '0 24px 60px -30px rgba(2,20,26,0.75)',
      },
      borderRadius: { xl2: '1.25rem' },
      // Fine-grained alpha steps used throughout the dark console surfaces.
      opacity: { 6: '0.06', 8: '0.08', 12: '0.12', 15: '0.15', 18: '0.18' },
      keyframes: {
        rise: { '0%': { opacity: 0, transform: 'translateY(14px)' }, '100%': { opacity: 1, transform: 'none' } },
        pulseRing: {
          '0%': { transform: 'scale(0.85)', opacity: 0.7 },
          '100%': { transform: 'scale(2.1)', opacity: 0 },
        },
      },
      animation: {
        rise: 'rise 480ms cubic-bezier(0.22, 1, 0.36, 1) both',
        ring: 'pulseRing 2.4s ease-out infinite',
      },
    },
  },
  plugins: [],
};
