import type { Config } from 'tailwindcss';

/**
 * Design system carried over from the HelloNeighbor HTML prototype.
 * Base font size is 14px and spacing is on an 8px unit — see globals.css.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#185FA5',
          dark: '#124a80',
          light: '#e8f1fa',
        },
        success: { DEFAULT: '#3B6D11', light: '#eef5e6' },
        warning: { DEFAULT: '#854F0B', light: '#fbf1e2' },
        danger: { DEFAULT: '#A32D2D', light: '#fbeaea' },
        ink: { DEFAULT: '#1a1a1a', muted: '#6b7280', faint: '#9ca3af' },
        line: '#e5e7eb',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        base: ['14px', '1.5'],
      },
      borderRadius: {
        btn: '8px',
        card: '12px',
      },
      maxWidth: {
        app: '720px',
      },
    },
  },
  plugins: [],
};

export default config;
