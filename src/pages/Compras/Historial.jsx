import { useState } from 'react'
import { db } from '../../db/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { fmtUSD, fmtDate } from '../../utils/format'
import useStore from '../../store/useStore'
import Modal from '../../components/UI/Modal'
import { addToSyncQueue } from '../../utils/syncManager'

export default function ComprasHistorial() {
    const { toast } = useStore()
    const [busq, setBusq] = useState('')
    const [selectedCompra, setSelectedCompra] = useState(null)
    const [compraItems, setCompraItems] = useState([])
    const [loadingItems, setLoadingItems] = useState(false)

    const compras = useLiveQuery(async () => {
        const data = await db.compras.orderBy('fecha').reverse().toArray()
        const result = []
        for (const c of data) {
            const prov = await db.proveedores.get(parseInt(c.proveedor_id) || 0)
            result.push({ ...c, proveedor: prov?.nombre || 'Desconocido' })
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
                    descripcion: art?.descripcion || 'Producto no encontrado',
                    codigo: art?.codigo || 'S/C'
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

    const handleDelete = async (compra) => {
        const { askAdmin } = useStore.getState()

        askAdmin(async () => {
            if (!confirm(`¿Estás seguro de ELIMINAR la factura ${compra.nro_factura}? Esto revertirá el stock de los productos ingresados.`)) return

            try {
                await db.transaction('rw', [db.compras, db.compra_items, db.articulos, db.ctas_pagar, db.sync_queue], async () => {
                    // 1. Revertir Stock
                    const items = await db.compra_items.where('compra_id').equals(compra.id).toArray()
                    for (const item of items) {
                        const art = await db.articulos.get(item.articulo_id)
                        if (art) {
                            const nuevoStock = (art.stock || 0) - item.qty
                            await db.articulos.update(art.id, { stock: nuevoStock })
                            // Sincronizar stock
                            await addToSyncQueue('articulos', 'UPDATE_STOCK', { codigo: art.codigo, stock: nuevoStock })
                        }
                    }

                    // 2. Eliminar de Dexie
                    await db.compra_items.where('compra_id').equals(compra.id).delete()
                    await db.compras.delete(compra.id)

                    // 3. Eliminar Cuenta por Pagar
                    const cta = await db.ctas_pagar.where('nro_factura').equals(compra.nro_factura).and(c => c.proveedor_id === parseInt(compra.proveedor_id)).first()
                    if (cta) await db.ctas_pagar.delete(cta.id)

                    // 4. Cola de Sincronización (Nube)
                    await addToSyncQueue('compras', 'DELETE', { id: compra.id })
                    await addToSyncQueue('compra_items', 'DELETE', { compra_id: compra.id })
                    await addToSyncQueue('cuentas_por_pagar', 'DELETE', { nro_factura: compra.nro_factura, proveedor_id: parseInt(compra.proveedor_id) })
                })
                toast('✅ Compra eliminada y stock revertido', 'ok')
            } catch (err) {
                console.error(err)
                toast('❌ Error al eliminar compra', 'error')
            }
        })
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
                                        <span className="badge badge-g !text-[9px] !px-3 shadow-none border border-[var(--teal)]">PROCESADA</span>
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
                                            <button
                                                onClick={() => handleDelete(c)}
                                                className="w-8 h-8 flex items-center justify-center bg-[var(--surfaceDark)] hover:bg-[var(--red-var)] hover:text-white transition-all shadow-[var(--win-shadow)] border border-[var(--border-var)]"
                                                title="Eliminar Compra"
                                            >
                                                <span className="material-icons-round text-sm">delete</span>
                                            </button>
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
        </div>
    )
}
