/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rojo: { DEFAULT: '#dc2626', dark: '#991b1b', bright: '#ef4444' },
        negro: '#0a0a0a',
        g1: '#111111', g2: '#1a1a1a', g3: '#222222', g4: '#2a2a2a',
        borde: '#333333',
        muted: '#777777',
      },
      fontFamily: {
        bebas: ['"Bebas Neue"', 'sans-serif'],
        raj: ['Rajdhani', 'sans-serif'],
        mono2: ['"Share Tech Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
