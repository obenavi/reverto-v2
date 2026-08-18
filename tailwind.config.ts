import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#185FA5',
        'primary-dark': '#0C447C',
        'primary-light': '#E6F1FB',
        success: '#3B6D11',
        'success-dark': '#27500A',
        'success-light': '#EAF3DE',
        warning: '#854F0B',
        'warning-dark': '#633806',
        'warning-light': '#FAEEDA',
        danger: '#A32D2D',
        'danger-dark': '#791F1F',
        'danger-light': '#FCEBEB',
      },
      borderRadius: {
        'sm': '8px',
        'md': '12px',
        'lg': '18px',
      },
    },
  },
  plugins: [],
}
export default config
