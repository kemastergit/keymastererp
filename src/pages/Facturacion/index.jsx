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
import { supabase } from '../../lib/supabase'

import Catalogo from './Catalogo'
import ItemsAgregados from './ItemsAgregados'
import PanelPago from './PanelPago'
import SmartSidebar from './SmartSidebar'

export default function Facturacion() {
  const {
    tasa, cart, addToCart, removeFromCart, updateQty, updateItem, clearCart,
    tipoPago, setTipoPago, clienteFact, setClienteFact,
    vencFact, setVencFact, cartTotal, cartSubtotal, cartIva, cartIgtf,
    ivaEnabled, setIvaEnabled, payments, addPayment, removePayment,
    paymentsTotal, activeSession, toast,
    configEmpresa, loadConfigEmpresa, currentUser,
    btStatus, setBtStatus, setHideNav, setShowHelp,
  } = useStore()
  const lastScrollY = useRef(0)

  const handleScroll = (e) => {
    const currentScroll = e.target.scrollTop
    if (window.innerWidth >= 768) return

    if (currentScroll > lastScrollY.current && currentScroll > 64) {
      setHideNav(true)
    } else if (currentScroll < lastScrollY.current) {
      setHideNav(false)
    }
    lastScrollY.current = currentScroll
  }

  const [busq, setBusq] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [payForm, setPayForm] = useState({ metodo: 'EFECTIVO_USD', montoUSD: '', montoBS: '' })

  const openModalWithMethod = (method) => {
    setPayForm({ ...payForm, metodo: method, montoUSD: '', montoBS: '' });
    setShowPaymentModal(true);
  }

  const [lastVenta, setLastVenta] = useState(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [editForm, setEditForm] = useState({ descripcion: '', precio: '' })

  // Mobile stepper state
  const [step, setStep] = useState(1) // 1: Catalogo, 2: Items, 3: Pago, 4: Smart
  const [loading, setLoading] = useState(false)

  const ticketRef = useRef()

  useEffect(() => {
    loadConfigEmpresa()
    const { loadTasa } = useStore.getState()
    loadTasa()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if a modal is open to let modal inputs handle keys if needed
      // Actually per rules: Enter=confirm modal, Esc=close modal. Those 
      // are better handled by the Modal component.

      if (e.key === 'F2') {
        e.preventDefault()
        // Focus the search input inside Catalogo
        const searchInput = document.getElementById('search-products')
        if (searchInput) {
          setStep(1)
          searchInput.focus()
        }
      } else if (e.key === 'F8') {
        e.preventDefault()
        // Open payment modal
        if (cart.length > 0) {
          setStep(3)
          setShowPaymentModal(true)
        } else {
          toast('El carrito está vacío', 'warn')
        }
      } else if (e.key === 'F9') {
        e.preventDefault()
        // Clear cart with confirmation
        if (cart.length > 0 && confirm('¿Estás seguro de vaciar el carrito?')) {
          clearCart()
        }
      } else if (e.key === 'z' && e.ctrlKey) {
        // Undo last item from cart
        e.preventDefault()
        if (cart.length > 0) {
          const lastItem = cart[cart.length - 1]
          removeFromCart(lastItem.id)
          toast('Último ítem removido: ' + lastItem.descripcion, 'info')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart, setShowPaymentModal, clearCart, setStep, removeFromCart, toast])

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
    if (loading) return
    setLoading(true)
    if (!activeSession) {
      toast('⚠️ Debe realizar la APERTURA DE CAJA para facturar', 'error'); setLoading(false); return
    }

    if (!clienteFact?.trim()) { toast('Ingresa el nombre del cliente', 'warn'); setLoading(false); return }
    if (cart.length === 0) { toast('El carrito está vacío', 'warn'); setLoading(false); return }

    const total = cartTotal()
    const pTotal = paymentsTotal()

    if (tipoPago === 'CONTADO' && pTotal < total - 0.01) {
      toast('Debe completar el pago total para ventas de contado', 'warn'); setLoading(false); return
    }
    if (tipoPago === 'CREDITO' && !vencFact) {
      toast('Selecciona fecha de vencimiento', 'warn'); setLoading(false); return
    }

    const nro = await nextNro('nro_nota')

    // --- 📡 1. PRE-VALIDACIÓN DE STOCK GLOBAL (SUPABASE) ---
    try {
      const ids = cart.map(i => i.id)
      const { data: cloudArticulos, error: cloudError } = await supabase
        .from('articulos')
        .select('id, codigo, stock,descripcion')
        .in('id', ids)

      if (!cloudError && cloudArticulos) {
        for (const item of cart) {
          const cloudArt = cloudArticulos.find(ca => ca.id === item.id)
          if (cloudArt && (cloudArt.stock || 0) < item.qty) {
            await db.articulos.update(item.id, { stock: cloudArt.stock })
            toast(`🚫 STOCK GLOBAL INSUFICIENTE para: ${item.descripcion}. Disponible: ${cloudArt.stock}.`, 'error')
            setLoading(false); return
          }
        }
      }
    } catch (e) {
      console.warn("⚠️ Fallo consulta stock global, procediendo con local", e)
    }

    let ventaId = null
    let ventaCalculada = null

    try {
      // 💾 A. GUARDADO LOCAL (DEXIE)
      await db.transaction('rw', [
        db.ventas, db.venta_items, db.articulos,
        db.ctas_cobrar, db.abonos, db.sesiones_caja, db.config
      ], async () => {
        // Validación de stock local final
        for (const item of cart) {
          const freshArticle = await db.articulos.get(item.id)
          if (!freshArticle || freshArticle.stock < item.qty) {
            throw new Error(`STOCK_INSUFICIENTE:${item.descripcion}:${freshArticle?.stock || 0}`)
          }
        }

        ventaCalculada = {
          nro, fecha: new Date(), cliente: clienteFact,
          tipo_pago: tipoPago, subtotal: cartSubtotal(), iva: cartIva(),
          igtf: cartIgtf(),
          total, payments, estado: 'ACTIVA', vencimiento: vencFact || null,
          usuario_id: currentUser?.id, turno_id: activeSession.id
        }
        ventaId = await db.ventas.add(ventaCalculada)

        for (const item of cart) {
          const freshArt = await db.articulos.get(item.id)
          await db.venta_items.add({
            venta_id: ventaId, articulo_id: item.id,
            codigo: item.codigo, descripcion: item.descripcion,
            marca: item.marca || '', precio: item.precio, costo: freshArt?.costo || 0, qty: item.qty
          })
          await db.articulos.update(item.id, { stock: Math.max(0, (freshArt.stock || 0) - item.qty) })
        }

        let cxcId = null
        if (tipoPago === 'CREDITO' || total > pTotal + 0.01) {
          cxcId = await db.ctas_cobrar.add({
            venta_id: ventaId, cliente: clienteFact, monto: total, fecha: new Date(),
            vencimiento: vencFact, estado: pTotal >= total - 0.01 ? 'COBRADA' : pTotal > 0 ? 'PARCIAL' : 'PENDIENTE'
          })
        }

        for (const p of payments) {
          await db.abonos.add({
            cuenta_id: cxcId || ventaId, tipo_cuenta: cxcId ? 'COBRAR' : 'VENTA',
            fecha: new Date(), monto: p.monto, metodo: p.metodo
          })
        }

        const nuevasNotas = [...(activeSession.notas_del_dia || []), ventaId]
        await db.sesiones_caja.update(activeSession.id, { notas_del_dia: nuevasNotas })
      })

      // ☁️ B. SINCRONIZACIÓN NUBE (INSTANTÁNEA COMO EL CATÁLOGO)
      try {
        const { addToSyncQueue } = await import('../../utils/syncManager')
        const ventaNube = {
          id: `factura-${nro}-${activeSession.id}-${Date.now()}`,
          numero: nro, cliente_nombre: clienteFact, total_usd: total,
          total_bs: total * tasa, tasa_bcv: tasa, vendedor: currentUser?.nombre || 'VENDEDOR',
          metodo_pago: payments.map(p => p.metodo).join(', '),
          items: cart.map(i => ({ articulo_id: i.id, codigo: i.codigo, descripcion: i.descripcion, cantidad: i.qty, precio: i.precio })),
          created_at: new Date().toISOString()
        }

        // 🚀 DISPARO DIRECTO A LA NUBE
        const { error: errFact } = await supabase.from('facturas').insert([ventaNube])

        if (errFact) throw new Error("FALLO_NUBE_DIRECTO")

        // 💨 ACTUALIZACIÓN STOCK INSTANTÁNEA
        for (const i of cart) {
          const fresh = await db.articulos.get(i.id)
          await supabase.from('articulos').update({ stock: fresh.stock }).eq('codigo', i.codigo)
        }

        toast('☁️ Venta y Stock sincronizado YA', 'ok')

      } catch (errSync) {
        console.warn("⚠️ Nube falló (Offline), encolando para después...", errSync)
        const { addToSyncQueue, processSyncQueue } = await import('../../utils/syncManager')

        // Encolado de respaldo
        await addToSyncQueue('facturas', 'INSERT', {
          id: `factura-${nro}-${Date.now()}`, numero: nro, cliente_nombre: clienteFact, total_usd: total,
          vendedor: currentUser?.nombre || 'VENDEDOR', items: cart, created_at: new Date().toISOString()
        })

        for (const i of cart) {
          const fresh = await db.articulos.get(i.id)
          await addToSyncQueue('articulos', 'UPDATE_STOCK', { codigo: i.codigo, stock: fresh.stock })
        }
        toast('🛰️ Guardado local (se enviará al conectar)', 'info')
        processSyncQueue()
      }

      // 🏆 C. FINALIZAR PROCESO
      const { processSaleCommissions } = await import('../../utils/comisiones')
      await processSaleCommissions(ventaId, ventaCalculada, cart.map(i => ({ ...i, costo: i.costo || 0 })))

      toast(`✅ Nota #${nro} procesada — Total: ${fmtUSD(total)}`)
      setLoading(false)

      setLastVenta({ nro, fecha: new Date(), cliente: clienteFact, tipo_pago: tipoPago, subtotal: cartSubtotal(), iva: cartIva(), igtf: cartIgtf(), total, payments, items: cart })
      setShowPrintModal(true)
      clearCart()
      setStep(1)

    } catch (err) {
      setLoading(false)
      if (err.message.startsWith('STOCK_INSUFICIENTE')) {
        const [_, desc, stock] = err.message.split(':')
        toast(`🚫 Stock insuficiente: ${desc} (${stock})`, 'error')
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
    const usd = parseFloat(payForm.montoUSD)
    if (!usd || usd <= 0) return
    const bs = parseFloat(payForm.montoBS) || (usd * tasa)
    addPayment(payForm.metodo, usd, tasa, bs)
    setPayForm({ ...payForm, montoUSD: '', montoBS: '' })
  }

  const updatePayAmount = (val, fromUSD = true) => {
    const n = parseFloat(val) || 0
    if (fromUSD) {
      setPayForm(prev => ({
        ...prev,
        montoUSD: val,
        montoBS: n > 0 ? (n * tasa).toFixed(2) : ''
      }))
    } else {
      setPayForm(prev => ({
        ...prev,
        montoBS: val,
        montoUSD: n > 0 ? (n / tasa).toFixed(2) : ''
      }))
    }
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
    <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-[var(--surfaceDark)]">
      {/* TABS MOBILE ONLY */}
      <div className="lg:hidden flex bg-[var(--surface)] p-1 mb-1 shadow-sm border-b border-[var(--border-var)] flex-none z-20">
        <button className={`flex-1 py-3 text-[10px] font-bold uppercase transition-none ${step === 1 ? 'bg-[var(--teal)] text-white shadow-[var(--win-shadow)]' : 'text-[var(--text2)]'}`} onClick={() => setStep(1)}>1. Buscar</button>
        <button className={`flex-1 py-3 text-[10px] font-bold uppercase transition-none relative focus:outline-none ${step === 2 ? 'bg-[var(--teal)] text-white shadow-[var(--win-shadow)]' : 'text-[var(--text2)]'}`} onClick={() => setStep(2)}>
          2. Items
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-[var(--green-var)] text-white text-[9px] w-5 h-5 rounded-full flex items-center justify-center font-black animate-bounce shadow-lg border-2 border-[var(--surface)]">
              {cart.length}
            </span>
          )}
        </button>
        <button className={`flex-1 py-3 text-[10px] font-bold uppercase transition-none ${step === 3 ? 'bg-[var(--teal)] text-white shadow-[var(--win-shadow)]' : 'text-[var(--text2)]'}`} onClick={() => setStep(3)}>3. Pago</button>
        <button className={`flex-1 py-3 text-[10px] font-bold uppercase transition-none ${step === 4 ? 'bg-[var(--teal)] text-white shadow-[var(--win-shadow)]' : 'text-[var(--text2)]'}`} onClick={() => setStep(4)}>4. App</button>
      </div>

      <div className="ventas-container flex-1 w-full overflow-hidden relative min-h-0 flex flex-col">
        {/* DESKTOP LAYOUT AND MOBILE CONDITIONAL VISIBILITY */}
        <div className="flex flex-col lg:flex-row h-full gap-0 lg:gap-2 overflow-hidden min-h-0 flex-1">

          {/* MOBILE SCROLL WRAPPER FOR STEPS */}
          <div
            className="lg:hidden flex-1 overflow-y-auto custom-scroll pb-10 scroll-smooth"
            onScroll={handleScroll}
          >
            {step === 1 && (
              <Catalogo
                busq={busq} setBusq={setBusq}
                showDrop={showDrop} setShowDrop={setShowDrop}
                articulos={articulos} addToCart={addToCart} addGeneric={addGeneric}
                cart={cart}
              />
            )}
            {step === 2 && (
              <ItemsAgregados
                cart={cart} updateQty={updateQty}
                openEditItem={openEditItem} removeFromCart={removeFromCart}
              />
            )}
            {step === 3 && (
              <PanelPago
                cart={cart} cartSubtotal={cartSubtotal} cartIva={cartIva} cartIgtf={cartIgtf} cartTotal={cartTotal}
                ivaEnabled={ivaEnabled} setIvaEnabled={setIvaEnabled}
                tipoPago={tipoPago} setTipoPago={setTipoPago}
                payments={payments} paymentsTotal={paymentsTotal}
                openModalWithMethod={openModalWithMethod}
                setShowPaymentModal={setShowPaymentModal} removePayment={removePayment}
                tasa={tasa} vencFact={vencFact} setVencFact={setVencFact}
                procesarCotizacion={procesarCotizacion} clearCart={clearCart}
                procesarNota={procesarNota} clienteFact={clienteFact} setClienteFact={setClienteFact}
              />
            )}
            {step === 4 && <SmartSidebar tasa={tasa} />}
          </div>

          {/* DESKTOP VIEW (HIDDEN ON MOBILE) */}
          {/* COLUMNA 1: CATALOGO */}
          <div className="hidden lg:flex lg:flex-1 h-full min-w-0">
            <Catalogo
              busq={busq} setBusq={setBusq}
              showDrop={showDrop} setShowDrop={setShowDrop}
              articulos={articulos} addToCart={addToCart} addGeneric={addGeneric}
              cart={cart}
            />
          </div>

          {/* COLUMNA 2: ITEMS (WIDTH MODERADO) */}
          <div className={`h-full hidden lg:flex lg:flex-none lg:w-[240px] xl:w-[280px]`}>
            <ItemsAgregados
              cart={cart} updateQty={updateQty}
              openEditItem={openEditItem} removeFromCart={removeFromCart}
            />
          </div>

          {/* COLUMNA 3: PAGO (WIDTH MODERADO) */}
          <div className={`h-full hidden lg:flex lg:flex-none lg:w-[240px] xl:w-[280px]`}>
            <PanelPago
              cart={cart} cartSubtotal={cartSubtotal} cartIva={cartIva} cartIgtf={cartIgtf} cartTotal={cartTotal}
              ivaEnabled={ivaEnabled} setIvaEnabled={setIvaEnabled}
              tipoPago={tipoPago} setTipoPago={setTipoPago}
              payments={payments} paymentsTotal={paymentsTotal}
              openModalWithMethod={openModalWithMethod}
              setShowPaymentModal={setShowPaymentModal} removePayment={removePayment}
              tasa={tasa} vencFact={vencFact} setVencFact={setVencFact}
              procesarCotizacion={procesarCotizacion} clearCart={clearCart}
              procesarNota={procesarNota} clienteFact={clienteFact} setClienteFact={setClienteFact}
            />
          </div>

          {/* COLUMNA 4: SMART SIDEBAR (APP DENTRO DE APP) */}
          <div className={`h-full hidden lg:flex lg:flex-none lg:w-[180px] xl:w-[220px]`}>
            <SmartSidebar tasa={tasa} />
          </div>
        </div>
      </div>

      {/* MODALS */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="REGISTRAR PAGO RECIBIDO">
        <div className="space-y-6">
          <div className="field">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)] mb-3 block">Seleccione el Método de Cobro *</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { id: 'EFECTIVO_USD', label: 'EFECTIVO', icon: 'payments' },
                { id: 'PAGO_MOVIL', label: 'P.MÓVIL', icon: 'account_balance' },
                { id: 'ZELLE', label: 'ZELLE', icon: 'credit_card' },
                { id: 'EFECTIVO_BS', label: 'BOLÍVARES', icon: 'savings' },
                { id: 'PUNTO_VENTA', label: 'PUNTO', icon: 'point_of_sale' },
                { id: 'OTRO', label: 'OTRO', icon: 'more_horiz' },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setPayForm({ ...payForm, metodo: m.id })}
                  className={`flex flex-col items-center justify-center gap-2 p-3 border-2 transition-all duration-200 aspect-square sm:aspect-auto sm:h-24
                    ${payForm.metodo === m.id
                      ? 'bg-[var(--teal)] border-[var(--teal)] text-white shadow-lg lg:scale-105 z-10'
                      : 'bg-[var(--surfaceDark)] border-[var(--border-var)] text-[var(--text2)] hover:border-[var(--teal)] hover:text-[var(--text-main)] cursor-pointer'
                    }`}
                >
                  <span className="material-icons-round text-2xl">{m.icon}</span>
                  <span className="text-[9px] font-black uppercase tracking-tighter text-center leading-none">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[var(--surfaceDark)] p-6 border-2 border-[var(--border-var)] shadow-inner space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
              <div className="field !mb-0">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--teal)] mb-2 block min-h-[24px]">Monto en Dólares ($)</label>
                <div className="relative">
                  <input type="number"
                    className="inp !py-4 !pl-10 font-mono text-xl font-black w-full rounded-none focus:bg-[var(--teal)]/5 transition-none shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    autoFocus
                    placeholder="0.00"
                    value={payForm.montoUSD}
                    onChange={e => updatePayAmount(e.target.value, true)}
                    inputMode="decimal"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--teal)] font-black z-10">$</span>
                </div>
              </div>

              <div className="field !mb-0">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)] mb-2 block min-h-[24px]">Equivalencia en Bolívares (Bs)</label>
                <div className="relative">
                  <input type="number"
                    className="inp !py-4 !pl-12 font-mono text-xl font-black w-full rounded-none focus:bg-[var(--teal)]/5 transition-none shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0.00"
                    value={payForm.montoBS}
                    onChange={e => updatePayAmount(e.target.value, false)}
                    inputMode="decimal"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text2)] font-black z-10 text-[10px]">BS</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center py-2 px-3 bg-[var(--surface2)] border-l-4 border-[var(--teal)]">
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text2)]">Tasa de Cambio (BCV):</span>
              <span className="font-mono font-black text-[var(--teal)]">1 $ = {tasa.toFixed(2)} BS</span>
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <button className="btn bg-[var(--surfaceDark)] text-[var(--text-main)] flex-1 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer" onClick={() => setShowPaymentModal(false)}>DESCARTAR</button>
            <button className="btn bg-[var(--teal)] text-white flex-2 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer tracking-widest" onClick={handleAddPay}>
              <span className="material-icons-round text-base">add_task</span>
              <span>CARGAR PAGO</span>
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showPrintModal && !!lastVenta} onClose={() => setShowPrintModal(false)} title="Venta Exitosa">
        <div className="space-y-6">
          <div className="bg-[var(--surfaceDark)] p-1 scale-90 origin-top overflow-hidden border border-[var(--border-var)] h-[280px] overflow-y-auto shadow-inner">
            <TicketTermico ref={null} nota={lastVenta} config={configEmpresa} />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button className="btn py-4 font-black flex items-center justify-center gap-3 bg-[var(--teal)] text-white shadow-[var(--win-shadow)] hover:bg-[var(--tealDark)]" onClick={() => handlePrint()}>
              <span className="material-icons-round">print</span>
              IMPRIMIR CABLE / RED
            </button>

            <button
              className={`btn py-4 font-black flex items-center justify-center gap-3 transition-none border border-[var(--border-var)] shadow-[var(--win-shadow)]
                ${btStatus === 'CONNECTED' ? 'bg-[#0078d4] text-white hover:bg-[#005a9e]' :
                  btStatus === 'CONNECTING' ? 'bg-[var(--orange-var)] text-white animate-pulse' : 'bg-[var(--surface2)] text-[var(--text2)] hover:bg-[var(--surface)]'}`}
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
    </div>
  )
}
