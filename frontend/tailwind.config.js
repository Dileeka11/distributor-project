/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-faint': 'var(--text-faint)',
        accent: 'var(--accent)',
        'accent-press': 'var(--accent-press)',
        'accent-soft': 'var(--accent-soft)',
        green: 'var(--green)',
        'green-soft': 'var(--green-soft)',
        amber: 'var(--amber)',
        'amber-soft': 'var(--amber-soft)',
        red: 'var(--red)',
        'red-soft': 'var(--red-soft)',
        blue: 'var(--blue)',
        'blue-soft': 'var(--blue-soft)',
      },
      fontFamily: {
        sans: ['Public Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '10px',
        sm: '7px',
        lg: '16px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15, 18, 25, 0.05), 0 1px 1px rgba(15, 18, 25, 0.03)',
        md: '0 4px 14px rgba(15, 18, 25, 0.08), 0 1px 3px rgba(15, 18, 25, 0.05)',
        lg: '0 24px 60px rgba(15, 18, 25, 0.18), 0 6px 18px rgba(15, 18, 25, 0.10)',
      },
    },
  },
  plugins: [],
};
