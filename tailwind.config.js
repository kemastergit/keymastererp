/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#f59e0b',
          dark: '#b45309',
        },
        'background-light': '#f8fafc',
        'background-dark': '#0f172a',
        'card-light': '#ffffff',
        'card-dark': '#1e293b',
        rojo: {
          DEFAULT: '#f59e0b',
          dark: '#b45309',
          bright: '#f59e0b'
        },
        borde: '#e2e8f0', // slate-200
        'borde-dark': '#1e293b', // slate-800
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
        bebas: ['IBM Plex Sans', 'sans-serif'], // Remapping for fast swap
        mono2: ['IBM Plex Mono', 'monospace'],
        raj: ['IBM Plex Sans', 'sans-serif'],
      },
      borderRadius: {
        'none': '0px',
        'sm': '0px',
        DEFAULT: '0px',
        'md': '0px',
        'lg': '0px',
        'xl': '0px',
        '2xl': '0px',
        '3xl': '0px',
        'full': '0px',
      }
    },
  },
  plugins: [],
}
