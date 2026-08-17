/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0F6E3E',
          50: '#EAF7F0',
          100: '#CDEEDC',
          200: '#9FDEBE',
          700: '#0B5230',
          900: '#0A3D24',
        },
        charcoal: {
          DEFAULT: '#14171A',
          light: '#1E2226',
        },
        success: '#12A150',
        warning: '#C77A0A',
        danger: '#C0362C',
      },
      fontFamily: {
        heading: ['"Inter"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 32, 0.04), 0 4px 12px rgba(16, 24, 32, 0.06)',
        'card-hover': '0 4px 8px rgba(16, 24, 32, 0.08), 0 12px 24px rgba(16, 24, 32, 0.10)',
      },
      spacing: {
        touch: '44px',
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
};
