import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { db } from '../db/db'
import { useLiveQuery } from 'dexie-react-hooks'

export default function SupabaseListener() {
    const { incrementUnread, toast, currentUser, setPendingSyncCount } = useStore()

    // 📡 Monitor de COLA DE SINCRONIZACIÓN (Reactivo con Dexie)
    const pendingItems = useLiveQuery(() => db.sync_queue.where('status').equals('PENDING').count(), [])

    useEffect(() => {
        setPendingSyncCount(pendingItems || 0)
    }, [pendingItems])

    // ✨ EFECTO 1: SUSCRIPCIONES REALTIME (Solo cuando el usuario cambia)
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
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3')
                    audio.play().catch(e => console.warn('Silenciado por política del navegador:', e.message))
                } catch (e) { console.warn(e) }
            })
            .subscribe()

        // 2. ESCUCHAR TASA BCV GLOBAL (Realtime)
        const configChannel = supabase
            .channel('public:config_global')
            .on('postgres_changes', { event: 'ALL', schema: 'public', table: 'config_global' }, async (payload) => {
                const { clave, valor } = payload.new
                if (clave === 'tasa_bcv' && valor?.monto) {
                    const nMonto = parseFloat(valor.monto)
                    useStore.getState().setTasa(nMonto)
                    toast(`📈 TASA SISTEMA ACTUALIZADA: Bs ${nMonto}`, 'success')
                }
                if (clave === 'tasa_bcv_oficial' && valor?.monto) {
                    const nMontoOficial = parseFloat(valor.monto)
                    useStore.getState().setTasaOficial(nMontoOficial)
                    toast(`🏛️ TASA BCV ACTUALIZADA: Bs ${nMontoOficial}`, 'info')
                }
            })
            .subscribe()

        // 3. 📡 RADAR DE FACTURAS (Sincronización Multi-Cajero)
        // Escucha cuando OTRO terminal sube una venta y la trae para acá
        const invoiceChannel = supabase
            .channel('public:facturas')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'facturas' }, async (payload) => {
                const facturaNube = payload.new

                // Verificar si ya la tenemos (para no duplicar)
                const existe = await db.ventas.where('nro').equals(facturaNube.numero).first()
                if (!existe) {
                    try {
                        // 1. Guardar Cabecera
                        const localId = await db.ventas.add({
                            nro: facturaNube.numero, // El nro es lo que usamos para buscar
                            fecha: new Date(facturaNube.created_at),
                            cliente: facturaNube.cliente,
                            total: facturaNube.total_usd,
                            tipo_pago: facturaNube.tipo_pago,
                            estado: 'ACTIVA',
                            vendedor: facturaNube.vendedor,
                            usuario_id: facturaNube.usuario_id
                        })

                        // 2. 📥 Traer los productos de esa venta desde la nube
                        const { data: itemsNube, error: errItems } = await supabase
                            .from('venta_items')
                            .select('*')
                            .eq('factura_id', facturaNube.id)

                        if (!errItems && itemsNube) {
                            // Guardar cada producto localmente para que el ticket salga completo
                            const itemsParaDexie = itemsNube.map(it => ({
                                venta_id: localId,
                                articulo_id: it.articulo_id,
                                codigo: it.codigo,
                                descripcion: it.descripcion,
                                cantidad: it.cantidad,
                                precio_unitario: it.precio_unitario,
                                total: it.total
                            }))
                            await db.venta_items.bulkAdd(itemsParaDexie)
                        }

                        toast(`📥 VENTA SINCRONIZADA: #${facturaNube.numero}`, 'info')
                    } catch (e) {
                        console.error("Error auto-sync factura completa:", e)
                    }
                }
            })
            .subscribe()

        // 4. 🛰️ RADAR DE INVENTARIO (Sincronización de Stock y Precios)
        // Escucha si el stock cambia en la nube (porque otro vendió) y lo actualiza aquí
        const inventoryChannel = supabase
            .channel('public:articulos')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'articulos' }, async (payload) => {
                const artNube = payload.new
                try {
                    // Actualizar localmente solo si hay cambios en stock o precio
                    await db.articulos.where('codigo').equals(artNube.codigo).modify({
                        stock: artNube.stock,
                        precio_vta: artNube.precio_vta,
                        precio_vta_2: artNube.precio_vta_2,
                        precio_vta_3: artNube.precio_vta_3
                    })
                    // No ponemos toast para no cansar al usuario con cada descuento de stock
                    console.log(`📦 Inventario Sincronizado: ${artNube.codigo} -> Stock: ${artNube.stock}`)
                } catch (e) { console.error("Error auto-sync stock:", e) }
            })
            .subscribe()

        // 5. RADAR DE SALUD (Heartbeat)
        const healthChannel = supabase.channel('terminal-health')
        healthChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') sendPulse(healthChannel)
        })

        const sendPulse = (channel) => {
            channel.send({
                type: 'broadcast',
                event: 'heartbeat',
                payload: {
                    user: currentUser.username || currentUser.nombre,
                    last_seen: new Date().toISOString(),
                    online: navigator.onLine
                }
            })
        }

        const healthInterval = setInterval(() => sendPulse(healthChannel), 15000)

        return () => {
            supabase.removeChannel(ordersChannel)
            supabase.removeChannel(configChannel)
            supabase.removeChannel(invoiceChannel)
            supabase.removeChannel(inventoryChannel)
            supabase.removeChannel(healthChannel)
            clearInterval(healthInterval)
        }
    }, [currentUser])

    // ⚡ EFECTO 2: BACKGROUND SYNC (Ciclo de sincronización independiente)
    useEffect(() => {
        if (!currentUser) return

        // 1. Ciclo Rápido (30 segundos): Datos críticos de ventas y stock
        const fastSync = async () => {
            const { processSyncQueue, pullRecentInvoices } = await import('../utils/syncManager')
            await processSyncQueue()
            const pulled = await pullRecentInvoices()
            if (pulled > 0) toast(`📥 ${pulled} VENTAS EXTERNAS DESCARGADAS`, 'info')
        }

        // 2. Ciclo Lento (30 minutos): Tasa BCV Oficial
        const slowSync = async () => {
            const { syncOfficialBcvRate } = await import('../utils/bcvSincronizador')
            await syncOfficialBcvRate()
        }

        // Ejecutar inmediatamente
        fastSync()
        slowSync()

        const fastInterval = setInterval(fastSync, 30000)
        const slowInterval = setInterval(slowSync, 1800000)

        return () => {
            clearInterval(fastInterval)
            clearInterval(slowInterval)
        }
    }, [currentUser])

    return null
}
