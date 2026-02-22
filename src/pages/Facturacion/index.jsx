import { useState, useCallback, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nextNro } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtBS, today } from '../../utils/format'
import { printNota, printCotizacion } from '../../utils/print'
import ClienteSelector from '../../components/UI/ClienteSelector'
import { useReactToPrint } from 'react-to-print'
import TicketTermico from '../../components/Ticket/TicketTermico'
import Modal from '../../components/UI/Modal'
import { btPrinter } from '../../utils/bluetoothPrinter'


export default function Facturacion() {
  const {
    tasa, cart, addToCart, removeFromCart, updateQty, updateItem, clearCart,
    tipoPago, setTipoPago, clienteFact, setClienteFact,
    vencFact, setVencFact, cartTotal, cartSubtotal, cartIva,
    ivaEnabled, setIvaEnabled, payments, addPayment, removePayment,
    paymentsTotal, activeSession, toast,
    configEmpresa, loadConfigEmpresa, currentUser,
    btStatus, setBtStatus
  } = useStore()

  const [busq, setBusq] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [payForm, setPayForm] = useState({ metodo: 'EFECTIVO_USD', monto: '' })
  const [lastVenta, setLastVenta] = useState(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [editForm, setEditForm] = useState({ descripcion: '', precio: '' })

  const ticketRef = useRef()
  // const { configEmpresa, loadConfigEmpresa, currentUser } = useStore() // Moved to above

  useEffect(() => {
    loadConfigEmpresa()
  }, [])

  const handlePrint = useReactToPrint({
    contentRef: ticketRef,
    documentTitle: `Ticket_${lastVenta?.nro}`,
    onAfterPrint: () => setShowPrintModal(false)
  })

  const handlePrintBT = async () => {
    if (!lastVenta) return;
    toast('🔍 Iniciando comunicación Bluetooth...', 'info')
    try {
      if (!btPrinter.isConnected()) {
        setBtStatus('CONNECTING')
        await btPrinter.connect()
        setBtStatus('CONNECTED')
        toast('✅ Impresora vinculada!', 'ok')
      }

      toast('⏳ Enviando ticket de venta...', 'info')
      await btPrinter.printVenta(lastVenta, configEmpresa)
      toast('✅ Factura enviada con éxito!', 'ok')
      setShowPrintModal(false)
    } catch (error) {
      setBtStatus('DISCONNECTED')
      console.error(error)
      toast('❌ Error: ' + (error.message || 'Error de conexión'), 'error')
    }
  }

  const articulos = useLiveQuery(
    () => busq.trim().length > 0
      ? db.articulos.filter(a =>
        a.codigo?.toLowerCase().includes(busq.toLowerCase()) ||
        a.descripcion?.toLowerCase().includes(busq.toLowerCase()) ||
        a.marca?.toLowerCase().includes(busq.toLowerCase())
      ).limit(20).toArray()
      : db.articulos.orderBy('descripcion').limit(30).toArray(),
    [busq], []
  )

  const procesarNota = async () => {
    if (!activeSession) {
      toast('⚠️ Debe realizar la APERTURA DE CAJA para facturar', 'error'); return
    }

    if (!clienteFact.trim()) { toast('Ingresa el nombre del cliente', 'warn'); return }
    if (cart.length === 0) { toast('El carrito está vacío', 'warn'); return }

    const total = cartTotal()
    const pTotal = paymentsTotal()

    if (tipoPago === 'CONTADO' && pTotal < total - 0.01) {
      toast('Debe completar el pago total para ventas de contado', 'warn'); return
    }
    if (tipoPago === 'CREDITO' && !vencFact) {
      toast('Selecciona fecha de vencimiento', 'warn'); return
    }

    const nro = await nextNro('nro_nota')
    const venta = {
      nro, fecha: new Date(), cliente: clienteFact,
      tipo_pago: tipoPago, subtotal: cartSubtotal(), iva: cartIva(),
      total, payments, estado: 'ACTIVA', vencimiento: vencFact || null,
      usuario_id: currentUser.id, turno_id: activeSession.id
    }
    const ventaId = await db.ventas.add(venta)

    // Items y Stock
    for (const item of cart) {
      await db.venta_items.add({
        venta_id: ventaId, articulo_id: item.id,
        codigo: item.codigo, descripcion: item.descripcion,
        marca: item.marca || '', precio: item.precio, qty: item.qty
      })
      await db.articulos.update(item.id, { stock: Math.max(0, (item.stock || 0) - item.qty) })
    }

    // Pagos y Cuentas
    let cuentaCobrarId = null
    if (tipoPago === 'CREDITO' || total > pTotal + 0.01) {
      cuentaCobrarId = await db.ctas_cobrar.add({
        venta_id: ventaId, cliente: clienteFact,
        monto: total, fecha: new Date(),
        vencimiento: vencFact, estado: pTotal >= total - 0.01 ? 'COBRADA' : pTotal > 0 ? 'PARCIAL' : 'PENDIENTE'
      })
    }

    for (const p of payments) {
      await db.abonos.add({
        cuenta_id: cuentaCobrarId || ventaId,
        tipo_cuenta: cuentaCobrarId ? 'COBRAR' : 'VENTA',
        fecha: new Date(), monto: p.monto, metodo: p.metodo
      })
    }

    // Vincular a sesión activa
    const nuevasNotas = [...(activeSession.notas_del_dia || []), ventaId]
    await db.sesiones_caja.update(activeSession.id, { notas_del_dia: nuevasNotas })
    await useStore.getState().loadSession()

    toast(`✅ Nota #${nro} procesada — Total: ${fmtUSD(total)}`)

    // Preparar para impresión
    const ventaFull = {
      ...venta,
      id: ventaId,
      items: [...cart], // Deep copy
      cajero_nombre: currentUser.nombre,
      cliente_nombre: clienteFact
    }
    setLastVenta(ventaFull)

    if (configEmpresa?.auto_imprimir) {
      // Small delay for React to render the ticket in the ref
      setTimeout(() => handlePrint(), 500)
    } else {
      setShowPrintModal(true)
    }

    clearCart()
    setShowPaymentModal(false)
  }

  const procesarCotizacion = async () => {
    if (!clienteFact.trim()) { toast('Ingresa el nombre del cliente', 'warn'); return }
    if (cart.length === 0) { toast('El carrito está vacío', 'warn'); return }

    const nro = await nextNro('nro_cot')
    const total = cartTotal()
    const cot = { nro, fecha: new Date(), cliente: clienteFact, total }
    const cotId = await db.cotizaciones.add(cot)

    for (const item of cart) {
      await db.cot_items.add({ cot_id: cotId, ...item })
    }

    toast(`📋 Cotización #${nro} generada`)
    printCotizacion({ ...cot, nro }, cart, tasa)
    clearCart()
  }

  const handleAddPay = () => {
    const m = parseFloat(payForm.monto)
    if (!m || m <= 0) return
    addPayment(payForm.metodo, m)
    setPayForm({ ...payForm, monto: '' })
  }

  const addGeneric = async () => {
    const art = await db.articulos.where('codigo').equals('000').first()
    const baseArt = art || { id: 999999, codigo: '000', stock: 99999, unidad: 'UNI' }

    const newItem = { ...baseArt, descripcion: 'VARIOS / GENÉRICO', precio: 0 }
    addToCart(newItem)

    // Open edit auto for price
    setEditingItem(newItem.id)
    setEditForm({ descripcion: newItem.descripcion, precio: '0' })
  }

  const openEditItem = (item) => {
    setEditingItem(item.id)
    setEditForm({ descripcion: item.descripcion, precio: item.precio.toString() })
  }

  const saveEditItem = () => {
    updateItem(editingItem, {
      descripcion: editForm.descripcion,
      precio: parseFloat(editForm.precio) || 0
    })
    setEditingItem(null)
  }


  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 items-start">

        {/* === IZQUIERDO === */}
        <div className="space-y-4">
          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-icons-round text-primary">shopping_basket</span>
              <div className="panel-title !m-0 !p-0">Venta Nueva</div>
            </div>

            <div className="space-y-4">
              <div className="field !m-0">
                <label className="!text-[10px] !font-black !text-slate-400 !uppercase !tracking-widest">Identificación del Cliente</label>
                <ClienteSelector value={clienteFact} onChange={setClienteFact} />
              </div>

              <div className="relative group">
                <label className="!text-[10px] !font-black !text-slate-400 !uppercase !tracking-widest">Búsqueda de Productos</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input className="inp !py-3 !pl-11 !bg-slate-50 focus:!bg-white transition-all shadow-inner" value={busq}
                      onChange={e => { setBusq(e.target.value); setShowDrop(true) }}
                      onFocus={() => setShowDrop(true)}
                      placeholder="Escriba código o nombre..."
                      autoComplete="off" inputMode="search" />
                    <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">search</span>
                  </div>
                  <button className="btn btn-y !px-4 shrink-0 rounded-2xl shadow-amber-500/20" onClick={addGeneric} title="Agregar Artículo Varios">
                    <span className="material-icons-round text-base">category</span>
                    <span className="text-[10px]">VARIOS</span>
                  </button>
                </div>

                {showDrop && articulos.length > 0 && (
                  <div className="absolute z-50 w-full bg-white border border-slate-200 mt-2
                  rounded-2xl max-h-72 overflow-y-auto shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 custom-scroll">
                    {articulos.map(a => (
                      <div key={a.id}
                        className="px-4 py-3 cursor-pointer border-b border-slate-50 hover:bg-slate-50 transition-colors flex items-center justify-between group/item"
                        onClick={() => { addToCart(a); setBusq(''); setShowDrop(false) }}>
                        <div className="min-w-0 pr-4">
                          <div className="font-mono text-primary text-[10px] font-bold uppercase">{a.codigo}</div>
                          <div className="font-bold text-slate-700 text-sm truncate">{a.descripcion}</div>
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <div className="text-sm font-black text-slate-800">{fmtUSD(a.precio)}</div>
                          <div className={`text-[9px] font-bold uppercase ${a.stock <= 0 ? 'text-red-500' : 'text-green-600'}`}>
                            Stock: {a.stock ?? 0}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="panel p-0 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-icons-round text-slate-400 text-sm">inventory_2</span>
                <div className="panel-title !m-0">Catálogo Sugerido</div>
              </div>
            </div>
            <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 440px)' }}>
              <table>
                <thead>
                  <tr className="bg-slate-50/10">
                    <th>Código</th><th>Producto</th><th>Stock</th><th className="text-right">Precio</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {articulos.map(a => (
                    <tr key={a.id} className="group/tr">
                      <td className="font-mono text-primary font-bold text-[11px]">{a.codigo}</td>
                      <td>
                        <div className="font-bold text-slate-700 leading-tight">{a.descripcion}</div>
                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">{a.marca}</div>
                      </td>
                      <td>
                        <span className={`badge ${(a.stock ?? 0) === 0 ? 'badge-r' : (a.stock ?? 0) <= 3 ? 'badge-y' : 'badge-g'} !px-2.5 font-mono font-bold`}>
                          {a.stock ?? 0}
                        </span>
                      </td>
                      <td className="font-mono text-right font-black text-slate-800">{fmtUSD(a.precio)}</td>
                      <td className="text-right">
                        <button className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center
                          ${(a.stock ?? 0) === 0
                            ? 'border-slate-100 text-slate-200 cursor-not-allowed'
                            : 'border-green-100 bg-green-50 text-green-600 hover:bg-green-500 hover:text-white hover:border-green-500'}`}
                          onClick={() => addToCart(a)}
                          disabled={(a.stock ?? 0) === 0}>
                          <span className="material-icons-round text-sm">add</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* === DERECHO: CARRITO === */}
        <div className="sticky top-[130px]">
          <div className="panel flex flex-col max-h-[calc(100vh-160px)] shadow-2xl border-primary/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-icons-round text-primary">receipt_long</span>
                <div className="panel-title !m-0">Carrito de Venta</div>
              </div>
              <div className="badge badge-g !rounded-full !py-0.5 !text-[9px] font-black">{cart.length} Art.</div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 custom-scroll space-y-2 mb-4 min-h-[100px]">
              {cart.length === 0
                ? (
                  <div className="flex flex-col items-center justify-center py-10 opacity-30">
                    <span className="material-icons-round text-4xl mb-2 text-slate-300">shopping_cart</span>
                    <div className="text-center text-slate-400 text-[10px] font-bold tracking-widest uppercase">Vacío</div>
                  </div>
                )
                : cart.map(item => (
                  <div key={item.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-center gap-3 group transition-all hover:border-primary/20 hover:shadow-sm">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEditItem(item)}>
                      <div className="text-xs font-bold text-slate-700 truncate flex items-center gap-1">
                        {item.descripcion}
                        <span className="material-icons-round text-[10px] opacity-0 group-hover:opacity-40 transition-opacity">edit</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">{fmtUSD(item.precio)} x {item.qty}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center bg-white border border-slate-200 rounded-full h-7">
                        <button className="px-3 text-[10px] font-bold" onClick={() => updateQty(item.id, item.qty - 1)}>-</button>
                        <span className="w-6 text-center text-xs font-bold">{item.qty}</span>
                        <button className="px-3 text-[10px] font-bold" onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                      </div>
                      <div className="font-mono text-[11px] font-black">{fmtUSD(item.precio * item.qty)}</div>
                    </div>
                  </div>
                ))
              }
            </div>

            {/* Totales */}
            <div className="bg-slate-900 rounded-3xl p-5 mb-5 text-white shadow-2xl">
              <div className="space-y-1 mb-4">
                <div className="flex justify-between items-center opacity-60">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">Subtotal</span>
                  <span className="text-xs font-mono">{fmtUSD(cartSubtotal())}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                    IVA (16%)
                    <button onClick={() => setIvaEnabled(!ivaEnabled)} className={`w-8 h-4 rounded-full relative transition-all ${ivaEnabled ? 'bg-primary' : 'bg-slate-700'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${ivaEnabled ? 'left-4.5' : 'left-0.5'}`}></div>
                    </button>
                  </span>
                  <span className="text-xs font-mono text-primary">{fmtUSD(cartIva())}</span>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div>
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest block">Total Final</span>
                  <div className="text-3xl font-mono font-black text-primary leading-none">
                    {fmtUSD(cartTotal())}
                  </div>
                </div>
              </div>
            </div>

            {/* Forma de Pago Multimoneda */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pagos Realizados</span>
                <button onClick={() => setShowPaymentModal(true)} className="text-primary text-[10px] font-black uppercase hover:underline">+ Agregar</button>
              </div>

              <div className="space-y-2 max-h-32 overflow-y-auto mb-3 custom-scroll">
                {payments.length === 0
                  ? <div className="text-[10px] text-slate-400 italic text-center py-2 border border-dashed border-slate-200 rounded-xl">No hay pagos registrados</div>
                  : payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div className="text-[10px] font-bold text-slate-600 uppercase">{p.metodo.replace('_', ' ')}</div>
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-xs font-black">{fmtUSD(p.monto)}</div>
                        <button onClick={() => removePayment(p.id)} className="text-red-400 hover:text-red-600">
                          <span className="material-icons-round text-sm">cancel</span>
                        </button>
                      </div>
                    </div>
                  ))
                }
              </div>

              {paymentsTotal() > 0 && paymentsTotal() < cartTotal() - 0.01 && (
                <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 mb-4 animate-in slide-in-from-top-2">
                  <div className="flex justify-between items-center text-amber-800">
                    <span className="text-[9px] font-black uppercase">Restante por cobrar:</span>
                    <span className="font-mono text-sm font-black">{fmtUSD(cartTotal() - paymentsTotal())}</span>
                  </div>
                </div>
              )}

              {paymentsTotal() > cartTotal() + 0.01 && (
                <div className="bg-green-50 p-3 rounded-2xl border border-green-100 mb-4 animate-in zoom-in-95">
                  <div className="flex justify-between items-center text-green-800 mb-1">
                    <span className="text-[9px] font-black uppercase tracking-tighter">Vuelto en Dólares ($):</span>
                    <span className="font-mono text-sm font-black">{fmtUSD(paymentsTotal() - cartTotal())}</span>
                  </div>
                  <div className="flex justify-between items-center text-green-700 border-t border-green-100 pt-1 mt-1 border-dashed">
                    <span className="text-[9px] font-black uppercase tracking-tighter">Vuelto en Bolívares (Bs):</span>
                    <span className="font-mono text-sm font-black">{fmtBS(paymentsTotal() - cartTotal(), tasa)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-5 px-1">
              <div className="bg-slate-100 p-1 rounded-2xl flex gap-1 shadow-inner">
                {['CONTADO', 'CREDITO'].map(t => (
                  <button key={t} onClick={() => setTipoPago(t)}
                    className={`flex-1 py-2 text-[10px] font-extrabold uppercase rounded-xl transition-all
                    ${tipoPago === t ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {tipoPago === 'CREDITO' && (
              <div className="mb-5 px-1 animate-in slide-in-from-top-2">
                <label className="text-[9px] font-black text-slate-400 mb-2 block uppercase">Vencimiento</label>
                <input type="date" className="inp !py-2 !text-xs" value={vencFact} onChange={e => setVencFact(e.target.value)} />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button className="w-full rounded-2xl py-3 flex items-center justify-center gap-3 font-bold uppercase text-[11px] tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                onClick={procesarCotizacion}>
                <span className="material-icons-round text-sm">assignment</span>
                <span>Solo Cotizar (Sin Venta)</span>
              </button>

              <div className="flex gap-2">
                <button className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center border border-slate-200 shrink-0" onClick={clearCart}>
                  <span className="material-icons-round">delete_sweep</span>
                </button>
                <button
                  className={`flex-1 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[12px] tracking-widest shadow-xl transition-all
                    ${(tipoPago === 'CONTADO' && paymentsTotal() < cartTotal() - 0.01) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/20'}`}
                  onClick={procesarNota}>
                  <span className="material-icons-round">check_circle</span>
                  <span>Cerrar Venta</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Pagos */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Registrar Pago">
        <div className="space-y-4">
          <div className="field">
            <label>Método de Pago</label>
            <select className="inp !py-3" value={payForm.metodo} onChange={e => setPayForm({ ...payForm, metodo: e.target.value })}>
              <option value="EFECTIVO_USD">Efectivo $</option>
              <option value="EFECTIVO_BS">Efectivo Bs</option>
              <option value="PAGO_MOVIL">Pago Móvil</option>
              <option value="PUNTO_VENTA">Punto de Venta</option>
              <option value="ZELLE">Zelle</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div className="field">
            <label>Monto en Dólares ($)</label>
            <div className="relative">
              <input type="number" className="inp !py-3 !pl-8 font-mono text-lg font-bold"
                placeholder="0.00" value={payForm.monto} onChange={e => setPayForm({ ...payForm, monto: e.target.value })} />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
            </div>
            {payForm.metodo === 'EFECTIVO_BS' || payForm.metodo === 'PAGO_MOVIL' || payForm.metodo === 'PUNTO_VENTA' ? (
              <p className="text-[10px] text-primary font-bold mt-2 uppercase">Equivalente: {fmtBS(parseFloat(payForm.monto) || 0, tasa)}</p>
            ) : null}
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn btn-gr flex-1" onClick={() => setShowPaymentModal(false)}>Cancelar</button>
            <button className="btn btn-primary flex-1 font-black" onClick={handleAddPay}>Agregar</button>
          </div>
        </div>
      </Modal>
      {/* Modal de Impresión */}
      <Modal open={showPrintModal && !!lastVenta} onClose={() => setShowPrintModal(false)} title="Venta Exitosa">
        <div className="space-y-6">
          <div className="bg-slate-50 p-2 rounded-xl scale-90 origin-top overflow-hidden border border-slate-100 h-[280px] overflow-y-auto">
            <TicketTermico ref={null} nota={lastVenta} config={configEmpresa} />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button className="btn btn-primary py-4 font-black flex items-center justify-center gap-3" onClick={() => handlePrint()}>
              <span className="material-icons-round">print</span>
              IMPRIMIR CABLE / RED
            </button>

            <button
              className={`btn py-4 font-black flex items-center justify-center gap-3 transition-all
                ${btStatus === 'CONNECTED' ? 'bg-blue-600 text-white' :
                  btStatus === 'CONNECTING' ? 'bg-amber-500 text-white animate-pulse' : 'bg-slate-800 text-slate-300'}`}
              onClick={handlePrintBT}
              disabled={btStatus === 'CONNECTING'}>
              <span className="material-icons-round">
                {btStatus === 'CONNECTED' ? 'print' : btStatus === 'CONNECTING' ? 'sync' : 'bluetooth'}
              </span>
              {btStatus === 'CONNECTED' ? 'IMPRIMIR BLUETOOTH' :
                btStatus === 'CONNECTING' ? 'CONECTANDO...' : 'VINCULAR BLUETOOTH'}
            </button>

            <button className="btn btn-gr py-3 font-bold mt-2" onClick={() => setShowPrintModal(false)}>CERRAR</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editingItem} onClose={() => setEditingItem(null)} title="Editar Artículo en Carrito">
        <div className="space-y-4">
          <div className="field">
            <label>Descripción del Producto</label>
            <input className="inp !py-3" value={editForm.descripcion} onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} />
          </div>
          <div className="field">
            <label>Precio Unitario ($)</label>
            <input className="inp !py-3 font-mono" type="number" step="0.01" value={editForm.precio} onChange={e => setEditForm({ ...editForm, precio: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn btn-gr flex-1" onClick={() => setEditingItem(null)}>Cancelar</button>
            <button className="btn btn-primary flex-1 font-black" onClick={saveEditItem}>Actualizar</button>
          </div>
        </div>
      </Modal>

      {/* Ticket oculto para auto-impresión */}
      <div style={{ display: 'none' }}>
        <TicketTermico ref={ticketRef} nota={lastVenta} config={configEmpresa} />
      </div>
    </>
  )
}
