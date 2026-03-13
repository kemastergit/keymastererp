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
import Fuse from 'fuse.js'

import Catalogo from './Catalogo'
import ItemsAgregados from './ItemsAgregados'
import PanelPago from './PanelPago'
import RutaVendedorModal from './RutaVendedorModal'
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
      }
      // ------ FIN NINJA SCANNER ------

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
  }, [cart, setShowPaymentModal, clearCart, setStep, removeFromCart, toast, showPaymentModal, showNotasModal, showPrintModal, editingItem, addToCart])

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
    async () => {
      const b = busq.trim().toLowerCase()
      if (b.length === 0) {
        return await db.articulos.orderBy('descripcion').toArray()
      }

      const allArts = await db.articulos.toArray()

      // Regla: Para 1-3 letras, priorizar estrictamente el inicio (Prefix matching)
      // Si escribes 'am', solo queremos lo que EMPIEZA con 'am'
      if (b.length <= 3) {
        const exactMatches = allArts.filter(a =>
          a.codigo?.toLowerCase().startsWith(b) ||
          a.descripcion?.toLowerCase().startsWith(b) ||
          a.marca?.toLowerCase().startsWith(b) ||
          a.referencia?.toLowerCase().startsWith(b)
        ).sort((x, y) => x.descripcion.localeCompare(y.descripcion))

        // Si encontramos suficientes coincidencias exactas al inicio, devolvemos esas
        if (exactMatches.length > 0) return exactMatches.slice(0, 100)
      }

      // Si es más larga la búsqueda o no hubo inicio exacto, usamos Fuse con ponderación
      const fuse = new Fuse(allArts, {
        keys: [
          { name: 'codigo', weight: 3 },      // Código manda
          { name: 'referencia', weight: 2 },  // Referencia técnica original
          { name: 'descripcion', weight: 2 }, // Luego descripción
          { name: 'marca', weight: 1 }       // Marca al final
        ],
        threshold: 0.2,      // Más estricto (0.3 era muy permisivo)
        location: 0,         // Buscar preferiblemente al inicio
        distance: 100,
        useExtendedSearch: true
      })

      const results = fuse.search(b).map(r => r.item)
      return results.slice(0, 100)
    },
    [busq], []
  ) || []

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

  const handleAddPay = (stayOpen = true) => {
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
  }

  const handleKeypad = (val) => {
    let newBuffer = keypadBuffer
    if (val === 'DEL') {
      newBuffer = newBuffer.slice(0, -1)
    } else if (val === '.') {
      if (!newBuffer.includes('.')) newBuffer += '.'
    } else {
      newBuffer += val
    }
    setKeypadBuffer(newBuffer)

    // Update payForm based on buffer
    if (activeCurrency === 'USD') {
      updatePayAmount(newBuffer, true)
    } else {
      updatePayAmount(newBuffer, false)
    }
  }

  const updatePayAmount = (val, fromUSD = true) => {
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
        <button className={`flex-1 py-3 text-[10px] font-bold uppercase transition-none ${step === 3 ? 'bg-[var(--teal)] text-white shadow-[var(--win-shadow)]' : 'text-[var(--text2)]'}`} onClick={() => setStep(3)}>
          {['CAJERO', 'ADMIN', 'SUPERVISOR'].includes(currentUser?.rol) ? '3. Pago' : '3. Enviar'}
        </button>
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
                cart={cart} removeFromCart={removeFromCart} updateQty={updateQty}
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
                procesarNota={procesarNota} clienteFact={clienteFact} setClienteFact={setClienteFact}
                currentUser={currentUser} enviarCajaCentral={enviarCajaCentral}
                setShowNotasModal={setShowNotasModal} notasPendientes={notasPendientes} fetchNotasVendedores={fetchNotasVendedores}
                loading={loading}
              />
            )}

          </div>

          {/* DESKTOP VIEW (HIDDEN ON MOBILE) */}
          {/* COLUMNA 1: CATALOGO */}
          <div className="hidden lg:flex lg:flex-1 h-full min-w-0">
            <Catalogo
              busq={busq} setBusq={setBusq}
              showDrop={showDrop} setShowDrop={setShowDrop}
              articulos={articulos} addToCart={addToCart} addGeneric={addGeneric}
              cart={cart} removeFromCart={removeFromCart} updateQty={updateQty}
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
              handleEditPay={handleEditPay}
              tasa={tasa} vencFact={vencFact} setVencFact={setVencFact}
              procesarCotizacion={procesarCotizacion} clearCart={clearCart}
              procesarNota={procesarNota} clienteFact={clienteFact} setClienteFact={setClienteFact}
              currentUser={currentUser} enviarCajaCentral={enviarCajaCentral}
              setShowNotasModal={setShowNotasModal} notasPendientes={notasPendientes} fetchNotasVendedores={fetchNotasVendedores}
              loading={loading}
            />
          </div>

          {/* COLUMNA 4: ACCESOS RÁPIDOS CONFIGURABLES */}
          <QuickAccessBar tasa={tasa} navigate={navigate} currentUser={currentUser} />
        </div>
      </div>

      {/* MODALS */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="" noPadding hideHeader>
        {(() => {
          const totalVenta = cartTotal()
          const yaPagado = paymentsTotal()
          const saldo = Math.max(0, totalVenta - yaPagado)

          return (
            <div className="flex flex-col bg-[#F4F6F8] rounded-3xl overflow-hidden max-w-[440px] mx-auto shadow-2xl scale-[0.98]">
              {/* HEADER PERSONALIZADO */}
              <div className="flex items-center justify-between p-4 bg-white border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                    <span className="material-icons-round text-[#F36E25]">payments</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-[#131E2E] leading-tight">Registro de Pagos</h2>
                    <p className="text-sm font-bold text-[#131E2E] opacity-90">Múltiples</p>
                  </div>
                </div>
                <button onClick={() => setShowPaymentModal(false)} className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-400 transition-colors">
                  <span className="material-icons-round">close</span>
                </button>
              </div>

              {/* DASHBOARD DE SALDOS */}
              <div className="p-4 bg-orange-50/30">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">TOTAL VENTA</p>
                    <p className="text-base font-black text-[#131E2E]">
                      {activeCurrency === 'USD' ? fmtUSD(totalVenta) : fmtBS(totalVenta * tasa)}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 relative">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">ABONADO</p>
                    <p className="text-base font-black text-[var(--green-var)]">
                      {activeCurrency === 'USD' ? fmtUSD(yaPagado) : fmtBS(yaPagado * tasa)}
                    </p>
                    {payments.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-[var(--green-var)] text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">{payments.length}</span>
                    )}
                  </div>
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 relative">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">FALTA POR PAGAR</p>
                    <p className="text-base font-black text-[#F36E25]">
                      {activeCurrency === 'USD' ? fmtUSD(saldo) : fmtBS(saldo * tasa)}
                    </p>
                  </div>
                </div>
              </div>

              {/* CONTENIDO PRINCIPAL DIVIDIDO */}
              <div className="flex flex-1 min-h-[380px]">
                {/* COLUMNA IZQUIERDA: MÉTODOS Y LISTA */}
                <div className="flex-1 p-4 space-y-4 border-r border-slate-200/60">
                  {/* SWITCHER MONEDA */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button
                        onClick={() => {
                          if (activeCurrency === 'BS' && keypadBuffer) {
                            const converted = (parseFloat(keypadBuffer) / tasa).toFixed(2)
                            setKeypadBuffer(converted === '0.00' ? '' : converted)
                          }
                          setActiveCurrency('USD')
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${activeCurrency === 'USD' ? 'bg-white text-[#F36E25] shadow-sm' : 'text-slate-400'}`}>
                        USD
                      </button>
                      <button
                        onClick={() => {
                          if (activeCurrency === 'USD' && keypadBuffer) {
                            const converted = (parseFloat(keypadBuffer) * tasa).toFixed(2)
                            setKeypadBuffer(converted === '0.00' ? '' : converted)
                          }
                          setActiveCurrency('BS')
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${activeCurrency === 'BS' ? 'bg-white text-[#F36E25] shadow-sm' : 'text-slate-400'}`}>
                        BS
                      </button>
                    </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">MÉTODO DE PAGO</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'EFECTIVO_USD', label: 'Efectivo $', icon: 'payments', currency: 'USD' },
                        { id: 'EFECTIVO_BS', label: 'Efectivo Bs', icon: 'money', currency: 'BS' },
                        { id: 'PUNTO_VENTA', label: 'Tarjeta', icon: 'credit_card', currency: 'BS' },
                        { id: 'ZELLE', label: 'Zelle', icon: 'bolt', currency: 'USD' },
                        { id: 'PAGO_MOVIL', label: 'Pago Móvil', icon: 'smartphone', currency: 'BS' },
                        { id: 'TRANSFERENCIA_BS', label: 'Transf. Bs', icon: 'account_balance', currency: 'BS' },
                        { id: 'CUPON', label: 'Cupón', icon: 'confirmation_number', currency: 'ANY' },
                        { id: 'OTRO', label: 'Otro', icon: 'more_horiz', currency: 'ANY' },
                      ]
                        .filter(m => m.currency === 'ANY' || m.currency === activeCurrency)
                        .map(m => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setPayForm({ ...payForm, metodo: m.id });
                              if (m.currency !== 'ANY' && m.currency !== activeCurrency) {
                                // Convertir el monto al cambiar de método/moneda
                                if (keypadBuffer) {
                                  const n = parseFloat(keypadBuffer) || 0
                                  const converted = m.currency === 'BS' ? (n * tasa).toFixed(2) : (n / tasa).toFixed(2)
                                  setKeypadBuffer(converted === '0.00' ? '' : converted)
                                }
                                setActiveCurrency(m.currency);
                              }
                            }}
                            className={`flex flex-col items-center justify-center p-2 rounded-2xl border-2 transition-all aspect-square
                              ${payForm.metodo === m.id ? 'border-[#F36E25] bg-white shadow-md scale-105' : 'border-transparent bg-white/50 opacity-60'}`}
                          >
                            <span className={`material-icons-round text-lg ${payForm.metodo === m.id ? 'text-[#F36E25]' : 'text-slate-400'}`}>{m.icon}</span>
                            <span className={`text-[9px] font-black mt-1 ${payForm.metodo === m.id ? 'text-[#131E2E]' : 'text-slate-400'}`}>{m.label}</span>
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* PAGOS APLICADOS */}
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">PAGOS APLICADOS</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {payments.length === 0 ? (
                        <p className="text-[10px] font-bold text-slate-300 text-center py-4 italic">No hay pagos registrados</p>
                      ) : (
                        payments.map(p => (
                          <div
                            key={p.id}
                            onClick={() => handleEditPay(p)}
                            className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100 shadow-sm hover:border-[#F36E25] cursor-pointer group transition-all"
                          >
                            <div className="flex items-center gap-2">
                              <span className="material-icons-round text-[var(--green-var)] text-sm group-hover:text-[#F36E25]">check_circle</span>
                              <span className="text-[10px] font-black text-[#131E2E] uppercase tracking-tight">{p.metodo.replace(/_/g, ' ')}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-black text-[#131E2E]">{fmtUSD(p.monto)}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); removePayment(p.id) }}
                                className="text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <span className="material-icons-round text-sm">delete</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* COLUMNA DERECHA: KEYPAD */}
                <div className="w-[170px] p-4 bg-white/40 flex flex-col">
                  <div className="mb-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">MONTO A INGRESA</p>
                    <div className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center bg-white shadow-sm
                      ${keypadBuffer ? 'border-[#F36E25]' : 'border-slate-100'}`}>
                      <div className="flex items-center">
                        <span className="text-xs font-black text-slate-400 mr-1">{activeCurrency === 'USD' ? '$' : 'Bs'}</span>
                        <span className="text-xl font-mono font-black text-[#131E2E]">{keypadBuffer || '0.00'}</span>
                      </div>
                      {keypadBuffer && parseFloat(keypadBuffer) > 0 && (
                        <div className="text-[10px] font-mono font-bold text-slate-400 leading-none mt-1">
                          {activeCurrency === 'USD' 
                            ? `Bs ${(parseFloat(keypadBuffer) * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `$ ${(parseFloat(keypadBuffer) / tasa).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          }
                        </div>
                      )}
                    </div>
                  </div>

                  {/* KEYPAD NUMÉRICO */}
                  <div className="grid grid-cols-3 gap-2 flex-1 mb-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, 'DEL'].map(val => (
                      <button
                        key={val}
                        onClick={() => handleKeypad(val)}
                        className={`w-full aspect-square rounded-2xl font-black text-lg transition-all flex items-center justify-center
                          ${val === 'DEL' ? 'bg-slate-50 text-slate-500' : 'bg-white text-[#131E2E] shadow-sm hover:scale-110 active:scale-95 border border-slate-100'}`}
                      >
                        {val === 'DEL' ? <span className="material-icons-round">backspace</span> : val}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleAddPay(true)}
                    disabled={!keypadBuffer || parseFloat(keypadBuffer) <= 0}
                    className="w-full py-4 bg-[#F36E25] hover:bg-[#e05d1a] disabled:opacity-30 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2">
                    Añadir Pago
                  </button>
                </div>
              </div>

              {/* FOOTER */}
              <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-4 border-2 border-slate-100 rounded-2xl font-black text-xs text-[#131E2E] uppercase tracking-widest hover:bg-slate-50 transition-all">
                  Volver
                </button>
                <button
                  onClick={() => {
                    if (payForm.montoUSD > 0 && keypadBuffer) handleAddPay(false)
                    else setShowPaymentModal(false)
                  }}
                  className="flex-[1.5] py-4 bg-[#131E2E] text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl shadow-slate-200">
                  Confirmar Pagos
                  <span className="material-icons-round text-base">verified_user</span>
                </button>
              </div>
            </div>
          )
        })()}
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

const ALL_SHORTCUTS = (rol) => {
  const base = [
    { icon: 'receipt', label: 'Facturación', path: '/facturacion' },
    { icon: 'inventory_2', label: 'Inventario', path: '/inventario' },
    { icon: 'people', label: 'Clientes', path: '/clientes' },
    { icon: 'request_quote', label: 'Cotizaciones', path: '/cotizaciones' },
  ]
  const adminSolo = [
    { icon: 'local_shipping', label: 'Proveedores', path: '/proveedores' },
    { icon: 'receipt_long', label: 'Reportes', path: '/reportes' },
    { icon: 'point_of_sale', label: 'Caja', path: '/caja' },
    { icon: 'assignment_return', label: 'Devoluciones', path: '/devoluciones' },
    { icon: 'shopping_cart', label: 'Compras', path: '/compras' },
    { icon: 'account_balance_wallet', label: 'Caja Chica', path: '/caja-chica' },
    { icon: 'account_balance', label: 'Ctas x Cobrar', path: '/cuentas-cobrar' },
    { icon: 'summarize', label: 'Cierre', path: '/cierre' },
    { icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
    { icon: 'security', label: 'Auditoría', path: '/auditoria' },
  ]

  if (['CAJERO', 'ADMIN', 'SUPERVISOR'].includes(rol)) {
    return [...base, ...adminSolo]
  }
  return base
}

const DEFAULT_PATHS = ['/inventario', '/clientes', '/reportes', '/caja', '/devoluciones']

function QuickAccessBar({ tasa, navigate, currentUser }) {
  const [editing, setEditing] = useState(false)
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('quick_access_buttons')
      return saved ? JSON.parse(saved) : DEFAULT_PATHS
    } catch { return DEFAULT_PATHS }
  })

  const toggle = (path) => {
    setEnabled(prev => {
      const next = prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
      localStorage.setItem('quick_access_buttons', JSON.stringify(next))
      return next
    })
  }

  const roleShortcuts = ALL_SHORTCUTS(currentUser?.rol)
  const visibleButtons = roleShortcuts.filter(s => enabled.includes(s.path))

  return (
    <div className={`h-full hidden lg:flex lg:flex-col lg:flex-none bg-[var(--surface)] border-l border-[var(--border-var)] items-center pt-3 relative transition-all duration-300 ${editing ? 'lg:w-[200px]' : 'lg:w-[60px]'}`}>

      {/* MODO NORMAL */}
      {!editing && (
        <>
          <div className="flex flex-col gap-2 p-2 items-center flex-1 overflow-y-auto custom-scroll w-full">
            {visibleButtons.map(a => (
              <button key={a.path} onClick={() => navigate(a.path)} title={a.label}
                className="w-11 h-11 flex flex-col items-center justify-center bg-[var(--surface2)] border border-[var(--border-var)] hover:border-[var(--teal)] hover:bg-[var(--teal)]/10 text-[var(--text2)] hover:text-[var(--teal)] transition-all group cursor-pointer rounded-xl shrink-0"
              >
                <span className="material-icons-round text-[18px] group-hover:scale-110 transition-transform">{a.icon}</span>
              </button>
            ))}
            {visibleButtons.length === 0 && (
              <div className="text-[7px] font-black text-[var(--text2)] opacity-30 uppercase text-center mt-4 px-1">
                Sin accesos
              </div>
            )}
          </div>
          <div className="shrink-0 pb-2 pt-2 text-center border-t border-[var(--border-var)] w-full">
            <div className="text-[7px] font-black text-[var(--text2)] opacity-40 uppercase tracking-tighter">TASA</div>
            <div className="text-[9px] font-mono font-black text-[var(--teal)]">{tasa.toFixed(0)}</div>
          </div>
          <button onClick={() => setEditing(true)} title="Configurar accesos"
            className="shrink-0 w-11 h-11 mb-2 flex items-center justify-center text-[var(--text2)] hover:text-[var(--teal)] hover:bg-[var(--teal)]/10 rounded-xl transition-all cursor-pointer opacity-40 hover:opacity-100"
          >
            <span className="material-icons-round text-[16px]">settings</span>
          </button>
        </>
      )}

      {/* MODO EDICIÓN */}
      {editing && (
        <div className="flex flex-col h-full w-full">
          <div className="p-3 border-b border-[var(--border-var)] bg-[var(--teal)]/5 shrink-0">
            <div className="text-[9px] font-black text-[var(--teal)] uppercase tracking-widest flex items-center gap-1">
              <span className="material-icons-round text-xs">tune</span>
              Personalizar
            </div>
            <div className="text-[7px] text-[var(--text2)] mt-1 font-bold">Selecciona tus accesos rápidos</div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll p-2 space-y-1">
            {roleShortcuts.map(s => (
              <label key={s.path}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-[10px] font-bold uppercase tracking-tight
                  ${enabled.includes(s.path)
                    ? 'bg-[var(--teal)]/10 text-[var(--teal)] border border-[var(--teal)]/30'
                    : 'text-[var(--text2)] hover:bg-[var(--surface2)] border border-transparent'
                  }`}
              >
                <input type="checkbox" checked={enabled.includes(s.path)} onChange={() => toggle(s.path)}
                  className="accent-[var(--teal)] w-3.5 h-3.5 shrink-0 cursor-pointer" />
                <span className="material-icons-round text-sm shrink-0">{s.icon}</span>
                <span className="truncate">{s.label}</span>
              </label>
            ))}
          </div>

          <button onClick={() => setEditing(false)}
            className="shrink-0 m-2 py-2 bg-[var(--teal)] text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[var(--tealDark)] transition-all flex items-center justify-center gap-1"
          >
            <span className="material-icons-round text-sm">check</span>
            Listo
          </button>
        </div>
      )}
    </div>
  )
}
