import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', ...defaultTheme.fontFamily.sans],
        mono: ['"JetBrains Mono"', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#dceeff',
          200: '#b3dbff',
          300: '#82c3ff',
          400: '#4aa3ff',
          500: '#1f84ff',
          600: '#0067e0',
          700: '#004fb4',
          800: '#003a82',
          900: '#032a5c',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
