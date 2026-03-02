import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validación estricta para evitar el crash de "Invalid supabaseUrl"
const isValidUrl = rawUrl && rawUrl.startsWith('http')
const supabaseUrl = isValidUrl ? rawUrl : 'https://placeholder-project.supabase.co'
const supabaseAnonKey = rawKey || 'placeholder-key'

if (!isValidUrl) {
    console.error('❌ ERROR CRÍTICO: VITE_SUPABASE_URL no está configurada en Vercel/Ambiente.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'guaicaipuro-auth-token',
        storage: window.localStorage
    }
})


