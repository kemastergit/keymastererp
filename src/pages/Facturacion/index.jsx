import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
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
import Fuse from 'fuse.js'

import Catalogo from './Catalogo'
import ItemsAgregados from './ItemsAgregados'
import PanelPago from './PanelPago'
import PanelPagoKeypad from './PanelPagoKeypad'
import RutaVendedorModal from './RutaVendedorModal'
import ClienteSelector from '../../components/UI/ClienteSelector'
import { useNavigate } from 'react-router-dom'

export default function Facturacion() {
  const {
    tasa, cart, addToCart, removeFromCart, updateQty, updateItem, clearCart,
    tipoPago, setTipoPago, clienteFact, setClienteFact,
    vencFact, setVencFact, cartTotal, cartSubtotal, cartIva, cartIgtf,
    ivaEnabled, setIvaEnabled, payments, addPayment, removePayment,
    paymentsTotal, activeSession, toast,
    configEmpresa, loadConfigEmpresa, currentUser,
    btStatus, setBtStatus, setHideNav, setShowHelp,
    cartDescuento, descuentoReason, descuentoAdmin
  } = useStore()
  const navigate = useNavigate()
  const lastScrollY = useRef(0)

  // NINJA SCANNER REFS
  const scannerBuffer = useRef('')
  const lastKeyTime = useRef(0)

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
  const [showRutaModal, setShowRutaModal] = useState(false)
  const [payForm, setPayForm] = useState({ metodo: 'EFECTIVO_USD', montoUSD: '', montoBS: '' })

  const [lastVenta, setLastVenta] = useState(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [editForm, setEditForm] = useState({ descripcion: '', precio: '' })

  // Mobile stepper state
  const [step, setStep] = useState(1) // 1: Catalogo, 2: Items, 3: Pago, 4: Smart
  const [loading, setLoading] = useState(false)
  const [showNotasModal, setShowNotasModal] = useState(false)
  const [notasPendientes, setNotasPendientes] = useState([])
  const [filtroNotas, setFiltroNotas] = useState('PENDIENTE') // 'PENDIENTE' o 'EN_PROCESO'

  const ticketRef = useRef()

  const [keypadBuffer, setKeypadBuffer] = useState('')
  const [activeCurrency, setActiveCurrency] = useState('USD') // Local states for logic

  // viewMode para el catálogo: grid, list, pos (default)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('catalogo_view_mode') || 'pos')

  // Deuda y límite del cliente seleccionado
  const [deuda, setDeuda] = useState(0)
  const [limiteCredito, setLimiteCredito] = useState(0)

  // --- ESTADOS ELEVADOS PARA CREDITO_CUOTAS ---
  const [inicialCuotas, setInicialCuotas] = useState(0)
  const [metodoInicial, setMetodoInicial] = useState('EFECTIVO_USD')
  const [numCuotas, setNumCuotas] = useState(2)
  const [frecuenciaCuotas, setFrecuenciaCuotas] = useState('QUINCENAL')

  const updatePayAmount = useCallback((val, fromUSD = true) => {
    const n = parseFloat(val) || 0
    if (fromUSD) {
      setPayForm(prev => ({
        ...prev,
        montoUSD: val,
        montoBS: val === '' ? '' : (n * tasa).toFixed(2)
      }))
    } else {
      setPayForm(prev => ({
        ...prev,
        montoBS: val,
        montoUSD: val === '' ? '' : (n / tasa).toFixed(2)
      }))
    }
  }, [tasa])

  const handleKeypad = useCallback((val) => {
    setKeypadBuffer(prev => {
      let newBuffer = prev
      if (val === 'DEL') {
        newBuffer = newBuffer.slice(0, -1)
      } else if (val === '.') {
        if (!newBuffer.includes('.')) newBuffer += '.'
      } else {
        newBuffer += val
      }

      // Update payForm inside functional state update depends on buffer
      if (activeCurrency === 'USD') {
        updatePayAmount(newBuffer, true)
      } else {
        updatePayAmount(newBuffer, false)
      }

      return newBuffer
    })
  }, [activeCurrency, updatePayAmount])

  const handleAddPay = useCallback((stayOpen = true) => {
    const usd = parseFloat(payForm.montoUSD)
    if (!usd || usd <= 0) {
      toast('Ingrese un monto válido', 'warn')
      return
    }
    const bs = parseFloat(payForm.montoBS) || (usd * tasa)
    addPayment(payForm.metodo, usd, tasa, bs)

    const remaining = Math.max(0, cartTotal() - (paymentsTotal() + usd))
    const nextUSD = remaining > 0 ? remaining.toFixed(2) : ''
    const nextBS = remaining > 0 ? (remaining * tasa).toFixed(2) : ''

    setPayForm({
      ...payForm,
      montoUSD: nextUSD,
      montoBS: nextBS
    })

    // Pre-llenar el buffer con el resto para agilizar
    setKeypadBuffer(activeCurrency === 'USD' ? nextUSD : nextBS)

    toast(`✅ Pago añadido`, 'ok')
    if (!stayOpen) setShowPaymentModal(false)
  }, [payForm, tasa, addPayment, cartTotal, paymentsTotal, activeCurrency, setShowPaymentModal, toast])

  useEffect(() => {
    if (!clienteFact || clienteFact.length < 2) { setDeuda(0); setLimiteCredito(0); return }
    const calcDeuda = async () => {
      try {
        const deudas = await db.ctas_cobrar
          .filter(c => c.cliente === clienteFact && c.estado !== 'COBRADA' && c.estado !== 'ANULADA')
          .toArray()
        const total = deudas.reduce((acc, curr) => {
          const m = curr.monto_total || curr.monto || 0
          const c = curr.monto_cobrado || curr.monto_pagado || 0
          return acc + (m - c)
        }, 0)
        setDeuda(total)
        const cliente = await db.clientes.filter(c => c.nombre === clienteFact).first()
        setLimiteCredito(cliente?.limite_credito || 0)
      } catch (_e) { /* offline */ }
    }
    calcDeuda()
  }, [clienteFact])

  // Resizable columns state
  const [widths, setWidths] = useState(() => {
    try {
      const saved = localStorage.getItem('fact_col_widths_v2') // Nueva versión para incluir teclado
      return saved ? JSON.parse(saved) : { catalogo: 400, items: 300, pago: 280, keypad: 260 }
    } catch { return { catalogo: 400, items: 300, pago: 280, keypad: 260 } }
  })

  const resizingRef = useRef({ isResizing: false, type: null, startX: 0, startWidth: 0 })

  const startResizing = (type, e) => {
    resizingRef.current = {
      isResizing: true,
      type,
      startX: e.clientX,
      startWidth: type === 'items' ? widths.items : widths.pago
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingRef.current.isResizing) return
      const { type, startX, startWidth } = resizingRef.current
      const deltaX = e.clientX - startX
      
      if (type === 'catalogo') {
        const newWidth = Math.max(250, Math.min(1000, startWidth + deltaX))
        setWidths(prev => ({ ...prev, catalogo: newWidth }))
      } else if (type === 'items') {
        const newWidth = Math.max(160, Math.min(500, startWidth - deltaX))
        setWidths(prev => ({ ...prev, items: newWidth }))
      } else if (type === 'pago') {
        const newWidth = Math.max(160, Math.min(500, startWidth - deltaX))
        setWidths(prev => ({ ...prev, pago: newWidth }))
      } else if (type === 'keypad') {
        const newWidth = Math.max(160, Math.min(500, startWidth - deltaX))
        setWidths(prev => ({ ...prev, keypad: newWidth }))
      }
    }

    const handleMouseUp = () => {
      if (resizingRef.current.isResizing) {
        localStorage.setItem('fact_col_widths', JSON.stringify(widths))
        resizingRef.current.isResizing = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [widths])

  const handleEditPay = (p) => {
    // Cargar los datos del pago al form y buffer
    setPayForm({
      metodo: p.metodo,
      montoUSD: p.monto.toString(),
      montoBS: p.montoBS?.toString() || (p.monto * tasa).toString()
    })
    setKeypadBuffer(p.monto.toString())
    setActiveCurrency('USD')

    // Quitarlo de la lista para que al "añadir" no se duplique
    removePayment(p.id)
    setShowPaymentModal(true)
  }

  const openModalWithMethod = (method) => {
    // Si ya está abierto, solo cambiamos el método sin reiniciar montos
    if (showPaymentModal) {
      setPayForm(prev => ({ ...prev, metodo: method }))
      return
    }

    const remaining = Math.max(0, cartTotal() - paymentsTotal())
    setPayForm({
      metodo: method,
      montoUSD: remaining > 0 ? remaining.toFixed(2) : '',
      montoBS: remaining > 0 ? (remaining * tasa).toFixed(2) : ''
    })
    setKeypadBuffer(remaining > 0 ? remaining.toFixed(2) : '')
    setShowPaymentModal(true)
  }

  useEffect(() => {
    loadConfigEmpresa()
    const { loadTasa } = useStore.getState()
    loadTasa()
    fetchNotasVendedores() // Cargar notas al iniciar
    syncCorrelativo()
  }, [])

  const syncCorrelativo = async () => {
    try {
      console.log("📡 Sincronizando correlativo con la nube...");
      // 1. Consultar la nube por las últimas facturas para detectar el número más alto
      // Usamos el ID para asegurar que traemos lo más reciente
      const { data, error } = await supabase
        .from('facturas')
        .select('numero')
        .order('id', { ascending: false })
        .limit(20);

      let maxNum = 0;

      if (!error && data) {
        data.forEach(f => {
          const parts = f.numero.split('-');
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        });
      }

      // 2. Revisar también ventas locales (por si hay ventas offline no sincronizadas aún)
      const lastLocal = await db.ventas.orderBy('id').last();
      if (lastLocal) {
        const parts = lastLocal.nro.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }

      // 3. Si el máximo encontrado es mayor o igual al contador local, actualizarlo
      const currentConfig = await db.config.get('nro_nota');
      const currentVal = currentConfig?.valor || 0;

      if (maxNum >= currentVal) {
        await db.config.put({ clave: 'nro_nota', valor: maxNum + 1 });
        console.log(`✅ Correlativo actualizado: Próxima nota será ${maxNum + 1}`);
      }
    } catch (e) {
      console.warn("⚠️ Falló sincronización de correlativo (Modo Offline activo):", e);
    }
  };

  const fetchNotasVendedores = async () => {
    try {
      const { data, error } = await supabase
        .from('pedidos_web')
        .select('*')
        .eq('estado', filtroNotas)
        .eq('cliente_telefono', 'TIENDA (VENDEDOR)')
        .order('id', { ascending: false })

      if (error) throw error
      setNotasPendientes(data || [])
    } catch (e) {
      console.error("Error al cargar notas:", e)
    }
  }

  // Recargar notas cuando cambie el filtro dentro del modal
  useEffect(() => {
    if (showNotasModal) fetchNotasVendedores()
  }, [filtroNotas, showNotasModal])

  const handleImportarNota = async (nota) => {
    const doImport = async () => {
      setLoading(true)
      try {
        clearCart()
        for (const item of nota.items) {
          let art = await db.articulos.get(item.articulo_id)
          if (!art && item.codigo) art = await db.articulos.where('codigo').equals(item.codigo).first()

          if (art) {
            addToCart(art, item.cantidad || item.qty)
          } else {
            toast(`⚠️ ${item.descripcion} no encontrado localmente`, 'warn')
          }
        }
        setClienteFact(nota.cliente_nombre)

        // Marcar como en proceso (solo si estaba pendiente)
        if (nota.estado === 'PENDIENTE') {
          await supabase.from('pedidos_web').update({ estado: 'EN_PROCESO' }).eq('id', nota.id)
        }

        setShowNotasModal(false)
        toast(`✅ Nota #${nota.id} cargada al carrito`, 'ok')
        setStep(3)
      } catch (e) {
        toast("Error al importar nota", 'error')
      }
      setLoading(false)
    }

    if (cart.length > 0) {
      if (confirm(`⚠️ El carrito tiene productos. ¿Deseas borrarlos y cargar la Nota #${nota.id} de ${nota.cliente_nombre}?`)) {
        doImport()
      }
    } else {
      doImport()
    }
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if a modal is open
      if (document.body.classList.contains('modal-open') || showPaymentModal || showNotasModal || showPrintModal || editingItem) return

      // ------ NINJA SCANNER (Headless Barcode Reader) ------
      // Si recibimos texto rápido sin modificadores (pistola en emulación teclado)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const now = Date.now()
        // Una pistola humana/normal no escribe usualmente < 35ms, un scanner escupe todo a 10-20ms
        if (now - lastKeyTime.current > 50) {
          scannerBuffer.current = e.key // Reset si fue muy lento (inicio o persona escribiendo normal)
        } else {
          scannerBuffer.current += e.key
        }
        lastKeyTime.current = now
      }
      else if (e.key === 'Enter') {
        const now = Date.now()
        // Si el buffer tiene > 3 caracteres y la ráfaga acaba de terminar (menos de 100ms atrás)
        if (scannerBuffer.current.length >= 3 && (now - lastKeyTime.current < 100)) {
          e.preventDefault() // Evitar submit accidental o enters sueltos
          const codeToFind = scannerBuffer.current.trim()
          scannerBuffer.current = '' // Limpiamos la metralleta

          db.articulos.where('codigo').equals(codeToFind).first().then(art => {
            if (art) {
              addToCart(art, 1) // Store local o store Zustand lo maneja a qty=1
              toast(`🛒 ${art.descripcion} escaneado!`, 'ok')
            } else {
              toast(`❌ Código de barra ${codeToFind} no registrado`, 'warn')
            }
          }).catch(err => console.error("Error ninja scanner:", err))

          return // Frenamos la propagación de este Enter ninja
        }
        scannerBuffer.current = '' // reset estándar

        // --- NUEVO: Confirmar pago con ENTER si no hay input enfocado ---
        const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'
        if (!isInput && keypadBuffer && parseFloat(keypadBuffer) > 0) {
           e.preventDefault()
           handleAddPay(true)
           return
        }
      }
      // ------ FIN NINJA SCANNER ------

      // --- NUEVO: Entrada numérica global ---
      const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'
      if (!isInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if ((e.key >= '0' && e.key <= '9')) {
             handleKeypad(e.key)
        } else if (e.key === '.' || e.key === ',') {
             handleKeypad('.')
        } else if (e.key === 'Backspace') {
             handleKeypad('DEL')
        }
      }

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
        const canPay = ['CAJERO', 'ADMIN', 'SUPERVISOR'].includes(currentUser?.rol)
        if (!canPay) {
          setStep(3) // Llevar al panel de envío
          return
        }
        // Open payment modal (Solo para Cajeros/Admin)
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
  }, [cart, setShowPaymentModal, clearCart, setStep, removeFromCart, toast, showPaymentModal, showNotasModal, showPrintModal, editingItem, addToCart, currentUser?.rol, handleAddPay, handleKeypad, keypadBuffer])

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

  // 1. Mantener todos los artículos cargados en memoria (Sincronizado con DB)
  const allArts = useLiveQuery(() => db.articulos.toArray(), [], [])

  // 2. Motor de búsqueda ultra-rápido en memoria
  const articulos = useMemo(() => {
    const b = busq.trim().toLowerCase()
    if (b.length === 0) {
      return [...allArts].sort((a, b) => a.descripcion.localeCompare(b.descripcion)).slice(0, 100)
    }

    // Regla: Para 1-3 letras, priorizar estrictamente el inicio (Prefix matching)
    if (b.length <= 3) {
      const exactMatches = allArts.filter(a =>
        a.codigo?.toLowerCase().startsWith(b) ||
        a.descripcion?.toLowerCase().startsWith(b) ||
        a.marca?.toLowerCase().startsWith(b) ||
        a.referencia?.toLowerCase().startsWith(b)
      ).sort((x, y) => x.descripcion.localeCompare(y.descripcion))

      if (exactMatches.length > 0) return exactMatches.slice(0, 100)
    }

    // Si es más larga la búsqueda o no hubo inicio exacto, usamos Fuse
    const fuse = new Fuse(allArts, {
      keys: [
        { name: 'codigo', weight: 3 },
        { name: 'referencia', weight: 2 },
        { name: 'descripcion', weight: 2 },
        { name: 'marca', weight: 1 }
      ],
      threshold: 0.2,
      location: 0,
      distance: 100,
      useExtendedSearch: true
    })

    return fuse.search(b).map(r => r.item).slice(0, 100)
  }, [busq, allArts])

  const procesarNota = async (inicial = 0, metodoInicial = 'EFECTIVO_USD', numCuotas = 1, frecuencia = 'MENSUAL') => {
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

    if (tipoPago.includes('CREDITO')) {
      // Soporta: V-123, V123, V- 123, V 123, J-, E-, G-
      const cedulaRegex = /^[VJEG]-?\s?\d{6,9}/i
      if (!cedulaRegex.test(clienteFact.trim())) {
        toast('❌ Para ventas a Crédito/Cuotas es obligatorio colocar Cédula/RIF (V-12345678) en el nombre del cliente', 'error')
        setLoading(false); return
      }
    }

    const prefix = configEmpresa?.terminal_prefix || 'FACT'
    const nextNum = await nextNro('nro_nota')
    const nro = `${prefix}-${nextNum}`

    let ventaId = null
    let ventaCalculada = null

    try {
      // 🔍 VALIDACIÓN DE PRECIOS (P4): detectar si algún precio cambió mientras el carrito estaba abierto
      const cambiosPrecio = []
      for (const item of cart) {
        const freshArt = item.id ? await db.articulos.get(item.id) : null
        if (freshArt && Math.abs(freshArt.precio - item.precio) > 0.001) {
          cambiosPrecio.push({ desc: item.descripcion, viejo: item.precio, nuevo: freshArt.precio })
        }
      }
      if (cambiosPrecio.length > 0) {
        const detalle = cambiosPrecio.map(c => `${c.desc}: ${fmtUSD(c.viejo)} → ${fmtUSD(c.nuevo)}`).join('\n')
        const aceptar = window.confirm(`⚠️ PRECIO ACTUALIZADO:\n\n${detalle}\n\n¿Desea continuar con los nuevos precios?`)
        if (!aceptar) { setLoading(false); return }
        // Actualizar precios en el carrito con los frescos
        cambiosPrecio.forEach(c => {
          const idx = cart.findIndex(i => i.descripcion === c.desc)
          if (idx >= 0) cart[idx].precio = c.nuevo
        })
      }

      // 💾 A. GUARDADO LOCAL (DEXIE)
      await db.transaction('rw', [
        db.ventas, db.venta_items, db.articulos,
        db.ctas_cobrar, db.abonos, db.sesiones_caja, db.config, db.cuotas_credito
      ], async () => {
        // Validación de stock local final (con reparación de IDs huérfanos)
        for (const item of cart) {
          let freshArticle = item.id ? await db.articulos.get(item.id) : null
          // Si el ID del carrito caducó por una recarga de la nube, buscar por código maestro
          if (!freshArticle && item.codigo) {
            freshArticle = await db.articulos.where('codigo').equals(item.codigo).first()
          }
          if (!freshArticle || freshArticle.stock < item.qty) {
            throw new Error(`STOCK_INSUFICIENTE:${item.descripcion}:${freshArticle?.stock || 0}`)
          }
        }

        ventaCalculada = {
          nro, fecha: new Date(), cliente: clienteFact,
          tipo_pago: tipoPago, subtotal: cartSubtotal(), iva: cartIva(),
          igtf: cartIgtf(),
          descuento_monto: cartDescuento,
          descuento_motivo: descuentoReason,
          descuento_autorizado: descuentoAdmin,
          total, payments, estado: 'ACTIVA', vencimiento: vencFact || null,
          usuario_id: currentUser?.id, turno_id: activeSession.id
        }
        ventaId = await db.ventas.add(ventaCalculada)

        for (const item of cart) {
          let freshArt = item.id ? await db.articulos.get(item.id) : null
          if (!freshArt && item.codigo) {
            freshArt = await db.articulos.where('codigo').equals(item.codigo).first()
          }

          await db.venta_items.add({
            venta_id: ventaId,
            articulo_id: freshArt ? freshArt.id : item.id, // Se usa el ID real de la base de datos actual
            codigo: item.codigo, descripcion: item.descripcion,
            marca: item.marca || '', precio: item.precio, costo: freshArt?.costo || 0, qty: item.qty
          })

          if (freshArt) {
            await db.articulos.update(freshArt.id, { stock: Math.max(0, (freshArt.stock || 0) - item.qty) })
          }
        }

        let cxcId = null
        if (tipoPago === 'CREDITO' || (tipoPago === 'CONTADO' && total > pTotal + 0.01)) {
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

        if (tipoPago === 'CREDITO_CUOTAS') {
          // 1. La deuda total va completa a Cuentas por Cobrar
          cxcId = await db.ctas_cobrar.add({
            venta_id: ventaId, cliente: clienteFact, monto: total, fecha: new Date(),
            vencimiento: vencFact, estado: inicial >= total - 0.01 ? 'COBRADA' : 'PENDIENTE'
          })

          // 2. Si pagó inicial, registramos el abono de una vez
          if (inicial > 0) {
            await db.abonos.add({
              cuenta_id: cxcId, tipo_cuenta: 'COBRAR',
              fecha: new Date(), monto: inicial, metodo: metodoInicial
            })
          }

          // 3. Calculamos y creamos N registros en la nueva tabla `cuotas_credito`
          const saldoRestante = Math.max(0, total - inicial)
          const montoPorCuota = saldoRestante / numCuotas

          for (let i = 1; i <= numCuotas; i++) {
            // Calculadora mágica de fechas futuras según Semanal, Quincenal o Mensual
            let fechaVenc = new Date()
            if (frecuencia === 'SEMANAL') fechaVenc.setDate(fechaVenc.getDate() + (i * 7))
            else if (frecuencia === 'QUINCENAL') fechaVenc.setDate(fechaVenc.getDate() + (i * 15))
            else if (frecuencia === 'MENSUAL') fechaVenc.setMonth(fechaVenc.getMonth() + i)

            await db.cuotas_credito.add({
              venta_id: ventaId,
              numero_cuota: i,
              monto: montoPorCuota,
              fecha_vencimiento: fechaVenc.toISOString().split('T')[0],
              estado: 'PENDIENTE',
              fecha_pago: null
            })
          }
        }

        const nuevasNotas = [...(activeSession.notas_del_dia || []), ventaId]
        await db.sesiones_caja.update(activeSession.id, { notas_del_dia: nuevasNotas })
      })

      // ☁️ B. SINCRONIZACIÓN NUBE — SÚPER FUNCIÓN RPC (ATÓMICA)
      console.log("🚀 Iniciando sincronización con Supabase (RPC: procesar_venta_completa)...")
      try {
        const facturaId = `factura-${nro}-${activeSession.id}-${Date.now()}`
        const itemsNube = cart.map(i => ({
          codigo: i.codigo, descripcion: i.descripcion,
          cantidad: i.qty, precio: i.precio
        }))

        // 🚀 UN SOLO PAQUETE: Factura + Stock + CXC + Kardex + Auditoría
        const { data: rpcResult, error: rpcError } = await supabase.rpc('procesar_venta_completa', {
          p_factura_id: facturaId,
          p_numero: String(nro),
          p_cliente: clienteFact,
          p_vendedor: currentUser?.nombre || 'VENDEDOR',
          p_total_usd: total,
          p_total_bs: total * tasa,
          p_tasa_bcv: tasa,
          p_metodo_pago: payments.map(p => p.metodo).join(', '),
          p_tipo_pago: tipoPago,
          p_vencimiento: vencFact || '',
          p_items: itemsNube,
          p_pagos: payments
        })

        if (rpcError || !rpcResult?.ok) {
          console.error("❌ Falló RPC en la nube:", rpcError || rpcResult?.error)
          throw new Error(rpcResult?.error || rpcError?.message || 'FALLO_RPC')
        }

        console.log("✅ Venta sincronizada en la nube con éxito.")
        toast('☁️ Venta procesada en la nube (Stock + CXC + Kardex)', 'ok')

      } catch (errSync) {
        console.warn("⚠️ Nube falló (Offline), encolando paquete completo...", errSync)
        const { addToSyncQueue, processSyncQueue } = await import('../../utils/syncManager')

        // Encolar el paquete completo para reintento posterior
        await addToSyncQueue('rpc_venta', 'RPC', {
          p_factura_id: `factura-${nro}-${Date.now()}`,
          p_numero: String(nro),
          p_cliente: clienteFact,
          p_vendedor: currentUser?.nombre || 'VENDEDOR',
          p_total_usd: total,
          p_total_bs: total * tasa,
          p_tasa_bcv: tasa,
          p_metodo_pago: payments.map(p => p.metodo).join(', '),
          p_tipo_pago: tipoPago,
          p_vencimiento: vencFact || '',
          p_items: cart.map(i => ({ codigo: i.codigo, descripcion: i.descripcion, cantidad: i.qty, precio: i.precio })),
          p_pagos: payments
        })
        toast('🛰️ Guardado local (se enviará al conectar)', 'info')
        processSyncQueue()
      }

      // Sincronización adicional vía syncManager (solo para las Cuotas)
      if (tipoPago === 'CREDITO_CUOTAS') {
        const { addToSyncQueue, processSyncQueue } = await import('../../utils/syncManager')
        const devolucionCxcId = await db.ctas_cobrar.where({ venta_id: ventaId }).first();

        const saldoRestante = Math.max(0, total - inicial)
        const montoPorCuota = saldoRestante / numCuotas

        for (let i = 1; i <= numCuotas; i++) {
          let fechaVenc = new Date()
          if (frecuencia === 'SEMANAL') fechaVenc.setDate(fechaVenc.getDate() + (i * 7))
          else if (frecuencia === 'QUINCENAL') fechaVenc.setDate(fechaVenc.getDate() + (i * 15))
          else if (frecuencia === 'MENSUAL') fechaVenc.setMonth(fechaVenc.getMonth() + i)

          await addToSyncQueue('cuotas_credito', 'INSERT', {
            venta_id: String(ventaId),
            numero_cuota: i,
            monto: montoPorCuota,
            fecha_vencimiento: fechaVenc.toISOString().split('T')[0],
            estado: 'PENDIENTE'
          })
        }

        if (inicial > 0 && devolucionCxcId) {
          await addToSyncQueue('abonos', 'INSERT', {
            id: `abono-${devolucionCxcId.id}-${Date.now()}`,
            cuenta_id: String(devolucionCxcId.id), tipo_cuenta: 'COBRAR',
            fecha: new Date().toISOString(), monto: inicial, metodo: metodoInicial
          })
        }
        processSyncQueue()
      }

      // 🏆 C. FINALIZAR PROCESO
      const { processSaleCommissions } = await import('../../utils/comisiones')
      await processSaleCommissions(ventaId, ventaCalculada, cart.map(i => ({ ...i, costo: i.costo || 0 })))

      toast(`✅ Nota #${nro} procesada — Total: ${fmtUSD(total)}`)
      setLoading(false)

      setLastVenta({ nro, fecha: new Date(), cliente: clienteFact, tipo_pago: tipoPago, subtotal: cartSubtotal(), iva: cartIva(), igtf: cartIgtf(), total, payments, items: cart, tasa })
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

  const enviarCajaCentral = async () => {
    if (!clienteFact?.trim()) { toast('Ingresa el nombre del cliente', 'warn'); return }
    if (cart.length === 0) { toast('El carrito está vacío', 'warn'); return }

    setLoading(true)
    const nro = await nextNro('nro_cot') // Podemos usar la sequencia de cot o notas
    const total = cartTotal()

    const notaObj = {
      cliente_nombre: clienteFact,
      cliente_telefono: 'TIENDA (VENDEDOR)',
      estado: 'PENDIENTE',
      total_usd: total,
      items: cart.map(i => ({
        articulo_id: i.id,
        codigo: i.codigo,
        descripcion: i.descripcion,
        cantidad: i.qty,
        precio_unitario: i.precio
      }))
    }

    try {
      const { error } = await supabase.from('pedidos_web').insert([notaObj])
      if (error) throw error

      logAction(currentUser, 'PEDIDO_CAJA_ENVIADO', { nro, cliente: clienteFact, total })
      toast(`📤 Nota enviada a Caja Central con éxito`, 'ok')
      clearCart()
      setClienteFact('')
      setStep(1)
    } catch (e) {
      console.warn("Error al enviar a caja", e)
      toast("Error al enviar a caja central (Chequea tu internet)", 'error')
    }
    setLoading(false)
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

      {/* FRANJA DE IDENTIDAD DEL CLIENTE — Solo Desktop */}
      <div className="hidden lg:flex bg-[#0f172a] text-white px-6 py-2.5 items-center justify-between border-b border-slate-800 shrink-0 z-30 shadow-xl">
        <div className="flex items-center gap-8 flex-1">
          {/* Selector lateral izquierdo */}
          <div className="flex flex-col w-72">
            <div className="flex items-center gap-2 mb-1 opacity-50">
              <span className="material-icons-round text-[14px]">person_search</span>
              <span className="text-[9px] font-bold uppercase tracking-widest">Buscar Cliente</span>
            </div>
            <ClienteSelector value={clienteFact} onChange={setClienteFact} dark={true} />
          </div>

          {/* Nombre central si existe */}
          {clienteFact && clienteFact !== 'CLIENTE EVENTUAL' && (
            <div className="flex flex-col border-l border-slate-800 pl-8 animate-in fade-in slide-in-from-left duration-500">
              <span className="text-xl font-black text-slate-100 uppercase tracking-tight">{clienteFact}</span>
              <div className="flex items-center gap-3 mt-1">
                <span className="bg-blue-500/20 text-blue-400 text-[9px] px-2 py-0.5 rounded-full font-bold border border-blue-500/30 uppercase">Cliente</span>
                {deuda > 0.01
                  ? <span className="text-[10px] text-red-400 font-medium">Deuda activa: {fmtUSD(deuda)}</span>
                  : <span className="text-[10px] text-slate-500 font-medium">Sin deuda registrada</span>
                }
              </div>
            </div>
          )}
        </div>

        {/* Resumen de Venta en el Header (Opcional: Reemplaza Indicadores Financieros) */}
        <div className="flex items-center gap-4 ml-auto">
          
          {/* SECCIÓN DE DEUDA Y CRÉDITO DEL CLIENTE (INDICADORES DE RIESGO) */}
          {(deuda > 0.01 || limiteCredito > 0) && (
            <div className="hidden lg:flex items-center gap-6 pl-6 border-l border-slate-800/50 ml-2 py-1">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${deuda > 0 ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                <span className="material-icons-round text-[24px]">{deuda > 0 ? 'warning' : 'account_balance_wallet'}</span>
              </div>
              
              <div className="flex gap-6">
                <div className="flex flex-col leading-none text-right">
                  <div className="flex items-center gap-2 justify-end mb-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saldo Deudor</span>
                    {deuda > 0 && <span className="text-[8px] bg-red-600 text-white px-1.5 py-0.5 rounded-md font-black animate-pulse">PENDIENTE</span>}
                  </div>
                  <span className={`text-[18px] font-mono font-black ${deuda > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                    {fmtUSD(deuda)}
                  </span>
                </div>

                <div className="flex flex-col leading-none pl-6 border-l border-slate-800/30 text-right">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Límite Crédito</span>
                  <span className="text-[18px] font-mono font-black text-emerald-500">
                    {fmtUSD(limiteCredito)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* CUADRO DE TOTALES — Enfocado en la venta actual */}
          <div className="flex items-center gap-6 px-6 bg-[#1e293b]/60 rounded-2xl py-2 border border-slate-700/50 shadow-inner">
            {/* SUB-TOTAL */}
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Subtotal</span>
              <span className="text-[14px] font-mono font-bold text-slate-200">{fmtUSD(cartSubtotal())}</span>
            </div>

            {/* IVA */}
            <div className="flex flex-col items-center border-l border-slate-700/50 pl-6">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">IVA (16%)</span>
                <input 
                  type="checkbox" 
                  checked={ivaEnabled} 
                  onChange={e => setIvaEnabled(e.target.checked)} 
                  className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 accent-emerald-500 cursor-pointer" 
                />
              </div>
              <span className="text-[14px] font-mono font-bold text-slate-200">{fmtUSD(cartIva())}</span>
            </div>

            {/* TOTAL A PAGAR */}
            <div className="flex flex-col items-end border-l border-slate-700/50 pl-6 min-w-[140px]">
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.1em] mb-0.5">Total a Pagar</span>
              <div className="flex flex-col items-end leading-none">
                <div className="text-[28px] font-black text-white hover:text-emerald-400 transition-colors leading-none tracking-tighter">
                  <span className="text-sm font-bold text-slate-500 mr-1">$</span>
                  {cartTotal()?.toFixed(2)}
                </div>
                <div className="text-[11px] font-mono font-bold text-slate-500 text-right leading-none uppercase tracking-widest mt-1.5 opacity-80">
                  {fmtBS(cartTotal(), tasa)}
                </div>
              </div>
            </div>
          </div>

          {/* BOTÓN DE ACCIÓN PRINCIPAL (DINÁMICO SEGÚN ROL) */}
          <div className="flex items-center ml-2 pl-4 border-l border-slate-800/50">
            {['CAJERO', 'ADMIN', 'SUPERVISOR'].includes(currentUser?.rol) ? (
              <button
                onClick={() => procesarNota(inicialCuotas, metodoInicial, numCuotas, frecuenciaCuotas)}
                disabled={loading || cart.length === 0}
                className={`group px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase text-[12px] tracking-[0.15em] shadow-xl shadow-emerald-900/30 flex items-center gap-3 transition-all active:scale-95 ${loading || cart.length === 0 ? 'opacity-20 grayscale cursor-not-allowed' : 'hover:ring-4 hover:ring-emerald-500/20'}`}
              >
                <span className={`material-icons-round text-[20px] ${!loading && cart.length > 0 ? 'group-hover:translate-x-1' : ''} transition-transform`}>check_circle</span>
                <span>{loading ? 'PROCESANDO...' : 'FACTURAR'}</span>
              </button>
            ) : (
              <button
                onClick={enviarCajaCentral}
                disabled={loading || cart.length === 0}
                className={`group px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase text-[12px] tracking-[0.15em] shadow-xl shadow-blue-900/30 flex items-center gap-3 transition-all active:scale-95 ${loading || cart.length === 0 ? 'opacity-20 grayscale cursor-not-allowed' : 'hover:ring-4 hover:ring-blue-500/20'}`}
              >
                <span className={`material-icons-round text-[20px] ${!loading && cart.length > 0 ? 'group-hover:translate-x-1' : ''} transition-transform`}>send</span>
                <span>{loading ? 'ENVIANDO...' : 'ENVIAR A CAJA'}</span>
              </button>
            )}

            {/* BOTÓN DE LIMPIAR — Reservado al final */}
            <button 
              onClick={clearCart}
              title="Vaciar Carrito"
              disabled={cart.length === 0}
              className="ml-4 w-11 h-11 rounded-xl flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20 disabled:opacity-10"
            >
              <span className="material-icons-round text-[22px]">delete_sweep</span>
            </button>
          </div>
        </div>
      </div>

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
        <button className={`flex-1 py-3 text-[10px] font-bold uppercase transition-none ${step === 3 ? 'bg-[var(--teal)] text-white shadow-[var(--win-shadow)]' : 'text-[var(--text2)]'}`} onClick={() => setStep(3)}>
          {['CAJERO', 'ADMIN', 'SUPERVISOR'].includes(currentUser?.rol) ? '3. Pago' : '3. Enviar'}
        </button>
      </div>

      <div className="ventas-container flex-1 w-full overflow-hidden relative min-h-0 flex flex-col">
        {/* DESKTOP LAYOUT AND MOBILE CONDITIONAL VISIBILITY */}
        <div className="flex flex-col lg:flex-row h-full gap-0 overflow-hidden min-h-0 flex-1">

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
                cart={cart} removeFromCart={removeFromCart} updateQty={updateQty}
                viewMode={viewMode} setViewMode={setViewMode}
                itemsAgregadosComponent={
                  <ItemsAgregados
                    cart={cart} updateQty={updateQty}
                    openEditItem={openEditItem} removeFromCart={removeFromCart}
                  />
                }
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
                handleEditPay={handleEditPay}
                tasa={tasa} vencFact={vencFact} setVencFact={setVencFact}
                procesarCotizacion={procesarCotizacion} clearCart={clearCart}
                procesarNota={() => procesarNota(inicialCuotas, metodoInicial, numCuotas, frecuenciaCuotas)} 
               clienteFact={clienteFact} setClienteFact={setClienteFact}
               currentUser={currentUser} enviarCajaCentral={enviarCajaCentral}
               setShowNotasModal={setShowNotasModal} notasPendientes={notasPendientes} fetchNotasVendedores={fetchNotasVendedores}
               loading={loading}
               // Pasamos los setters para que PanelPago los maneje
               inicialCuotas={inicialCuotas} setInicialCuotas={setInicialCuotas}
               metodoInicial={metodoInicial} setMetodoInicial={setMetodoInicial}
               numCuotas={numCuotas} setNumCuotas={setNumCuotas}
               frecuenciaCuotas={frecuenciaCuotas} setFrecuenciaCuotas={setFrecuenciaCuotas}
            />
            )}

          </div>

          {/* DESKTOP VIEW (HIDDEN ON MOBILE) */}
          {/* COLUMNA 1: CATALOGO */}
          <div 
            className="hidden lg:flex h-full min-w-0"
            style={{ width: viewMode === 'pos' ? '100%' : widths.catalogo + 'px' }}
          >
            <Catalogo
              busq={busq} setBusq={setBusq}
              showDrop={showDrop} setShowDrop={setShowDrop}
              articulos={articulos} addToCart={addToCart} addGeneric={addGeneric}
              cart={cart} removeFromCart={removeFromCart} updateQty={updateQty}
              viewMode={viewMode} setViewMode={setViewMode}
              itemsAgregadosComponent={
                <ItemsAgregados
                  cart={cart} updateQty={updateQty}
                  openEditItem={openEditItem} removeFromCart={removeFromCart}
                />
              }
            />
          </div>

          {/* DIVISOR RESIZABLE 1 (CATALOGO) — oculto en modo POS */}
          {viewMode !== 'pos' && (
            <div 
              onMouseDown={(e) => startResizing('catalogo', e)}
              className="hidden lg:flex w-2.5 bg-orange-500/30 hover:bg-orange-600 cursor-col-resize transition-all h-full z-20 shrink-0 border-x border-orange-500/20 items-center justify-center group"
              title="Estirar Catálogo"
            >
              <div className="w-1 h-8 bg-orange-500 rounded-full opacity-40 group-hover:opacity-100 transition-opacity shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div>
            </div>
          )}

          {/* COLUMNA 2: ITEMS — oculta en modo POS (está integrado dentro del Catalogo) */}
          {viewMode !== 'pos' && (
            <div 
              className="hidden lg:flex h-full flex-1"
            >
              <ItemsAgregados
                cart={cart} updateQty={updateQty}
                openEditItem={openEditItem} removeFromCart={removeFromCart}
              />
            </div>
          )}

          {/* DIVISOR RESIZABLE 2 (PAGO) */}
          <div 
            onMouseDown={(e) => startResizing('pago', e)}
            className="hidden lg:flex w-2.5 bg-orange-500/30 hover:bg-orange-600 cursor-col-resize transition-all h-full z-20 shrink-0 border-x border-orange-500/20 items-center justify-center group"
            title="Arrastrar para ajustar totales"
          >
            <div className="w-1 h-8 bg-orange-500 rounded-full opacity-40 group-hover:opacity-100 transition-opacity"></div>
          </div>

          {/* COLUMNA 3: PAGO (Totales) */}
          <div 
            className="hidden lg:flex h-full shrink-0"
            style={{ width: widths.pago + 'px' }}
          >
            <PanelPago
              cart={cart} cartSubtotal={cartSubtotal} cartIva={cartIva} cartIgtf={cartIgtf} cartTotal={cartTotal}
              ivaEnabled={ivaEnabled} setIvaEnabled={setIvaEnabled}
              tipoPago={tipoPago} setTipoPago={setTipoPago}
              payments={payments} paymentsTotal={paymentsTotal}
              openModalWithMethod={openModalWithMethod}
              setShowPaymentModal={setShowPaymentModal} removePayment={removePayment}
              handleEditPay={handleEditPay}
              tasa={tasa} vencFact={vencFact} setVencFact={setVencFact}
              procesarCotizacion={procesarCotizacion} clearCart={clearCart}
              procesarNota={procesarNota} clienteFact={clienteFact} setClienteFact={setClienteFact}
              currentUser={currentUser} enviarCajaCentral={enviarCajaCentral}
              setShowNotasModal={setShowNotasModal} notasPendientes={notasPendientes} fetchNotasVendedores={fetchNotasVendedores}
              loading={loading}
            />
          </div>

          {/* DIVISOR RESIZABLE 3 (KEYPAD) */}
          <div 
            onMouseDown={(e) => startResizing('keypad', e)}
            className="hidden lg:flex w-2.5 bg-orange-500/30 hover:bg-orange-600 cursor-col-resize transition-all h-full z-20 shrink-0 border-x border-orange-500/20 items-center justify-center group"
            title="Ajustar teclado"
          >
            <div className="w-1 h-8 bg-orange-500 rounded-full opacity-40 group-hover:opacity-100 transition-opacity"></div>
          </div>

          {/* COLUMNA 4: TECLADO Y MÉTODOS (KEYPAD) */}
          <div 
            className="hidden lg:flex h-full shrink-0"
            style={{ width: widths.keypad + 'px' }}
          >
            <PanelPagoKeypad
              payForm={payForm} setPayForm={setPayForm}
              keypadBuffer={keypadBuffer} setKeypadBuffer={setKeypadBuffer}
              activeCurrency={activeCurrency} setActiveCurrency={setActiveCurrency}
              handleAddPay={handleAddPay} handleKeypad={handleKeypad}
              cartTotal={cartTotal} paymentsTotal={paymentsTotal}
              payments={payments} handleEditPay={handleEditPay} removePayment={removePayment}
              tasa={tasa}
            />
          </div>

        </div>
      </div>

      {/* MODALS */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="" noPadding hideHeader>
        <div className="max-w-[400px] mx-auto overflow-hidden rounded-3xl shadow-2xl h-[90vh]">
          <PanelPagoKeypad
              payForm={payForm} setPayForm={setPayForm}
              keypadBuffer={keypadBuffer} setKeypadBuffer={setKeypadBuffer}
              activeCurrency={activeCurrency} setActiveCurrency={setActiveCurrency}
              handleAddPay={handleAddPay} handleKeypad={handleKeypad}
              cartTotal={cartTotal} paymentsTotal={paymentsTotal}
              payments={payments} handleEditPay={handleEditPay} removePayment={removePayment}
              tasa={tasa}
              onConfirm={() => setShowPaymentModal(false)}
            />
            {/* Botón flotante para cerrar en mobile */}
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white backdrop-blur-md z-50">
                <span className="material-icons-round">close</span>
            </button>
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
      {/* MODAL NOTAS VENDEDORES */}
      <Modal open={showNotasModal} onClose={() => setShowNotasModal(false)} title="NOTAS PENDIENTES DE VENDEDORES">
        <div className="flex bg-[var(--surface2)] p-1 mb-4 border border-[var(--border-var)]">
          <button
            className={`flex-1 py-2 text-[10px] font-black uppercase transition-all ${filtroNotas === 'PENDIENTE' ? 'bg-[var(--teal)] text-white shadow-md' : 'text-[var(--text2)] opacity-60'}`}
            onClick={() => setFiltroNotas('PENDIENTE')}
          >
            Nuevas Notas
          </button>
          <button
            className={`flex-1 py-2 text-[10px] font-black uppercase transition-all ${filtroNotas === 'EN_PROCESO' ? 'bg-[var(--orange-var)] text-white shadow-md' : 'text-[var(--text2)] opacity-60'}`}
            onClick={() => setFiltroNotas('EN_PROCESO')}
          >
            En Proceso / Recuperar
          </button>
        </div>

        <div className="space-y-3 max-h-[55vh] overflow-y-auto p-1">
          {notasPendientes.length === 0 ? (
            <div className="text-center py-10 text-[var(--text3)] uppercase font-black text-xs opacity-50 border-2 border-dashed border-[var(--border-var)] bg-[var(--surfaceDark)]">
              No hay registros en este estado
            </div>
          ) : (
            notasPendientes.map(nota => (
              <div key={nota.id} onClick={() => handleImportarNota(nota)}
                className={`border p-4 flex justify-between items-center cursor-pointer shadow-sm active:scale-[0.98] transition-all
                  ${nota.estado === 'PENDIENTE' ? 'bg-[var(--surface2)] border-[var(--border-var)] hover:border-[var(--teal)] hover:bg-[var(--surface)]'
                    : 'bg-orange-50/30 border-orange-200 hover:border-orange-400'}`}
              >
                <div>
                  <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${nota.estado === 'PENDIENTE' ? 'text-[var(--teal)]' : 'text-[var(--orange-var)]'}`}>
                    Nota #{nota.id} {nota.estado === 'EN_PROCESO' && '(CARGADA)'}
                  </div>
                  <div className="text-sm font-black text-[var(--text-main)] uppercase">{nota.cliente_nombre}</div>
                  <div className="text-[9px] text-[var(--text3)] font-mono mt-1">{new Date(nota.created_at).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-[var(--text3)] uppercase">Total</div>
                  <div className="text-lg font-black font-mono text-[var(--text-main)]">{fmtUSD(nota.total_usd)}</div>
                  <div className={`text-[9px] font-black text-white px-2 py-0.5 mt-1 inline-block ${nota.estado === 'PENDIENTE' ? 'bg-[var(--teal)]' : 'bg-[var(--orange-var)]'}`}>
                    {nota.estado === 'PENDIENTE' ? 'CARGAR' : 'RE-CARGAR'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="mt-6">
          <button className="btn w-full justify-center bg-[var(--surface2)] py-4 font-black text-xs" onClick={() => setShowNotasModal(false)}>SALIR</button>
        </div>
      </Modal>

      <RutaVendedorModal open={showRutaModal} onClose={() => setShowRutaModal(false)} />

    </div>
  )
}
