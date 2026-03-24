import { useState, useEffect, useRef, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router-dom'
import { db } from '../../db/db'
import { fmtUSD, fmtDate, today } from '../../utils/format'
import { printReporte, printLibroVentas, printLibroCompras, printLibroInventarioValorado } from '../../utils/print'
import { useReactToPrint } from 'react-to-print'
import TicketTermico from '../../components/Ticket/TicketTermico'
import TicketCierre from '../../components/Ticket/TicketCierre'
import useStore from '../../store/useStore'
import Modal from '../../components/UI/Modal'
import { btPrinter } from '../../utils/bluetoothPrinter'
import { logAction } from '../../utils/audit'
import { supabase } from '../../lib/supabase'
import { hashPin } from '../../utils/security'


const primerDiaMes = () => {
  const d = new Date(); d.setDate(1)
  return d.toISOString().split('T')[0]
}

export default function Reportes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') || 'ventas'

  const [desde, setDesde] = useState(primerDiaMes())
  const [hasta, setHasta] = useState(today())
  const [tab, setTab] = useState(initialTab)

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t) setTab(t)
  }, [searchParams])

  const changeTab = (newTab) => {
    setTab(newTab)
    setSearchParams({ tab: newTab })
  }
  const [selectedVenta, setSelectedVenta] = useState(null)
  const [showReimprimirModal, setShowReimprimirModal] = useState(false)
  const [selectedCierre, setSelectedCierre] = useState(null)
  const [showCierreModal, setShowCierreModal] = useState(false)
  const [showCierreGeneralModal, setShowCierreGeneralModal] = useState(false)

  // Estados Anulación
  const [showAnularModal, setShowAnularModal] = useState(false)
  const [ventaParaAnular, setVentaParaAnular] = useState(null)
  const [motivoAnulacion, setMotivoAnulacion] = useState('')
  const [pinAnulacion, setPinAnulacion] = useState('')

  const { configEmpresa, loadConfigEmpresa, currentUser, btStatus, setBtStatus, toast } = useStore()
  const ticketRef = useRef()

  const [cloudVentas, setCloudVentas] = useState([])
  const [loadingCloud, setLoadingCloud] = useState(false)
  const [highlightedIds, setHighlightedIds] = useState(new Set())

  // 👤 Filtro por vendedor
  const [filtroVendedor, setFiltroVendedor] = useState('TODOS')

  // ☁️ Estado de Cierres en Nube
  const [cloudCierres, setCloudCierres] = useState([])
  const [loadingCierres, setLoadingCierres] = useState(false)

  // ☁️ Escuchar Ventas de TODOS los Vendedores en Tiempo Real + Carga Inicial por Fecha
  useEffect(() => {
    const fetchCloud = async () => {
      setLoadingCloud(true)
      const { data, error } = await supabase
        .from('facturas')
        .select('*')
        .gte('created_at', desde + 'T00:00:00')
        .lte('created_at', hasta + 'T23:59:59')
        .order('created_at', { ascending: false })
      if (!error && data) {
        setCloudVentas(data)
        console.log(`📊 Reportes: Cargadas ${data.length} ventas desde Supabase (${desde} - ${hasta})`)
      }
      setLoadingCloud(false)
    }

    fetchCloud()

    const channel = supabase.channel('radar-facturas-reporte')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'facturas' }, payload => {
        const newSale = payload.new
        // Solo agregar si está en el rango actual
        const saleDate = new Date(newSale.created_at).toISOString().split('T')[0]
        if (saleDate >= desde && saleDate <= hasta) {
          setCloudVentas(prev => [newSale, ...prev])
          setHighlightedIds(prev => new Set(prev).add(newSale.id))
          setTimeout(() => {
            setHighlightedIds(prev => {
              const next = new Set(prev); next.delete(newSale.id); return next
            })
          }, 10000)
          toast(`🔥 Nueva venta de ${newSale.vendedor || 'un vendedor'}: ${fmtUSD(newSale.total_usd)}`, 'ok')
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [desde, hasta])

  // ☁️ Cargar Cierres de la Nube al cambiar a la pestaña Cierres
  useEffect(() => {
    if (tab !== 'cierres' && cloudCierres.length > 0) return

    const fetchCierres = async () => {
      setLoadingCierres(true)
      const { data, error } = await supabase
        .from('cierres_caja')
        .select('*')
        .order('fecha_apertura', { ascending: false })
      if (!error && data) setCloudCierres(data)
      setLoadingCierres(false)
    }

    if (tab === 'cierres') fetchCierres()
  }, [tab])

  // Cierre General — jala cierres de HOY desde Supabase
  const [cierreGeneralData, setCierreGeneralData] = useState([])
  const [loadingCierreGeneral, setLoadingCierreGeneral] = useState(false)

  useEffect(() => {
    if (!showCierreGeneralModal) return
    const fetchGeneral = async () => {
      setLoadingCierreGeneral(true)
      const hoy = today() // 'YYYY-MM-DD'
      const { data, error } = await supabase
        .from('cierres_caja')
        .select('*')
        .gte('fecha_cierre', hoy + 'T00:00:00')
        .lte('fecha_cierre', hoy + 'T23:59:59')
        .order('fecha_cierre', { ascending: true })
      if (!error && data) setCierreGeneralData(data)
      setLoadingCierreGeneral(false)
    }
    fetchGeneral()
  }, [showCierreGeneralModal])

  useEffect(() => {
    loadConfigEmpresa()
  }, [])

  // ✨ Efecto Glow para el Radar
  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      @keyframes radar-pulse {
        0% { background-color: var(--surface2); }
        20% { background-color: rgba(34, 197, 94, 0.2); box-shadow: inset 0 0 20px rgba(34, 197, 94, 0.15); }
        50% { background-color: rgba(34, 197, 94, 0.1); }
        100% { background-color: var(--surface2); }
      }
      .radar-glow {
        animation: radar-pulse 3s ease-in-out infinite;
        border-left: 4px solid var(--green-var) !important;
        position: relative;
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  const handlePrintTicket = useReactToPrint({
    contentRef: ticketRef,
    documentTitle: `Reimpresion_${selectedVenta?.nro}`,
    onAfterPrint: () => {
      logAction(currentUser, 'REIMPRIMIR_TICKET', { nro: selectedVenta?.nro, metodo: 'RED/CABLE' })
      setShowReimprimirModal(false)
    }
  })

  const reimprimirVenta = async (venta) => {
    // CAMBIO: Si la venta ya trae items (ej. de la nube), usarlos. Si no, buscarlos localmente.
    let items = venta.items || []
    
    if (items.length === 0 && !venta.isCloud) {
      items = await db.venta_items.where('venta_id').equals(venta.id).toArray()
    }

    const u = venta.usuario_id ? await db.usuarios.get(venta.usuario_id) : null

    setSelectedVenta({
      ...venta,
      items,
      cliente_nombre: venta.cliente_nombre || venta.cliente,
      cajero_nombre: u?.nombre || venta.vendedor || 'SISTEMA'
    })

    setShowReimprimirModal(true)
    logAction(currentUser, 'SOLICITUD_REIMPRESION', { nro: venta.nro })
  }

  const handlePrintBT = async () => {
    if (!selectedVenta) return
    toast('🔍 Iniciando Bluetooth...', 'info')
    try {
      if (!btPrinter.isConnected()) {
        setBtStatus('CONNECTING')
        await btPrinter.connect()
        setBtStatus('CONNECTED')
      }
      toast('⏳ Enviando ticket...', 'info')
      await btPrinter.printVenta(selectedVenta, configEmpresa)
      logAction(currentUser, 'REIMPRIMIR_TICKET', { nro: selectedVenta?.nro, metodo: 'BLUETOOTH' })
      toast('✅ Ticket enviado con éxito!', 'ok')
      setShowReimprimirModal(false)
    } catch (error) {
      setBtStatus('DISCONNECTED')
      toast('❌ Error: ' + (error.message || 'Fallo conexión'), 'error')
    }
  }

  const handleAnular = async () => {
    if (!motivoAnulacion.trim()) return toast('Debe ingresar un motivo', 'warn')
    if (!pinAnulacion) return toast('Debe ingresar su PIN', 'warn')

    const hashed = await hashPin(pinAnulacion)
    const sup = await db.usuarios.where('pin').equals(hashed).first()
    if (!sup || !['ADMIN', 'SUPERVISOR'].includes(sup.rol)) {
      return toast('PIN de supervisor inválido', 'error')
    }

    const { anularVenta } = useStore.getState()
    if (!ventaParaAnular.id) return toast('No se puede anular una venta sin ID local', 'error')
    const ok = await anularVenta(ventaParaAnular.id, motivoAnulacion, sup)
    if (ok) {
      setShowAnularModal(false)
      setVentaParaAnular(null)
      setMotivoAnulacion('')
      setPinAnulacion('')
    }
  }

  /* Comentado: Ventas ahora se leen de Supabase directamente
  const ventas = useLiveQuery(
    () => db.ventas.filter(v => {
      const d = new Date(v.fecha).toISOString().split('T')[0]
      return d >= desde && d <= hasta
    }).toArray(),
    [desde, hasta], []
  )
  */

  const articulos = useLiveQuery(() => db.articulos.toArray().then(arr => [...arr].sort((a, b) => (a.stock || 0) - (b.stock || 0))), [], [])
  const ctas_cobrar = useLiveQuery(() => db.ctas_cobrar.where('estado').anyOf('PENDIENTE', 'PARCIAL').toArray(), [], [])
  const ctas_pagar = useLiveQuery(() => db.ctas_pagar.where('estado').anyOf('PENDIENTE', 'PARCIAL').toArray(), [], [])
  const abonos = useLiveQuery(() => db.abonos.toArray(), [], [])
  const cierres = useLiveQuery(() => db.sesiones_caja.where('estado').equals('CERRADA').toArray().then(arr => [...arr].reverse()), [], [])

  // 🔄 Unificar Cierres (Locales + Nube)
  const allCierres = useMemo(() => {
    const myDeviceId = localStorage.getItem('deviceId') || 'DEV-UNKNOWN'

    const merged = [...cierres.map(c => ({ ...c, isCloud: false, terminal_nombre: myDeviceId }))]

    cloudCierres.forEach(cc => {
      // Solo omitimos si es de ESTE dispositivo y ya existe localmente
      const isMio = cc.id_sesion_local?.startsWith(`${myDeviceId}-`)
      const localId = isMio ? Number(cc.id_sesion_local.substring(myDeviceId.length + 1)) : null
      const yaLoTengoLocal = isMio && merged.find(c => c.id === localId)

      if (!yaLoTengoLocal) {
        merged.push({
          id: cc.id_sesion_local || cc.id,
          fecha_apertura: cc.fecha_apertura,
          fecha_cierre: cc.fecha_cierre,
          usuario: cc.usuario || 'SISTEMA',
          terminal_nombre: cc.terminal_nombre || cc.id_sesion_local?.split('-')[0] || 'NUBE',
          notas_del_dia: Array(cc.notas_count || 0).fill(1),
          cierre_z: cc.desglose || { esperadoUsd: cc.ventas_totales_usd, esperadoBs: cc.efectivo_bs },
          monto_inicial_usd: cc.desglose?.inicialUsd ?? 0,
          monto_inicial_bs: cc.desglose?.inicialBs ?? 0,
          monto_fisico_usd: cc.monto_fisico_usd ?? cc.desglose?.fisicoUsd ?? 0,
          diferencia_usd: cc.diferencia_usd,
          diferencia_bs: cc.diferencia_bs,
          isCloud: true
        })
      }
    })

    return merged.sort((a, b) => new Date(b.fecha_apertura) - new Date(a.fecha_apertura))
  }, [cierres, cloudCierres])

  // 📊 Datos para P&L (Estado de Resultados)
  const devolucionesPeriodo = useLiveQuery(
    () => db.ventas.filter(v => {
      const d = new Date(v.fecha).toISOString().split('T')[0]
      return v.estado === 'ANULADA' && d >= desde && d <= hasta
    }).toArray(),
    [desde, hasta], []
  )

  const gastosPeriodo = useLiveQuery(
    () => db.caja_chica.filter(g => {
      const d = (g.fecha instanceof Date ? g.fecha : new Date(g.fecha)).toISOString().split('T')[0]
      return d >= desde && d <= hasta
    }).toArray(),
    [desde, hasta], []
  )

  const allVentaItems = useLiveQuery(
    async () => {
      const currentVentas = await db.ventas.filter(v => {
        const d = new Date(v.fecha).toISOString().split('T')[0]
        return v.estado !== 'ANULADA' && d >= desde && d <= hasta
      }).toArray()
      const ids = currentVentas.map(v => v.id)
      return db.venta_items.where('venta_id').anyOf(ids).toArray()
    },
    [desde, hasta], []
  )

  const allVentas = useMemo(() => {
    return cloudVentas.map(cv => ({
      id: cv.id,
      nro: cv.numero,
      fecha: cv.created_at,
      cliente: cv.cliente || cv.cliente_nombre,
      cliente_nombre: cv.cliente_nombre, // Mantener para consistencia si se usa en otros lados
      tipo_pago: cv.metodo_pago,
      total: cv.total_usd,
      tasa: cv.tasa_bcv || 1,             // CAMBIO: Asegurar tasa de la nube
      subtotal: cv.subtotal_usd || cv.total_usd, // CAMBIO: Fallback al total si no hay subtotal
      iva: cv.iva_usd || 0,               // CAMBIO: Asegurar IVA
      igtf: cv.igtf_usd || 0,
      pagos: cv.pagos_json || [],         // CAMBIO: Recuperar pagos detallados
      items: cv.items || [],
      vendedor: cv.vendedor,
      estado: cv.estado || 'CLOUD',
      isCloud: true
    })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  }, [cloudVentas])

  // 👤 Lista única de vendedores para el dropdown
  const vendedoresUnicos = useMemo(() => {
    const set = new Set()
    allVentas.forEach(v => {
      const nombre = v.vendedor || v.cajero_nombre || 'SISTEMA'
      if (nombre) set.add(nombre)
    })
    return [...set].sort()
  }, [allVentas])

  // 👤 Ventas filtradas por vendedor seleccionado
  const allVentasFiltradas = useMemo(() => {
    if (filtroVendedor === 'TODOS') return allVentas
    return allVentas.filter(v => {
      const nombre = v.vendedor || v.cajero_nombre || 'SISTEMA'
      return nombre === filtroVendedor
    })
  }, [allVentas, filtroVendedor])

  // 👤 Ranking de ventas por cajero/vendedor
  const resumenPorVendedor = useMemo(() => {
    const mapa = {}
    allVentas.filter(v => v.estado !== 'ANULADA').forEach(v => {
      const nombre = v.vendedor || v.cajero_nombre || 'SISTEMA'
      if (!mapa[nombre]) mapa[nombre] = { total: 0, notas: 0 }
      mapa[nombre].total += v.total || 0
      mapa[nombre].notas += 1
    })
    return Object.entries(mapa)
      .map(([nombre, datos]) => ({ nombre, ...datos }))
      .sort((a, b) => b.total - a.total)
  }, [allVentas])

  const totalVentas = allVentasFiltradas.filter(v => v.estado !== 'ANULADA').reduce((s, v) => s + (v.total || 0), 0)

  const porCobrarTotal = ctas_cobrar.reduce((s, c) => {
    const pagos = abonos.filter(a => a.cuenta_id === c.id && a.tipo_cuenta === 'COBRAR').reduce((sum, a) => sum + a.monto, 0)
    return s + (c.monto - pagos)
  }, 0)

  const porPagarTotal = ctas_pagar.reduce((s, c) => {
    const pagos = abonos.filter(a => a.cuenta_id === c.id && a.tipo_cuenta === 'PAGAR').reduce((sum, a) => sum + a.monto, 0)
    return s + (c.monto - pagos)
  }, 0)

  const porTipo = useMemo(() => {
    const acc = {}
    allVentasFiltradas
      .filter(v => v.estado !== 'ANULADA')
      .forEach(v => {
        // 1. Si tiene el desglose detallado (pagos_json), lo usamos para precisión total
        if (v.pagos && v.pagos.length > 0) {
          v.pagos.forEach(p => {
            const metodo = p.metodo || 'OTRO'
            acc[metodo] = (acc[metodo] || 0) + (p.monto || 0)
          })
        } else {
          // 2. Fallback: Normalizar el string tipo_pago
          const metodosUnicos = [...new Set(
            (v.tipo_pago || 'OTRO')
              .split(',')
              .map(m => m.trim())
              .filter(Boolean)
          )]
          
          metodosUnicos.forEach(m => {
            const montoProporcional = v.total / (metodosUnicos.length || 1)
            acc[m] = (acc[m] || 0) + montoProporcional
          })
        }
      })
    return acc
  }, [allVentasFiltradas])

  const agotados = articulos.filter(a => (a.stock || 0) === 0)
  const bajoStock = articulos.filter(a => (a.stock || 0) > 0 && (a.stock || 0) <= 3)

  const handlePrint = () => {
    if (tab === 'ventas') {
      const data = allVentasFiltradas.map(v => [`#${v.nro}`, fmtDate(v.fecha), v.cliente, v.tipo_pago, fmtUSD(v.total)])
      printReporte(`Ventas (${desde} a ${hasta})`, ['NRO', 'FECHA', 'CLIENTE', 'PAGO', 'TOTAL'], data, { 'TOTAL VENTAS $': fmtUSD(totalVentas) })
    } else if (tab === 'inventario') {
      const data = articulos.map(a => [a.codigo, a.descripcion, a.marca, a.stock || 0, fmtUSD(a.precio), fmtUSD((a.stock || 0) * a.precio)])
      const totalInv = articulos.reduce((s, a) => s + (a.stock || 0) * a.precio, 0)
      printReporte('Inventario de Productos', ['CÓDIGO', 'DESCRIPCIÓN', 'MARCA', 'STOCK', 'PRECIO', 'VALOR'], data, { 'VALOR TOTAL INVENTARIO': fmtUSD(totalInv) })
    } else if (tab === 'cobrar') {
      const data = ctas_cobrar.map(c => {
        const pagos = abonos.filter(a => a.cuenta_id === c.id && a.tipo_cuenta === 'COBRAR').reduce((sum, a) => sum + a.monto, 0)
        return [c.cliente, fmtUSD(c.monto), fmtUSD(c.monto - pagos), fmtDate(c.vencimiento)]
      })
      printReporte('Cuentas por Cobrar Pendientes', ['CLIENTE', 'TOTAL', 'PENDIENTE', 'VENCIMIENTO'], data, { 'TOTAL POR COBRAR': fmtUSD(porCobrarTotal) })
    } else if (tab === 'pagar') {
      const data = ctas_pagar.map(c => {
        const pagos = abonos.filter(a => a.cuenta_id === c.id && a.tipo_cuenta === 'PAGAR').reduce((sum, a) => sum + a.monto, 0)
        return [c.proveedor, c.concepto, fmtUSD(c.monto), fmtUSD(c.monto - pagos), fmtDate(c.vencimiento)]
      })
      printReporte('Cuentas por Pagar Pendientes', ['PROVEEDOR', 'CONCEPTO', 'TOTAL', 'PENDIENTE', 'VENCIMIENTO'], data, { 'TOTAL POR PAGAR': fmtUSD(porPagarTotal) })
    } else if (tab === 'cierres') {
      const data = allCierres.map(c => [
        fmtDate(c.fecha_apertura),
        c.isCloud ? `${c.usuario} (${c.terminal_nombre || 'NUBE'})` : (c.usuario || '—'),
        c.notas_del_dia?.length || 0,
        fmtUSD(c.cierre_z?.esperadoUsd || 0),
        fmtUSD(c.diferencia_usd || 0)
      ])
      printReporte('Historial Global de Cierres Z', ['FECHA', 'CAJERO', 'NOTAS', 'TOTAL USD', 'DIFERENCIA'], data)
    } else if (tab === 'pyl') {
      const ventasBrutas = totalVentas
      const totalDev = devolucionesPeriodo.reduce((s, d) => s + (d.total || 0), 0)
      const ventasNetas = ventasBrutas - totalDev
      const cmv = allVentaItems.reduce((s, i) => s + ((i.costo || 0) * (i.qty || 0)), 0)
      const utilBruta = ventasNetas - cmv
      const totalGst = gastosPeriodo.reduce((s, g) => s + g.monto, 0)
      const utilNeta = utilBruta - totalGst
      const margenB = ventasNetas > 0 ? (utilBruta / ventasNetas * 100).toFixed(1) : '0.0'
      const margenN = ventasNetas > 0 ? (utilNeta / ventasNetas * 100).toFixed(1) : '0.0'

      const data = [
        ['Ventas Brutas', '', '', fmtUSD(ventasBrutas)],
        ['(-) Devoluciones', '', '', fmtUSD(totalDev)],
        ['VENTAS NETAS', '', '', fmtUSD(ventasNetas)],
        ['', '', '', ''],
        ['(-) Costo Mercancía Vendida', '', '', fmtUSD(cmv)],
        ['UTILIDAD BRUTA', '', `${margenB}%`, fmtUSD(utilBruta)],
        ['', '', '', ''],
      ]
      // Gastos por categoría
      const gastosMap = {}
      gastosPeriodo.forEach(g => { const c = g.categoria || 'SIN_CAT'; gastosMap[c] = (gastosMap[c] || 0) + g.monto })
      Object.entries(gastosMap).sort((a, b) => b[1] - a[1]).forEach(([cat, m]) => {
        data.push([`  (-) ${cat}`, '', '', fmtUSD(m)])
      })
      data.push(['TOTAL GASTOS OPERATIVOS', '', '', fmtUSD(totalGst)])
      data.push(['', '', '', ''])
      data.push(['UTILIDAD NETA', '', `${margenN}%`, fmtUSD(utilNeta)])

      printReporte(`Estado de Resultados (${desde} a ${hasta})`, ['CONCEPTO', '', 'MARGEN', 'MONTO'], data, { 'UTILIDAD NETA': fmtUSD(utilNeta) })
    }
  }

  const exportLibroVentas = () => {
    const periodo = `${desde} al ${hasta}`
    printLibroVentas(allVentasFiltradas.filter(v => v.estado !== 'ANULADA'), periodo, configEmpresa)
  }

  const exportLibroCompras = async () => {
    const compras = await db.compras.filter(c => {
      const d = new Date(c.fecha).toISOString().split('T')[0]
      return d >= desde && d <= hasta
    }).toArray()
    const periodo = `${desde} al ${hasta}`
    printLibroCompras(compras, periodo, configEmpresa)
  }

  const exportLibroInventario = () => {
    const periodo = `${desde} al ${hasta}`
    printLibroInventarioValorado(articulos, periodo, configEmpresa)
  }

  const exportToCSV = () => {
    const headers = ['FECHA', 'NOTA', 'CLIENTE', 'FORMA', 'TOTAL $', 'VENDEDOR', 'ESTADO']
    const rows = allVentas.map(v => [
      new Date(v.fecha).toLocaleString(),
      v.nro,
      v.cliente,
      v.tipo_pago,
      v.total.toFixed(2),
      v.vendedor || 'SISTEMA',
      v.estado
    ])

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `Ventas_${desde}_al_${hasta}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast('📂 CSV descargado con éxito', 'ok')
  }

  const sendWhatsappStatement = (c) => {
    const pagos = abonos.filter(a => a.cuenta_id === c.id && a.tipo_cuenta === 'COBRAR').reduce((sum, a) => sum + a.monto, 0)
    const pendiente = c.monto - pagos
    const text = encodeURIComponent(`*ESTADO DE CUENTA - KEYMASTER*\n\nHola ${c.cliente}, le saludamos de Automotores Guaicaipuro.\n\nLe informamos que mantiene una deuda pendiente por un valor de *${fmtUSD(pendiente)}*.\n\nVencimiento: ${fmtDate(c.vencimiento)}\n\nPor favor, contacte con nosotros para coordinar su pago. ¡Gracias!`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const Stat = ({ label, value, sub, color = 'text-[var(--teal)]' }) => (
    <div className="panel flex flex-col justify-center border-l-4 transition-none" style={{ borderColor: 'var(--teal)' }}>
      <div className="text-[10px] text-[var(--text2)] tracking-widest uppercase mb-1 font-bold">{label}</div>
      <div className={`text-2xl font-bold text-[var(--text-main)] ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-[var(--text2)] font-medium mt-1 uppercase tracking-tighter">{sub}</div>}
    </div>
  )

  return (
    <div className="space-y-4 pr-2">
      {/* Filtros fecha */}
      <div className="panel flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="field" style={{ margin: 0 }}>
            <label>Desde</label>
            <input type="date" className="inp !py-2 !px-3 w-40" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Hasta</label>
            <input type="date" className="inp !py-2 !px-3 w-40" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
        </div>
        {/* Filtro Vendedor — solo visible en tab ventas */}
        {tab === 'ventas' && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2 py-1">
            <span className="material-icons-round text-sm text-slate-400">person</span>
            <select
              className="bg-transparent border-none text-[11px] font-black text-slate-600 focus:ring-0 pr-1 cursor-pointer"
              value={filtroVendedor}
              onChange={e => setFiltroVendedor(e.target.value)}
            >
              <option value="TODOS">TODOS LOS VENDEDORES</option>
              {vendedoresUnicos.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2 w-full sm:w-auto">
          {tab === 'ventas' && (
            <>
              <button onClick={exportToCSV} className="btn bg-white text-slate-600 border border-slate-200 hover:border-emerald-600 hover:text-emerald-700 transition-all shadow-sm w-full sm:w-auto cursor-pointer">
                <span className="material-icons-round text-base text-emerald-600">grid_on</span>
                <span>Exportar CSV</span>
              </button>
              <button onClick={exportLibroVentas} className="btn bg-[#0d9488] text-white hover:bg-[#0b7a6f] transition-all shadow-lg w-full sm:w-auto cursor-pointer font-black">
                <span className="material-icons-round text-base">file_download</span>
                <span>Libro Ventas</span>
              </button>
            </>
          )}
          {tab === 'inventario' && (
            <button onClick={exportLibroInventario} className="btn bg-[#0d9488] text-white hover:bg-[#0b7a6f] transition-all shadow-lg w-full sm:w-auto cursor-pointer font-black">
              <span className="material-icons-round text-base">inventory</span>
              <span>Exportar Valorado</span>
            </button>
          )}
          {tab === 'pyl' && (
            <button onClick={exportLibroCompras} className="btn bg-[#0d9488] text-white hover:bg-[#0b7a6f] transition-all shadow-lg w-full sm:w-auto cursor-pointer font-black">
              <span className="material-icons-round text-base">shopping_cart</span>
              <span>Libro Compras</span>
            </button>
          )}
          <button onClick={handlePrint} className="btn btn-r w-full sm:w-auto cursor-pointer">
            <span className="material-icons-round text-base">print</span>
            <span>Imprimir Reporte</span>
          </button>
        </div>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total Ventas" value={fmtUSD(totalVentas)} sub={`${allVentas.length} notas emitidas`} />
        <Stat label="Por Cobrar" value={fmtUSD(porCobrarTotal)}
          sub={`${ctas_cobrar.length} pendientes`} color="text-[var(--orange-var)]" />
        <Stat label="Por Pagar" value={fmtUSD(porPagarTotal)}
          sub={`${ctas_pagar.length} cuentas`} color="text-[var(--red-var)]" />
        <Stat label="Críticos" value={agotados.length}
          sub={`${bajoStock.length} bajo stock`} color="text-[var(--orange-var)]" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--surface)] p-1 border border-[var(--border-var)] shadow-[var(--win-shadow)] w-fit">
        {[
          ['ventas', 'assignment'], ['inventario', 'inventory_2'],
          ['cobrar', 'payments'], ['pagar', 'account_balance'],
          ['cierres', 'point_of_sale'], ['pyl', 'analytics']
        ].map(([k, icon]) => (
          <button key={k} onClick={() => changeTab(k)}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-none flex items-center gap-2 cursor-pointer 
            ${tab === k ? 'bg-[var(--teal)] text-[var(--surface)] shadow-[var(--win-shadow)] border border-[var(--tealDark)]' : 'text-[var(--text2)] hover:text-[var(--text-main)] hover:bg-[var(--surfaceDark)] border border-transparent'}`}>
            <span className="material-icons-round text-base">{icon}</span>
            <span className="hidden sm:inline">{k}</span>
          </button>
        ))}
      </div>

      {tab === 'ventas' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="panel overflow-hidden flex flex-col p-0">
            <div className="flex justify-between items-center p-4 border-b border-[var(--border-var)] bg-[var(--surface2)]">
              <div className="panel-title mb-0">Detalle de Ventas</div>
              <div className="text-[10px] text-[var(--text2)] font-bold uppercase tracking-widest">{allVentas.length} registros</div>
            </div>
            {/* Mobile cards */}
            <div className="block md:hidden divide-y divide-[var(--border-var)]">
              {allVentasFiltradas.map(v => (
                <div key={v.id} className={`p-4 active:bg-[var(--surfaceDark)] hover:bg-[var(--surface2)] transition-none cursor-pointer ${highlightedIds.has(v.id) ? 'radar-glow' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[var(--teal)] font-bold text-sm">#{v.nro}</span>
                        <span className={`badge ${v.estado === 'ANULADA' ? 'badge-r' : v.tipo_pago === 'CREDITO' ? 'badge-y' : 'badge-g'}`}>
                          {v.estado === 'ANULADA' ? 'ANULADA' : v.tipo_pago}
                        </span>
                        {v.isCloud && <span className="text-[8px] bg-[var(--teal)] text-white px-1 rounded font-black">NUBE</span>}
                      </div>
                      <p className="font-bold text-[var(--text-main)] text-sm">{v.cliente}</p>
                      <p className="text-[10px] text-[var(--text2)]">{fmtDate(v.fecha)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-[var(--text-main)]">{fmtUSD(v.total)}</div>
                      <button onClick={() => reimprimirVenta(v)} className="mt-1 bg-[var(--surface)] border border-[var(--border-var)] hover:bg-[var(--surfaceDark)] text-[var(--text-main)] px-2 py-1 rounded-none text-[9px] font-black cursor-pointer shadow-[var(--win-shadow)]">🖨️</button>
                    </div>
                  </div>
                </div>
              ))}
              {allVentasFiltradas.length === 0 && <div className="text-center text-[var(--text2)] py-12 text-[10px] font-bold uppercase">No se encontraron ventas</div>}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto min-h-[400px]">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">N° Nota</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Fecha</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Cliente</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Forma</th>
                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Total</th>
                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allVentasFiltradas.map(v => (
                    <tr key={v.id} className={`hover:bg-slate-50 transition-colors ${highlightedIds.has(v.id) ? 'radar-glow shadow-inner' : ''}`}>
                      <td className="p-4 font-mono text-[#0d9488] font-black">#{v.nro}</td>
                      <td className="p-4 text-[11px] text-slate-500 font-bold">{fmtDate(v.fecha)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700">{v.cliente}</span>
                          {v.isCloud && <span className="text-[8px] bg-[#0d9488] text-white px-1.5 py-0.5 rounded font-black shadow-sm">NUBE</span>}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex px-2 py-1 text-[9px] font-black uppercase rounded border ${v.estado === 'ANULADA' ? 'bg-red-50 text-red-600 border-red-100' : v.tipo_pago === 'CREDITO' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                          {v.estado === 'ANULADA' ? 'ANULADA' : v.tipo_pago}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-800 text-right font-black text-sm">{fmtUSD(v.total)}</td>
                      <td className="p-4 text-right flex gap-2 justify-end">
                        <button onClick={() => reimprimirVenta(v)} className="bg-white hover:bg-[#0d9488] hover:text-white text-slate-500 border border-slate-200 p-2 rounded transition-all shadow-sm flex items-center gap-1 text-[9px] font-black cursor-pointer">
                          <span className="material-icons-round text-sm">print</span>
                          REIMPRIMIR
                        </button>
                        {v.estado !== 'ANULADA' && ['ADMIN', 'SUPERVISOR'].includes(currentUser?.rol) && !v.isCloud && (
                          <button onClick={() => { setVentaParaAnular(v); setShowAnularModal(true) }} className="bg-white hover:bg-red-600 hover:text-white text-slate-500 border border-slate-200 p-2 rounded transition-all shadow-sm flex items-center gap-1 text-[9px] font-black cursor-pointer">
                            <span className="material-icons-round text-sm">block</span>
                            ANULAR
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {allVentasFiltradas.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-12 tracking-widest text-[10px] font-black uppercase opacity-50">No se encontraron ventas</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="panel">
              <div className="panel-title !mb-6">Distribución de Pagos</div>
              <div className="space-y-5">
                {Object.entries(porTipo).map(([tipo, total]) => {
                  const porc = (total / totalVentas * 100) || 0
                  return (
                    <div key={tipo}>
                      <div className="flex justify-between text-[11px] mb-1.5 font-bold">
                        <span className="text-[var(--text2)] tracking-widest uppercase">{tipo}</span>
                        <span className="text-[var(--text-main)] font-mono">{fmtUSD(total)}</span>
                      </div>
                      <div className="h-1.5 bg-[var(--surface2)] rounded-none overflow-hidden border border-[var(--border-var)]">
                        <div className={`h-full transition-none rounded-none ${tipo === 'CREDITO' ? 'bg-[var(--orange-var)]' : 'bg-[var(--green-var)]'}`}
                          style={{ width: `${porc}%` }} />
                      </div>
                      <div className="text-[9px] text-right text-[var(--text2)] font-bold mt-1 uppercase tracking-tighter">{porc.toFixed(1)}% del total</div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-8 pt-4 border-t border-[var(--border-var)]">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-widest">Gran Total:</span>
                  <span className="text-2xl font-mono font-bold text-[var(--teal)]">{fmtUSD(totalVentas)}</span>
                </div>
              </div>
            </div>

            {/* 👤 RANKING POR VENDEDOR */}
            <div className="panel p-0 overflow-hidden">
              <div className="p-3 border-b border-[var(--border-var)] bg-[var(--surface2)] flex items-center gap-2">
                <span className="material-icons-round text-sm text-[var(--teal)]">leaderboard</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">Ventas por Vendedor</span>
              </div>
              <div className="divide-y divide-[var(--border-var)]">
                {resumenPorVendedor.map((v, i) => (
                  <div key={v.nombre}
                    className={`flex items-center justify-between p-3 cursor-pointer transition-none hover:bg-[var(--surfaceDark)] ${filtroVendedor === v.nombre ? 'bg-[var(--teal)]/10 border-l-2 border-[var(--teal)]' : ''}`}
                    onClick={() => setFiltroVendedor(filtroVendedor === v.nombre ? 'TODOS' : v.nombre)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-[var(--text2)] w-4">{i + 1}</span>
                      <div>
                        <div className="text-[11px] font-black text-[var(--text-main)] uppercase">{v.nombre}</div>
                        <div className="text-[9px] text-[var(--text2)] font-bold">{v.notas} nota{v.notas !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-black text-[var(--teal)] text-sm">{fmtUSD(v.total)}</div>
                      <div className="text-[9px] text-[var(--text2)] font-bold">
                        {totalVentas > 0 ? ((v.total / allVentas.filter(x => x.estado !== 'ANULADA').reduce((s, x) => s + (x.total || 0), 0)) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  </div>
                ))}
                {resumenPorVendedor.length === 0 && (
                  <div className="text-center text-[var(--text2)] py-8 text-[10px] font-bold uppercase">Sin datos</div>
                )}
              </div>
              {filtroVendedor !== 'TODOS' && (
                <div className="p-2 border-t border-[var(--border-var)] bg-[var(--surface2)]">
                  <button
                    onClick={() => setFiltroVendedor('TODOS')}
                    className="w-full text-[9px] font-black uppercase text-[var(--teal)] hover:text-[var(--tealDark)] tracking-widest flex items-center justify-center gap-1"
                  >
                    <span className="material-icons-round text-xs">close</span>
                    Quitar filtro — Ver todos
                  </button>
                </div>
              )}
            </div>

            <div className="bg-[var(--surface2)] border border-[var(--border-var)] p-4 rounded-none shadow-[var(--win-shadow)] relative overflow-hidden">
              <div className="absolute right-0 top-0 w-16 h-full bg-[var(--tealDark)] opacity-10 -skew-x-12 translate-x-4"></div>
              <div className="text-[10px] text-[var(--teal)] font-bold mb-1 tracking-widest uppercase flex items-center gap-1">
                <span className="material-icons-round text-base">info</span>
                <span>Información</span>
              </div>
              <p className="text-[11px] text-[var(--text2)] font-medium">
                Los montos mostrados corresponden a las ventas brutas realizadas entre las fechas seleccionadas.
              </p>
            </div>
          </div>
        </div>
      )
      }

      {
        tab === 'inventario' && (
          <div className="panel p-0 overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-[var(--border-var)] bg-[var(--surface2)]">
              <div className="panel-title mb-0">Estado de Inventario</div>
              <div className="text-[10px] text-[var(--text2)] font-bold uppercase tracking-widest font-mono">{articulos.length} items</div>
            </div>
            {/* Mobile cards */}
            <div className="block md:hidden divide-y divide-[var(--border-var)]">
              {articulos.map(a => (
                <div key={a.id} className="p-4 active:bg-[var(--surfaceDark)] transition-none cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[var(--teal)] font-bold text-[10px]">{a.codigo}</span>
                        <span className={`badge ${(a.stock ?? 0) === 0 ? 'badge-r' : (a.stock ?? 0) <= 3 ? 'badge-y' : 'badge-g'} font-mono !text-[10px]`}>Stock: {a.stock ?? 0}</span>
                      </div>
                      <p className="font-bold text-[var(--text-main)] text-sm leading-tight truncate">{a.descripcion}</p>
                      {a.marca && <p className="text-[10px] text-[var(--text2)] uppercase font-bold mt-0.5">{a.marca}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-[var(--text-main)]">{fmtUSD(a.precio)}</div>
                      <div className="font-mono text-[10px] text-[var(--text2)]">Val: {fmtUSD((a.stock || 0) * a.precio)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto min-h-[400px]">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Cód.</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Descripción</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Marca</th>
                    <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Stock</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Precio</th>
                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {articulos.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-mono text-[#0d9488] font-black">{a.codigo}</td>
                      <td className="p-4 font-bold text-slate-700 text-sm">{a.descripcion}</td>
                      <td className="p-4 text-slate-500 text-[11px] font-black uppercase">{a.marca}</td>
                      <td className="p-4">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={`inline-flex px-2 py-0.5 text-[9px] font-black rounded border ${a.stock > 10 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : a.stock > 3 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                            {a.stock ?? 0} UNIDADES
                          </span>
                          <div className="w-16 h-1 bg-slate-100 rounded-full border border-slate-200 overflow-hidden shadow-inner">
                            <div className={`h-full transition-all duration-500 ${a.stock > 10 ? 'bg-emerald-500' : a.stock > 3 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(100, (a.stock / 20) * 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-[11px] text-slate-500 font-bold">{fmtUSD(a.precio)}</td>
                      <td className="p-4 font-mono text-slate-800 text-right font-black">{fmtUSD((a.stock || 0) * a.precio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      {
        tab === 'cobrar' && (
          <div className="panel p-0 overflow-hidden">
            <div className="p-4 border-b border-[var(--border-var)] bg-[var(--surface2)]">
              <div className="panel-title mb-0">Cuentas por Cobrar Pendientes</div>
            </div>
            {/* Mobile cards */}
            <div className="block md:hidden divide-y divide-[var(--border-var)]">
              {ctas_cobrar.map(c => {
                const pagado = abonos.filter(a => a.cuenta_id === c.id && a.tipo_cuenta === 'COBRAR').reduce((s, x) => s + x.monto, 0)
                const pendiente = c.monto - pagado
                const dias = Math.ceil((new Date(c.vencimiento) - new Date()) / (1000 * 60 * 60 * 24))
                return (
                  <div key={c.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-[var(--text-main)] text-sm">{c.cliente}</p>
                        <p className="text-[10px] text-[var(--text2)]">Vence: {fmtDate(c.vencimiento)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-black text-[var(--text-main)]">{fmtUSD(pendiente)}</div>
                        <div className="font-mono text-[10px] text-[var(--text2)]">de {fmtUSD(c.monto)}</div>
                        <span className={`badge mt-1 ${pendiente <= 0 ? 'badge-g' : dias < 0 ? 'badge-r' : 'badge-y'}`}>{pendiente <= 0 ? 'COBRADA' : dias < 0 ? 'VENCIDA' : c.estado}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {ctas_cobrar.length === 0 && <div className="text-center text-[var(--text2)] py-12 text-[10px] font-bold uppercase">Sin cuentas pendientes ✅</div>}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto min-h-[400px]">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Cliente</th>
                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Total</th>
                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Pendiente</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Vencimiento</th>
                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ctas_cobrar.map(c => {
                    const pagado = abonos.filter(a => a.cuenta_id === c.id && a.tipo_cuenta === 'COBRAR').reduce((s, x) => s + x.monto, 0)
                    const pendiente = c.monto - pagado
                    const dias = Math.ceil((new Date(c.vencimiento) - new Date()) / (1000 * 60 * 60 * 24))
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-black text-slate-700">{c.cliente}</td>
                        <td className="p-4 font-mono text-slate-400 text-xs text-right">{fmtUSD(c.monto)}</td>
                        <td className="p-4 font-mono text-slate-800 font-black text-right text-lg">{fmtUSD(pendiente)}</td>
                        <td className="p-4 text-slate-500 text-[11px] font-black">{fmtDate(c.vencimiento)}</td>
                        <td className="p-4 text-right flex justify-end items-center gap-3">
                          <button onClick={() => sendWhatsappStatement(c)} className="bg-emerald-50 text-emerald-600 p-2 rounded hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1 text-[9px] font-black cursor-pointer border border-emerald-100 shadow-sm">
                            <span className="material-icons-round text-sm">message</span>
                            WHATSAPP
                          </button>
                          <span className={`inline-flex px-2 py-1 text-[9px] font-black uppercase rounded border ${pendiente <= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : dias < 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                            {pendiente <= 0 ? 'COBRADA' : dias < 0 ? 'VENCIDA' : c.estado}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {ctas_cobrar.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-12 tracking-widest text-[10px] font-black uppercase opacity-50">Sin cuentas pendientes ✅</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      {
        tab === 'pagar' && (
          <div className="panel p-0 overflow-hidden">
            <div className="p-4 border-b border-[var(--border-var)] bg-[var(--surface2)]">
              <div className="panel-title mb-0">Cuentas por Pagar Pendientes</div>
            </div>
            {/* Mobile cards */}
            <div className="block md:hidden divide-y divide-[var(--border-var)]">
              {ctas_pagar.map(c => {
                const pagado = abonos.filter(a => a.cuenta_id === c.id && a.tipo_cuenta === 'PAGAR').reduce((s, x) => s + x.monto, 0)
                const pendiente = c.monto - pagado
                return (
                  <div key={c.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-[var(--text-main)] text-sm">{c.proveedor}</p>
                        <p className="text-[10px] text-[var(--text2)] uppercase font-bold">{c.concepto}</p>
                        <p className="text-[10px] text-[var(--text2)]">Vence: {fmtDate(c.vencimiento)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-black text-[var(--red-var)]">{fmtUSD(pendiente)}</div>
                        <div className="font-mono text-[10px] text-[var(--text2)]">de {fmtUSD(c.monto)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {ctas_pagar.length === 0 && <div className="text-center text-[var(--text2)] py-12 text-[10px] font-bold uppercase">Sin cuentas pendientes ✅</div>}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto min-h-[400px]">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Proveedor</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Concepto</th>
                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Total</th>
                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Pendiente</th>
                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">Vencimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ctas_pagar.map(c => {
                    const pagado = abonos.filter(a => a.cuenta_id === c.id && a.tipo_cuenta === 'PAGAR').reduce((s, x) => s + x.monto, 0)
                    const pendiente = c.monto - pagado
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-black text-slate-700">{c.proveedor}</td>
                        <td className="p-4 text-slate-500 text-[10px] font-black uppercase tracking-tighter">{c.concepto}</td>
                        <td className="p-4 font-mono text-slate-400 text-xs text-right">{fmtUSD(c.monto)}</td>
                        <td className="p-4 font-mono text-red-600 font-black text-right text-lg">{fmtUSD(pendiente)}</td>
                        <td className="p-4 text-slate-500 text-[11px] font-black text-right">{fmtDate(c.vencimiento)}</td>
                      </tr>
                    )
                  })}
                  {ctas_pagar.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-12 tracking-widest text-[10px] font-black uppercase opacity-50">Sin cuentas pendientes ✅</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      {
        tab === 'cierres' && (
          <div className="panel p-0 overflow-hidden">
            <div className="p-4 border-b border-[var(--border-var)] bg-[var(--surface2)] flex items-center justify-between">
              <div className="panel-title mb-0">Historial de Cierres Z</div>
              {currentUser?.rol === 'ADMIN' && (
                <button
                  onClick={() => setShowCierreGeneralModal(true)}
                  className="btn bg-[var(--teal)] text-white shadow-[var(--win-shadow)] font-black text-xs uppercase tracking-widest px-6 !py-3 animate-pulse-slow border border-[var(--tealDark)] cursor-pointer hover:scale-105 transition-transform"
                >
                  <span className="material-icons-round text-lg mr-2">military_tech</span>
                  CIERRE GENERAL (Z MAESTRO)
                </button>
              )}
            </div>
            {/* Mobile cards */}
            <div className="block md:hidden divide-y divide-[var(--border-var)]">
              {allCierres.map(c => (
                <div key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-[var(--text-main)] text-sm">{fmtDate(c.fecha_apertura)}</p>
                      <div className="flex items-center gap-1">
                        <p className="text-[10px] text-[var(--text2)] uppercase font-bold">{c.usuario}</p>
                        {c.isCloud && <span className="text-[8px] bg-[var(--teal)] text-white px-1 rounded font-black">NUBE ({c.terminal_nombre || 'SUCURSAL'})</span>}
                      </div>
                      <span className="badge badge-g mt-1">{c.notas_del_dia?.length || 0} notas</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-[var(--text-main)]">{fmtUSD(c.cierre_z?.esperadoUsd || 0)}</div>
                      <div className="font-mono text-[10px] text-[var(--text2)]">Bs {(c.cierre_z?.esperadoBs || 0).toFixed(2)}</div>
                      <div className={`font-mono text-[10px] font-bold ${c.diferencia_usd < -0.01 ? 'text-[var(--red-var)]' : c.diferencia_usd > 0.01 ? 'text-[var(--green-var)]' : 'text-[var(--text2)]'}`}>
                        Dif: {fmtUSD(c.diferencia_usd)}
                      </div>
                      <button className="btn btn-gr !py-1 !px-2 text-[9px] mt-1" onClick={() => { setSelectedCierre(c); setShowCierreModal(true) }}>VER DETALLE</button>
                    </div>
                  </div>
                </div>
              ))}
              {allCierres.length === 0 && <div className="text-center text-[var(--text2)] py-12 text-[10px] font-bold uppercase">No hay cierres registrados</div>}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto min-h-[400px]">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Fecha</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Cajero</th>
                    <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Notas</th>
                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Total USD</th>
                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Total BS</th>
                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Diferencia $</th>
                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allCierres.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-black text-slate-700">{fmtDate(c.fecha_apertura)}</td>
                      <td className="p-4 text-slate-500 text-[11px] font-black uppercase">
                        {c.usuario}
                        {c.isCloud && <span className="ml-2 text-[8px] bg-[#0d9488] text-white px-1.5 py-0.5 rounded font-black shadow-sm">NUBE ({c.terminal_nombre || 'SUCURSAL'})</span>}
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-black border border-indigo-100">
                          {c.notas_del_dia?.length || 0} ITEMS
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-800 font-black text-right">{fmtUSD(c.cierre_z?.esperadoUsd || 0)}</td>
                      <td className="p-4 font-mono text-slate-500 font-bold text-right text-[11px]">Bs {(c.cierre_z?.esperadoBs || 0).toFixed(2)}</td>
                      <td className={`p-4 font-mono font-black text-right ${Math.abs(c.diferencia_usd || 0) < 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fmtUSD(c.diferencia_usd || 0)}
                      </td>
                      <td className="p-4 text-right">
                        <button className="bg-white hover:bg-slate-800 hover:text-white text-slate-600 border border-slate-200 px-3 py-1.5 rounded text-[9px] font-black shadow-sm transition-all cursor-pointer"
                          onClick={() => { setSelectedCierre(c); setShowCierreModal(true) }}>
                          VER DETALLE
                        </button>
                      </td>
                    </tr>
                  ))}
                  {allCierres.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-12 tracking-widest text-[10px] font-black uppercase opacity-50">No hay cierres registrados</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      {tab === 'pyl' && (() => {
        const ventasBrutas = totalVentas
        const totalDevoluciones = devolucionesPeriodo.reduce((s, d) => s + (d.total || 0), 0)
        const ventasNetas = ventasBrutas - totalDevoluciones
        const cmv = allVentaItems.reduce((s, i) => s + ((i.costo || 0) * (i.qty || 0)), 0)
        const utilidadBruta = ventasNetas - cmv
        const margenBruto = ventasNetas > 0 ? (utilidadBruta / ventasNetas * 100) : 0

        // Agrupar gastos por categoría
        const gastosMap = {}
        gastosPeriodo.forEach(g => {
          const cat = g.categoria || 'SIN_CATEGORIA'
          gastosMap[cat] = (gastosMap[cat] || 0) + g.monto
        })
        const totalGastos = gastosPeriodo.reduce((s, g) => s + g.monto, 0)
        const utilidadNeta = utilidadBruta - totalGastos
        const margenNeto = ventasNetas > 0 ? (utilidadNeta / ventasNetas * 100) : 0

        const CATS_LABELS = {
          ALQUILER: '🏠 Alquiler',
          NOMINA: '👥 Nómina',
          SERVICIOS: '💡 Servicios',
          TRANSPORTE: '🚚 Transporte',
          MANTENIMIENTO: '🔧 Mantenimiento',
          CAJA_CHICA_GENERAL: '💰 Caja Chica General',
          SIN_CATEGORIA: '📁 Sin Categoría',
        }

        const PLRow = ({ label, value, bold, sub, negative, divider, highlight, big }) => (
          <div className={`flex justify-between items-center py-2.5 px-4
            ${divider ? 'border-t-2 border-[var(--text-main)] mt-2 pt-3' : ''}
            ${highlight ? 'bg-[var(--surface2)] border-l-4 border-[var(--teal)] my-1' : ''}
            ${big ? 'bg-[var(--teal)] text-white my-2 py-4 px-5' : ''}`}>
            <span className={`text-[11px] uppercase tracking-wide
              ${bold || big ? 'font-black' : 'font-bold'}
              ${sub ? 'pl-6 text-[var(--text2)]' : ''}
              ${big ? 'text-sm text-white' : big ? '' : 'text-[var(--text-main)]'}`}>
              {label}
            </span>
            <span className={`font-mono text-sm
              ${bold || big ? 'font-black' : 'font-bold'}
              ${negative ? 'text-[var(--red-var)]' : ''}
              ${highlight ? 'text-[var(--teal)] text-base' : ''}
              ${big ? 'text-xl text-white' : ''}`}>
              {negative && value > 0 ? '−' : ''}{fmtUSD(Math.abs(value || 0))}
            </span>
          </div>
        )

        return (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            {/* REPORTE PRINCIPAL */}
            <div className="panel p-0 overflow-hidden">
              <div className="p-5 border-b border-[var(--border-var)] bg-[var(--surface2)]">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="panel-title !mb-1">Estado de Resultados</div>
                    <p className="text-[10px] text-[var(--text2)] font-bold uppercase tracking-widest">Período: {desde} al {hasta}</p>
                  </div>
                  <span className="material-icons-round text-4xl text-[var(--teal)] opacity-20">analytics</span>
                </div>
              </div>

              <div className="divide-y divide-[var(--border-var)]">
                {/* INGRESOS */}
                <div className="py-3">
                  <div className="px-4 py-2">
                    <span className="text-[9px] font-black text-[var(--teal)] uppercase tracking-[0.2em]">Ingresos</span>
                  </div>
                  <PLRow label="Ventas Brutas" value={ventasBrutas} />
                  {totalDevoluciones > 0 && <PLRow label="Devoluciones" value={totalDevoluciones} sub negative />}
                  <PLRow label="Ventas Netas" value={ventasNetas} bold divider />
                </div>

                {/* CMV */}
                <div className="py-3">
                  <div className="px-4 py-2">
                    <span className="text-[9px] font-black text-[var(--orange-var)] uppercase tracking-[0.2em]">Costo de Mercancía Vendida</span>
                  </div>
                  <PLRow label="CMV (costo de lo vendido)" value={cmv} negative />
                  <PLRow label="Utilidad Bruta" value={utilidadBruta} highlight divider />
                  <div className="px-4 pb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-[var(--surface2)] border border-[var(--border-var)] overflow-hidden">
                        <div className={`h-full ${margenBruto >= 30 ? 'bg-[var(--green-var)]' : margenBruto >= 15 ? 'bg-[var(--orange-var)]' : 'bg-[var(--red-var)]'}`}
                          style={{ width: `${Math.min(100, Math.max(0, margenBruto))}%` }} />
                      </div>
                      <span className={`text-xs font-mono font-black ${margenBruto >= 30 ? 'text-[var(--green-var)]' : margenBruto >= 15 ? 'text-[var(--orange-var)]' : 'text-[var(--red-var)]'}`}>
                        {margenBruto.toFixed(1)}%
                      </span>
                    </div>
                    <span className="text-[8px] font-bold text-[var(--text2)] uppercase tracking-widest">Margen bruto</span>
                  </div>
                </div>

                {/* GASTOS OPERATIVOS */}
                <div className="py-3">
                  <div className="px-4 py-2">
                    <span className="text-[9px] font-black text-[var(--red-var)] uppercase tracking-[0.2em]">Gastos Operativos</span>
                  </div>
                  {Object.keys(gastosMap).length === 0 && (
                    <div className="px-4 py-4 text-center text-[var(--text2)] text-[10px] font-bold uppercase tracking-widest opacity-50">
                      Sin gastos registrados en el período
                    </div>
                  )}
                  {Object.entries(gastosMap).sort((a, b) => b[1] - a[1]).map(([cat, monto]) => (
                    <PLRow key={cat} label={CATS_LABELS[cat] || `📁 ${cat}`} value={monto} sub negative />
                  ))}
                  {totalGastos > 0 && <PLRow label="Total Gastos Operativos" value={totalGastos} bold negative divider />}
                </div>

                {/* UTILIDAD NETA */}
                <div className="py-3">
                  <PLRow label="UTILIDAD NETA" value={utilidadNeta} big />
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-[var(--surface2)] border border-[var(--border-var)] overflow-hidden">
                        <div className={`h-full ${margenNeto >= 20 ? 'bg-[var(--green-var)]' : margenNeto >= 10 ? 'bg-[var(--orange-var)]' : 'bg-[var(--red-var)]'}`}
                          style={{ width: `${Math.min(100, Math.max(0, margenNeto))}%` }} />
                      </div>
                      <span className={`text-xs font-mono font-black ${margenNeto >= 20 ? 'text-[var(--green-var)]' : margenNeto >= 10 ? 'text-[var(--orange-var)]' : 'text-[var(--red-var)]'}`}>
                        {margenNeto.toFixed(1)}%
                      </span>
                    </div>
                    <span className="text-[8px] font-bold text-[var(--text2)] uppercase tracking-widest">Margen neto</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SIDEBAR INDICADORES */}
            <div className="space-y-4">
              {/* Card Ventas Netas */}
              <div className="panel border-l-4 transition-none" style={{ borderColor: 'var(--teal)' }}>
                <div className="text-[9px] text-[var(--text2)] tracking-widest uppercase mb-1 font-black">Ventas Netas</div>
                <div className="text-2xl font-mono font-black text-[var(--teal)]">{fmtUSD(ventasNetas)}</div>
                <div className="text-[10px] text-[var(--text2)] font-bold mt-1">{allVentas.filter(v => v.estado !== 'ANULADA').length} notas • {totalDevoluciones > 0 ? `${devolucionesPeriodo.length} devoluciones` : 'Sin devoluciones'}</div>
              </div>

              {/* Card Utilidad Bruta */}
              <div className="panel border-l-4 transition-none" style={{ borderColor: margenBruto >= 30 ? 'var(--green-var)' : margenBruto >= 15 ? 'var(--orange-var)' : 'var(--red-var)' }}>
                <div className="text-[9px] text-[var(--text2)] tracking-widest uppercase mb-1 font-black">Utilidad Bruta</div>
                <div className={`text-2xl font-mono font-black ${margenBruto >= 30 ? 'text-[var(--green-var)]' : margenBruto >= 15 ? 'text-[var(--orange-var)]' : 'text-[var(--red-var)]'}`}>{fmtUSD(utilidadBruta)}</div>
                <div className="text-[10px] text-[var(--text2)] font-bold mt-1">Margen: {margenBruto.toFixed(1)}% • CMV: {fmtUSD(cmv)}</div>
              </div>

              {/* Card Utilidad Neta */}
              <div className={`panel border-l-4 transition-none`} style={{ borderColor: utilidadNeta >= 0 ? 'var(--green-var)' : 'var(--red-var)' }}>
                <div className="text-[9px] text-[var(--text2)] tracking-widest uppercase mb-1 font-black">Utilidad Neta</div>
                <div className={`text-2xl font-mono font-black ${utilidadNeta >= 0 ? 'text-[var(--green-var)]' : 'text-[var(--red-var)]'}`}>{fmtUSD(utilidadNeta)}</div>
                <div className="text-[10px] text-[var(--text2)] font-bold mt-1">Margen: {margenNeto.toFixed(1)}% • Gastos: {fmtUSD(totalGastos)}</div>
              </div>

              {/* Desglose Gastos */}
              {totalGastos > 0 && (
                <div className="panel">
                  <div className="text-[9px] text-[var(--text2)] tracking-widest uppercase mb-4 font-black">Desglose de Gastos</div>
                  <div className="space-y-3">
                    {Object.entries(gastosMap).sort((a, b) => b[1] - a[1]).map(([cat, monto]) => {
                      const porc = totalGastos > 0 ? (monto / totalGastos * 100) : 0
                      return (
                        <div key={cat}>
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="font-bold text-[var(--text2)] uppercase">{CATS_LABELS[cat] || cat}</span>
                            <span className="font-mono font-black text-[var(--text-main)]">{fmtUSD(monto)}</span>
                          </div>
                          <div className="h-1.5 bg-[var(--surface2)] border border-[var(--border-var)] overflow-hidden">
                            <div className="h-full bg-[var(--red-var)] opacity-70" style={{ width: `${porc}%` }} />
                          </div>
                          <div className="text-[8px] text-right text-[var(--text2)] font-bold mt-0.5">{porc.toFixed(1)}%</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="bg-[var(--surface2)] border border-[var(--border-var)] p-4 shadow-[var(--win-shadow)] relative overflow-hidden">
                <div className="absolute right-0 top-0 w-16 h-full bg-[var(--tealDark)] opacity-10 -skew-x-12 translate-x-4"></div>
                <div className="text-[10px] text-[var(--teal)] font-bold mb-1 tracking-widest uppercase flex items-center gap-1">
                  <span className="material-icons-round text-base">info</span>
                  <span>Nota</span>
                </div>
                <p className="text-[11px] text-[var(--text2)] font-medium">
                  El CMV se calcula usando el costo AVCO guardado al momento de cada venta. Los gastos provienen de Caja Chica (egresos).
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de Reimpresión */}
      <Modal open={showReimprimirModal} onClose={() => setShowReimprimirModal(false)} title="REIMPRIMIR TICKET">
        <div className="space-y-6">
          <div className="bg-[var(--surface2)] p-2 rounded-none scale-90 origin-top overflow-hidden border border-[var(--border-var)] shadow-inner">
            <TicketTermico ref={ticketRef} nota={selectedVenta} config={configEmpresa} isCopia={true} />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button className="btn bg-[var(--teal)] text-white py-4 font-black flex items-center justify-center gap-3 cursor-pointer transition-none shadow-[var(--win-shadow)]" onClick={handlePrintTicket}>
              <span className="material-icons-round">print</span>
              IMPRIMIR CABLE / RED
            </button>

            <button className={`btn py-4 font-black flex items-center justify-center gap-3 transition-none cursor-pointer shadow-[var(--win-shadow)]
              ${btStatus === 'CONNECTED' ? 'bg-[var(--teal)] text-white' :
                btStatus === 'CONNECTING' ? 'bg-[var(--orange-var)] text-white animate-pulse' : 'bg-[var(--text-main)] text-[var(--surface2)]'}`}
              onClick={handlePrintBT}>
              <span className="material-icons-round">
                {btStatus === 'CONNECTED' ? 'print' : btStatus === 'CONNECTING' ? 'sync' : 'bluetooth'}
              </span>
              {btStatus === 'CONNECTED' ? 'IMPRIMIR BLUETOOTH' :
                btStatus === 'CONNECTING' ? 'CONECTANDO...' : 'VINCULAR BLUETOOTH'}
            </button>

            <button className="btn btn-gr py-3 font-bold mt-2 cursor-pointer transition-none" onClick={() => setShowReimprimirModal(false)}>CANCELAR</button>
          </div>
        </div>
      </Modal>

      {/* Modal Detalle de Cierre */}
      <Modal open={showCierreGeneralModal} onClose={() => setShowCierreGeneralModal(false)} title="CIERRE GENERAL (Z MAESTRO) DEL DÍA" wide>
        {loadingCierreGeneral ? (
          <div className="p-12 text-center text-[var(--text2)] font-black uppercase tracking-widest animate-pulse">⏳ Cargando cierres del día...</div>
        ) : cierreGeneralData.length === 0 ? (
          <div className="p-12 text-center text-[var(--text2)] font-black uppercase tracking-widest">No hay cierres registrados hoy</div>
        ) : (() => {
          // Calcular totales consolidados
          const totalUsd = cierreGeneralData.reduce((s, c) => s + (c.ventas_totales_usd || 0), 0)
          const totEfecUsd = cierreGeneralData.reduce((s, c) => s + (c.desglose?.efectivoUsd || 0), 0)
          const totZelle = cierreGeneralData.reduce((s, c) => s + (c.desglose?.zelle || 0), 0)
          const totOtros = cierreGeneralData.reduce((s, c) => s + (c.desglose?.otros || 0), 0)
          const totCredito = cierreGeneralData.reduce((s, c) => s + (c.desglose?.credito || 0), 0)
          const totEfecBs = cierreGeneralData.reduce((s, c) => s + (c.desglose?.efectivoBs || 0), 0)
          const totMovil = cierreGeneralData.reduce((s, c) => s + (c.desglose?.pagoMovil || 0), 0)
          const totPunto = cierreGeneralData.reduce((s, c) => s + (c.desglose?.punto || 0), 0)
          const totNotas = cierreGeneralData.reduce((s, c) => s + (c.notas_count || 0), 0)
          const todasCuadradas = cierreGeneralData.every(c => Math.abs(c.diferencia_usd || 0) < 0.10)

          return (
            <div className="space-y-4 -m-2">
              {/* Header */}
              <div className="bg-slate-900 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-3">
                <div>
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">CONSOLIDADO MAESTRO — {today()}</div>
                  <div className="text-2xl font-black text-white">{cierreGeneralData.length} CAJAS CERRADAS</div>
                </div>
                <div className={`px-4 py-2 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 border ${todasCuadradas ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                  <span className={`w-2 h-2 rounded-full ${todasCuadradas ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                  {todasCuadradas ? 'TODAS LAS CAJAS CUADRADAS ✓' : 'HAY DESCUADRES — REVISAR'}
                </div>
              </div>

              {/* Tabla por caja */}
              <div className="overflow-x-auto px-2">
                <table className="w-full border-separate border-spacing-0 text-[11px]">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="p-3 text-left font-black uppercase tracking-widest border-r border-slate-700">Cajero / Terminal</th>
                      <th className="p-3 text-right font-black uppercase tracking-widest border-r border-slate-700">Ef. USD</th>
                      <th className="p-3 text-right font-black uppercase tracking-widest border-r border-slate-700">Zelle</th>
                      <th className="p-3 text-right font-black uppercase tracking-widest border-r border-slate-700">Otros</th>
                      <th className="p-3 text-right font-black uppercase tracking-widest border-r border-slate-700">Crédito</th>
                      <th className="p-3 text-right font-black uppercase tracking-widest border-r border-slate-700">Ef. Bs</th>
                      <th className="p-3 text-right font-black uppercase tracking-widest border-r border-slate-700">Total USD</th>
                      <th className="p-3 text-center font-black uppercase tracking-widest">Dif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cierreGeneralData.map((c, i) => {
                      const cuad = Math.abs(c.diferencia_usd || 0) < 0.10
                      return (
                        <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                          <td className="p-3 font-black text-slate-700">
                            {c.usuario}
                            <div className="text-[9px] text-slate-400 font-bold">{c.terminal_nombre}</div>
                          </td>
                          <td className="p-3 text-right font-mono text-slate-600">{fmtUSD(c.desglose?.efectivoUsd || 0)}</td>
                          <td className="p-3 text-right font-mono text-slate-600">{fmtUSD(c.desglose?.zelle || 0)}</td>
                          <td className="p-3 text-right font-mono text-slate-600">{fmtUSD(c.desglose?.otros || 0)}</td>
                          <td className="p-3 text-right font-mono text-slate-600">{fmtUSD(c.desglose?.credito || 0)}</td>
                          <td className="p-3 text-right font-mono text-slate-500 text-[10px]">Bs {(c.desglose?.efectivoBs || 0).toFixed(2)}</td>
                          <td className="p-3 text-right font-mono font-black text-slate-800">{fmtUSD(c.ventas_totales_usd || 0)}</td>
                          <td className={`p-3 text-center font-black text-xs ${cuad ? 'text-emerald-600' : 'text-red-600'}`}>
                            {cuad ? '✓' : fmtUSD(c.diferencia_usd)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-900 text-white">
                      <td className="p-3 font-black uppercase tracking-widest text-xs">TOTAL DÍA — {totNotas} NOTAS</td>
                      <td className="p-3 text-right font-mono font-black">{fmtUSD(totEfecUsd)}</td>
                      <td className="p-3 text-right font-mono font-black">{fmtUSD(totZelle)}</td>
                      <td className="p-3 text-right font-mono font-black">{fmtUSD(totOtros)}</td>
                      <td className="p-3 text-right font-mono font-black">{fmtUSD(totCredito)}</td>
                      <td className="p-3 text-right font-mono font-black text-[10px]">Bs {(totEfecBs + totMovil + totPunto).toFixed(2)}</td>
                      <td className="p-3 text-right font-mono font-black text-[var(--teal)] text-base">{fmtUSD(totalUsd)}</td>
                      <td className="p-3 text-center font-black text-emerald-400 text-base">{todasCuadradas ? '✓' : '⚠'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Botones */}
              <div className="flex gap-3 justify-end px-2 pb-2">
                <button onClick={() => window.print()} className="btn bg-[var(--teal)] text-white font-black uppercase tracking-widest cursor-pointer shadow-[var(--win-shadow)]">
                  <span className="material-icons-round text-base">print</span> Imprimir Reporte
                </button>
                <button onClick={() => setShowCierreGeneralModal(false)} className="btn btn-gr font-bold cursor-pointer">Cerrar</button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Modal Detalle de Cierre */}
      <Modal open={showCierreModal} onClose={() => setShowCierreModal(false)} title="INFORME DE CIERRE Z" wide>
        {selectedCierre && (() => {
          const dif = selectedCierre.diferencia_usd || 0
          const cuadrado = Math.abs(dif) < 0.10
          return (
            <div className="space-y-0 overflow-hidden rounded-none -m-2">

              {/* Header Command */}
              <div className="bg-slate-900 px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">SESIÓN DE CAJA CERTIFICADA</div>
                  <div className="text-2xl font-black text-white uppercase tracking-tighter">{selectedCierre.usuario}</div>
                  <div className="text-xs font-bold text-slate-400 mt-1 font-mono">{fmtDate(selectedCierre.fecha_apertura)}</div>
                </div>
                <div className={`px-4 py-2 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 border ${cuadrado ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                  <span className={`w-2 h-2 rounded-full ${cuadrado ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                  {cuadrado ? 'CAJA CUADRADA' : 'DESCUADRE DETECTADO'}
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3">

                {/* USD Column */}
                <div className="bg-emerald-950/50 border-r border-slate-800 p-5 space-y-3">
                  <div className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.25em] flex items-center gap-2">
                    <span className="material-icons-round text-sm">attach_money</span>
                    OPERACIONES USD
                  </div>
                  <CierreRow label="Fondo Inicial" val={selectedCierre.monto_inicial_usd} />
                  <CierreRow label="Efectivo Recibido" val={selectedCierre.cierre_z?.efectivoUsd} />
                  <CierreRow label="Zelle / Otros" val={(selectedCierre.cierre_z?.zelle || 0) + (selectedCierre.cierre_z?.otros || 0)} />
                  <CierreRow label="Ingresos C.C." val={selectedCierre.cierre_z?.ingresosCC || 0} />
                  <CierreRow label="Egresos C.C." val={-(selectedCierre.cierre_z?.egresosCC || 0)} negative />
                  <div className="pt-3 border-t border-emerald-900 flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">ESPERADO</span>
                    <span className="text-xl font-mono font-black text-slate-900">{fmtUSD(selectedCierre.cierre_z?.esperadoUsd)}</span>
                  </div>
                </div>

                {/* BS Column */}
                <div className="bg-indigo-950/50 border-r border-slate-800 p-5 space-y-3">
                  <div className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.25em] flex items-center gap-2">
                    <span className="material-icons-round text-sm">currency_exchange</span>
                    OPERACIONES BS
                  </div>
                  <CierreRow label="Fondo Inicial" val={selectedCierre.monto_inicial_bs} isBs />
                  <CierreRow label="Efectivo Bs" val={selectedCierre.cierre_z?.efectivoBs} isBs />
                  <CierreRow label="Pago Móvil / P.Venta" val={(selectedCierre.cierre_z?.pagoMovil || 0) + (selectedCierre.cierre_z?.punto || 0)} isBs />
                  <div className="pt-3 border-t border-indigo-900 flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">ESPERADO</span>
                    <span className="text-xl font-mono font-black text-slate-900">Bs {(selectedCierre.cierre_z?.esperadoBs || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Discrepancy Column */}
                <div className={`p-5 space-y-3 ${cuadrado ? 'bg-emerald-950/30' : 'bg-red-950/30'}`}>
                  <div className={`text-[9px] font-black uppercase tracking-[0.25em] flex items-center gap-2 ${cuadrado ? 'text-emerald-500' : 'text-red-500'}`}>
                    <span className="material-icons-round text-sm">{cuadrado ? 'task_alt' : 'report_problem'}</span>
                    ARQUEO FINAL
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-slate-600 uppercase">Contado Físico</div>
                    <div className="text-2xl font-mono font-black text-slate-900">{fmtUSD(selectedCierre.monto_fisico_usd || 0)}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-slate-600 uppercase">Sistema Esperaba</div>
                    <div className="text-lg font-mono font-bold text-slate-800">{fmtUSD(selectedCierre.cierre_z?.esperadoUsd || 0)}</div>
                  </div>
                  <div className={`pt-3 border-t flex justify-between items-center ${cuadrado ? 'border-emerald-900' : 'border-red-900'}`}>
                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">DIFERENCIA</span>
                    <span className={`text-2xl font-mono font-black text-slate-900`}>
                      {fmtUSD(dif)}
                    </span>
                  </div>
                  <div className="pt-2">
                    <div className="text-[9px] font-black text-slate-600 uppercase mb-2">FACTURAS DEL PERÍODO</div>
                    <div className="text-3xl font-black text-slate-900">{selectedCierre.notas_del_dia?.length || 0}</div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-900 px-6 py-4 flex justify-end">
                <button className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-3 font-black text-xs uppercase tracking-widest transition-colors cursor-pointer"
                  onClick={() => setShowCierreModal(false)}>
                  CERRAR INFORME
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Modal Anulación */}
      <Modal open={showAnularModal} onClose={() => setShowAnularModal(false)} title="Anular Venta">
        <div className="space-y-4">
          <div className="bg-[var(--red-var)] bg-opacity-10 p-3 rounded-none border border-[var(--red-var)]">
            <p className="text-[10px] text-[var(--red-var)] font-bold uppercase mb-1">Atención</p>
            <p className="text-xs text-[var(--red-var)]">
              Está por anular la nota <strong>#{ventaParaAnular?.nro}</strong>. Esta acción devolverá los productos al stock y cancelará deudas pendientes.
            </p>
          </div>

          <div className="field">
            <label>Motivo de Anulación</label>
            <textarea className="inp w-full !py-2 h-20 resize-none text-xs rounded-none border-[var(--border-var)] focus:border-[var(--teal)] transition-none"
              placeholder="Ej: Error en precio, El cliente ya no lo quiere..."
              value={motivoAnulacion}
              onChange={e => setMotivoAnulacion(e.target.value)}
            />
          </div>

          <div className="field">
            <label>PIN de Autorización (Admin/Supervisor)</label>
            <input type="password"
              className="inp w-full !py-3 text-center font-mono text-xl tracking-[1em] rounded-none border-[var(--border-var)] focus:border-[var(--teal)] transition-none"
              maxLength={4}
              placeholder="****"
              value={pinAnulacion}
              onChange={e => setPinAnulacion(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button className="btn btn-gr flex-1 cursor-pointer transition-none shadow-[var(--win-shadow)]" onClick={() => setShowAnularModal(false)}>Cancelar</button>
            <button className="btn bg-[var(--red-var)] text-white flex-1 font-black cursor-pointer transition-none shadow-[var(--win-shadow)]" onClick={handleAnular}>CONFIRMAR ANULACIÓN</button>
          </div>
        </div>
      </Modal>

    </div>
  )
}

function CierreRow({ label, val, isBs, negative }) {
  return (
    <div className="flex justify-between items-center text-[11px] py-1">
      <span className="text-slate-800 font-bold uppercase tracking-wider">{label}</span>
      <span className={`font-mono font-black text-slate-900`}>
        {isBs ? `Bs ${(val || 0).toFixed(2)}` : fmtUSD(val || 0)}
      </span>
    </div>
  )
}
