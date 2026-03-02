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
    const pending = await db.sync_queue.where('status').equals('PENDING').toArray()
    if (pending.length === 0) return 0

    let successCount = 0

    for (const item of pending) {
        try {
            let error = null

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
            }

            if (!error) {
                await db.sync_queue.delete(item.id)
                successCount++
            } else {
                console.error(`Sync error for item ${item.id}:`, error)
            }
        } catch (e) {
            console.error(`Fatal sync error for item ${item.id}:`, e)
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
