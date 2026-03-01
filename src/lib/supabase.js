import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabaseUrl = (rawUrl && rawUrl.startsWith('http')) ? rawUrl : 'https://placeholder.supabase.co'
const supabaseAnonKey = rawKey || 'placeholder'

if (!rawUrl || !rawUrl.startsWith('http')) {
    console.warn('⚠️ Supabase URL no es válida o está vacía. Usando placeholder para evitar crash.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)


