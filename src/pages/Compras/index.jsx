import { useState, useEffect } from 'react'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtBS, today } from '../../utils/format'
import { logAction } from '../../utils/audit'
import { printEtiquetas } from '../../utils/print'
import Modal from '../../components/UI/Modal'
import { useLiveQuery } from 'dexie-react-hooks'
import { addToSyncQueue, processSyncQueue, syncArticulosFromSupabase } from '../../utils/syncManager'

export default function Compras() {
    const { toast, currentUser, tasa } = useStore()
    const [header, setHeader] = useState(() => {
        try {
            const saved = localStorage.getItem('borrador_compras_header')
            if (saved) {
                const parsed = JSON.parse(saved)
                return { ...parsed, tasa: tasa || parsed.tasa }
            }
        } catch (e) {}
        return {
            proveedor_id: '',
            nro_factura: '',
            fecha: today(),
            moneda: 'USD',
            tasa: tasa || 0,
            tipo_tasa: 'BCV',
            condicion: 'CREDITO',
            metodo_pago: 'EFECTIVO_USD'
        }
    })

    const [items, setItems] = useState(() => {
        try {
            const saved = localStorage.getItem('borrador_compras_items')
            if (saved) return JSON.parse(saved)
        } catch (e) {}
        return []
    })

    const [busq, setBusq] = useState('')
    const [showProductModal, setShowProductModal] = useState(false)
    const [newProduct, setNewProduct] = useState({ codigo: '', descripcion: '', marca: '', referencia: '', departamento: '', precio: 0, costo: 0, stock_min: 0 })
    const [printItems, setPrintItems] = useState([])
    const [showPrintModal, setShowPrintModal] = useState(false)
    const [showGeminiModal, setShowGeminiModal] = useState(false)
    const [showGemsInstructions, setShowGemsInstructions] = useState(false)
    const [showConfirmClear, setShowConfirmClear] = useState(false)
    const [jsonInput, setJsonInput] = useState('')

    // Evitar que el lector de barras escriba en otros lados
    useEffect(() => {
        localStorage.setItem('borrador_compras_header', JSON.stringify(header))
    }, [header])

    useEffect(() => {
        localStorage.setItem('borrador_compras_items', JSON.stringify(items))
    }, [items])

    const proveedores = useLiveQuery(() => db.proveedores.orderBy('nombre').toArray(), [], [])
    const articulos = useLiveQuery(() =>
        busq.trim().length > 0
            ? db.articulos
                .filter(a =>
                    a.descripcion?.toLowerCase().includes(busq.toLowerCase()) ||
                    a.codigo?.toLowerCase().includes(busq.toLowerCase()) ||
                    a.referencia?.toLowerCase().includes(busq.toLowerCase())
                )
                .toArray()
                .then(results =>
                    results
                        .sort((a, b) => a.descripcion.localeCompare(b.descripcion))
                        .slice(0, 100)
                )
            : [],
        [busq], []
    )

    // Sincronizar artículos desde Supabase si la DB local está vacía (primera carga)
    useEffect(() => {
        db.articulos.count().then(count => {
            if (count === 0) {
                syncArticulosFromSupabase()
            }
        })
    }, [])

    const addItem = (art) => {
        const exists = items.find(i => i.id === art.id)
        if (exists) {
            toast('El producto ya está en la lista', 'warn')
            return
        }
        setItems([...items, {
            ...art,
            qty: "1",
            costo_unit: art.costo !== undefined ? String(art.costo) : "0",
            costo_anterior: art.costo || 0,
            precio_venta: art.precio !== undefined ? String(art.precio) : "0",
            stock_actual: art.stock || 0
        }])
        setBusq('')
    }

    const updateItem = (id, field, val) => {
        setItems(items.map(i => i.id === id ? { ...i, [field]: val } : i))
    }

    const removeItem = (id) => setItems(items.filter(i => i.id !== id))

    const totalUSD = items.reduce((s, i) => {
        const q = parseFloat(i.qty) || 0
        const c = parseFloat(i.costo_unit) || 0
        return s + (q * c)
    }, 0)

    const processGeminiJSON = async () => {
        try {
            if (!jsonInput.trim()) return toast('Pegue el JSON primero', 'warn')
            const parsed = JSON.parse(jsonInput)
            
            // Determinar si es el formato nuevo { cabecera, items } o el viejo []
            let itemsToProcess = []
            let headerData = null
            
            if (Array.isArray(parsed)) {
                itemsToProcess = parsed
            } else if (parsed.items && Array.isArray(parsed.items)) {
                itemsToProcess = parsed.items
                headerData = parsed.cabecera
            } else {
                throw new Error("Formato JSON no válido")
            }

            let agregados = 0
            let creados = 0
            let nuevosItems = [...items]

            const artsDB = await db.articulos.toArray()

            for (const p of itemsToProcess) {
                // Buscar por codigo o descripcion
                let match = null
                if (p.codigo) {
                    match = artsDB.find(a => String(a.codigo).toUpperCase() === String(p.codigo).toUpperCase())
                }
                if (!match && p.descripcion) {
                    // busqueda por coincidencia parcial o exacta
                    match = artsDB.find(a => 
                        String(a.descripcion).toUpperCase() === String(p.descripcion).toUpperCase() ||
                        String(a.descripcion).toUpperCase().includes(String(p.descripcion).toUpperCase()) ||
                        String(p.descripcion).toUpperCase().includes(String(a.descripcion).toUpperCase())
                    )
                }

                if (match) {
                    // Evitar duplicados en la lista de compra
                    if (!nuevosItems.find(i => i.id === match.id)) {
                        nuevosItems.push({
                            ...match,
                            qty: String(p.qty || 1),
                            costo_unit: String(p.costo_unit || match.costo || 0),
                            costo_anterior: match.costo || 0,
                            precio_venta: match.precio !== undefined ? String(match.precio) : "0",
                            stock_actual: match.stock || 0
                        })
                        agregados++
                    }
                } else {
                    // NO EXISTE -> CREARLO AUTOMÁTICAMENTE
                    const newCodigo = p.codigo || `IA-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`
                    const artToSave = {
                        codigo: newCodigo.toUpperCase(),
                        descripcion: String(p.descripcion || 'PRODUCTO DESCONOCIDO').toUpperCase(),
                        marca: '',
                        referencia: '',
                        departamento: 'VARIOS',
                        precio: 0, // El precio de venta se decidirá en la tabla
                        costo: parseFloat(p.costo_unit) || 0,
                        stock: 0,
                        activo: true
                    }
                    
                    const id = await db.articulos.add(artToSave)
                    const newArt = await db.articulos.get(id)
                    
                    // Sincronizar nuevo artículo
                    const { id: localId, ...artToSync } = artToSave
                    await addToSyncQueue('articulos', 'INSERT', {
                        ...artToSync,
                        mostrar_en_web: true
                    })

                    nuevosItems.push({
                        ...newArt,
                        qty: String(p.qty || 1),
                        costo_unit: String(p.costo_unit || newArt.costo || 0),
                        costo_anterior: 0,
                        precio_venta: "0",
                        stock_actual: 0
                    })
                    creados++
                }
            }

            // Aplicar cabecera si vino en el JSON
            if (headerData) {
                let foundProvId = header.proveedor_id
                if (headerData.proveedor) {
                    // Intentar buscar el proveedor por nombre
                    const provMatch = proveedores?.find(pr => 
                        pr.nombre.toUpperCase().includes(headerData.proveedor.toUpperCase()) ||
                        headerData.proveedor.toUpperCase().includes(pr.nombre.toUpperCase())
                    )
                    if (provMatch) foundProvId = provMatch.id
                }

                setHeader(prev => ({
                    ...prev,
                    nro_factura: headerData.nro_factura || prev.nro_factura,
                    fecha: headerData.fecha || prev.fecha,
                    moneda: headerData.moneda || prev.moneda,
                    tasa: headerData.tasa_cambio > 0 ? headerData.tasa_cambio : prev.tasa,
                    proveedor_id: foundProvId
                }))
            }

            setItems(nuevosItems)
            setShowGeminiModal(false)
            setJsonInput('')

            if (agregados > 0 || creados > 0) {
                toast(`✅ Vinculados: ${agregados} | Creados Nuevos: ${creados}`)
            }

        } catch (e) {
            toast('❌ Error leyendo JSON: ' + e.message, 'error')
        }
    }

    const handleProcess = async () => {
        if (!header.proveedor_id) return toast('Seleccione un proveedor', 'error')
        if (!header.nro_factura) return toast('Ingrese número de factura', 'error')
        if (items.length === 0) return toast('No hay productos en la factura', 'error')
        if (header.fecha > today()) return toast('❌ No puede registrar compras con fecha futura', 'error')

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
            let articulosParaSync = [];

            // Calculamos el total fuera para asegurar que sea un número válido
            const finalTotal = parseFloat(totalUSD.toFixed(2)) || 0;

            await db.transaction('rw', [db.compras, db.compra_items, db.articulos, db.ctas_pagar, db.auditoria, db.abonos, db.sync_queue], async () => {
                // Buscar nombre del proveedor antes de guardar (para desnormalización defensiva)
                const provObj = proveedores.find(p => p.id === parseInt(header.proveedor_id))
                compraId = await db.compras.add({
                    ...header,
                    proveedor_nombre: provObj?.nombre || 'PROVEEDOR DESCONOCIDO',
                    proveedor_uuid: provObj?.proveedor_uuid || '',
                    total_usd: finalTotal,
                    usuario_id: currentUser.id,
                    created_at: new Date()
                })

                for (const item of items) {
                    const cantNueva = parseFloat(item.qty) || 0
                    const costoNuevo = parseFloat(item.costo_unit) || 0
                    const costoAnterior = parseFloat(item.costo_anterior) || 0

                    await db.compra_items.add({
                        compra_id: compraId,
                        articulo_id: item.id,
                        codigo: item.codigo,
                        descripcion: item.descripcion,
                        qty: cantNueva,
                        costo_unit: costoNuevo,
                        costo_anterior: costoAnterior
                    })


                    // Recalcular AVCO (Costo Promedio Ponderado)
                    const stockActual = parseFloat(item.stock_actual) || 0
                    const nuevoCosto = (stockActual + cantNueva) > 0 
                        ? ((stockActual * costoAnterior) + (cantNueva * costoNuevo)) / (stockActual + cantNueva)
                        : costoNuevo

                    await db.articulos.update(item.id, {
                        stock: stockActual + cantNueva,
                        costo: parseFloat(nuevoCosto.toFixed(4)),
                        precio: parseFloat(item.precio_venta) || 0
                    })

                    articulosParaSync.push({
                        codigo: item.codigo,
                        stock: stockActual + cantNueva,
                        costo: parseFloat(nuevoCosto.toFixed(4)),
                        precio: parseFloat(item.precio_venta) || 0
                    })
                }


                // Crear Cuenta por Pagar
                ctaPagarId = await db.ctas_pagar.add({
                    proveedor_id: parseInt(header.proveedor_id),
                    proveedor_uuid: provObj?.proveedor_uuid || '',
                    proveedor: provObj?.nombre || 'PROVEEDOR DESCONOCIDO',
                    proveedor_nombre: provObj?.nombre || 'PROVEEDOR DESCONOCIDO',
                    nro_factura: header.nro_factura,
                    monto: finalTotal,
                    fecha: header.fecha,
                    estado: header.condicion === 'CONTADO' ? 'PAGADA' : 'PENDIENTE',
                    vencimiento: header.fecha 
                })

                if (header.condicion === 'CONTADO') {
                    abonoId = await db.abonos.add({
                        cuenta_id: ctaPagarId,
                        tipo_cuenta: 'PAGAR',
                        fecha: header.fecha + 'T' + new Date().toTimeString().split(' ')[0],
                        monto: finalTotal,
                        metodo: header.metodo_pago,
                        usuario_id: currentUser.id
                    })
                }

                await logAction(currentUser, 'COMPRA_PROVEEDOR', {
                    factura: header.nro_factura,
                    total: finalTotal,
                    condicion: header.condicion
                })
            })

            toast('✅ Compra procesada e inventario actualizado')

            // Mostrar el modal de impresión en lugar de invocar inmediatamente
            setPrintItems(items.map(i => ({ ...i, qty_print: Number(i.qty) || 1 })))
            setShowPrintModal(true)

            // ☁️ SYNC A SUPABASE — El Cacique ve todo desde su choza
            const provObj = proveedores.find(p => p.id === parseInt(header.proveedor_id))
            const syncHeader = { ...header } // Capturar datos antes de resetear el form
            const syncCompraId = `compra-${syncHeader.nro_factura}-${syncHeader.proveedor_id}-${Date.now()}`
            const syncCtaPagarId = `ctag-pagar-${syncHeader.nro_factura}-${syncHeader.proveedor_id}-${Date.now()}`

            // 🔑 Guardar supabase_id en Dexie para usarlo al borrar
            await db.compras.update(compraId, { supabase_id: syncCompraId })
            
            const compraData = { 
                ...syncHeader, 
                id: syncCompraId, // Usar ID único para la nube
                total_usd: finalTotal, 
                usuario_id: currentUser.id, 
                proveedor_nombre: provObj?.nombre || 'PROVEEDOR DESCONOCIDO',
                proveedor_uuid: provObj?.proveedor_uuid || '',
                estado: syncHeader.condicion === 'CONTADO' ? 'PAGADA' : 'PROCESADA',
                created_at: new Date().toISOString() 
            }
            
            const ctaPagarData = {
                id: syncCtaPagarId,
                proveedor_id: parseInt(syncHeader.proveedor_id),
                proveedor: provObj?.nombre || 'PROVEEDOR DESCONOCIDO',
                proveedor_nombre: provObj?.nombre || 'PROVEEDOR DESCONOCIDO',
                proveedor_uuid: provObj?.proveedor_uuid || '',
                nro_factura: syncHeader.nro_factura,
                monto: finalTotal,
                fecha: syncHeader.fecha,
                estado: syncHeader.condicion === 'CONTADO' ? 'PAGADA' : 'PENDIENTE',
                vencimiento: syncHeader.fecha
            }
            
            let abonoData = null
            if (syncHeader.condicion === 'CONTADO') {
                abonoData = {
                    id: `abono-compra-${syncCtaPagarId}-${Date.now()}`, 
                    cuenta_id: syncCtaPagarId, 
                    tipo_cuenta: 'PAGAR',
                    fecha: syncHeader.fecha + 'T' + new Date().toTimeString().split(' ')[0], 
                    monto: finalTotal, 
                    metodo: syncHeader.metodo_pago, 
                    usuario_id: currentUser.id
                }
            }

            const itemsData = items.map(item => ({
                id: `item-${syncCompraId}-${item.id}`,
                compra_id: syncCompraId, 
                articulo_id: item.id,
                codigo: item.codigo,
                descripcion: item.descripcion,
                qty: parseFloat(item.qty) || 0, 
                costo_unit: parseFloat(item.costo_unit) || 0, 
                costo_anterior: parseFloat(item.costo_anterior) || 0
            }))

            await addToSyncQueue('compras_bulk', 'INSERT', {
                compra: compraData,
                items: itemsData,
                articulos: articulosParaSync,
                cta_pagar: ctaPagarData,
                abono: abonoData
            })

            // Resetear formulario después de capturar datos para sync
            setItems([])
            setHeader({ ...header, nro_factura: '', condicion: 'CREDITO', metodo_pago: 'EFECTIVO_USD' })
            localStorage.removeItem('borrador_compras_header')
            localStorage.removeItem('borrador_compras_items')
            processSyncQueue()
        } catch (err) {
            console.error(err)
            toast('❌ Error al procesar: ' + err.message, 'error')
        }
    }

    const handleCreateProduct = async () => {
        if (!newProduct.codigo || !newProduct.descripcion) return toast('Faltan datos', 'warn')
        const artToSave = { ...newProduct, stock: 0 }
        const id = await db.articulos.add(artToSave)
        const art = await db.articulos.get(id)

        // ☁️ Sync a Supabase — otros terminales recibirán este producto nuevo
        // Se identifica por 'codigo' (único global), no por el id local de Dexie
        await addToSyncQueue('articulos', 'INSERT', {
            codigo: newProduct.codigo,
            referencia: newProduct.referencia || '',
            descripcion: newProduct.descripcion,
            departamento: newProduct.departamento || 'VARIOS',
            marca: newProduct.marca || '',
            precio: parseFloat(newProduct.precio) || 0,
            costo: parseFloat(newProduct.costo) || 0,
            stock: 0,
            activo: true,
            mostrar_en_web: true  // ✅ Visible en catálogo online desde el primer momento
        })

        addItem(art)
        setShowProductModal(false)
        setNewProduct({ codigo: '', descripcion: '', marca: '', referencia: '', departamento: '', precio: 0, costo: 0, stock_min: 0 })
        toast('Producto creado y agregado a la factura')
    }

    return (
        <div className="space-y-6 w-full max-w-[1600px] mx-auto px-4 md:px-8 pb-10">
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


            {/* ── CABECERA HORIZONTAL ── */}
            <div className="panel transition-none">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                    {/* Proveedor */}
                    <div className="field lg:col-span-2">
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

                    {/* Nº Factura */}
                    <div className="field">
                        <label className="text-[10px] font-black uppercase text-[var(--text2)]">Nº Factura *</label>
                        <input
                            type="text"
                            className="inp !py-3 font-mono font-bold uppercase rounded-none focus:border-[var(--teal)] transition-none"
                            placeholder="F000001"
                            value={header.nro_factura}
                            onChange={e => setHeader({ ...header, nro_factura: e.target.value })}
                        />
                    </div>

                    {/* Fecha */}
                    <div className="field">
                        <label className="text-[10px] font-black uppercase text-[var(--text2)]">Fecha</label>
                        <input
                            type="date"
                            max={today()}
                            className="inp !py-3 rounded-none focus:border-[var(--teal)] transition-none"
                            value={header.fecha}
                            onChange={e => {
                                const val = e.target.value
                                if (val > today()) { toast('⚠️ No se permite fecha futura', 'warn'); return }
                                setHeader({ ...header, fecha: val })
                            }}
                        />
                    </div>

                    {/* Moneda */}
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

                    {/* Tasa */}
                    <div className="field">
                        <label className="text-[10px] font-black uppercase text-[var(--text2)]">Tasa (BS/$)</label>
                        <input
                            type="number"
                            className="inp !py-3 font-mono text-lg font-black text-[var(--teal)] rounded-none focus:border-[var(--teal)] transition-none"
                            value={header.tasa}
                            onChange={e => setHeader({ ...header, tasa: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                </div>
            </div>

            {/* ── DETALLE (ancho completo) ── */}
            <div className="space-y-6">
                <div className="panel transition-none">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                            <h3 className="panel-title !m-0">Búsqueda de Productos</h3>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button
                                    className="btn btn-sm bg-[#e8f0fe] text-[#1967d2] border border-[#1967d2] !px-4 hover:bg-[#1967d2] hover:text-white transition-none flex items-center gap-2 flex-1 sm:flex-none justify-center"
                                    onClick={() => setShowGeminiModal(true)}
                                    title="Pegar JSON de Gemini"
                                >
                                    <span className="material-icons-round text-[16px]">smart_toy</span>
                                    CARGA IA (JSON)
                                </button>
                                <button
                                    className="btn btn-sm bg-white text-[#1967d2] border border-slate-200 hover:bg-slate-50 transition-none flex items-center justify-center"
                                    onClick={() => setShowGemsInstructions(true)}
                                    title="Instrucciones para Gemini"
                                >
                                    <span className="material-icons-round text-[16px]">help_outline</span>
                                </button>
                                <button
                                    className="btn btn-sm bg-[var(--surfaceDark)] text-[var(--teal)] border border-[var(--teal)] !px-4 hover:bg-[var(--teal)] hover:text-white transition-none flex-1 sm:flex-none justify-center"
                                    onClick={() => setShowProductModal(true)}
                                >
                                    + NUEVO
                                </button>
                            </div>
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
                                <div className="absolute top-full left-0 right-0 bg-[var(--surface)] border border-[var(--border-var)] shadow-2xl z-[50] mt-1 max-h-[400px] overflow-y-auto">
                                    {articulos?.map(a => (
                                        <div
                                            key={a.id}
                                            className="p-3 hover:bg-[var(--teal4)] cursor-pointer border-b border-[var(--border-var)] last:border-0 flex justify-between items-center"
                                            onClick={() => addItem(a)}
                                        >
                                            <div>
                                                <div className="text-[10px] font-black text-[var(--text2)] uppercase">
                                                    {a.codigo} {a.marca && <span className="opacity-60 ml-2">• {a.marca}</span>}
                                                </div>
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
                                                CREAR &quot;{busq.toUpperCase()}&quot;
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="panel transition-none">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="panel-title !m-0">Líneas de la Factura</h3>
                            {items.length > 0 && (
                                <button
                                    className="btn btn-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white transition-colors flex items-center gap-2"
                                    onClick={() => setShowConfirmClear(true)}
                                >
                                    <span className="material-icons-round text-[16px]">delete_sweep</span>
                                    VACIAR TODO
                                </button>
                            )}
                        </div>
                        <div className="overflow-x-auto min-h-[300px]">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[10px] uppercase text-[var(--text2)] font-black border-b border-[var(--border-var)] bg-[var(--surface2)]">
                                        <th className="py-3 px-4">Producto</th>
                                        <th className="py-3 px-4 w-28 text-center">Cant.</th>
                                        <th className="py-3 px-4 w-44 text-right">Costo Unit.</th>
                                        <th className="py-3 px-4 w-36 text-right">Costo Ant.</th>
                                        <th className="py-3 px-4 w-44 text-right">Precio Venta</th>
                                        <th className="py-3 px-4 w-36 text-right">Subtotal</th>
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
                                                <div className={`text-[8px] font-black uppercase ${(parseFloat(i.costo_unit) || 0) > (parseFloat(i.costo_anterior) || 0) ? 'text-[var(--red-var)]' : (parseFloat(i.costo_unit) || 0) < (parseFloat(i.costo_anterior) || 0) ? 'text-[var(--teal)]' : 'text-slate-500'} line-clamp-1`}>
                                                    {(parseFloat(i.costo_unit) || 0) > (parseFloat(i.costo_anterior) || 0) ? '↑ Subió' : (parseFloat(i.costo_unit) || 0) < (parseFloat(i.costo_anterior) || 0) ? '↓ Bajó' : '= Igual'}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        className="inp !py-2 !pl-6 text-right font-mono font-bold rounded-none focus:border-[var(--teal)]"
                                                        value={i.precio_venta}
                                                        onChange={e => updateItem(i.id, 'precio_venta', e.target.value)}
                                                    />
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text2)]">$</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-black text-[var(--text-main)]">
                                                {fmtUSD((parseFloat(i.qty) || 0) * (parseFloat(i.costo_unit) || 0))}
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
                                            <td colSpan="7" className="py-20 text-center text-[var(--text2)]">
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
                            <label className="text-[10px] font-black uppercase text-[var(--text2)]">Marca / Fabricante (Opcional)</label>
                            <input
                                className="inp !py-3 rounded-none focus:border-[var(--teal)] uppercase"
                                value={newProduct.marca}
                                onChange={e => setNewProduct({ ...newProduct, marca: e.target.value.toUpperCase() })}
                                placeholder="EJ. DENSO, TOYOTA, BOSCH"
                            />
                        </div>
                        <div className="field">
                            <label className="text-[10px] font-black uppercase text-[var(--text2)]">Ubicación / Referencia</label>
                            <input
                                className="inp !py-3 rounded-none focus:border-[var(--teal)] uppercase"
                                value={newProduct.referencia}
                                onChange={e => setNewProduct({ ...newProduct, referencia: e.target.value.toUpperCase() })}
                                placeholder="EJ. ESTANTE 4"
                            />
                        </div>
                    </div>
                    <div className="field">
                        <label className="text-[10px] font-black uppercase text-[var(--text2)]">Categoría / Departamento</label>
                        <input
                            className="inp !py-3 rounded-none focus:border-[var(--teal)] uppercase"
                            value={newProduct.departamento}
                            onChange={e => setNewProduct({ ...newProduct, departamento: e.target.value.toUpperCase() })}
                            placeholder="EJ. MOTOR, SUSPENSIÓN, VARIOS"
                        />
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

            {/* Print Selection Modal */}
            <Modal
                open={showPrintModal}
                onClose={() => setShowPrintModal(false)}
                title="IMPRIMIR ETIQUETAS"
            >
                <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-[var(--text2)] mb-4">
                        Ajusta la cantidad de etiquetas que deseas imprimir por cada producto.
                    </p>
                    
                    <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-3">
                        {printItems.map(item => (
                            <div key={item.id} className="flex justify-between items-center bg-[var(--surfaceDark)] p-3 border border-[var(--border-var)]">
                                <div className="max-w-[70%]">
                                    <h4 className="text-xs font-black text-[var(--text-main)] uppercase truncate">
                                        {item.descripcion}
                                    </h4>
                                    <div className="text-[9px] font-mono text-[var(--text2)] uppercase">{item.codigo}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black uppercase text-[var(--text2)]">CANT:</span>
                                    <input
                                        type="number"
                                        min="0"
                                        className="inp !py-1 !px-2 w-16 text-center font-mono !rounded-none"
                                        value={item.qty_print}
                                        onChange={e => {
                                            const val = parseInt(e.target.value) || 0
                                            setPrintItems(printItems.map(i => i.id === item.id ? { ...i, qty_print: val } : i))
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-4 pt-4 mt-2 border-t border-[var(--border-var)]">
                        <button className="btn bg-[var(--surfaceDark)] flex-1 uppercase text-xs" onClick={() => setShowPrintModal(false)}>
                            Omitir
                        </button>
                        <button
                            className="btn bg-[var(--teal)] text-white flex-1 font-black uppercase text-xs"
                            onClick={() => {
                                const finalItemsForPrinting = printItems
                                    .filter(i => i.qty_print > 0)
                                    .map(i => ({ ...i, qty: i.qty_print })) // El util lo lee de 'qty'
                                
                                if (finalItemsForPrinting.length > 0) {
                                    printEtiquetas(finalItemsForPrinting, header.tasa || tasa, 'mediana')
                                }
                                setShowPrintModal(false)
                            }}
                        >
                            <span className="material-icons-round text-sm mr-2">print</span>
                            Imprimir Etiquetas
                        </button>
                    </div>
                </div>
            </Modal>
            {/* MODAL GEMINI IA */}
            {showGeminiModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-[var(--surface)] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col border border-[var(--border-var)] overflow-hidden">
                        <div className="p-6 border-b border-[var(--border-var)] flex justify-between items-center bg-[#f8fafd]">
                            <div className="flex items-center gap-3">
                                <span className="material-icons-round text-3xl text-[#1967d2]">smart_toy</span>
                                <div>
                                    <h2 className="text-xl font-black text-[#1967d2] uppercase tracking-tight">Carga Inteligente con Gemini</h2>
                                    <p className="text-xs font-bold text-slate-500 uppercase">Pegue el JSON generado por la IA</p>
                                </div>
                            </div>
                            <button className="material-icons-round text-slate-400 hover:text-red-500 transition-colors" onClick={() => setShowGeminiModal(false)}>close</button>
                        </div>
                        <div className="p-6 bg-slate-50">
                            <textarea
                                className="w-full h-64 inp !p-4 font-mono text-sm bg-white border-slate-300 focus:border-[#1967d2] text-slate-800 shadow-inner resize-none"
                                placeholder='{\n  "cabecera": {\n    "nro_factura": "1234",\n    "fecha": "2026-05-27",\n    "proveedor": "MARCA",\n    "moneda": "USD",\n    "tasa_cambio": 0\n  },\n  "items": [\n    {\n      "codigo": "REF-123",\n      "descripcion": "TUERCA",\n      "qty": 10,\n      "costo_unit": 0.50\n    }\n  ]\n}'
                                value={jsonInput}
                                onChange={e => setJsonInput(e.target.value)}
                            />
                            <div className="mt-3 text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                <span className="material-icons-round text-[14px]">info</span>
                                Si un producto no existe, se creará automáticamente en el sistema.
                            </div>
                        </div>
                        <div className="p-4 border-t border-[var(--border-var)] flex justify-end gap-3 bg-white">
                            <button className="btn bg-white text-slate-600 border border-slate-300 hover:bg-slate-50" onClick={() => setShowGeminiModal(false)}>
                                CANCELAR
                            </button>
                            <button className="btn bg-[#1967d2] text-white hover:bg-[#1557b0] flex items-center gap-2 shadow-md" onClick={processGeminiJSON}>
                                <span className="material-icons-round text-[18px]">auto_awesome</span>
                                VINCULAR FACTURA
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CONFIRMAR VACIADO */}
            {showConfirmClear && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-[var(--surface)] w-full max-w-sm rounded-2xl shadow-2xl flex flex-col border border-[var(--border-var)] overflow-hidden">
                        <div className="p-6 flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                                <span className="material-icons-round text-3xl">delete_sweep</span>
                            </div>
                            <h2 className="text-xl font-black text-[var(--text-main)] mb-2">¿Vaciar la factura?</h2>
                            <p className="text-sm text-[var(--text2)]">Se eliminarán todos los productos de la lista actual. Esta acción no se puede deshacer.</p>
                        </div>
                        <div className="p-4 border-t border-[var(--border-var)] flex justify-stretch gap-3 bg-[var(--surface2)]">
                            <button className="btn flex-1 bg-white text-slate-600 border border-slate-300 hover:bg-slate-50" onClick={() => setShowConfirmClear(false)}>
                                CANCELAR
                            </button>
                            <button 
                                className="btn flex-1 bg-red-600 text-white hover:bg-red-700 shadow-md" 
                                onClick={() => {
                                    setItems([])
                                    setShowConfirmClear(false)
                                }}
                            >
                                SÍ, VACIAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL INSTRUCCIONES GEMS */}
            {showGemsInstructions && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-[var(--surface)] w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col border border-[var(--border-var)] overflow-hidden">
                        <div className="p-6 border-b border-[var(--border-var)] flex justify-between items-center bg-[#f8fafd]">
                            <div className="flex items-center gap-3">
                                <span className="material-icons-round text-3xl text-[#1967d2]">integration_instructions</span>
                                <div>
                                    <h2 className="text-xl font-black text-[#1967d2] uppercase tracking-tight">Instrucciones para Crear Gem</h2>
                                    <p className="text-xs font-bold text-slate-500 uppercase">Configura la IA de Gemini para leer facturas</p>
                                </div>
                            </div>
                            <button className="material-icons-round text-slate-400 hover:text-red-500 transition-colors" onClick={() => setShowGemsInstructions(true)}>close</button>
                        </div>
                        <div className="p-6 bg-slate-50 overflow-y-auto max-h-[60vh] text-sm text-slate-700 space-y-4">
                            <p><strong>1.</strong> Ve a <strong>Google Gemini</strong> y crea un nuevo <strong>"Gem"</strong>.</p>
                            <p><strong>2.</strong> Asígnale un nombre (ej. <em>Lector de Facturas</em>) y copia el siguiente texto exacto en la caja de <strong>Instrucciones</strong>:</p>
                            
                            <div className="relative group">
                                <pre className="bg-slate-800 text-green-400 p-4 rounded-lg font-mono text-[11px] overflow-x-auto">
{`Eres un asistente experto en extracción de datos estructurados para sistemas ERP.
Tu única tarea es analizar fotos de facturas de proveedores y extraer TODA la información con absoluta precisión matemática y de catálogo.

REGLAS ESTRICTAS DE FORMATEO:
1. Tu respuesta debe comenzar EXACTAMENTE con el carácter { y terminar EXACTAMENTE con el carácter }. No incluyas saludos, introducciones ni bloques de código Markdown (prohibido usar \`\`\`json).
2. Tu respuesta debe ser ÚNICA y EXCLUSIVAMENTE un objeto JSON válido en formato de texto plano.
3. SANITIZACIÓN: Si una descripción contiene comillas dobles (ej. 1/2"), debes escaparlas usando barra invertida (\\") o cambiarlas por 'pulgadas' para no romper el JSON.
4. Los números decimales usan punto (.). NO incluyas separadores de miles bajo ninguna circunstancia.

REGLAS DE PROCESAMIENTO:
5. CONSISTENCIA MATEMÁTICA: Valida cada línea. El producto de (qty * costo_unit) debe aproximarse al subtotal de esa fila. Si las columnas están desalineadas, calcula la cantidad dividiendo el precio total de la fila entre el costo unitario.
6. COMPOSICIÓN DE DESCRIPCIÓN: Concatena en un solo string para "descripcion" el nombre del repuesto, la marca (ej. GP, TRIX) y cualquier número de pieza original que aparezca flotando visualmente.
7. CÓDIGOS: Usa el código principal del proveedor para el campo "codigo". Si detectas códigos secundarios (fábrica), concaténalos al final de la "descripcion".
8. DEVOLUCIONES: Si una línea indica "Devolución" o nota de crédito, extrae el producto pero coloca la cantidad (qty) como un número negativo.
9. IGNORA texto manuscrito con bolígrafo que no sea original de la factura impresa.

ESTRUCTURA DEL JSON REQUERIDA:
{
  "cabecera": {
    "nro_factura": "String (número o código de la factura)",
    "fecha": "YYYY-MM-DD (fecha de emisión de la factura)",
    "proveedor": "String (nombre de la empresa que emite la factura)",
    "moneda": "String (USD, VES o COP)",
    "tasa_cambio": Number (si aparece en la factura, de lo contrario 0)
  },
  "items": [
    {
      "codigo": "String (Código principal, si no tiene usa string vacío '')",
      "descripcion": "String (Descripción completa sanitizada sin comillas sueltas)",
      "qty": Number (Cantidad real verificada, negativa si es devolución),
      "costo_unit": Number (Precio unitario, solo números)
    }
  ]
}

Espera a que te envíe una imagen. En cuanto la recibas, devuelve solo el JSON plano.`}</pre>
                                <button 
                                    className="absolute top-2 right-2 btn btn-sm bg-white/10 text-white hover:bg-white/20 border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                        navigator.clipboard.writeText(`Eres un asistente experto en extracción de datos estructurados para sistemas ERP.
Tu única tarea es analizar fotos de facturas de proveedores y extraer TODA la información con absoluta precisión matemática y de catálogo.

REGLAS ESTRICTAS DE FORMATEO:
1. Tu respuesta debe comenzar EXACTAMENTE con el carácter { y terminar EXACTAMENTE con el carácter }. No incluyas saludos, introducciones ni bloques de código Markdown (prohibido usar \`\`\`json).
2. Tu respuesta debe ser ÚNICA y EXCLUSIVAMENTE un objeto JSON válido en formato de texto plano.
3. SANITIZACIÓN: Si una descripción contiene comillas dobles (ej. 1/2"), debes escaparlas usando barra invertida (\\") o cambiarlas por 'pulgadas' para no romper el JSON.
4. Los números decimales usan punto (.). NO incluyas separadores de miles bajo ninguna circunstancia.

REGLAS DE PROCESAMIENTO:
5. CONSISTENCIA MATEMÁTICA: Valida cada línea. El producto de (qty * costo_unit) debe aproximarse al subtotal de esa fila. Si las columnas están desalineadas, calcula la cantidad dividiendo el precio total de la fila entre el costo unitario.
6. COMPOSICIÓN DE DESCRIPCIÓN: Concatena en un solo string para "descripcion" el nombre del repuesto, la marca (ej. GP, TRIX) y cualquier número de pieza original que aparezca flotando visualmente.
7. CÓDIGOS: Usa el código principal del proveedor para el campo "codigo". Si detectas códigos secundarios (fábrica), concaténalos al final de la "descripcion".
8. DEVOLUCIONES: Si una línea indica "Devolución" o nota de crédito, extrae el producto pero coloca la cantidad (qty) como un número negativo.
9. IGNORA texto manuscrito con bolígrafo que no sea original de la factura impresa.

ESTRUCTURA DEL JSON REQUERIDA:
{
  "cabecera": {
    "nro_factura": "String (número o código de la factura)",
    "fecha": "YYYY-MM-DD (fecha de emisión de la factura)",
    "proveedor": "String (nombre de la empresa que emite la factura)",
    "moneda": "String (USD, VES o COP)",
    "tasa_cambio": Number (si aparece en la factura, de lo contrario 0)
  },
  "items": [
    {
      "codigo": "String (Código principal, si no tiene usa string vacío '')",
      "descripcion": "String (Descripción completa sanitizada sin comillas sueltas)",
      "qty": Number (Cantidad real verificada, negativa si es devolución),
      "costo_unit": Number (Precio unitario, solo números)
    }
  ]
}

Espera a que te envíe una imagen. En cuanto la recibas, devuelve solo el JSON plano.`);
                                        toast('Copiado al portapapeles');
                                    }}
                                >
                                    <span className="material-icons-round text-[16px]">content_copy</span> COPIAR TEXTO
                                </button>
                            </div>
                            <p><strong>3.</strong> ¡Guárdalo y listo! Cada vez que tengas una factura, ábrela en tu teléfono o PC con ese Gem, tómale la foto y pega el resultado aquí.</p>
                        </div>
                        <div className="p-4 border-t border-[var(--border-var)] flex justify-end bg-white">
                            <button className="btn bg-[#1967d2] text-white hover:bg-[#1557b0] shadow-md" onClick={() => setShowGemsInstructions(false)}>
                                ENTENDIDO
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
