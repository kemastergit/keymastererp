import { useState, useEffect } from 'react'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtBS, today } from '../../utils/format'
import { logAction } from '../../utils/audit'
import { printEtiquetas } from '../../utils/print'
import Modal from '../../components/UI/Modal'
import { useLiveQuery } from 'dexie-react-hooks'
import { addToSyncQueue, processSyncQueue } from '../../utils/syncManager'

export default function Compras() {
    const { toast, currentUser, tasa } = useStore()
    const [header, setHeader] = useState({
        proveedor_id: '',
        nro_factura: '',
        fecha: today(),
        moneda: 'USD',
        tasa: tasa || 0,
        tipo_tasa: 'BCV',
        condicion: 'CREDITO',
        metodo_pago: 'EFECTIVO_USD'
    })

    const [items, setItems] = useState([])
    const [busq, setBusq] = useState('')
    const [showProductModal, setShowProductModal] = useState(false)
    const [newProduct, setNewProduct] = useState({ codigo: '', descripcion: '', precio: 0, costo: 0, stock_min: 0 })

    const proveedores = useLiveQuery(() => db.proveedores.orderBy('nombre').toArray(), [], [])
    const articulos = useLiveQuery(() =>
        busq.trim().length > 0
            ? db.articulos.filter(a =>
                a.descripcion.toLowerCase().includes(busq.toLowerCase()) ||
                a.codigo.toLowerCase().includes(busq.toLowerCase()) ||
                a.referencia?.toLowerCase().includes(busq.toLowerCase())
            ).limit(10).toArray()
            : [],
        [busq], []
    )

    const addItem = (art) => {
        const exists = items.find(i => i.id === art.id)
        if (exists) {
            toast('El producto ya está en la lista', 'warn')
            return
        }
        setItems([...items, {
            ...art,
            qty: 1,
            costo_unit: art.costo || 0,
            costo_anterior: art.costo || 0,
            stock_actual: art.stock || 0
        }])
        setBusq('')
    }

    const updateItem = (id, field, val) => {
        setItems(items.map(i => i.id === id ? { ...i, [field]: parseFloat(val) || 0 } : i))
    }

    const removeItem = (id) => setItems(items.filter(i => i.id !== id))

    const totalUSD = items.reduce((s, i) => s + (i.qty * i.costo_unit), 0)

    const handleProcess = async () => {
        if (!header.proveedor_id) return toast('Seleccione un proveedor', 'error')
        if (!header.nro_factura) return toast('Ingrese número de factura', 'error')
        if (items.length === 0) return toast('No hay productos en la factura', 'error')

        // Anti-duplicado
        const facturaExiste = await db.compras
            .where('nro_factura')
            .equals(header.nro_factura)
            .and(c => String(c.proveedor_id) === String(header.proveedor_id))
            .first()
        
        if (facturaExiste) {
            return toast(
                '❌ Ya existe una factura ' + header.nro_factura + ' para este proveedor',
                'error'
            )
        }

        try {
            let compraId = null;
            let ctaPagarId = null;
            let abonoId = null;

            await db.transaction('rw', [db.compras, db.compra_items, db.articulos, db.ctas_pagar, db.auditoria], async () => {
                compraId = await db.compras.add({
                    ...header,
                    total_usd: totalUSD,
                    usuario_id: currentUser.id,
                    created_at: new Date()
                })

                for (const item of items) {
                    await db.compra_items.add({
                        compra_id: compraId,
                        articulo_id: item.id,
                        qty: item.qty,
                        costo_unit: item.costo_unit,
                        costo_anterior: item.costo_anterior
                    })

                    // Recalcular AVCO (Costo Promedio Ponderado)
                    const stockActual = item.stock_actual
                    const costoActual = item.costo_anterior
                    const cantNueva = item.qty
                    const costoNuevo = item.costo_unit

                    const nuevoCosto = ((stockActual * costoActual) + (cantNueva * costoNuevo)) / (stockActual + cantNueva)

                    await db.articulos.update(item.id, {
                        stock: stockActual + cantNueva,
                        costo: parseFloat(nuevoCosto.toFixed(4))
                    })
                }

                // Buscar nombre del proveedor para las cuentas por pagar
                const provObj = proveedores.find(p => p.id === parseInt(header.proveedor_id))

                // Crear Cuenta por Pagar
                ctaPagarId = await db.ctas_pagar.add({
                    proveedor_id: parseInt(header.proveedor_id),
                    proveedor: provObj?.nombre || 'PROVEEDOR DESCONOCIDO',
                    proveedor_nombre: provObj?.nombre || 'PROVEEDOR DESCONOCIDO',
                    nro_factura: header.nro_factura,
                    monto: totalUSD,
                    fecha: header.fecha,
                    estado: header.condicion === 'CONTADO' ? 'PAGADA' : 'PENDIENTE',
                    vencimiento: header.fecha // Simplificado
                })

                if (header.condicion === 'CONTADO') {
                    abonoId = await db.abonos.add({
                        cuenta_id: ctaPagarId,
                        tipo_cuenta: 'PAGAR',
                        fecha: header.fecha + 'T' + new Date().toTimeString().split(' ')[0],
                        monto: totalUSD,
                        metodo: header.metodo_pago,
                        usuario_id: currentUser.id
                    })
                }

                await logAction(currentUser, 'COMPRA_PROVEEDOR', {
                    factura: header.nro_factura,
                    total: totalUSD,
                    condicion: header.condicion
                })
            })

            toast('✅ Compra procesada e inventario actualizado')

            // 🏷️ Imprimir etiquetas automático
            printEtiquetas(items, header.tasa || tasa, 'mediana')

            setItems([])
            setHeader({ ...header, nro_factura: '', condicion: 'CREDITO', metodo_pago: 'EFECTIVO_USD' })

            // ☁️ SYNC A SUPABASE — El Cacique ve todo desde su choza
            const compraData = { ...header, total_usd: totalUSD, usuario_id: currentUser.id, created_at: new Date().toISOString() }
            await addToSyncQueue('compras', 'INSERT', { ...compraData, id: compraId })
            for (const item of items) {
                await addToSyncQueue('compra_items', 'INSERT', {
                    compra_id: compraId, articulo_id: item.id,
                    qty: item.qty, costo_unit: item.costo_unit, costo_anterior: item.costo_anterior
                })
            }
            const provObj = proveedores.find(p => p.id === parseInt(header.proveedor_id))
            if (ctaPagarId) {
                await addToSyncQueue('cuentas_por_pagar', 'INSERT', {
                    id: ctaPagarId,
                    proveedor_id: parseInt(header.proveedor_id),
                    proveedor: provObj?.nombre || 'PROVEEDOR DESCONOCIDO',
                    proveedor_nombre: provObj?.nombre || 'PROVEEDOR DESCONOCIDO',
                    nro_factura: header.nro_factura,
                    monto: totalUSD,
                    fecha: header.fecha,
                    estado: header.condicion === 'CONTADO' ? 'PAGADA' : 'PENDIENTE',
                    vencimiento: header.fecha
                })
                if (header.condicion === 'CONTADO') {
                    await addToSyncQueue('abonos', 'INSERT', {
                        id: abonoId, cuenta_id: ctaPagarId, tipo_cuenta: 'PAGAR',
                        fecha: header.fecha + 'T' + new Date().toTimeString().split(' ')[0], monto: totalUSD, metodo: header.metodo_pago, usuario_id: currentUser.id
                    })
                }
                processSyncQueue()
            }
        } catch (err) {
            console.error(err)
            toast('❌ Error al procesar: ' + err.message, 'error')
        }
    }

    const handleCreateProduct = async () => {
        if (!newProduct.codigo || !newProduct.descripcion) return toast('Faltan datos', 'warn')
        const id = await db.articulos.add({ ...newProduct, stock: 0 })
        const art = await db.articulos.get(id)
        addItem(art)
        setShowProductModal(false)
        setNewProduct({ codigo: '', descripcion: '', precio: 0, costo: 0, stock_min: 0 })
        toast('Producto creado y agregado a la factura')
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[var(--text-main)] uppercase tracking-tighter">Entrada de Compras</h1>
                    <p className="text-[var(--text2)] font-bold text-xs uppercase tracking-widest mt-1">Recepción de Facturas de Proveedores</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Condición</label>
                        <select className="inp !py-2.5 !px-3 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 font-bold bg-white border border-slate-200 shadow-sm"
                            value={header.condicion || 'CREDITO'}
                            onChange={e => setHeader({ ...header, condicion: e.target.value })}>
                            <option value="CREDITO">A CRÉDITO</option>
                            <option value="CONTADO">DE CONTADO</option>
                        </select>
                    </div>
                    {header.condicion === 'CONTADO' && (
                        <div className="flex flex-col items-end">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Método de Pago</label>
                            <select className="inp !py-2.5 !px-3 rounded-lg text-xs focus:ring-2 focus:ring-emerald-100 font-bold bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-sm"
                                value={header.metodo_pago || 'EFECTIVO_USD'}
                                onChange={e => setHeader({ ...header, metodo_pago: e.target.value })}>
                                <option value="EFECTIVO_USD">EFECTIVO USD</option>
                                <option value="EFECTIVO_BS">EFECTIVO BS</option>
                                <option value="ZELLE">ZELLE / BOFA</option>
                                <option value="BANCO_BS">BANCO NACIONAL</option>
                            </select>
                        </div>
                    )}
                    <button
                        className="btn bg-[#009c85] hover:bg-[#007b69] text-white !py-3 !px-6 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-md active:scale-[0.98] self-end h-[42px] flex items-center justify-center gap-2"
                        onClick={handleProcess}
                    >
                        <span className="material-icons-round text-[18px]">save</span>
                        <span>PROCESAR FACTURA</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* CABECERA */}
                <div className="panel lg:col-span-1 space-y-4 h-fit lg:sticky lg:top-4 transition-none">
                    <div className="panel-title mb-4">Datos de Cabecera</div>

                    <div className="field">
                        <label className="text-[10px] font-black uppercase text-[var(--text2)]">Proveedor *</label>
                        <select
                            className="inp !py-3 rounded-none focus:border-[var(--teal)]"
                            value={header.proveedor_id}
                            onChange={e => setHeader({ ...header, proveedor_id: e.target.value })}
                        >
                            <option value="">Seleccione Proveedor...</option>
                            {proveedores?.map(p => (
                                <option key={p.id} value={p.id}>{p.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div className="field">
                        <label className="text-[10px] font-black uppercase text-[var(--text2)]">Nº Factura de Proveedor *</label>
                        <input
                            type="text"
                            className="inp !py-3 font-mono font-bold uppercase rounded-none focus:border-[var(--teal)] transition-none"
                            placeholder="F000001"
                            value={header.nro_factura}
                            onChange={e => setHeader({ ...header, nro_factura: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="field">
                            <label className="text-[10px] font-black uppercase text-[var(--text2)]">Fecha</label>
                            <input
                                type="date"
                                className="inp !py-3 rounded-none focus:border-[var(--teal)] transition-none"
                                value={header.fecha}
                                onChange={e => setHeader({ ...header, fecha: e.target.value })}
                            />
                        </div>
                        <div className="field">
                            <label className="text-[10px] font-black uppercase text-[var(--text2)]">Moneda</label>
                            <select
                                className="inp !py-3 rounded-none focus:border-[var(--teal)] transition-none"
                                value={header.moneda}
                                onChange={e => setHeader({ ...header, moneda: e.target.value })}
                            >
                                <option value="USD">DÓLARES ($)</option>
                                <option value="VES">BOLÍVARES (BS)</option>
                            </select>
                        </div>
                    </div>

                    <div className="field">
                        <label className="text-[10px] font-black uppercase text-[var(--text2)]">Tasa Fiscal Confimada (BS/$)</label>
                        <input
                            type="number"
                            className="inp !py-3 font-mono text-lg font-black text-[var(--teal)] rounded-none focus:border-[var(--teal)] transition-none"
                            value={header.tasa}
                            onChange={e => setHeader({ ...header, tasa: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                </div>

                {/* DETALLE */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="panel transition-none">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="panel-title !m-0">Búsqueda de Productos</h3>
                            <button
                                className="btn btn-sm bg-[var(--surfaceDark)] text-[var(--teal)] border border-[var(--teal)] !px-4 hover:bg-[var(--teal)] hover:text-white transition-none"
                                onClick={() => setShowProductModal(true)}
                            >
                                + NUEVO PRODUCTO
                            </button>
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                className="inp !py-4 !pl-12 rounded-none text-lg focus:border-[var(--teal)] transition-none"
                                placeholder="Escanee código o escriba descripción del producto..."
                                value={busq}
                                onChange={e => setBusq(e.target.value)}
                            />
                            <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text2)]">search</span>

                            {busq && (
                                <div className="absolute top-full left-0 right-0 bg-[var(--surface)] border border-[var(--border-var)] shadow-2xl z-[50] mt-1">
                                    {articulos?.map(a => (
                                        <div
                                            key={a.id}
                                            className="p-3 hover:bg-[var(--teal4)] cursor-pointer border-b border-[var(--border-var)] last:border-0 flex justify-between items-center"
                                            onClick={() => addItem(a)}
                                        >
                                            <div>
                                                <div className="text-[10px] font-black text-[var(--text2)] uppercase">{a.codigo}</div>
                                                <div className="text-sm font-bold text-[var(--text-main)] uppercase">{a.descripcion}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-black text-[var(--text2)] uppercase">Stock: {a.stock}</div>
                                                <div className="text-sm font-black text-[var(--teal)]">{fmtUSD(a.costo || 0)}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {articulos?.length === 0 && (
                                        <div className="p-8 text-center text-[var(--text2)]">
                                            <p className="text-xs font-bold uppercase tracking-widest">No se encontraron productos</p>
                                            <button
                                                className="btn bg-[var(--teal)] text-white mt-4 btn-sm"
                                                onClick={() => setShowProductModal(true)}
                                            >
                                                CREAR "{busq.toUpperCase()}"
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="panel transition-none">
                        <h3 className="panel-title mb-4">Líneas de la Factura</h3>
                        <div className="overflow-x-auto min-h-[300px]">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[10px] uppercase text-[var(--text2)] font-black border-b border-[var(--border-var)] bg-[var(--surface2)]">
                                        <th className="py-3 px-4">Producto</th>
                                        <th className="py-3 px-4 w-24 text-center">Cant.</th>
                                        <th className="py-3 px-4 w-32 text-right">Costo Unit.</th>
                                        <th className="py-3 px-4 w-32 text-right">Costo Ant.</th>
                                        <th className="py-3 px-4 w-32 text-right">Subtotal</th>
                                        <th className="py-3 px-4 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-var)]">
                                    {items.map(i => (
                                        <tr key={i.id} className="text-xs hover:bg-[var(--surfaceDark)] transition-none group">
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-[var(--text-main)] uppercase">{i.descripcion}</div>
                                                <div className="text-[9px] text-[var(--text2)] font-mono">{i.codigo}</div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <input
                                                    type="number"
                                                    className="inp !py-2 text-center font-mono font-bold rounded-none focus:border-[var(--teal)]"
                                                    value={i.qty}
                                                    onChange={e => updateItem(i.id, 'qty', e.target.value)}
                                                />
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        className="inp !py-2 !pl-6 text-right font-mono font-bold rounded-none focus:border-[var(--teal)]"
                                                        value={i.costo_unit}
                                                        onChange={e => updateItem(i.id, 'costo_unit', e.target.value)}
                                                    />
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text2)]">$</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="text-[var(--text2)] font-mono">{fmtUSD(i.costo_anterior)}</div>
                                                <div className="text-[8px] font-black uppercase {i.costo_unit > i.costo_anterior ? 'text-[var(--red-var)]' : 'text-[var(--teal)]'} line-clamp-1">
                                                    {i.costo_unit > i.costo_anterior ? '↑ Subió' : i.costo_unit < i.costo_anterior ? '↓ Bajó' : '= Igual'}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-black text-[var(--text-main)]">
                                                {fmtUSD(i.qty * i.costo_unit)}
                                            </td>
                                            <td className="py-3 px-4">
                                                <button
                                                    className="w-8 h-8 flex items-center justify-center text-[var(--text2)] hover:text-white hover:bg-[var(--red-var)] transition-colors"
                                                    onClick={() => removeItem(i.id)}
                                                >
                                                    <span className="material-icons-round text-lg">delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {items.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="py-20 text-center text-[var(--text2)]">
                                                <div className="flex flex-col items-center opacity-40">
                                                    <span className="material-icons-round text-6xl mb-4">local_shipping</span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Agregue productos a la factura de compra</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-6 pt-6 border-t-4 border-[var(--text-main)] flex justify-end">
                            <div className="w-full sm:w-64 space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase text-[var(--text2)]">
                                    <span>Subtotal Factura</span>
                                    <span className="font-mono text-xs">{fmtUSD(totalUSD)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-[var(--surfaceDark)] p-4 border border-[var(--border-var)]">
                                    <span className="text-[10px] font-black uppercase text-[var(--teal)]">Total a Pagar</span>
                                    <div className="text-right">
                                        <div className="text-2xl font-mono font-black text-[var(--teal)]">{fmtUSD(totalUSD)}</div>
                                        <div className="text-[10px] font-mono font-bold text-[var(--text2)]">{fmtBS(totalUSD, header.tasa)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL PRODUCTO NUEVO (SOBRE EL FLUJO ACTUAL) */}
            <Modal open={showProductModal} onClose={() => setShowProductModal(false)} title="CREAR PRODUCTO SOBRE LA MARCHA">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="field">
                            <label className="text-[10px] font-black uppercase text-[var(--text2)]">Código / SKU *</label>
                            <input
                                className="inp !py-3 rounded-none focus:border-[var(--teal)] uppercase font-mono"
                                value={newProduct.codigo}
                                onChange={e => setNewProduct({ ...newProduct, codigo: e.target.value.toUpperCase() })}
                                placeholder="PROD-001"
                            />
                        </div>
                        <div className="field">
                            <label className="text-[10px] font-black uppercase text-[var(--text2)]">Descripción *</label>
                            <input
                                className="inp !py-3 rounded-none focus:border-[var(--teal)] uppercase"
                                value={newProduct.descripcion}
                                onChange={e => setNewProduct({ ...newProduct, descripcion: e.target.value.toUpperCase() })}
                                placeholder="NOMBRE DEL PRODUCTO"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="field">
                            <label className="text-[10px] font-black uppercase text-[var(--text2)]">Costo Base ($)</label>
                            <input
                                type="number"
                                className="inp !py-3 rounded-none focus:border-[var(--teal)] font-mono"
                                value={newProduct.costo}
                                onChange={e => setNewProduct({ ...newProduct, costo: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="field">
                            <label className="text-[10px] font-black uppercase text-[var(--text2)]">Precio Venta ($)</label>
                            <input
                                type="number"
                                className="inp !py-3 rounded-none focus:border-[var(--teal)] font-mono"
                                value={newProduct.precio}
                                onChange={e => setNewProduct({ ...newProduct, precio: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button className="btn bg-[var(--surfaceDark)] flex-1" onClick={() => setShowProductModal(false)}>CANCELAR</button>
                        <button className="btn bg-[var(--teal)] text-white flex-1 font-black" onClick={handleCreateProduct}>CREAR Y AGREGAR</button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
