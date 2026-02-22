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
        sans: ['Inter', 'sans-serif'],
        bebas: ['Inter', 'sans-serif'], // Remapping for fast swap
        mono2: ['JetBrains Mono', 'monospace'],
        raj: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
}
