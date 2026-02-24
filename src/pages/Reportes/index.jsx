import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router-dom'
import { db } from '../../db/db'
import { fmtUSD, fmtDate, today } from '../../utils/format'
import { printReporte } from '../../utils/print'
import { useReactToPrint } from 'react-to-print'
import TicketTermico from '../../components/Ticket/TicketTermico'
import useStore from '../../store/useStore'
import Modal from '../../components/UI/Modal'
import { btPrinter } from '../../utils/bluetoothPrinter'
import { logAction } from '../../utils/audit'


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

  // Estados Anulación
  const [showAnularModal, setShowAnularModal] = useState(false)
  const [ventaParaAnular, setVentaParaAnular] = useState(null)
  const [motivoAnulacion, setMotivoAnulacion] = useState('')
  const [pinAnulacion, setPinAnulacion] = useState('')

  const { configEmpresa, loadConfigEmpresa, currentUser, btStatus, setBtStatus, toast } = useStore()
  const ticketRef = useRef()

  useEffect(() => {
    loadConfigEmpresa()
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
    const items = await db.venta_items.where('venta_id').equals(venta.id).toArray()
    const u = venta.usuario_id ? await db.usuarios.get(venta.usuario_id) : null

    setSelectedVenta({
      ...venta,
      items,
      cliente_nombre: venta.cliente,
      cajero_nombre: u?.nombre || 'SISTEMA'
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

    const sup = await db.usuarios.where('pin').equals(pinAnulacion).first()
    if (!sup || !['ADMIN', 'SUPERVISOR'].includes(sup.rol)) {
      return toast('PIN de supervisor inválido', 'error')
    }

    const { anularVenta } = useStore.getState()
    const ok = await anularVenta(ventaParaAnular.id, motivoAnulacion, sup)
    if (ok) {
      setShowAnularModal(false)
      setVentaParaAnular(null)
      setMotivoAnulacion('')
      setPinAnulacion('')
    }
  }

  const ventas = useLiveQuery(
    () => db.ventas.filter(v => {
      const d = new Date(v.fecha).toISOString().split('T')[0]
      return d >= desde && d <= hasta
    }).toArray(),
    [desde, hasta], []
  )

  const articulos = useLiveQuery(() => db.articulos.toArray().then(arr => [...arr].sort((a, b) => (a.stock || 0) - (b.stock || 0))), [], [])
  const ctas_cobrar = useLiveQuery(() => db.ctas_cobrar.where('estado').anyOf('PENDIENTE', 'PARCIAL').toArray(), [], [])
  const ctas_pagar = useLiveQuery(() => db.ctas_pagar.where('estado').anyOf('PENDIENTE', 'PARCIAL').toArray(), [], [])
  const abonos = useLiveQuery(() => db.abonos.toArray(), [], [])
  const cierres = useLiveQuery(() => db.sesiones_caja.where('estado').equals('CERRADA').toArray().then(arr => [...arr].reverse()), [], [])

  const totalVentas = ventas.filter(v => v.estado !== 'ANULADA').reduce((s, v) => s + (v.total || 0), 0)

  const porCobrarTotal = ctas_cobrar.reduce((s, c) => {
    const pagos = abonos.filter(a => a.cuenta_id === c.id && a.tipo_cuenta === 'COBRAR').reduce((sum, a) => sum + a.monto, 0)
    return s + (c.monto - pagos)
  }, 0)

  const porPagarTotal = ctas_pagar.reduce((s, c) => {
    const pagos = abonos.filter(a => a.cuenta_id === c.id && a.tipo_cuenta === 'PAGAR').reduce((sum, a) => sum + a.monto, 0)
    return s + (c.monto - pagos)
  }, 0)

  const porTipo = ventas.filter(v => v.estado !== 'ANULADA').reduce((acc, v) => {
    acc[v.tipo_pago] = (acc[v.tipo_pago] || 0) + v.total
    return acc
  }, {})

  const agotados = articulos.filter(a => (a.stock || 0) === 0)
  const bajoStock = articulos.filter(a => (a.stock || 0) > 0 && (a.stock || 0) <= 3)

  const handlePrint = () => {
    if (tab === 'ventas') {
      const data = ventas.map(v => [`#${v.nro}`, fmtDate(v.fecha), v.cliente, v.tipo_pago, fmtUSD(v.total)])
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
    }
  }

  const exportLibroVentas = () => {
    const data = ventas.filter(v => v.estado !== 'ANULADA').map(v => {
      const base = v.subtotal || (v.total / 1.16)
      const iva = v.iva || (v.total - base)
      return [
        fmtDate(v.fecha),
        `#${v.nro}`,
        v.cliente || 'CONTADO',
        'J-00000000-0', // Default RIF
        fmtUSD(base),
        fmtUSD(iva),
        fmtUSD(v.igtf || 0),
        fmtUSD(v.total)
      ]
    })
    printReporte(`Libro de Ventas (${desde} a ${hasta})`,
      ['FECHA', 'NOTA', 'CLIENTE', 'RIF', 'BASE', 'IVA (16%)', 'IGTF (3%)', 'TOTAL'],
      data,
      { 'TOTAL VENTAS $': fmtUSD(totalVentas) }
    )
  }

  const sendWhatsappStatement = (c) => {
    const pagos = abonos.filter(a => a.cuenta_id === c.id && a.tipo_cuenta === 'COBRAR').reduce((sum, a) => sum + a.monto, 0)
    const pendiente = c.monto - pagos
    const text = encodeURIComponent(`*ESTADO DE CUENTA - KEMASTER*\n\nHola ${c.cliente}, le saludamos de Automotores Guaicaipuro.\n\nLe informamos que mantiene una deuda pendiente por un valor de *${fmtUSD(pendiente)}*.\n\nVencimiento: ${fmtDate(c.vencimiento)}\n\nPor favor, contacte con nosotros para coordinar su pago. ¡Gracias!`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const Stat = ({ label, value, sub, color = 'text-primary' }) => (
    <div className="panel flex flex-col justify-center border-l-4" style={{ borderColor: 'var(--primary)' }}>
      <div className="text-[10px] text-slate-400 tracking-widest uppercase mb-1 font-bold">{label}</div>
      <div className={`text-2xl font-bold text-slate-800 ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-tighter">{sub}</div>}
    </div>
  )

  return (
    <div className="space-y-4 h-full overflow-y-auto custom-scroll pr-2 pb-6">
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
        <div className="flex gap-2 w-full sm:w-auto">
          {tab === 'ventas' && (
            <button onClick={exportLibroVentas} className="btn bg-blue-600 text-white w-full sm:w-auto">
              <span className="material-icons-round text-base">file_download</span>
              <span>Libro de Ventas</span>
            </button>
          )}
          <button onClick={handlePrint} className="btn btn-r w-full sm:w-auto">
            <span className="material-icons-round text-base">print</span>
            <span>Imprimir Reporte</span>
          </button>
        </div>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total Ventas" value={fmtUSD(totalVentas)} sub={`${ventas.length} notas emitidas`} />
        <Stat label="Por Cobrar" value={fmtUSD(porCobrarTotal)}
          sub={`${ctas_cobrar.length} pendientes`} color="text-amber-600" />
        <Stat label="Por Pagar" value={fmtUSD(porPagarTotal)}
          sub={`${ctas_pagar.length} cuentas`} color="text-red-500" />
        <Stat label="Críticos" value={agotados.length}
          sub={`${bajoStock.length} bajo stock`} color="text-orange-600" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
        {[
          ['ventas', 'assignment'], ['inventario', 'inventory_2'],
          ['cobrar', 'payments'], ['pagar', 'account_balance'],
          ['cierres', 'point_of_sale']
        ].map(([k, icon]) => (
          <button key={k} onClick={() => changeTab(k)}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 
            ${tab === k ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}>
            <span className="material-icons-round text-base">{icon}</span>
            <span className="hidden sm:inline">{k}</span>
          </button>
        ))}
      </div>

      {tab === 'ventas' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="panel overflow-hidden flex flex-col p-0">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="panel-title mb-0">Detalle de Ventas</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{ventas.length} registros</div>
            </div>
            {/* Mobile cards */}
            <div className="block md:hidden divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {ventas.map(v => (
                <div key={v.id} className="p-4 active:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-primary font-bold text-sm">#{v.nro}</span>
                        <span className={`badge ${v.estado === 'ANULADA' ? 'badge-r' : v.tipo_pago === 'CREDITO' ? 'badge-y' : 'badge-g'}`}>
                          {v.estado === 'ANULADA' ? 'ANULADA' : v.tipo_pago}
                        </span>
                      </div>
                      <p className="font-bold text-slate-700 text-sm">{v.cliente}</p>
                      <p className="text-[10px] text-slate-400">{fmtDate(v.fecha)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-slate-800">{fmtUSD(v.total)}</div>
                      <button onClick={() => reimprimirVenta(v)} className="mt-1 bg-slate-100 text-zinc-600 px-2 py-1 rounded text-[9px] font-black">🖨️</button>
                    </div>
                  </div>
                </div>
              ))}
              {ventas.length === 0 && <div className="text-center text-slate-400 py-12 text-[10px] font-bold uppercase">No se encontraron ventas</div>}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto min-h-[400px]">
              <table>
                <thead><tr><th>N° Nota</th><th>Fecha</th><th>Cliente</th><th>Forma</th><th className="text-right">Total</th><th className="text-right">Acciones</th></tr></thead>
                <tbody>
                  {ventas.map(v => (
                    <tr key={v.id}>
                      <td className="font-mono text-primary font-bold">#{v.nro}</td>
                      <td className="text-[11px] text-slate-500">{fmtDate(v.fecha)}</td>
                      <td className="font-bold text-slate-700">{v.cliente}</td>
                      <td>
                        <span className={`badge ${v.estado === 'ANULADA' ? 'badge-r' : v.tipo_pago === 'CREDITO' ? 'badge-y' : 'badge-g'}`}>
                          {v.estado === 'ANULADA' ? 'ANULADA' : v.tipo_pago}
                        </span>
                      </td>
                      <td className="font-mono text-slate-800 text-right font-bold">{fmtUSD(v.total)}</td>
                      <td className="text-right flex gap-1 justify-end">
                        <button onClick={() => reimprimirVenta(v)} className="bg-slate-100 hover:bg-zinc-200 text-zinc-600 px-2 py-1 rounded text-[9px] font-black tracking-tighter transition shadow-sm">🖨️ REIMPRIMIR</button>
                        {v.estado !== 'ANULADA' && ['ADMIN', 'SUPERVISOR'].includes(currentUser?.rol) && (
                          <button onClick={() => { setVentaParaAnular(v); setShowAnularModal(true) }} className="bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded text-[9px] font-black tracking-tighter transition shadow-sm">🚫 ANULAR</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {ventas.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-12 tracking-widest text-[10px] font-bold uppercase opacity-50">No se encontraron ventas</td></tr>}
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
                        <span className="text-slate-500 tracking-widest uppercase">{tipo}</span>
                        <span className="text-slate-800 font-mono">{fmtUSD(total)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-500 rounded-full ${tipo === 'CREDITO' ? 'bg-amber-400' : 'bg-green-500'}`}
                          style={{ width: `${porc}%` }} />
                      </div>
                      <div className="text-[9px] text-right text-slate-400 font-bold mt-1 uppercase tracking-tighter">{porc.toFixed(1)}% del total</div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-8 pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gran Total:</span>
                  <span className="text-2xl font-mono font-bold text-primary">{fmtUSD(totalVentas)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl relative overflow-hidden">
              <div className="absolute right-0 top-0 w-16 h-full bg-primary/5 -skew-x-12 translate-x-4"></div>
              <div className="text-[10px] text-primary font-bold mb-1 tracking-widest uppercase flex items-center gap-1">
                <span className="material-icons-round text-base">info</span>
                <span>Información</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
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
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="panel-title mb-0">Estado de Inventario</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono">{articulos.length} items</div>
            </div>
            {/* Mobile cards */}
            <div className="block md:hidden divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {articulos.map(a => (
                <div key={a.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-primary font-bold text-[10px]">{a.codigo}</span>
                        <span className={`badge ${(a.stock ?? 0) === 0 ? 'badge-r' : (a.stock ?? 0) <= 3 ? 'badge-y' : 'badge-g'} font-mono !text-[10px]`}>Stock: {a.stock ?? 0}</span>
                      </div>
                      <p className="font-bold text-slate-800 text-sm leading-tight truncate">{a.descripcion}</p>
                      {a.marca && <p className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">{a.marca}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-slate-800">{fmtUSD(a.precio)}</div>
                      <div className="font-mono text-[10px] text-slate-400">Val: {fmtUSD((a.stock || 0) * a.precio)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto min-h-[400px]">
              <table className="w-full">
                <thead><tr><th>Cód.</th><th>Descripción</th><th>Marca</th><th className="text-center">Stock</th><th>Precio</th><th className="text-right">Valor Total</th></tr></thead>
                <tbody>
                  {articulos.map(a => (
                    <tr key={a.id}>
                      <td className="font-mono text-primary font-bold">{a.codigo}</td>
                      <td className="font-bold text-slate-700 text-sm">{a.descripcion}</td>
                      <td className="text-slate-400 text-[11px] font-bold uppercase">{a.marca}</td>
                      <td className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`badge ${(a.stock ?? 0) === 0 ? 'badge-r' : (a.stock ?? 0) <= 3 ? 'badge-y' : 'badge-g'}`}>{a.stock ?? 0}</span>
                          <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${a.stock > 10 ? 'bg-green-500' : a.stock > 3 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${Math.min(100, (a.stock / 20) * 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-[11px] text-slate-500 font-bold">{fmtUSD(a.precio)}</td>
                      <td className="font-mono text-slate-800 text-right font-bold">{fmtUSD((a.stock || 0) * a.precio)}</td>
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
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="panel-title mb-0">Cuentas por Cobrar Pendientes</div>
            </div>
            {/* Mobile cards */}
            <div className="block md:hidden divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {ctas_cobrar.map(c => {
                const pagado = abonos.filter(a => a.cuenta_id === c.id && a.tipo_cuenta === 'COBRAR').reduce((s, x) => s + x.monto, 0)
                const pendiente = c.monto - pagado
                const dias = Math.ceil((new Date(c.vencimiento) - new Date()) / (1000 * 60 * 60 * 24))
                return (
                  <div key={c.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-700 text-sm">{c.cliente}</p>
                        <p className="text-[10px] text-slate-400">Vence: {fmtDate(c.vencimiento)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-black text-slate-800">{fmtUSD(pendiente)}</div>
                        <div className="font-mono text-[10px] text-slate-400">de {fmtUSD(c.monto)}</div>
                        <span className={`badge mt-1 ${pendiente <= 0 ? 'badge-g' : dias < 0 ? 'badge-r' : 'badge-y'}`}>{pendiente <= 0 ? 'COBRADA' : dias < 0 ? 'VENCIDA' : c.estado}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {ctas_cobrar.length === 0 && <div className="text-center text-slate-400 py-12 text-[10px] font-bold uppercase">Sin cuentas pendientes ✅</div>}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto min-h-[400px]">
              <table className="w-full">
                <thead><tr><th>Cliente</th><th className="text-right">Total</th><th className="text-right">Pendiente</th><th>Vencimiento</th><th className="text-right">Estado</th></tr></thead>
                <tbody>
                  {ctas_cobrar.map(c => {
                    const pagado = abonos.filter(a => a.cuenta_id === c.id && a.tipo_cuenta === 'COBRAR').reduce((s, x) => s + x.monto, 0)
                    const pendiente = c.monto - pagado
                    const dias = Math.ceil((new Date(c.vencimiento) - new Date()) / (1000 * 60 * 60 * 24))
                    return (
                      <tr key={c.id}>
                        <td className="font-bold text-slate-700">{c.cliente}</td>
                        <td className="font-mono text-slate-400 text-xs text-right">{fmtUSD(c.monto)}</td>
                        <td className="font-mono text-slate-800 font-bold text-right">{fmtUSD(pendiente)}</td>
                        <td className="text-slate-500 text-[11px] font-bold">{fmtDate(c.vencimiento)}</td>
                        <td className="text-right flex justify-end gap-1">
                          <button onClick={() => sendWhatsappStatement(c)} className="bg-green-50 text-green-600 p-1.5 rounded-lg hover:bg-green-100 flex items-center gap-1 text-[10px] font-bold">
                            📲 WHATSAPP
                          </button>
                          <span className={`badge ${pendiente <= 0 ? 'badge-g' : dias < 0 ? 'badge-r' : 'badge-y'}`}>{pendiente <= 0 ? 'COBRADA' : dias < 0 ? 'VENCIDA' : c.estado}</span>
                        </td>
                      </tr>
                    )
                  })}
                  {ctas_cobrar.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-12 tracking-widest text-[10px] font-bold uppercase opacity-50">Sin cuentas pendientes ✅</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      {
        tab === 'pagar' && (
          <div className="panel p-0 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="panel-title mb-0">Cuentas por Pagar Pendientes</div>
            </div>
            {/* Mobile cards */}
            <div className="block md:hidden divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {ctas_pagar.map(c => {
                const pagado = abonos.filter(a => a.cuenta_id === c.id && a.tipo_cuenta === 'PAGAR').reduce((s, x) => s + x.monto, 0)
                const pendiente = c.monto - pagado
                return (
                  <div key={c.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-700 text-sm">{c.proveedor}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">{c.concepto}</p>
                        <p className="text-[10px] text-slate-400">Vence: {fmtDate(c.vencimiento)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-black text-rose-500">{fmtUSD(pendiente)}</div>
                        <div className="font-mono text-[10px] text-slate-400">de {fmtUSD(c.monto)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {ctas_pagar.length === 0 && <div className="text-center text-slate-400 py-12 text-[10px] font-bold uppercase">Sin cuentas pendientes ✅</div>}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto min-h-[400px]">
              <table className="w-full">
                <thead><tr><th>Proveedor</th><th>Concepto</th><th className="text-right">Total</th><th className="text-right">Pendiente</th><th className="text-right">Vencimiento</th></tr></thead>
                <tbody>
                  {ctas_pagar.map(c => {
                    const pagado = abonos.filter(a => a.cuenta_id === c.id && a.tipo_cuenta === 'PAGAR').reduce((s, x) => s + x.monto, 0)
                    const pendiente = c.monto - pagado
                    return (
                      <tr key={c.id}>
                        <td className="font-bold text-slate-700">{c.proveedor}</td>
                        <td className="text-slate-500 text-[10px] font-bold uppercase tracking-tighter">{c.concepto}</td>
                        <td className="font-mono text-slate-400 text-xs text-right">{fmtUSD(c.monto)}</td>
                        <td className="font-mono text-rose-500 font-bold text-right">{fmtUSD(pendiente)}</td>
                        <td className="text-slate-400 text-[11px] font-bold text-right">{fmtDate(c.vencimiento)}</td>
                      </tr>
                    )
                  })}
                  {ctas_pagar.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-12 tracking-widest text-[10px] font-bold uppercase opacity-50">Sin cuentas pendientes ✅</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      {
        tab === 'cierres' && (
          <div className="panel p-0 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="panel-title mb-0">Historial de Cierres Z</div>
            </div>
            {/* Mobile cards */}
            <div className="block md:hidden divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {cierres.map(c => (
                <div key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-700 text-sm">{fmtDate(c.fecha_apertura)}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">{c.usuario}</p>
                      <span className="badge badge-g mt-1">{c.notas_del_dia?.length || 0} notas</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-slate-800">{fmtUSD(c.cierre_z?.esperadoUsd || 0)}</div>
                      <div className="font-mono text-[10px] text-slate-500">Bs {(c.cierre_z?.esperadoBs || 0).toFixed(2)}</div>
                      <div className={`font-mono text-[10px] font-bold ${c.diferencia_usd < -0.01 ? 'text-red-500' : c.diferencia_usd > 0.01 ? 'text-green-600' : 'text-slate-400'}`}>
                        Dif: {fmtUSD(c.diferencia_usd)}
                      </div>
                      <button className="btn btn-gr !py-1 !px-2 text-[9px] mt-1" onClick={() => { setSelectedCierre(c); setShowCierreModal(true) }}>VER DETALLE</button>
                    </div>
                  </div>
                </div>
              ))}
              {cierres.length === 0 && <div className="text-center text-slate-400 py-12 text-[10px] font-bold uppercase">No hay cierres registrados</div>}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto min-h-[400px]">
              <table className="w-full">
                <thead><tr><th>Fecha</th><th>Cajero</th><th className="text-center">Notas</th><th className="text-right">Total USD</th><th className="text-right">Total BS</th><th className="text-right">Diferencia $</th><th className="text-right">Acción</th></tr></thead>
                <tbody>
                  {cierres.map(c => (
                    <tr key={c.id}>
                      <td className="font-bold text-slate-700">{fmtDate(c.fecha_apertura)}</td>
                      <td className="text-slate-500 text-[11px] font-bold uppercase">{c.usuario}</td>
                      <td className="text-center"><span className="badge badge-g">{c.notas_del_dia?.length || 0}</span></td>
                      <td className="font-mono text-slate-800 font-bold text-right">{fmtUSD(c.cierre_z?.esperadoUsd || 0)}</td>
                      <td className="font-mono text-slate-800 font-bold text-right">Bs {(c.cierre_z?.esperadoBs || 0).toFixed(2)}</td>
                      <td className={`font-mono font-bold text-right ${c.diferencia_usd < -0.01 ? 'text-red-500' : c.diferencia_usd > 0.01 ? 'text-green-600' : 'text-slate-400'}`}>{fmtUSD(c.diferencia_usd)}</td>
                      <td className="text-right"><button className="btn btn-gr !py-1 !px-3 text-[10px]" onClick={() => { setSelectedCierre(c); setShowCierreModal(true) }}>VER DETALLE</button></td>
                    </tr>
                  ))}
                  {cierres.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-12 tracking-widest text-[10px] font-bold uppercase opacity-50">No hay cierres registrados</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
      {/* Modal de Reimpresión */}
      <Modal open={showReimprimirModal} onClose={() => setShowReimprimirModal(false)} title="REIMPRIMIR TICKET">
        <div className="space-y-6">
          <div className="bg-slate-50 p-2 rounded-xl scale-90 origin-top overflow-hidden border border-slate-100">
            <TicketTermico ref={ticketRef} nota={selectedVenta} config={configEmpresa} isCopia={true} />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button className="btn btn-primary py-4 font-black flex items-center justify-center gap-3" onClick={handlePrintTicket}>
              <span className="material-icons-round">print</span>
              IMPRIMIR CABLE / RED
            </button>

            <button className={`btn py-4 font-black flex items-center justify-center gap-3 transition-all
              ${btStatus === 'CONNECTED' ? 'bg-blue-600 text-white' :
                btStatus === 'CONNECTING' ? 'bg-amber-500 text-white animate-pulse' : 'bg-slate-800 text-slate-300'}`}
              onClick={handlePrintBT}>
              <span className="material-icons-round">
                {btStatus === 'CONNECTED' ? 'print' : btStatus === 'CONNECTING' ? 'sync' : 'bluetooth'}
              </span>
              {btStatus === 'CONNECTED' ? 'IMPRIMIR BLUETOOTH' :
                btStatus === 'CONNECTING' ? 'CONECTANDO...' : 'VINCULAR BLUETOOTH'}
            </button>

            <button className="btn btn-gr py-3 font-bold mt-2" onClick={() => setShowReimprimirModal(false)}>CANCELAR</button>
          </div>
        </div>
      </Modal>

      {/* Modal Detalle de Cierre */}
      <Modal open={showCierreModal} onClose={() => setShowCierreModal(false)} title="RESUMEN DE CIERRE DE CAJA">
        {selectedCierre && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Cajero</p>
                  <p className="text-sm font-bold text-slate-800">{selectedCierre.usuario}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Fecha</p>
                  <p className="text-sm font-bold text-slate-800">{fmtDate(selectedCierre.fecha_apertura)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Desglose de Operaciones</p>
              <div className="panel bg-white space-y-3">
                <CierreRow label="Inicial en Caja ($)" val={selectedCierre.monto_inicial_usd} />
                <CierreRow label="Efectivo Recibido ($)" val={selectedCierre.cierre_z?.efectivoUsd} />
                <CierreRow label="Zelle / Otros ($)" val={(selectedCierre.cierre_z?.zelle || 0) + (selectedCierre.cierre_z?.otros || 0)} />
                <CierreRow label="Ingresos Extra C.C. ($)" val={selectedCierre.cierre_z?.ingresosCC || 0} />
                <CierreRow label="Egresos / Gastos C.C. ($)" val={-(selectedCierre.cierre_z?.egresosCC || 0)} />
                <div className="pt-2 border-t border-slate-100 flex justify-between">
                  <span className="text-xs font-black text-slate-800">TOTAL ESPERADO ($)</span>
                  <span className="text-sm font-mono font-black text-green-600">{fmtUSD(selectedCierre.cierre_z?.esperadoUsd)}</span>
                </div>
              </div>

              <div className="panel bg-white space-y-3">
                <CierreRow label="Inicial en Caja (Bs)" val={selectedCierre.monto_inicial_bs} isBs />
                <CierreRow label="Efectivo Recibido (Bs)" val={selectedCierre.cierre_z?.efectivoBs} isBs />
                <CierreRow label="Pago Móvil / Punto (Bs)" val={(selectedCierre.cierre_z?.pagoMovil || 0) + (selectedCierre.cierre_z?.punto || 0)} isBs />
                <div className="pt-2 border-t border-slate-100 flex justify-between">
                  <span className="text-xs font-black text-slate-800">TOTAL ESPERADO (BS)</span>
                  <span className="text-sm font-mono font-black text-blue-600">Bs {(selectedCierre.cierre_z?.esperadoBs || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-amber-800 uppercase">Contado Físico</span>
                  <span className="text-sm font-mono font-black text-amber-900">{fmtUSD(selectedCierre.monto_fisico_usd)}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-amber-200/50 mt-1">
                  <span className="text-[10px] font-black text-amber-800 uppercase">Diferencia Final</span>
                  <span className={`text-sm font-mono font-black ${selectedCierre.diferencia_usd < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {fmtUSD(selectedCierre.diferencia_usd)}
                  </span>
                </div>
              </div>
            </div>

            <button className="btn btn-gr w-full py-4 font-black" onClick={() => setShowCierreModal(false)}>
              CERRAR VISTA
            </button>
          </div>
        )}
      </Modal>

      {/* Modal Anulación */}
      <Modal open={showAnularModal} onClose={() => setShowAnularModal(false)} title="Anular Venta">
        <div className="space-y-4">
          <div className="bg-red-50 p-3 rounded-xl border border-red-100">
            <p className="text-[10px] text-red-600 font-bold uppercase mb-1">Atención</p>
            <p className="text-xs text-red-800">
              Está por anular la nota <strong>#{ventaParaAnular?.nro}</strong>. Esta acción devolverá los productos al stock y cancelará deudas pendientes.
            </p>
          </div>

          <div className="field">
            <label>Motivo de Anulación</label>
            <textarea className="inp w-full !py-2 h-20 resize-none text-xs"
              placeholder="Ej: Error en precio, El cliente ya no lo quiere..."
              value={motivoAnulacion}
              onChange={e => setMotivoAnulacion(e.target.value)}
            />
          </div>

          <div className="field">
            <label>PIN de Autorización (Admin/Supervisor)</label>
            <input type="password"
              className="inp w-full !py-3 text-center font-mono text-xl tracking-[1em]"
              maxLength={4}
              placeholder="****"
              value={pinAnulacion}
              onChange={e => setPinAnulacion(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button className="btn btn-gr flex-1" onClick={() => setShowAnularModal(false)}>Cancelar</button>
            <button className="btn bg-red-600 text-white flex-1 font-black" onClick={handleAnular}>CONFIRMAR ANULACIÓN</button>
          </div>
        </div>
      </Modal>

    </div>
  )
}

function CierreRow({ label, val, isBs }) {
  return (
    <div className="flex justify-between items-center text-[11px]">
      <span className="text-slate-500 font-bold uppercase">{label}</span>
      <span className="font-mono text-slate-800 font-bold">{isBs ? `Bs ${(val || 0).toFixed(2)}` : fmtUSD(val || 0)}</span>
    </div>
  )
}
