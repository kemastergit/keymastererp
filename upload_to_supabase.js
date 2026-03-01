import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Configurar dotenv para leer el archivo .env
dotenv.config()

// Asegurarse de que seed_data.js se pueda importar dinámicamente o leer con fs
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: Faltan llaves de Supabase en el .env.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function startMigration() {
    console.log('⏳ Leyendo archivo seed_data.js local...')

    try {
        const { seedArticulos } = await import('./src/db/seed_data.js')

        if (!seedArticulos || !seedArticulos.length) {
            console.error('No se encontraron artículos en seed_data.js')
            process.exit(1)
        }

        console.log(`📦 Encontrados ${seedArticulos.length} artículos. Preparando formateo a Supabase...`)

        const payload = seedArticulos.map(art => ({
            codigo: String(art.codigo).trim(),
            nombre: String(art.descripcion).trim(),
            descripcion: art.referencia ? `Ref: ${art.referencia} - Marca: ${art.marca}` : (art.marca ? `Marca: ${art.marca}` : ''),
            precio_usd: Number(art.precio) || 0,
            stock: Number(art.stock) || 10,
            stock_visible: true,
            categoria: art.departamento || 'VARIOS',
            activo: true
        }))

        // Subir por trozos de 100 para no ahogar la base de datos
        const chunkSize = 100
        let successCount = 0

        console.log('🚀 Iniciando subida a Supabase en bloques de 100...')

        for (let i = 0; i < payload.length; i += chunkSize) {
            const chunk = payload.slice(i, i + chunkSize)

            const { error } = await supabase
                .from('catalogo_productos')
                .upsert(chunk, { onConflict: 'codigo', ignoreDuplicates: false })

            if (error) {
                console.error(`❌ Error insertando bloque ${i}:`, error.message)
            } else {
                successCount += chunk.length
                console.log(`✅ Subidos ${successCount} de ${payload.length}...`)
            }
        }

        console.log('\n=======================================')
        console.log('🎉 ¡MIGRACIÓN COMPLETADA CON ÉXITO! 🎉')
        console.log('Ve a tu página en Vercel y comprueba los productos.')
        console.log('=======================================')

    } catch (e) {
        console.error('Error durante la migración:', e)
    }
}

startMigration()
