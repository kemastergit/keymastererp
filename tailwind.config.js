/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rojo: { DEFAULT: '#d97706', dark: '#92400e', bright: '#fbbf24' },
        negro: '#0a0a0a',
        g1: '#111111', g2: '#1a1a1a', g3: '#1f1f1f', g4: '#2a2a2a',
        borde: '#92400e44',
        muted: '#92400e88',
        accent: '#fef3c7',
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
