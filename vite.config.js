import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'logoguaicaipuro.jpeg'],
      manifest: {
        name: 'KEYMASTER ERP - Command Center',
        short_name: 'KEYMASTER',
        description: 'Tecnología de Gestión Avanzada para Negocios Automotrices - Automotores Guaicaipuro',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'any',
        categories: ['business', 'productivity', 'finance'],
        lang: 'es-VE',
        icons: [
          {
            src: 'logoguaicaipuro.jpeg',
            sizes: '192x192',
            type: 'image/jpeg',
            purpose: 'any'
          },
          {
            src: 'logoguaicaipuro.jpeg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpeg,woff2}'],
        maximumFileSizeToCacheInBytes: 5000000,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  server: {
    port: 3005,
    strictPort: true,
    host: true,
    allowedHosts: [
      'applicant-translate-screenshots-vegetarian.trycloudflare.com',
      '.trycloudflare.com',
      'localhost'
    ]
  },
  preview: {
    port: 3005,
  }
})

