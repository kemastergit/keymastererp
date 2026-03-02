import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { db } from '../db/db'
import { useLiveQuery } from 'dexie-react-hooks'

export default function SupabaseListener() {
    const { incrementUnread, toast, currentUser, setPendingSyncCount } = useStore()

    // 📡 Monitor de COLA DE SINCRONIZACIÓN (Reactivo con Dexie)
    const pendingItems = useLiveQuery(() => db.sync_queue.count(), [])

    useEffect(() => {
        setPendingSyncCount(pendingItems || 0)
    }, [pendingItems])

    useEffect(() => {
        if (!currentUser) return

        // 1. ESCUCHAR PEDIDOS WEB (Realtime)
        const ordersChannel = supabase
            .channel('public:pedidos_web')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos_web' }, (payload) => {
                const nombreCliente = payload.new.cliente_nombre || 'Cliente Web'
                toast(`🔔 NUEVO PEDIDO de ${nombreCliente.toUpperCase()}`, 'info')
                incrementUnread()
                try {
                    new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play()
                } catch (e) { }
            })
            .subscribe()

        // 2. ESCUCHAR TASA BCV GLOBAL (Realtime)
        const configChannel = supabase
            .channel('public:config_global')
            .on('postgres_changes', { event: 'ALL', schema: 'public', table: 'config_global' }, async (payload) => {
                const { clave, valor } = payload.new
                if (clave === 'tasa_bcv' && valor?.monto) {
                    const nMonto = parseFloat(valor.monto)
                    useStore.getState().setTasa(nMonto) // Actualiza store global
                    toast(`📈 TASA ACTUALIZADA: Bs ${nMonto}`, 'success')
                }
            })
            .subscribe()

        // 2. BACKGROUND SYNC (Bandeja de Salida)
        const syncInterval = setInterval(async () => {
            const { processSyncQueue } = await import('../utils/syncManager')
            const okCount = await processSyncQueue()
            if (okCount > 0) toast(`☁️ ${okCount} registros sincronizados con la nube`, 'ok')
        }, 20000) // Cada 20 segundos intenta vaciar la cola

        // 3. RADAR DE SALUD (Reportar mi estado al administrador)
        const healthChannel = supabase.channel('terminal-health')
        healthChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                // Primer latido inmediato
                sendPulse(healthChannel)
            }
        })

        const sendPulse = (channel) => {
            const status = {
                user: currentUser.username || currentUser.nombre,
                last_seen: new Date().toISOString(),
                pending_sync: pendingItems || 0,
                online: navigator.onLine
            }
            channel.send({
                type: 'broadcast',
                event: 'heartbeat',
                payload: status
            })
        }

        const healthInterval = setInterval(() => sendPulse(healthChannel), 10000)

        return () => {
            supabase.removeChannel(ordersChannel)
            supabase.removeChannel(healthChannel)
            clearInterval(syncInterval)
            clearInterval(healthInterval)
        }
    }, [currentUser, pendingItems])

    return null
}
