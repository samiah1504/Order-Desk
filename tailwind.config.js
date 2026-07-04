/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: '#EAB308',
          'yellow-dark': '#CA8A04',
          'yellow-light': '#FEF9C3',
          black: '#0A0A0A',
          gray: '#6B7280',
        },
        status: {
          new: '#3B82F6',
          'awaiting-waybill': '#F97316',
          waybilled: '#A855F7',
          warehouse: '#14B8A6',
          processing: '#EAB308',
          delivered: '#22C55E',
          paid: '#15803D',
          failed: '#EF4444',
          cancelled: '#9CA3AF',
          returned: '#92400E',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      screens: {
        xs: '375px',
      }
    },
  },
  plugins: [],
}
