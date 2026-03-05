import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initInventorySync } from './utils/syncManager'

// Sincronizar inventario con Supabase al arrancar
initInventorySync()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)

