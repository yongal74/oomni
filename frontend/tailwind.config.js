/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0F0F10',
        surface: '#1A1A1C',
        border: '#2A2A2C',
        primary: '#D97757',
        'primary-hover': '#C5664A',
        text: '#E8E6E1',
        muted: '#6B6B6B',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"Cascadia Code"', '"Fira Code"', 'monospace'],
      },
    },
  },
  plugins: [],
}
