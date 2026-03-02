import { db } from '../db/db'
import { supabase } from '../lib/supabase'

/**
 * Agrega una operación a la cola de sincronización local
 */
export async function addToSyncQueue(table, operation, data) {
    await db.sync_queue.add({
        table,
        operation,
        data,
        status: 'PENDING',
        created_at: new Date()
    })
}

/**
 * Intenta sincronizar los elementos pendientes en la cola
 */
export async function processSyncQueue() {
    if (!supabase) {
        console.warn("🛰️ SyncManager: Supabase no está configurado. Postponiendo...")
        return 0
    }

    const pending = await db.sync_queue.where('status').equals('PENDING').toArray()
    if (pending.length === 0) return 0

    let successCount = 0

    for (const item of pending) {
        try {
            let error = null

            // Control de reintentos (Máximo 3)
            item.intentos = (item.intentos || 0) + 1
            if (item.intentos > 3) {
                console.warn(`🛑 Límite de (3) intentos superado para ${item.table}. Marcado como ERROR.`);
                await db.sync_queue.update(item.id, { status: 'ERROR', intentos: item.intentos })
                continue
            }
            await db.sync_queue.update(item.id, { intentos: item.intentos })

            // Log para depuración
            console.log(`☁️ Intentando sincronizar ${item.table} (${item.operation}) - Intento ${item.intentos}...`)

            if (item.table === 'facturas' && item.operation === 'INSERT') {
                const { error: err } = await supabase.from('facturas').upsert([item.data], { onConflict: 'id' })
                error = err
            } else if (item.table === 'articulos' && item.operation === 'UPDATE_STOCK') {
                const { error: err } = await supabase.from('articulos')
                    .update({ stock: item.data.stock })
                    .eq('codigo', item.data.codigo)
                error = err
            } else if (item.table === 'cuentas_por_cobrar' && item.operation === 'INSERT') {
                const { error: err } = await supabase.from('cuentas_por_cobrar').upsert([item.data], { onConflict: 'id' })
                error = err
            } else if (item.table === 'abonos' && item.operation === 'INSERT') {
                const { error: err } = await supabase.from('abonos').upsert([item.data], { onConflict: 'id' })
                error = err
            } else if (item.table === 'auditoria' && item.operation === 'INSERT') {
                const { error: err } = await supabase.from('auditoria').upsert([item.data], { onConflict: 'id' })
                error = err
            } else {
                // Si la tabla no existe o no se maneja, la eliminamos para no trabar la cola
                console.warn(`⚠️ Tabla desconocida en SyncQueue: ${item.table}`)
                await db.sync_queue.delete(item.id)
                continue
            }

            if (!error) {
                await db.sync_queue.delete(item.id)
                successCount++
                console.log(`✅ ${item.table} sincronizado correctamente.`)
            } else {
                console.error(`❌ Error Supabase para ${item.table}:`, error)
                // Marcamos el error para no reintentar eternamente si es un fallo de esquema
                if (error.code === '42P01' || error.code === 'PGRST204') { // Tabla no existe o recurso no hallado
                    await db.sync_queue.delete(item.id)
                }
            }
        } catch (e) {
            console.error(`💥 Error fatal sincronizando item ${item.id}:`, e)
        }
    }

    return successCount
}

/**
 * Limpiador de cola: Si algo está muy viejo o falló muchas veces (opcional)
 */
export async function clearOldSyncItems() {
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    await db.sync_queue.where('created_at').below(oneWeekAgo).delete()
}
