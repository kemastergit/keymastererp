import { useState, useCallback, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nextNro } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtBS, today } from '../../utils/format'
import { logAction } from '../../utils/audit'
import { printNota, printCotizacion } from '../../utils/print'
import { useReactToPrint } from 'react-to-print'
import TicketTermico from '../../components/Ticket/TicketTermico'
import Modal from '../../components/UI/Modal'
import { btPrinter } from '../../utils/bluetoothPrinter'

import Catalogo from './Catalogo'
import ItemsAgregados from './ItemsAgregados'
import PanelPago from './PanelPago'

export default function Facturacion() {
  const {
    tasa, cart, addToCart, removeFromCart, updateQty, updateItem, clearCart,
    tipoPago, setTipoPago, clienteFact, setClienteFact,
    vencFact, setVencFact, cartTotal, cartSubtotal, cartIva, cartIgtf,
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

  // Mobile stepper state
  const [step, setStep] = useState(1) // 1: Catalogo, 2: Items, 3: Pago

  const ticketRef = useRef()

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
      ).limit(100).toArray()
      : db.articulos.orderBy('descripcion').toArray(),
    [busq], []
  ) || []

  const procesarNota = async () => {
    if (!activeSession) {
      toast('⚠️ Debe realizar la APERTURA DE CAJA para facturar', 'error'); return
    }

    if (!clienteFact?.trim()) { toast('Ingresa el nombre del cliente', 'warn'); return }
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

    try {
      await db.transaction('rw', [
        db.ventas, db.venta_items, db.articulos,
        db.ctas_cobrar, db.abonos, db.sesiones_caja, db.config
      ], async () => {

        // 1. VALIDACIÓN DE STOCK EN TIEMPO REAL
        for (const item of cart) {
          const freshArticle = await db.articulos.get(item.id)
          if (!freshArticle || freshArticle.stock < item.qty) {
            throw new Error(`STOCK_INSUFICIENTE:${item.descripcion}:${freshArticle?.stock || 0}`)
          }
        }

        const venta = {
          nro, fecha: new Date(), cliente: clienteFact,
          tipo_pago: tipoPago, subtotal: cartSubtotal(), iva: cartIva(),
          igtf: cartIgtf(),
          total, payments, estado: 'ACTIVA', vencimiento: vencFact || null,
          usuario_id: currentUser?.id, turno_id: activeSession.id
        }
        const ventaId = await db.ventas.add(venta)

        // 2. Items y Actualización de Stock Atómica
        for (const item of cart) {
          const freshArticle = await db.articulos.get(item.id)
          await db.venta_items.add({
            venta_id: ventaId, articulo_id: item.id,
            codigo: item.codigo, descripcion: item.descripcion,
            marca: item.marca || '',
            precio: item.precio,
            costo: freshArticle?.costo || 0,
            qty: item.qty
          })
          await db.articulos.update(item.id, {
            stock: Math.max(0, (freshArticle.stock || 0) - item.qty)
          })
        }

        // 3. Pagos y Cuentas
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

        // 4. Vincular a sesión activa
        const nuevasNotas = [...(activeSession.notas_del_dia || []), ventaId]
        await db.sesiones_caja.update(activeSession.id, { notas_del_dia: nuevasNotas })
      })

      // FUERA DE LA TRANSACCIÓN (Efectos secundarios)
      await useStore.getState().loadSession()
      logAction(currentUser, 'VENTA_PROCESADA', { nro, cliente: clienteFact, total })
      toast(`✅ Nota #${nro} procesada — Total: ${fmtUSD(total)}`)

      // Preparar para impresión
      const ventaFull = {
        nro, fecha: new Date(), cliente: clienteFact,
        tipo_pago: tipoPago, subtotal: cartSubtotal(), iva: cartIva(),
        igtf: cartIgtf(),
        total, payments, items: cart
      }
      printNota(ventaFull, cart, tasa)
      clearCart()
      setStep(1)

    } catch (err) {
      if (err.message.startsWith('STOCK_INSUFICIENTE')) {
        const [_, desc, stock] = err.message.split(':')
        toast(`🚫 Stock insuficiente para: ${desc}. Disponible: ${stock}`, 'error')
        logAction(currentUser, 'INTENTO_VENTA_SIN_STOCK', { producto: desc, solicitado: cart.find(i => i.descripcion === desc)?.qty })
      } else {
        toast('❌ Error al procesar la venta', 'error')
        console.error(err)
      }
    }
  }

  const procesarCotizacion = async () => {
    if (!clienteFact?.trim()) { toast('Ingresa el nombre del cliente', 'warn'); return }
    if (cart.length === 0) { toast('El carrito está vacío', 'warn'); return }

    const nro = await nextNro('nro_cot')
    const total = cartTotal()
    const cot = { nro, fecha: new Date(), cliente: clienteFact, total }
    const cotId = await db.cotizaciones.add(cot)

    for (const item of cart) {
      await db.cot_items.add({ cot_id: cotId, ...item })
    }

    logAction(currentUser, 'COTIZACION_GENERADA', { nro, cliente: clienteFact, total })
    toast(`📋 Cotización #${nro} generada`)
    printCotizacion({ ...cot, nro }, cart, tasa)
    clearCart()
    setStep(1)
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
      {/* TABS MOBILE ONLY */}
      <div className="lg:hidden flex bg-white rounded-2xl p-1 mb-3 shadow-sm border border-slate-100 flex-none z-10">
        <button className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${step === 1 ? 'bg-primary text-white shadow-md' : 'text-slate-400'}`} onClick={() => setStep(1)}>1. Buscar</button>
        <button className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all relative ${step === 2 ? 'bg-primary text-white shadow-md' : 'text-slate-400'}`} onClick={() => setStep(2)}>
          2. Items
          {cart.length > 0 && <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[9px]">{cart.length}</span>}
        </button>
        <button className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${step === 3 ? 'bg-primary text-white shadow-md' : 'text-slate-400'}`} onClick={() => setStep(3)}>3. Pago</button>
      </div>

      <div className="ventas-container flex-1 w-full h-full pb-[80px] md:pb-0 relative min-h-0 flex flex-col">
        {/* DESKTOP LAYOUT AND MOBILE CONDITIONAL VISIBILITY */}
        <div className="flex flex-col lg:flex-row h-full gap-3 overflow-hidden min-h-0 flex-1">

          {/* COLUMNA 1: CATALOGO */}
          <div className={`h-full lg:flex ${step === 1 ? 'flex' : 'hidden'} lg:flex-1`}>
            <Catalogo
              busq={busq} setBusq={setBusq}
              showDrop={showDrop} setShowDrop={setShowDrop}
              articulos={articulos} addToCart={addToCart} addGeneric={addGeneric}
            />
          </div>

          {/* COLUMNA 2: ITEMS */}
          <div className={`h-full lg:flex ${step === 2 ? 'flex' : 'hidden'} lg:flex-none lg:w-[280px] xl:w-[320px]`}>
            <ItemsAgregados
              cart={cart} updateQty={updateQty}
              openEditItem={openEditItem} removeFromCart={removeFromCart}
            />
          </div>

          {/* COLUMNA 3: PAGO */}
          <div className={`h-full lg:flex ${step === 3 ? 'flex' : 'hidden'} lg:flex-none lg:w-[280px] xl:w-[320px]`}>
            <PanelPago
              cart={cart} cartSubtotal={cartSubtotal} cartIva={cartIva} cartIgtf={cartIgtf} cartTotal={cartTotal}
              ivaEnabled={ivaEnabled} setIvaEnabled={setIvaEnabled}
              tipoPago={tipoPago} setTipoPago={setTipoPago}
              payments={payments} paymentsTotal={paymentsTotal}
              setShowPaymentModal={setShowPaymentModal} removePayment={removePayment}
              tasa={tasa} vencFact={vencFact} setVencFact={setVencFact}
              procesarCotizacion={procesarCotizacion} clearCart={clearCart}
              procesarNota={procesarNota} clienteFact={clienteFact} setClienteFact={setClienteFact}
            />
          </div>
        </div>
      </div>

      {/* MOBILE FLOATING BUTTONS FOR NAVIGATION */}
      <div className="fixed bottom-[80px] md:bottom-24 left-1/2 -translate-x-1/2 w-[90%] lg:hidden flex gap-2 z-40">
        {step === 1 && (
          <button onClick={() => setStep(2)} className="flex-1 bg-amber-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-amber-500/30 uppercase tracking-widest flex items-center justify-center gap-2">
            Ver Items <span className="bg-white text-amber-500 px-2 py-0.5 rounded-full text-xs font-mono">{cart.length}</span> <span className="material-icons-round">arrow_forward</span>
          </button>
        )}
        {step === 2 && (
          <>
            <button onClick={() => setStep(1)} className="flex-1 bg-white text-slate-500 border border-slate-200 font-bold py-4 rounded-2xl uppercase tracking-widest flex items-center justify-center gap-1">
              <span className="material-icons-round text-sm">arrow_back</span> Atrás
            </button>
            <button onClick={() => setStep(3)} className="flex-[2] bg-primary text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/30 uppercase tracking-widest flex items-center justify-center gap-2">
              Ir a Pagar <span className="material-icons-round">arrow_forward</span>
            </button>
          </>
        )}
        {step === 3 && (
          <>
            <button onClick={() => setStep(2)} className="flex-1 bg-white text-slate-500 border border-slate-200 font-bold py-4 rounded-2xl uppercase tracking-widest flex items-center justify-center gap-1">
              <span className="material-icons-round text-sm">arrow_back</span> Items
            </button>
            <button onClick={procesarNota} className="flex-[2] bg-green-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-green-500/30 uppercase tracking-widest flex items-center justify-center gap-2">
              Cerrar Venta <span className="material-icons-round">check_circle</span>
            </button>
          </>
        )}
      </div>

      {/* MODALS */}
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
                autoFocus
                placeholder="0.00" value={payForm.monto} onChange={e => setPayForm({ ...payForm, monto: e.target.value })} />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold z-10">$</span>
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

      <div style={{ display: 'none' }}>
        <TicketTermico ref={ticketRef} nota={lastVenta} config={configEmpresa} />
      </div>
    </>
  )
}
