import { useState, useEffect } from 'react'
import { db } from '../../db/db'
import { fmtUSD, fmtBS } from '../../utils/format'
import useStore from '../../store/useStore'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'


export default function PedidosWeb() {
    const { tasa, cart, addToCart, clearCart, setClienteFact, toast } = useStore()
    const navigate = useNavigate()
    const [filtro, setFiltro] = useState('PENDIENTE')
    const [selectedPedido, setSelectedPedido] = useState(null)

    // Estado para pedidos consolidados (Dexie + Supabase)
    const [pedidos, setPedidos] = useState([])
    const [loading, setLoading] = useState(true)

    // Cargar pedidos
    const fetchPedidos = async () => {
        setLoading(true)
        try {
            // 1. Pedidos Locales (Dexie)
            let dexieQuery = db.pedidos.orderBy('id').reverse()
            if (filtro !== 'TODOS') {
                dexieQuery = db.pedidos.where('estado').equals(filtro).reverse()
            }
            const dexieResults = await dexieQuery.toArray()
            const dexieFull = await Promise.all(dexieResults.map(async (p) => {
                const items = await db.pedido_items.where('pedido_id').equals(p.id).toArray()
                const itemsDetallados = await Promise.all(items.map(async (it) => {
                    const art = await db.articulos.get(it.articulo_id)
                    return { ...it, descripcion: art?.descripcion || 'Artículo no encontrado', codigo: art?.codigo || '', stock: art?.stock || 0 }
                }))
                return { ...p, items: itemsDetallados, origen: 'LOCAL' }
            }))

            // 2. Pedidos Supabase
            let sbQuery = supabase.from('pedidos_web').select('*').order('created_at', { ascending: false })
            if (filtro !== 'TODOS') {
                sbQuery = sbQuery.eq('estado', filtro)
            }
            const { data: sbResults, error: sbError } = await sbQuery
            if (sbError) throw sbError

            const sbFull = (sbResults || []).map(p => ({
                ...p,
                fecha: p.created_at,
                origen: 'CLOUD',
                items: p.items.map(it => ({
                    ...it,
                    qty: it.cantidad,
                    precio: it.precio_unitario
                }))
            }))

            // Consolidar y ordenar por fecha
            const combined = [...dexieFull, ...sbFull].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            setPedidos(combined)
        } catch (err) {
            console.error('Error fetching pedidos:', err)
            toast('❌ Error cargando pedidos de Supabase', 'error')
        } finally {
            setLoading(true) // Wait, should be false
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPedidos()

        // Suscripción en tiempo real a pedidos nuevos
        const channel = supabase
            .channel('pedidos_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_web' }, () => {
                fetchPedidos()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [filtro])

    const handleImportarAVenta = async (pedido) => {
        if (cart.length > 0) {
            const ok = confirm(`⚠️ El carrito tiene productos. ¿Reemplazar?`)
            if (!ok) return
        }

        clearCart()
        for (const item of pedido.items) {
            let art = null
            if (item.articulo_id) art = await db.articulos.get(item.articulo_id)
            if (!art && item.codigo) art = await db.articulos.where('codigo').equals(item.codigo).first()

            if (art) {
                addToCart(art, item.qty)
            } else {
                toast(`⚠️ Producto ${item.codigo} no encontrado en inventario local`, 'warn')
            }
        }
        if (pedido.cliente_nombre) setClienteFact(pedido.cliente_nombre)

        if (pedido.origen === 'CLOUD') {
            await supabase.from('pedidos_web').update({ estado: 'EN_PROCESO' }).eq('id', pedido.id)
        } else {
            await db.pedidos.update(pedido.id, { estado: 'EN_PROCESO' })
        }

        fetchPedidos()
        toast(`📦 Pedido #${pedido.id} importado`, 'ok')
        navigate('/facturacion')
    }

    // Recargar pedido que ya estaba en proceso (se perdió del carrito)
    const handleRecargar = async (pedido) => {
        if (cart.length > 0) {
            const ok = confirm(
                `⚠️ Ya tienes ${cart.length} producto(s) en el carrito.\n\nSi continúas, se reemplazará con el Pedido #${pedido.id}.\n\n¿Deseas continuar?`
            )
            if (!ok) return
        }

        clearCart()
        for (const item of pedido.items) {
            const art = await db.articulos.get(item.articulo_id)
            if (art) {
                addToCart(art, item.qty)
            }
        }
        if (pedido.cliente_nombre) setClienteFact(pedido.cliente_nombre)
        toast(`🔄 Pedido #${pedido.id} recargado al carrito`, 'ok')
        navigate('/facturacion')
    }

    // Devolver a pendiente
    const handleDevolverPendiente = async (pedido) => {
        await db.pedidos.update(pedido.id, { estado: 'PENDIENTE' })
        toast(`↩️ Pedido #${pedido.id} devuelto a PENDIENTE`, 'ok')
    }

    const handleMarcarContactado = async (pedido) => {
        if (pedido.origen === 'CLOUD') {
            await supabase.from('pedidos_web').update({ estado: 'CONTACTADO' }).eq('id', pedido.id)
        } else {
            await db.pedidos.update(pedido.id, { estado: 'CONTACTADO' })
        }
        fetchPedidos()
        toast(`📞 Pedido marcado como CONTACTADO`, 'ok')
    }

    const handleRechazar = async (pedido) => {
        if (!confirm('¿Seguro que deseas rechazar este pedido?')) return
        if (pedido.origen === 'CLOUD') {
            await supabase.from('pedidos_web').update({ estado: 'RECHAZADO' }).eq('id', pedido.id)
        } else {
            await db.pedidos.update(pedido.id, { estado: 'RECHAZADO' })
        }
        fetchPedidos()
        toast(`❌ Pedido rechazado`, 'warn')
    }

    const handleWhatsApp = (pedido) => {
        const tel = pedido.cliente_telefono?.replace(/\D/g, '')
        if (!tel) {
            toast('⚠️ No hay número de teléfono registrado', 'warn')
            return
        }
        const msg = `Hola ${pedido.cliente_nombre || 'estimado cliente'}, recibimos tu pedido #${pedido.id}. Estamos procesándolo. ¡Gracias por tu preferencia! - AUTOMOTORES GUAICAIPURO`
        window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank')
    }

    const [contadores, setContadores] = useState({ pendientes: 0, total: 0 })

    useEffect(() => {
        const fetchCounters = async () => {
            // Local
            const dPending = await db.pedidos.where('estado').equals('PENDIENTE').count()
            const dTotal = await db.pedidos.count()

            // Supabase
            const { count: sPending } = await supabase.from('pedidos_web').select('*', { count: 'exact', head: true }).eq('estado', 'PENDIENTE')
            const { count: sTotal } = await supabase.from('pedidos_web').select('*', { count: 'exact', head: true })

            setContadores({
                pendientes: (dPending || 0) + (sPending || 0),
                total: (dTotal || 0) + (sTotal || 0)
            })
        }
        fetchCounters()
    }, [pedidos])

    const filtros = [
        { key: 'PENDIENTE', label: 'PENDIENTES', icon: 'pending', color: 'bg-orange-500', count: contadores?.pendientes },
        { key: 'CONTACTADO', label: 'CONTACTADOS', icon: 'phone_in_talk', color: 'bg-blue-500', count: contadores?.contactados },
        { key: 'EN_PROCESO', label: 'EN PROCESO', icon: 'sync', color: 'bg-purple-500', count: contadores?.enProceso },
        { key: 'PROCESADO', label: 'COMPLETADOS', icon: 'check_circle', color: 'bg-green-600', count: contadores?.completados },
        { key: 'RECHAZADO', label: 'RECHAZADOS', icon: 'cancel', color: 'bg-red-600', count: contadores?.rechazados },
        { key: 'TODOS', label: 'TODOS', icon: 'list', color: 'bg-slate-600', count: contadores?.total },
    ]

    const getEstadoBadge = (estado) => {
        const map = {
            PENDIENTE: { bg: 'bg-orange-100 text-orange-700 border-orange-300', icon: 'pending', label: 'PENDIENTE' },
            CONTACTADO: { bg: 'bg-blue-100 text-blue-700 border-blue-300', icon: 'phone_in_talk', label: 'CONTACTADO' },
            EN_PROCESO: { bg: 'bg-purple-100 text-purple-700 border-purple-300', icon: 'sync', label: 'EN PROCESO' },
            PROCESADO: { bg: 'bg-green-100 text-green-700 border-green-300', icon: 'check_circle', label: 'COMPLETADO' },
            RECHAZADO: { bg: 'bg-red-100 text-red-700 border-red-300', icon: 'cancel', label: 'RECHAZADO' },
        }
        return map[estado] || map.PENDIENTE
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-[var(--surface2)]">
            {/* HEADER */}
            <div className="flex-none bg-[var(--surface)] border-b-2 border-[var(--border-var)] p-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 flex items-center justify-center text-white shadow-lg">
                            <span className="material-icons-round">shopping_cart_checkout</span>
                        </div>
                        <div>
                            <h2 className="font-black text-lg uppercase tracking-tight text-[var(--text-main)]">
                                Pedidos en Línea
                            </h2>
                            <p className="text-[9px] font-bold text-[var(--text3)] uppercase tracking-widest">
                                Gestión de pedidos desde el catálogo web
                            </p>
                        </div>
                    </div>
                    {contadores?.pendientes > 0 && (
                        <div className="flex items-center gap-2 bg-red-50 border-2 border-red-200 px-4 py-2 animate-pulse">
                            <span className="material-icons-round text-red-600">notification_important</span>
                            <span className="text-sm font-black text-red-700 uppercase">{contadores.pendientes} NUEVO(S)</span>
                        </div>
                    )}
                </div>

                {/* FILTROS */}
                <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar">
                    {filtros.map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFiltro(f.key)}
                            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-wider border transition-all shrink-0
                ${filtro === f.key
                                    ? `${f.color} text-white border-transparent shadow-lg`
                                    : 'bg-white text-[var(--text2)] border-[var(--border-var)] hover:border-blue-300'
                                }`}
                        >
                            <span className="material-icons-round text-sm">{f.icon}</span>
                            {f.label}
                            {(f.count || 0) > 0 && (
                                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[8px] font-black
                  ${filtro === f.key ? 'bg-white/30 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                    {f.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTENIDO */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-[10px] font-black uppercase text-[var(--text3)] tracking-widest">Sincronizando con la nube...</p>
                    </div>
                ) : !pedidos || pedidos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">

                        <span className="material-icons-round text-6xl text-slate-300 mb-4">inbox</span>
                        <h3 className="font-black text-lg text-slate-400 uppercase tracking-widest mb-2">
                            Sin Pedidos {filtro !== 'TODOS' ? filtro.replace('_', ' ') + 'S' : ''}
                        </h3>
                        <p className="text-xs text-slate-400 max-w-md">
                            Los pedidos realizados desde el catálogo digital aparecerán aquí automáticamente.
                            Comparte el link <strong>/catalogo</strong> con tus clientes.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {pedidos.map(pedido => {
                            const badge = getEstadoBadge(pedido.estado)
                            return (
                                <div key={pedido.id}
                                    className={`bg-[var(--surface)] border-2 overflow-hidden shadow-sm hover:shadow-xl transition-all
                    ${pedido.estado === 'PENDIENTE' ? 'border-orange-300 ring-2 ring-orange-100' : 'border-[var(--border-var)]'}`}
                                >
                                    {/* CABECERA DEL PEDIDO */}
                                    <div className="flex items-center justify-between p-4 bg-[var(--surface2)] border-b border-[var(--border-var)]">
                                        <div className="flex items-center gap-3">
                                            {pedido.estado === 'PENDIENTE' && (
                                                <span className="w-3 h-3 rounded-full bg-orange-500 animate-pulse"></span>
                                            )}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-black text-sm text-[var(--text-main)]">
                                                        PEDIDO #{pedido.id}
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black uppercase border ${badge.bg}`}>
                                                        <span className="material-icons-round text-xs">{badge.icon}</span>
                                                        {badge.label}
                                                    </span>
                                                    <span className={`inline-flex items-center px-2 py-0.5 text-[8px] font-black border ${pedido.origen === 'CLOUD' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                        {pedido.origen}
                                                    </span>
                                                </div>
                                                <div className="text-[9px] text-[var(--text3)] font-mono mt-0.5">
                                                    {new Date(pedido.fecha).toLocaleString('es-VE')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[8px] font-black text-[var(--text3)] uppercase tracking-widest">Total</div>
                                            <div className="font-mono font-black text-lg text-blue-600">{fmtUSD(pedido.total_usd || 0)}</div>
                                            {tasa > 0 && (
                                                <div className="text-[9px] font-mono text-[var(--text3)]">{fmtBS((pedido.total_usd || 0) * tasa)}</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* INFO CLIENTE */}
                                    <div className="p-4 border-b border-[var(--border-var)] bg-blue-50/30">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 bg-blue-100 border border-blue-200 flex items-center justify-center">
                                                    <span className="material-icons-round text-blue-600 text-lg">person</span>
                                                </div>
                                                <div>
                                                    <div className="font-black text-sm text-[var(--text-main)] uppercase">
                                                        {pedido.cliente_nombre || 'CLIENTE WEB'}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-blue-600">
                                                        <span className="material-icons-round text-xs">phone</span>
                                                        {pedido.cliente_telefono || 'Sin teléfono'}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleWhatsApp(pedido)}
                                                className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 hover:bg-green-700 transition-colors shadow-sm"
                                            >
                                                <span className="material-icons-round text-sm">chat</span>
                                                <span className="text-[9px] font-black uppercase tracking-wider hidden sm:inline">WhatsApp</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* ITEMS */}
                                    <div className="p-4">
                                        <div className="text-[8px] font-black text-[var(--text3)] uppercase tracking-widest mb-2">
                                            Artículos Solicitados ({pedido.items?.length || 0})
                                        </div>
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                            {pedido.items?.map((item, i) => (
                                                <div key={i} className="flex justify-between items-center text-[11px] py-1.5 px-2 bg-[var(--surface2)] border border-[var(--border-var)]">
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        <span className="font-black text-blue-600 shrink-0">x{item.qty}</span>
                                                        <span className="font-bold text-[var(--text2)] truncate">{item.descripcion}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded
                              ${item.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {item.stock > 0 ? `Stock: ${item.stock}` : 'AGOTADO'}
                                                        </span>
                                                        <span className="font-mono font-black text-[var(--text-main)]">
                                                            {fmtUSD(item.precio * item.qty)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ACCIONES */}
                                    {pedido.estado !== 'PROCESADO' && pedido.estado !== 'RECHAZADO' && (
                                        <div className="p-4 pt-0 flex flex-wrap gap-2">
                                            {pedido.estado === 'PENDIENTE' && (
                                                <button
                                                    onClick={() => handleMarcarContactado(pedido)}
                                                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 hover:bg-blue-700 transition-all font-black text-[10px] uppercase tracking-widest"
                                                >
                                                    <span className="material-icons-round text-sm">phone_in_talk</span>
                                                    CONTACTAR CLIENTE
                                                </button>
                                            )}

                                            {(pedido.estado === 'PENDIENTE' || pedido.estado === 'CONTACTADO') && (
                                                <button
                                                    onClick={() => handleImportarAVenta(pedido)}
                                                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 px-4 hover:bg-green-700 transition-all font-black text-[10px] uppercase tracking-widest"
                                                >
                                                    <span className="material-icons-round text-sm">login</span>
                                                    IMPORTAR A VENTA
                                                </button>
                                            )}

                                            {pedido.estado === 'EN_PROCESO' && (
                                                <>
                                                    <button
                                                        onClick={() => handleRecargar(pedido)}
                                                        className="flex-1 flex items-center justify-center gap-2 bg-purple-600 text-white py-3 px-4 hover:bg-purple-700 transition-all font-black text-[10px] uppercase tracking-widest"
                                                    >
                                                        <span className="material-icons-round text-sm">refresh</span>
                                                        RECARGAR AL CARRITO
                                                    </button>
                                                    <button
                                                        onClick={() => handleDevolverPendiente(pedido)}
                                                        className="flex items-center justify-center gap-1 bg-orange-100 text-orange-700 py-3 px-4 hover:bg-orange-200 transition-all font-black text-[10px] uppercase tracking-widest border border-orange-200"
                                                    >
                                                        <span className="material-icons-round text-sm">undo</span>
                                                        DEVOLVER A PENDIENTE
                                                    </button>
                                                </>
                                            )}

                                            {pedido.estado === 'PENDIENTE' && (
                                                <button
                                                    onClick={() => handleRechazar(pedido)}
                                                    className="flex items-center justify-center gap-1 bg-red-100 text-red-700 py-3 px-4 hover:bg-red-200 transition-all font-black text-[10px] uppercase tracking-widest border border-red-200"
                                                >
                                                    <span className="material-icons-round text-sm">close</span>
                                                    RECHAZAR
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* ESTADO FINAL */}
                                    {(pedido.estado === 'PROCESADO' || pedido.estado === 'RECHAZADO') && (
                                        <div className={`p-3 text-center text-[10px] font-black uppercase tracking-widest
                      ${pedido.estado === 'PROCESADO' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            <span className="material-icons-round text-sm align-middle mr-1">
                                                {pedido.estado === 'PROCESADO' ? 'check_circle' : 'cancel'}
                                            </span>
                                            {pedido.estado === 'PROCESADO' ? 'PEDIDO PROCESADO CON ÉXITO' : 'PEDIDO RECHAZADO'}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
