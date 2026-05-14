/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f1115',
        card: '#181b22',
        muted: '#262a33',
        accent: '#a855f7',
        accentSoft: 'rgba(168, 85, 247, 0.15)',
        text: '#e6e7eb',
        subtle: '#8a8f9b',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
