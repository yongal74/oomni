/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#1C1812',
        surface: '#242018',
        border: '#3D3828',
        primary: '#D4763B',
        'primary-hover': '#C5664A',
        text: '#F2EAD8',
        muted: '#8A7E6E',
        dim: '#BDB09E',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"Cascadia Code"', '"Fira Code"', 'monospace'],
      },
    },
  },
  plugins: [],
}
