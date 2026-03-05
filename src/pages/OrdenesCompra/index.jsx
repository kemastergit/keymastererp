import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nextNro } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtBS, fmtDate } from '../../utils/format'
import { addToSyncQueue, processSyncQueue } from '../../utils/syncManager'

export default function OrdenesCompra() {
    const { tasa, toast, configEmpresa } = useStore()
    const [tab, setTab] = useState('nueva')
    const [busq, setBusq] = useState('')
    const [showDrop, setShowDrop] = useState(false)
    const [provSelected, setProvSelected] = useState(null)
    const [items, setItems] = useState([])
    const [notas, setNotas] = useState('')
    const [fechaEntrega, setFechaEntrega] = useState('')

    const prefix = configEmpresa?.terminal_prefix || 'OC'

    const articulos = useLiveQuery(
        () => busq.trim()
            ? db.articulos.filter(a =>
                a.codigo?.toLowerCase().includes(busq.toLowerCase()) ||
                a.descripcion?.toLowerCase().includes(busq.toLowerCase())
            ).limit(20).toArray()
            : db.articulos.orderBy('descripcion').limit(30).toArray(),
        [busq], []
    )

    const proveedores = useLiveQuery(() => db.proveedores.toArray(), [], [])
    const historial = useLiveQuery(() => db.ordenes_compra.orderBy('fecha').reverse().limit(50).toArray(), [], [])

    const addItem = (art) => {
        const exists = items.find(i => i.articulo_id === art.id)
        if (exists) {
            setItems(items.map(i => i.articulo_id === art.id ? { ...i, qty: i.qty + 1 } : i))
        } else {
            setItems([...items, {
                articulo_id: art.id,
                codigo: art.codigo,
                descripcion: art.descripcion,
                qty: 1,
                costo_estimado: art.costo || art.precio || 0
            }])
        }
        setBusq('')
        setShowDrop(false)
    }

    const updateItem = (artId, field, val) => {
        setItems(items.map(i => i.articulo_id === artId ? { ...i, [field]: val } : i))
    }

    const removeItem = (artId) => {
        setItems(items.filter(i => i.articulo_id !== artId))
    }

    const totalOC = items.reduce((sum, i) => sum + (i.qty * i.costo_estimado), 0)

    const procesarOC = async () => {
        if (!provSelected) { toast('⚠️ Seleccione un PROVEEDOR', 'warn'); return }
        if (items.length === 0) { toast('⚠️ Agregue al menos un producto', 'warn'); return }

        const nro = await nextNro('nro_oc')
        const oc = {
            nro: `OC-${prefix}-${nro}`,
            fecha: new Date(),
            proveedor_id: provSelected.id,
            proveedor_nombre: provSelected.nombre,
            proveedor_rif: provSelected.rif || '',
            estado: 'PENDIENTE',
            total_estimado: totalOC,
            notas,
            fecha_entrega_esperada: fechaEntrega || null,
            usuario: useStore.getState().userSession?.nombre || 'SISTEMA'
        }

        const ocId = await db.ordenes_compra.add(oc)

        for (const item of items) {
            await db.oc_items.add({ oc_id: ocId, ...item })
        }

        // ☁️ SYNC A SUPABASE
        await addToSyncQueue('ordenes_compra', 'INSERT', { id: ocId, ...oc, fecha: oc.fecha.toISOString() })
        for (const item of items) {
            await addToSyncQueue('oc_items', 'INSERT', { oc_id: ocId, ...item })
        }
        processSyncQueue()

        toast(`📦 Orden de Compra ${oc.nro} generada con éxito`, 'ok')
        setItems([])
        setProvSelected(null)
        setNotas('')
        setFechaEntrega('')
    }

    const cambiarEstado = async (oc, nuevoEstado) => {
        await db.ordenes_compra.update(oc.id, { estado: nuevoEstado })
        // ☁️ SYNC estado a Supabase
        await addToSyncQueue('ordenes_compra', 'UPDATE_ESTADO', { nro: oc.nro, estado: nuevoEstado })
        processSyncQueue()
        toast(`✅ OC #${oc.nro} → ${nuevoEstado}`, 'ok')
    }

    const estadoColor = (estado) => {
        switch (estado) {
            case 'PENDIENTE': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            case 'RECIBIDA': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            case 'CANCELADA': return 'bg-red-500/20 text-red-400 border-red-500/30'
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
        }
    }

    return (
        <div className="pr-2 pb-6">
            <div className="flex gap-1 mb-4">
                {['nueva', 'historial'].map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-6 py-3 rounded-none text-[10px] font-black uppercase tracking-widest transition-none cursor-pointer border shadow-[var(--win-shadow)]
            ${tab === t ? 'bg-[var(--teal)] text-white border-transparent' : 'bg-[var(--surface2)] text-[var(--text2)] border-[var(--border-var)] hover:bg-[var(--surfaceDark)]'}`}>
                        {t === 'nueva' ? '📦 NUEVA ORDEN DE COMPRA' : '🕒 HISTORIAL DE ÓRDENES'}
                    </button>
                ))}
            </div>

            {tab === 'nueva' && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3">
                    <div className="space-y-3">
                        {/* Panel Proveedor */}
                        <div className="panel rounded-none shadow-[var(--win-shadow)] transition-none border-t-4 border-t-[var(--orange-var)]">
                            <div className="text-xl font-black text-[var(--text-main)] mb-6 uppercase tracking-tighter flex items-center gap-2">
                                <span className="material-icons-round text-[var(--orange-var)]">local_shipping</span>
                                EMISIÓN DE ORDEN DE COMPRA
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">Proveedor</label>
                                    <select
                                        value={provSelected?.id || ''}
                                        onChange={(e) => {
                                            const prov = proveedores.find(p => p.id === Number(e.target.value))
                                            setProvSelected(prov || null)
                                        }}
                                        className="inp w-full rounded-none focus:border-[var(--orange-var)] transition-none shadow-inner !py-3 bg-[var(--surfaceDark)] text-[var(--text-main)] border border-[var(--border-var)] outline-none font-black uppercase text-xs"
                                    >
                                        <option value="">— SELECCIONE PROVEEDOR —</option>
                                        {proveedores.map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre} {p.rif ? `(${p.rif})` : ''}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">Fecha Entrega Esperada (Opcional)</label>
                                    <input
                                        type="date"
                                        value={fechaEntrega}
                                        onChange={(e) => setFechaEntrega(e.target.value)}
                                        className="inp w-full rounded-none focus:border-[var(--orange-var)] transition-none shadow-inner !py-3 bg-[var(--surfaceDark)] text-[var(--text-main)] border border-[var(--border-var)] outline-none font-black text-xs"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">Notas / Observaciones</label>
                                <input
                                    type="text"
                                    value={notas}
                                    onChange={(e) => setNotas(e.target.value)}
                                    placeholder="Ej: Urgente, Entrega parcial, etc."
                                    className="inp w-full rounded-none focus:border-[var(--orange-var)] transition-none shadow-inner !py-3 bg-[var(--surfaceDark)] text-[var(--text-main)] border border-[var(--border-var)] outline-none font-bold text-xs uppercase"
                                />
                            </div>
                        </div>

                        {/* Buscador de Artículos */}
                        <div className="panel rounded-none shadow-[var(--win-shadow)] transition-none">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">Buscar Artículos para Solicitar</label>
                            <div className="relative mt-2">
                                <input className="inp rounded-none focus:border-[var(--teal)] transition-none shadow-inner !py-4 w-full" value={busq}
                                    onChange={e => { setBusq(e.target.value); setShowDrop(true) }}
                                    onFocus={() => setShowDrop(true)}
                                    placeholder="🔍 ESCRIBE CÓDIGO O DESCRIPCIÓN..." autoComplete="off" />
                                {showDrop && articulos.length > 0 && (
                                    <div className="absolute z-20 w-full bg-[var(--surface)] border-2 border-[var(--border-var)] rounded-none max-h-64 overflow-y-auto shadow-[var(--win-shadow)] mt-1">
                                        {articulos.map(a => (
                                            <div key={a.id}
                                                className="px-4 py-3 cursor-pointer border-b border-[var(--border-var)] hover:bg-[var(--surfaceDark)] transition-none flex justify-between items-center"
                                                onClick={() => addItem(a)}>
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-[var(--teal)] text-xs font-black uppercase">{a.codigo}</span>
                                                    <span className="font-black text-[var(--text-main)] text-sm uppercase">{a.descripcion}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-mono font-black text-[var(--teal)] bg-[var(--surfaceDark)] px-2 py-1 shadow-inner border border-black/5 text-sm">{fmtUSD(a.costo || a.precio)}</span>
                                                    <div className="text-[9px] text-[var(--text2)] font-black mt-1">STOCK: {a.stock ?? '—'}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tabla de Items Agregados */}
                        {items.length > 0 && (
                            <div className="panel rounded-none shadow-[var(--win-shadow)] transition-none p-0 overflow-hidden">
                                <div className="p-4 bg-[var(--surface2)] border-b border-[var(--border-var)]">
                                    <div className="text-[10px] font-black text-[var(--text2)] uppercase tracking-widest">Productos Solicitados ({items.length})</div>
                                </div>
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-800 text-white">
                                            <th className="p-3 text-[9px] font-black uppercase tracking-widest">Código</th>
                                            <th className="p-3 text-[9px] font-black uppercase tracking-widest">Descripción</th>
                                            <th className="p-3 text-[9px] font-black uppercase tracking-widest text-center">Cantidad</th>
                                            <th className="p-3 text-[9px] font-black uppercase tracking-widest text-right">Costo Unit.</th>
                                            <th className="p-3 text-[9px] font-black uppercase tracking-widest text-right">Subtotal</th>
                                            <th className="p-3 text-[9px] font-black uppercase tracking-widest text-center">X</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-var)]">
                                        {items.map(item => (
                                            <tr key={item.articulo_id} className="hover:bg-[var(--surface2)] transition-none">
                                                <td className="p-3 font-mono text-[var(--teal)] font-black text-xs">{item.codigo}</td>
                                                <td className="p-3 font-black text-[var(--text-main)] text-xs uppercase">{item.descripcion}</td>
                                                <td className="p-3 text-center">
                                                    <input type="number" value={item.qty} min="1"
                                                        onChange={e => updateItem(item.articulo_id, 'qty', parseInt(e.target.value) || 1)}
                                                        className="w-16 bg-[var(--surfaceDark)] border border-[var(--border-var)] text-center rounded-none px-1 py-1 font-mono text-sm outline-none focus:border-[var(--teal)] font-black transition-none shadow-inner" />
                                                </td>
                                                <td className="p-3 text-right">
                                                    <input type="number" value={item.costo_estimado} min="0" step="0.01"
                                                        onChange={e => updateItem(item.articulo_id, 'costo_estimado', parseFloat(e.target.value) || 0)}
                                                        className="w-24 bg-[var(--surfaceDark)] border border-[var(--border-var)] text-right rounded-none px-1 py-1 font-mono text-sm outline-none focus:border-[var(--teal)] font-black transition-none shadow-inner" />
                                                </td>
                                                <td className="p-3 font-mono font-black text-xs text-right text-[var(--text-main)]">{fmtUSD(item.qty * item.costo_estimado)}</td>
                                                <td className="p-3 text-center">
                                                    <button className="text-[var(--red-var)] bg-[var(--red-var)]/10 hover:bg-[var(--red-var)] hover:text-white transition-none p-1 rounded-none cursor-pointer"
                                                        onClick={() => removeItem(item.articulo_id)}>
                                                        <span className="material-icons-round text-sm">close</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Panel Lateral - Resumen */}
                    <div>
                        <div className="panel rounded-none shadow-[var(--win-shadow)] transition-none bg-[var(--surface2)] sticky top-2">
                            <div className="text-[10px] font-black text-[var(--text2)] mb-4 uppercase tracking-widest">RESUMEN DE OC</div>

                            {provSelected && (
                                <div className="bg-[var(--surfaceDark)] border border-[var(--border-var)] rounded-none p-3 mb-4">
                                    <div className="text-[9px] text-[var(--text2)] font-black uppercase tracking-widest mb-1">Proveedor</div>
                                    <div className="text-sm font-black text-[var(--orange-var)] uppercase">{provSelected.nombre}</div>
                                    {provSelected.rif && <div className="text-[10px] font-mono text-[var(--text2)]">{provSelected.rif}</div>}
                                </div>
                            )}

                            <div className="text-[9px] font-black text-[var(--text2)] uppercase tracking-widest mb-1">Artículos: {items.length}</div>
                            <div className="text-[9px] font-black text-[var(--text2)] uppercase tracking-widest mb-1">Unidades Totales: {items.reduce((s, i) => s + i.qty, 0)}</div>

                            <div className="bg-[var(--surfaceDark)] border-2 border-[var(--border-var)] rounded-none p-4 mt-4 shadow-inner">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] font-black text-[var(--text2)] uppercase tracking-widest">TOTAL ESTIMADO</span>
                                    <span className="text-2xl font-mono font-black text-[var(--orange-var)]">{fmtUSD(totalOC)}</span>
                                </div>
                                <div className="flex justify-between items-center opacity-60">
                                    <span className="text-[10px] font-black text-[var(--text2)] uppercase tracking-widest">REF. BOLÍVARES</span>
                                    <span className="text-sm font-mono font-black text-[var(--text-main)]">{fmtBS(totalOC, tasa)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2 mt-4">
                                <button className="btn bg-[var(--orange-var)] text-white w-full py-4 text-xs font-black tracking-widest transition-none shadow-[var(--win-shadow)] cursor-pointer uppercase flex items-center justify-center gap-2" onClick={procesarOC}>
                                    <span className="material-icons-round text-base">send</span>
                                    GENERAR ORDEN DE COMPRA
                                </button>
                                <button className="btn bg-[var(--surfaceDark)] text-[var(--text-main)] w-full py-3 text-[10px] font-black tracking-widest transition-none shadow-[var(--win-shadow)] cursor-pointer uppercase flex items-center justify-center gap-2"
                                    onClick={() => { setItems([]); setProvSelected(null); setNotas(''); setFechaEntrega('') }}>
                                    <span className="material-icons-round text-base">delete_sweep</span>
                                    LIMPIAR TODO
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'historial' && (
                <div className="panel rounded-none shadow-[var(--win-shadow)] transition-none p-0 overflow-hidden border-t-4 border-t-[var(--orange-var)]">
                    <div className="p-5 bg-[var(--surface2)] border-b border-[var(--border-var)]">
                        <div className="text-xl font-black text-[var(--text-main)] mb-1 uppercase tracking-tighter">HISTORIAL DE ÓRDENES DE COMPRA</div>
                        <p className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest">Control de pedidos realizados a proveedores</p>
                    </div>
                    <div className="overflow-x-auto min-h-[400px]">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-800 text-white">
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">N° OC</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">FECHA</th>
                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">PROVEEDOR</th>
                                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">TOTAL EST.</th>
                                    <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest border-r border-slate-700">ESTADO</th>
                                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-var)]">
                                {historial.map(oc => (
                                    <tr key={oc.id} className="hover:bg-[var(--surface2)] transition-none">
                                        <td className="py-3 px-4 font-mono text-[var(--orange-var)] font-black text-xs">{oc.nro}</td>
                                        <td className="py-3 px-4 text-[var(--text2)] text-[10px] font-black uppercase tracking-tighter">{fmtDate(oc.fecha)}</td>
                                        <td className="py-3 px-4 font-black text-[var(--text-main)] text-xs uppercase">{oc.proveedor_nombre}</td>
                                        <td className="py-3 px-4 font-mono font-black text-xs text-right text-[var(--text-main)]">{fmtUSD(oc.total_estimado)}</td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 border rounded-none inline-block ${estadoColor(oc.estado)}`}>
                                                {oc.estado}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex gap-1 justify-end flex-wrap">
                                                {oc.estado === 'PENDIENTE' && (
                                                    <>
                                                        <button className="btn bg-emerald-600 text-white transition-none px-3 py-2 text-[9px] font-black uppercase tracking-widest shadow-[var(--win-shadow)] cursor-pointer inline-flex items-center gap-1"
                                                            onClick={() => cambiarEstado(oc, 'RECIBIDA')}>
                                                            <span className="material-icons-round text-sm">check_circle</span> RECIBIDA
                                                        </button>
                                                        <button className="btn bg-red-600 text-white transition-none px-3 py-2 text-[9px] font-black uppercase tracking-widest shadow-[var(--win-shadow)] cursor-pointer inline-flex items-center gap-1"
                                                            onClick={() => cambiarEstado(oc, 'CANCELADA')}>
                                                            <span className="material-icons-round text-sm">cancel</span> ANULAR
                                                        </button>
                                                    </>
                                                )}
                                                <button className="btn bg-[var(--surfaceDark)] text-[var(--text-main)] hover:bg-[var(--teal)] hover:text-white transition-none px-3 py-2 text-[9px] font-black uppercase tracking-widest shadow-[var(--win-shadow)] cursor-pointer inline-flex items-center gap-1"
                                                    onClick={async () => {
                                                        const ocItems = await db.oc_items.where('oc_id').equals(oc.id).toArray()
                                                        const detail = ocItems.map(i => `${i.qty}x ${i.descripcion} @ ${fmtUSD(i.costo_estimado)}`).join('\n')
                                                        alert(`OC: ${oc.nro}\nProveedor: ${oc.proveedor_nombre}\nNotas: ${oc.notas || '—'}\n\nProductos:\n${detail}\n\nTotal: ${fmtUSD(oc.total_estimado)}`)
                                                    }}>
                                                    <span className="material-icons-round text-sm">visibility</span> VER
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {historial.length === 0 && (
                                    <tr><td colSpan={6} className="text-center text-[var(--text2)] py-24 tracking-widest text-[11px] font-black uppercase italic opacity-40">Sin órdenes de compra registradas</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
