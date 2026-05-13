/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── 배경 레이어 ── */
        bg:          'var(--color-bg)',
        surface:     'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        'surface-3': 'var(--color-surface-3)',
        /* ── 테두리 ── */
        border:        'var(--color-border)',
        'border-muted':'var(--color-border-muted)',
        /* ── 텍스트 ── */
        text:  'var(--color-text)',
        dim:   'var(--color-dim)',
        muted: 'var(--color-muted)',
        /* ── 브랜드 ── */
        primary:       'var(--color-primary)',
        'primary-hover':'var(--color-primary-hover)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"Cascadia Code"', '"Fira Code"', 'monospace'],
      },
    },
  },
  plugins: [],
}
