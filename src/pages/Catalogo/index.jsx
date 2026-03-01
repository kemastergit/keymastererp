
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtUSD, fmtBS } from '../../utils/format'
import useStore from '../../store/useStore'
import { ShoppingCart, Search, ChevronRight, X, Package, MessageCircle } from 'lucide-react'

// El catálogo azul premium (Stitch inspired)
export default function Catalogo() {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedDepto, setSelectedDepto] = useState('TODOS')
    const [cart, setCart] = useState([])
    const [showCheckout, setShowCheckout] = useState(false)
    const [checkoutData, setCheckoutData] = useState({ nombre: '', telefono: '' })
    const [isSending, setIsSending] = useState(false)
    const [orderSuccess, setOrderSuccess] = useState(false)
    const { tasa = 0, loadTasa } = useStore()
    const [articulos, setArticulos] = useState([])
    const [deptos, setDeptos] = useState(['TODOS'])
    const [loadingData, setLoadingData] = useState(true)

    useEffect(() => {
        if (loadTasa) loadTasa()
        fetchCatalog()
    }, [])

    const fetchCatalog = async () => {
        setLoadingData(true)
        try {
            // Leer productos activos y con stock
            const { data: productos, error } = await supabase
                .from('catalogo_productos')
                .select('*')
                .eq('activo', true)
                .gt('stock', 0)

            if (error) {
                console.warn('Filtro de Supabase falló, trayendo todos para fallback:', error)
                // Reintento sin filtros si falla algo de columnas
                const { data: fallback } = await supabase.from('catalogo_productos').select('*')
                setArticulos(fallback || [])
            } else {
                setArticulos(productos || [])
            }

            // Extraer categorías únicas
            const rawCats = (productos || []).map(p => p.categoria || p.departamento)
            const uniqueCats = [...new Set(rawCats)].filter(Boolean)
            setDeptos(['TODOS', ...uniqueCats])

        } catch (error) {
            console.error('Error fatal cargando catálogo:', error)
        } finally {
            setLoadingData(false)
        }
    }

    // Filtrar localmente según la búsqueda
    const filteredArticulos = (articulos || []).filter(a => {
        const desc = (a.descripcion || a.nombre || '').toLowerCase()
        const nom = (a.nombre || a.descripcion || '').toLowerCase()
        const term = searchTerm.toLowerCase()
        const matchesSearch = desc.includes(term) || nom.includes(term)

        const deptoProducto = a.categoria || a.departamento || 'VARIOS'
        const matchesDepto = selectedDepto === 'TODOS' || deptoProducto === selectedDepto
        return matchesSearch && matchesDepto
    })

    const addToCart = (art) => {
        const exists = cart.find(i => i.id === art.id)
        if (exists) {
            setCart(cart.map(i => i.id === art.id ? { ...i, qty: i.qty + 1 } : i))
        } else {
            setCart([...cart, { ...art, qty: 1 }])
        }
    }

    const removeFromCart = (id) => {
        setCart(cart.filter(i => i.id !== id))
    }

    const total = cart.reduce((s, i) => s + ((i.precio_usd || i.precio || 0) * i.qty), 0)

    const [lastPedidoId, setLastPedidoId] = useState(null)

    const handleSendOrder = async () => {
        if (!checkoutData.nombre || !checkoutData.telefono) {
            alert('Por favor completa tu nombre y teléfono')
            return
        }

        setIsSending(true)
        try {
            // Formatear items para JSONB (Supabase)
            const itemsParaSupabase = cart.map(item => ({
                articulo_id: item.id,
                codigo: item.codigo,
                descripcion: item.descripcion || item.nombre,
                cantidad: item.qty,
                precio_unitario: item.precio_usd || item.precio || 0
            }))

            // Insertar en Supabase
            const { data, error } = await supabase
                .from('pedidos_web')
                .insert([{
                    cliente_nombre: checkoutData.nombre,
                    cliente_telefono: checkoutData.telefono,
                    total_usd: total,
                    items: itemsParaSupabase,
                    estado: 'PENDIENTE'
                }])
                .select()
                .single()

            if (error) throw error

            setLastPedidoId(data.numero || data.id || 'WEB')
            setOrderSuccess(true)
        } catch (e) {
            console.error("Error al guardar pedido en Supabase:", e)
            alert("Error de conexión al procesar el pedido. Intenta de nuevo.")
        } finally {
            setIsSending(false)
        }
    }

    const handleBackToCatalog = () => {
        setCart([])
        setShowCheckout(false)
        setOrderSuccess(false)
        setLastPedidoId(null)
        setCheckoutData({ nombre: '', telefono: '' })
    }

    // Render principal
    return (
        <div className="min-h-screen bg-[var(--bg)] font-inter pb-32 text-[var(--text-main)] overflow-x-hidden">
            {/* HEADER */}
            <header className="bg-[var(--surface)] border-b border-[var(--border2)] p-5 rounded-b-[2rem] shadow-sm">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-[var(--surface2)] border border-[var(--border2)] rounded-xl flex items-center justify-center">
                            <span className="font-bebas text-[var(--orange-var)] text-xl">KM</span>
                        </div>
                        <div>
                            <h1 className="font-black text-lg tracking-tight text-[var(--orange-var)]">KM KEYMASTER</h1>
                            <p className="text-[var(--text2)] text-[9px] font-black tracking-[0.2em] uppercase">Automotores Guaicaipuro</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {(tasa || 0) > 0 && (
                            <div className="bg-[var(--surface2)] border border-[var(--border2)] px-3 py-2 rounded-xl">
                                <p className="text-[8px] font-black text-[var(--text2)] uppercase tracking-widest">Tasa BCV</p>
                                <p className="text-[var(--teal)] font-mono font-black text-sm">{(tasa || 0).toFixed(2)} Bs</p>
                            </div>
                        )}
                        <button
                            onClick={() => cart.length > 0 && setShowCheckout(true)}
                            className="relative bg-[var(--surface)] border border-[var(--border-var)] p-3 rounded-xl active:scale-95 transition-all shadow-[var(--win-shadow)]"
                        >
                            <ShoppingCart size={22} className="text-[var(--teal)]" />
                            {cart.length > 0 && (
                                <span className="absolute -top-2 -right-2 bg-[var(--teal)] text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-[var(--surface)] shadow-lg">
                                    {cart.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* SEARCH BAR */}
            <div className="px-4 mt-4 sticky top-2 z-40">
                <div className="bg-[var(--surface)] border border-[var(--border2)] rounded-card flex items-center gap-3 px-4 shadow-sm">
                    <Search size={18} className="text-[var(--text2)] shrink-0" />
                    <input
                        type="text"
                        placeholder="¿Qué pieza necesitas...?"
                        className="flex-1 py-3.5 outline-none text-sm font-bold bg-transparent placeholder:text-[var(--text3)] text-[var(--text-main)]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* CATEGORIES */}
            <div className="mt-5 px-4 overflow-x-auto no-scrollbar flex gap-2">
                {deptos?.map(depto => (
                    <button
                        key={depto}
                        onClick={() => setSelectedDepto(depto)}
                        className={`px-5 py-2.5 rounded-full text-[10px] font-black tracking-widest uppercase transition-all border shrink-0 ${selectedDepto === depto
                            ? 'bg-[var(--teal)] border-[var(--teal)] text-white shadow-[0_5px_20px_rgba(15,23,42,0.3)]'
                            : 'bg-[var(--surface)] border-[var(--border2)] text-[var(--text2)] hover:border-[var(--teal)]'
                            }`}
                    >
                        {depto}
                    </button>
                ))}
            </div>

            {/* PRODUCT LIST */}
            <div className="p-4 mt-2">
                {loadingData ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 animate-pulse">
                        <div className="w-12 h-12 bg-[var(--surface2)] rounded-full border-4 border-t-[var(--teal)] border-[var(--surface2)] animate-spin"></div>
                        <p className="text-[10px] font-black uppercase text-[var(--text3)] tracking-widest">Cargando Catálogo...</p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h2 className="font-black text-sm uppercase tracking-wider text-[var(--text2)]">Catálogo</h2>
                            <div className="flex items-center gap-2 bg-[var(--surface2)] border border-[var(--border2)] px-3 py-1.5 rounded-lg">
                                <div className="w-1.5 h-1.5 bg-[var(--teal)] rounded-full"></div>
                                <span className="text-[9px] font-black text-[var(--text2)] uppercase tracking-wider">
                                    {(filteredArticulos || []).length} ítems
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {(filteredArticulos || []).map(art => {
                                const currentInCart = cart.find(i => i.id === art.id)
                                const precioUsd = art.precio_usd || art.precio || 0
                                return (
                                    <div
                                        key={art.id}
                                        className="group bg-[var(--surface)] border border-[var(--border-var)] p-4 rounded-card flex items-center gap-4 active:scale-[0.98] transition-all hover:border-[var(--teal)]"
                                    >
                                        <div className="w-16 h-16 bg-[var(--teal4)] border border-[var(--border2)] rounded-xl flex items-center justify-center shrink-0">
                                            <Package size={28} className="text-[var(--teal)] opacity-70" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[8px] font-black text-[var(--teal)] bg-[var(--teal4)] px-2 py-0.5 rounded-full uppercase">
                                                    {art.categoria || art.departamento || 'VARIOS'}
                                                </span>
                                            </div>
                                            <h3 className="font-black text-[12px] leading-tight text-[var(--text-main)] line-clamp-1 mb-1">
                                                {art.nombre || art.descripcion}
                                            </h3>
                                            <p className="text-[9px] text-[var(--text3)] font-mono leading-tight line-clamp-1">
                                                {art.descripcion || `REF: ${art.codigo}`}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            <div className="text-right">
                                                <p className="font-black text-lg text-[var(--teal)] leading-none">
                                                    {fmtUSD(precioUsd)}
                                                </p>
                                                <p className="text-[9px] font-mono text-[var(--text3)] mt-1">
                                                    ~ {fmtBS(precioUsd * (tasa || 0))}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => addToCart(art)}
                                                className="relative bg-[var(--teal)] text-white w-10 h-10 rounded-button flex items-center justify-center active:scale-90 transition-all hover:bg-[var(--tealDark)] shadow-[0_4px_12px_rgba(15,23,42,0.3)]"
                                            >
                                                <ShoppingCart size={16} />
                                                {currentInCart && (
                                                    <span className="absolute -top-1.5 -right-1.5 bg-[var(--surface)] text-[var(--teal)] text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[var(--border2)]">
                                                        {currentInCart.qty}
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}

                            {(filteredArticulos || []).length === 0 && (
                                <div className="text-center py-24 px-10">
                                    <div className="w-20 h-20 bg-[var(--surface)] border border-[var(--border2)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Search size={32} className="text-[var(--text3)]" />
                                    </div>
                                    <h3 className="font-black text-lg text-[var(--text2)] uppercase tracking-widest">
                                        Sin Resultados
                                    </h3>
                                    <p className="text-[10px] font-bold text-[var(--text3)] uppercase mt-1">
                                        Intenta con otra palabra o categoría
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* FLOATING CART BAR */}
            {cart.length > 0 && !showCheckout && (
                <div className="fixed bottom-6 left-4 right-4 z-50">
                    <button
                        onClick={() => setShowCheckout(true)}
                        className="w-full bg-[var(--teal)] text-white p-3 rounded-2xl shadow-[0_10px_40px_rgba(15,23,42,0.4)] flex items-center justify-between active:scale-95 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 w-11 h-11 rounded-xl flex items-center justify-center">
                                <ShoppingCart size={20} />
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] font-black tracking-wider uppercase">Mi Carrito</span>
                                <span className="text-[9px] font-bold text-white/80">
                                    {cart.length} piezas seleccionadas
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mr-2">
                            <div className="text-right">
                                <p className="text-xl font-black leading-none">{fmtUSD(total)}</p>
                            </div>
                            <ChevronRight size={20} className="text-white/80" />
                        </div>
                    </button>
                </div>
            )}

            {/* CHECKOUT / ORDER CONFIRMATION */}
            {showCheckout && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex flex-col justify-end transition-all">
                    {orderSuccess ? (
                        <div className="bg-[#0d1117] rounded-t-[3rem] p-8 max-h-[92vh] flex flex-col items-center animate-in slide-in-from-bottom-full duration-500 shadow-[-10px_-10px_50px_rgba(0,0,0,0.4)] text-center overflow-y-auto w-full">
                            <div className="flex items-center gap-3 mb-10 self-start">
                                <div className="w-10 h-10 bg-[#0d968b]/20 border border-[#0d968b]/30 rounded-xl flex items-center justify-center">
                                    <span className="font-bebas text-[#0d968b] text-lg">KM</span>
                                </div>
                                <div className="text-left">
                                    <p className="text-white font-black text-sm">KM KEYMASTER</p>
                                    <p className="text-[#0d968b] text-[9px] font-black tracking-[0.2em] uppercase">Automotores Guaicaipuro</p>
                                </div>
                            </div>

                            <div className="w-28 h-28 bg-[#0d968b]/10 border-2 border-[#0d968b]/20 rounded-3xl flex items-center justify-center shadow-[0_0_60px_rgba(13,150,139,0.2)] mb-8">
                                <span className="material-icons-round text-[#0d968b] text-5xl">verified</span>
                            </div>

                            <div className="inline-flex items-center gap-2 bg-[#0d968b]/10 border border-[#0d968b]/30 px-5 py-2 rounded-full mb-6">
                                <span className="w-2 h-2 bg-[#0d968b] rounded-full animate-pulse"></span>
                                <span className="text-[10px] font-black text-[#0d968b] uppercase tracking-[0.2em]">Pedido en Puerta</span>
                            </div>

                            <h2 className="text-white font-black text-3xl mb-3">¡Pedido Recibido!</h2>
                            <p className="text-slate-400 text-sm leading-relaxed mb-10 max-w-xs">
                                Tu pedido está en espera de confirmación. Te notificaremos pronto.
                            </p>

                            <div className="bg-[#161b22] border border-slate-700/50 rounded-2xl p-5 w-full max-w-xs mb-10 text-left">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Número de Pedido</p>
                                <div className="flex items-center justify-between">
                                    <p className="text-[#0d968b] font-mono font-black text-xl">#KM-{lastPedidoId || '0000'}</p>
                                    <span className="material-icons-round text-slate-600 text-2xl">qr_code_2</span>
                                </div>
                            </div>

                            <button
                                onClick={handleBackToCatalog}
                                className="w-full max-w-xs bg-[#0d968b] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-[#0b8276] transition-all shadow-[0_10px_30px_rgba(13,150,139,0.3)] mb-3"
                            >
                                Volver al Catálogo
                            </button>
                        </div>
                    ) : (
                        <div className="bg-[#161b22] rounded-t-[3rem] p-8 max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-full duration-500 shadow-[-10px_-10px_50px_rgba(0,0,0,0.4)] w-full">
                            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-8 opacity-50"></div>

                            <div className="flex justify-between items-start mb-6">
                                <div className="text-left">
                                    <h2 className="font-black text-2xl text-white leading-none">Tu Carrito</h2>
                                    <p className="text-[10px] font-black text-[#0d968b] tracking-[0.2em] uppercase mt-2">Revisa y confirma</p>
                                </div>
                                <button
                                    onClick={() => setShowCheckout(false)}
                                    className="bg-white/5 border border-white/10 p-3 rounded-xl text-slate-400"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 mb-6 no-scrollbar">
                                {cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center bg-[#0d1117] p-4 rounded-xl border border-slate-700/20">
                                        <div className="flex-1 min-w-0 pr-4 text-left">
                                            <p className="font-black text-[11px] uppercase truncate text-white">{item.nombre || item.descripcion}</p>
                                            <p className="text-[10px] font-bold text-slate-500 mt-1">CANT: {item.qty} × {fmtUSD(item.precio_usd || item.precio || 0)}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-black text-sm text-[#0d968b]">{fmtUSD((item.precio_usd || item.precio || 0) * item.qty)}</span>
                                            <button onClick={() => removeFromCart(item.id)} className="text-slate-600"><X size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mb-6 pt-4 border-t border-slate-700/30 flex justify-between items-end">
                                <span className="font-black text-[10px] text-slate-500 uppercase tracking-widest">Total</span>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-white leading-none">{fmtUSD(total)}</p>
                                    <p className="text-[11px] font-mono font-bold text-[#0d968b] mt-1">~ {fmtBS(total * (tasa || 0))}</p>
                                </div>
                            </div>

                            <div className="space-y-3 mb-6">
                                <input
                                    type="text"
                                    placeholder="Nombre Completo"
                                    className="w-full bg-[#0d1117] p-5 rounded-xl border border-slate-700/30 outline-none text-sm font-black text-white focus:border-[#0d968b]"
                                    value={checkoutData.nombre}
                                    onChange={(e) => setCheckoutData({ ...checkoutData, nombre: e.target.value })}
                                />
                                <input
                                    type="tel"
                                    placeholder="Teléfono WhatsApp"
                                    className="w-full bg-[#0d1117] p-5 rounded-xl border border-slate-700/30 outline-none text-sm font-black text-white focus:border-[#0d968b]"
                                    value={checkoutData.telefono}
                                    onChange={(e) => setCheckoutData({ ...checkoutData, telefono: e.target.value })}
                                />
                            </div>

                            <button
                                onClick={handleSendOrder}
                                disabled={isSending}
                                className="w-full py-5 rounded-2xl font-black text-xs tracking-[0.2em] bg-[#0d968b] text-white shadow-lg"
                            >
                                {isSending ? 'PROCESANDO...' : 'FINALIZAR PEDIDO'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
