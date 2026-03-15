import { useState } from 'react'
import { db } from '../../db/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { fmtUSD, fmtDate } from '../../utils/format'
import useStore from '../../store/useStore'
import Modal from '../../components/UI/Modal'
import { addToSyncQueue } from '../../utils/syncManager'
import { logAction } from '../../utils/audit'

export default function ComprasHistorial() {
    const { toast } = useStore()
    const [busq, setBusq] = useState('')
    const [selectedCompra, setSelectedCompra] = useState(null)
    const [compraItems, setCompraItems] = useState([])
    const [loadingItems, setLoadingItems] = useState(false)
    const [anulando, setAnulando] = useState(null)
    const [motivoAnulacion, setMotivoAnulacion] = useState('')

    const compras = useLiveQuery(async () => {
        const data = await db.compras.orderBy('fecha').reverse().toArray()
        const result = []
        for (const c of data) {
            const prov = await db.proveedores.get(parseInt(c.proveedor_id) || 0)
            const nombreProv = c.proveedor_nombre || prov?.nombre || 'Desconocido'
            result.push({ ...c, proveedor: nombreProv })
        }
        return busq.trim()
            ? result.filter(c =>
                c.nro_factura.toLowerCase().includes(busq.toLowerCase()) ||
                c.proveedor.toLowerCase().includes(busq.toLowerCase())
            )
            : result
    }, [busq], [])

    const handleViewDetails = async (compra) => {
        setSelectedCompra(compra)
        setLoadingItems(true)
        try {
            const items = await db.compra_items.where('compra_id').equals(compra.id).toArray()
            const fullItems = []
            for (const item of items) {
                const art = await db.articulos.get(item.articulo_id)
                fullItems.push({
                    ...item,
                    descripcion: item.descripcion || art?.descripcion || 'Producto no encontrado',
                    codigo: item.codigo || art?.codigo || 'S/C'
                })
            }
            setCompraItems(fullItems)
        } catch (err) {
            console.error(err)
            toast('Error al cargar detalles', 'error')
        } finally {
            setLoadingItems(false)
        }
    }

    const handleAnular = async () => {
        if (!anulando) return
        if (!motivoAnulacion.trim()) return toast('Debe indicar el motivo de anulación', 'warn')

        const compra = anulando
        const { currentUser } = useStore.getState()
        const usuario = currentUser?.nombre || 'SISTEMA'
        const ahora = new Date().toISOString()

        try {
            await db.transaction('rw', [db.compras, db.compra_items, db.articulos, db.ctas_pagar, db.auditoria, db.sync_queue], async () => {
                // 1. Revertir Stock (con trazabilidad)
                const items = await db.compra_items.where('compra_id').equals(compra.id).toArray()
                for (const item of items) {
                    const art = await db.articulos.get(item.articulo_id)
                    if (art) {
                        const nuevoStock = (art.stock || 0) - item.qty
                        await db.articulos.update(art.id, { stock: nuevoStock })
                        await addToSyncQueue('articulos', 'UPDATE_STOCK', { codigo: art.codigo, stock: nuevoStock })
                    }
                }

                // 2. Marcar compra como ANULADA (NO borrar)
                await db.compras.update(compra.id, {
                    estado: 'ANULADA',
                    motivo_anulacion: motivoAnulacion.trim(),
                    anulado_por: usuario,
                    fecha_anulacion: ahora
                })

                // 3. Anular Cuenta por Pagar asociada (NO borrar)
                const cta = await db.ctas_pagar.where('nro_factura').equals(compra.nro_factura).and(c => c.proveedor_id === parseInt(compra.proveedor_id)).first()
                if (cta) {
                    await db.ctas_pagar.update(cta.id, {
                        estado: 'ANULADA',
                        motivo_anulacion: motivoAnulacion.trim(),
                        autorizado_por: usuario
                    })
                }

                // 4. Sincronizar a la nube como UPDATE (NO como DELETE)
                if (compra.supabase_id) {
                    await addToSyncQueue('compras', 'ANULAR', {
                        id: compra.supabase_id,
                        estado: 'ANULADA',
                        motivo_anulacion: motivoAnulacion.trim(),
                        anulado_por: usuario,
                        fecha_anulacion: ahora
                    })
                }
                await addToSyncQueue('cuentas_por_pagar', 'ANULAR', {
                    nro_factura: compra.nro_factura,
                    proveedor_id: parseInt(compra.proveedor_id),
                    estado: 'ANULADA',
                    motivo_anulacion: motivoAnulacion.trim(),
                    autorizado_por: usuario
                })

                // 5. Registrar en auditoría
                await logAction(currentUser, 'ANULACION_COMPRA', {
                    factura: compra.nro_factura,
                    proveedor: compra.proveedor,
                    total: compra.total_usd,
                    motivo: motivoAnulacion.trim()
                })
            })

            toast('✅ Factura anulada correctamente. Stock revertido.', 'ok')
            setAnulando(null)
            setMotivoAnulacion('')
        } catch (err) {
            console.error(err)
            toast('❌ Error al anular compra', 'error')
        }
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-10 mt-6 px-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-[var(--text-main)] uppercase tracking-tighter">Historial de Compras</h1>
                    <p className="text-[var(--text2)] font-bold text-[10px] uppercase tracking-widest mt-1">Registro histórico de facturas recibidas</p>
                </div>
            </div>

            <div className="panel transition-none">
                <div className="flex justify-between items-center mb-6">
                    <div className="relative w-full max-w-md">
                        <input
                            type="text"
                            className="inp !py-3 !pl-10 rounded-none focus:border-[var(--teal)] transition-none shadow-inner"
                            placeholder="Buscar por factura o proveedor..."
                            value={busq}
                            onChange={e => setBusq(e.target.value)}
                        />
                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text2)] text-sm">search</span>
                    </div>
                    <div className="badge badge-g shadow-sm">{compras?.length || 0} Facturas</div>
                </div>

                <div className="overflow-x-auto overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800 text-white">
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Fecha</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Proveedor</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Nº Factura</th>
                                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Total ($)</th>
                                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Estado</th>
                                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Tasa</th>
                                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">Detalle</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {compras?.map(c => (
                                <tr key={c.id} className="text-[11px] hover:bg-[var(--surfaceDark)] transition-none">
                                    <td className="py-3 px-4 font-mono font-bold text-[var(--text2)]">{fmtDate(c.fecha)}</td>
                                    <td className="py-3 px-4">
                                        <div className="font-black text-[var(--text-main)] uppercase">{c.proveedor}</div>
                                    </td>
                                    <td className="py-3 px-4 font-mono font-bold uppercase tracking-wider">{c.nro_factura}</td>
                                    <td className="py-3 px-4 text-right font-mono font-black text-[var(--teal)]">{fmtUSD(c.total_usd)}</td>
                                    <td className="py-3 px-4 text-center">
                                        {c.estado === 'ANULADA' ? (
                                            <span className="badge !text-[9px] !px-3 shadow-none border border-[var(--red-var)] bg-[var(--red-var)] text-white">ANULADA</span>
                                        ) : (
                                            <span className="badge badge-g !text-[9px] !px-3 shadow-none border border-[var(--teal)]">PROCESADA</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-bold text-[var(--text2)]">{c.tasa?.toFixed(2)}</td>
                                    <td className="py-3 px-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => handleViewDetails(c)}
                                                className="w-8 h-8 flex items-center justify-center bg-[var(--surfaceDark)] hover:bg-[var(--teal)] hover:text-white transition-all shadow-[var(--win-shadow)] border border-[var(--border-var)]"
                                                title="Ver Detalle"
                                            >
                                                <span className="material-icons-round text-sm">visibility</span>
                                            </button>
                                            {c.estado !== 'ANULADA' && (
                                                <button
                                                    onClick={() => {
                                                        const { askAdmin } = useStore.getState()
                                                        askAdmin(() => setAnulando(c))
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center bg-[var(--surfaceDark)] hover:bg-[var(--red-var)] hover:text-white transition-all shadow-[var(--win-shadow)] border border-[var(--border-var)]"
                                                    title="Anular Compra"
                                                >
                                                    <span className="material-icons-round text-sm">block</span>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {compras?.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="py-20 text-center opacity-30">
                                        <div className="flex flex-col items-center">
                                            <span className="material-icons-round text-5xl mb-3">cloud_off</span>
                                            <p className="text-[10px] font-black uppercase tracking-widest leading-none">No se encontraron registros</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Detalle */}
            <Modal
                open={!!selectedCompra}
                onClose={() => setSelectedCompra(null)}
                title={`DETALLE DE COMPRA: FACTURA ${selectedCompra?.nro_factura}`}
                wide
            >
                {selectedCompra && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[var(--surface2)] p-4 border border-[var(--border-var)]">
                            <div>
                                <label className="text-[10px] font-black text-[var(--text2)] uppercase">Proveedor</label>
                                <p className="font-black text-xs uppercase uppercase">{selectedCompra.proveedor}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-[var(--text2)] uppercase">Fecha de Recepción</label>
                                <p className="font-mono font-bold text-xs">{fmtDate(selectedCompra.fecha)}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-[var(--text2)] uppercase">Monto Total</label>
                                <p className="font-mono font-black text-sm text-[var(--teal)]">{fmtUSD(selectedCompra.total_usd)}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-[var(--text2)] uppercase">Tasa Operativa</label>
                                <p className="font-mono font-bold text-xs">{selectedCompra.tasa?.toFixed(2)} BS/$</p>
                            </div>
                        </div>

                        <div className="panel p-0 overflow-hidden border border-[var(--border-var)]">
                            <table className="w-full text-left">
                                <thead className="bg-[var(--surfaceDark)] border-b border-[var(--border-var)]">
                                    <tr className="text-[9px] uppercase font-black text-[var(--text2)]">
                                        <th className="py-3 px-4">Producto</th>
                                        <th className="py-3 px-4 text-center">Cantidad</th>
                                        <th className="py-3 px-4 text-right">Costo Unit. ($)</th>
                                        <th className="py-3 px-4 text-right">Subtotal ($)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-var)]">
                                    {loadingItems ? (
                                        <tr>
                                            <td colSpan="4" className="py-10 text-center animate-pulse text-[10px] font-black uppercase tracking-widest">Cargando ítems...</td>
                                        </tr>
                                    ) : compraItems.map((item, idx) => (
                                        <tr key={idx} className="text-xs hover:bg-[var(--surfaceDark)]">
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-[var(--text-main)] uppercase">{item.descripcion}</div>
                                                <div className="text-[9px] font-mono text-[var(--text2)] uppercase">{item.codigo}</div>
                                            </td>
                                            <td className="py-3 px-4 text-center font-mono font-bold">{item.qty}</td>
                                            <td className="py-3 px-4 text-right font-mono font-bold">{fmtUSD(item.costo_unit)}</td>
                                            <td className="py-3 px-4 text-right font-mono font-black text-[var(--teal)]">{fmtUSD(item.qty * item.costo_unit)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                {!loadingItems && (
                                    <tfoot className="bg-[var(--surface2)] border-t-2 border-[var(--text-main)]">
                                        <tr className="font-black text-[var(--text-main)]">
                                            <td colSpan="3" className="py-3 px-4 text-right uppercase text-[10px]">Total Factura ($)</td>
                                            <td className="py-3 px-4 text-right font-mono text-sm">{fmtUSD(selectedCompra.total_usd)}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setSelectedCompra(null)}
                                className="btn bg-[var(--surfaceDark)] !px-8 !py-3 font-black text-xs uppercase"
                            >
                                CERRAR VISTA
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal de Anulación */}
            <Modal
                open={!!anulando}
                onClose={() => { setAnulando(null); setMotivoAnulacion('') }}
                title={`ANULAR FACTURA: ${anulando?.nro_factura}`}
            >
                {anulando && (
                    <div className="space-y-5">
                        <div className="p-4 bg-[var(--red-var)]/10 border-2 border-[var(--red-var)] text-center">
                            <span className="material-icons-round text-4xl text-[var(--red-var)] mb-2">warning</span>
                            <p className="text-xs font-black uppercase text-[var(--red-var)] tracking-widest">ESTA ACCIÓN ES IRREVERSIBLE</p>
                            <p className="text-[10px] text-[var(--text2)] mt-1">La factura quedará marcada como ANULADA y el stock será revertido.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 bg-[var(--surface2)] p-3 border border-[var(--border-var)]">
                            <div>
                                <p className="text-[9px] font-black text-[var(--text2)] uppercase">Proveedor</p>
                                <p className="text-xs font-black uppercase">{anulando.proveedor}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-[var(--text2)] uppercase">Total Factura</p>
                                <p className="text-sm font-mono font-black text-[var(--red-var)]">{fmtUSD(anulando.total_usd)}</p>
                            </div>
                        </div>

                        <div className="field">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">Motivo de Anulación *</label>
                            <textarea
                                className="inp !py-3 rounded-none focus:border-[var(--red-var)] transition-none shadow-inner uppercase w-full"
                                rows={3}
                                value={motivoAnulacion}
                                onChange={e => setMotivoAnulacion(e.target.value.toUpperCase())}
                                placeholder="EJ: ERROR EN EL MONTO / FACTURA DUPLICADA / DEVOLUCION AL PROVEEDOR"
                            />
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-[var(--border-var)]">
                            <button
                                className="btn bg-[var(--surfaceDark)] text-[var(--text-main)] flex-1 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer"
                                onClick={() => { setAnulando(null); setMotivoAnulacion('') }}
                            >
                                CANCELAR
                            </button>
                            <button
                                className="btn bg-[var(--red-var)] text-white flex-2 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer tracking-widest"
                                onClick={handleAnular}
                                disabled={!motivoAnulacion.trim()}
                            >
                                <span className="material-icons-round text-base">block</span>
                                <span>CONFIRMAR ANULACIÓN</span>
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
