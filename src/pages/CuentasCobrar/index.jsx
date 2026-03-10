import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtDate, isVencido } from '../../utils/format'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/UI/Modal'

export default function CuentasCobrar() {
  const toast = useStore(s => s.toast)
  const [filtro, setFiltro] = useState('TODOS')
  const [cobro, setCobro] = useState(null)
  const [montoCobro, setMontoCobro] = useState('')
  const [metodoCobro, setMetodoCobro] = useState('EFECTIVO_USD')
  const [cuotaSeleccionada, setCuotaSeleccionada] = useState(null)
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [pagosCxc, setPagosCxc] = useState([]) // Nueva lista de multipagos
  const tasa = useStore(s => s.tasa)

  const cuotasAll = useLiveQuery(() => db.cuotas_credito.toArray(), [], [])

  const cuentas = useLiveQuery(
    () => filtro === 'TODOS'
      ? db.ctas_cobrar.orderBy('vencimiento').toArray()
      : db.ctas_cobrar.where('estado').equals(filtro).toArray(),
    [filtro], []
  )

  const abonos = useLiveQuery(() => db.abonos.where('tipo_cuenta').equals('COBRAR').toArray(), [], [])

  const totalPorCobrar = cuentas.reduce((s, c) => {
    if (c.estado === 'COBRADA') return s
    const pagos = abonos.filter(a => a.cuenta_id === c.id).reduce((sum, a) => sum + a.monto, 0)
    return s + (c.monto - pagos)
  }, 0)

  const vencidas = cuentas.filter(c => c.estado !== 'COBRADA' && isVencido(c.vencimiento))

  const isBS = (m) => ['EFECTIVO_BS', 'PAGO_MOVIL', 'PUNTO_VENTA', 'TRANSFERENCIA'].includes(m)

  const handleAddPago = () => {
    const val = parseFloat(montoCobro)
    if (!val || val <= 0) { toast('Monto inválido', 'error'); return }

    const montoUSD = isBS(metodoCobro) ? val / tasa : val
    const montoBS = isBS(metodoCobro) ? val : val * tasa

    setPagosCxc([...pagosCxc, {
      id: Date.now(),
      metodo: metodoCobro,
      monto: montoUSD,
      montoBS,
      tasa
    }])
    setMontoCobro('')
  }

  const removePago = (id) => setPagosCxc(p => p.filter(x => x.id !== id))

  const totalPagadoUSD = pagosCxc.reduce((s, p) => s + p.monto, 0)

  const procesarCobro = async () => {
    if (!cobro || pagosCxc.length === 0) return

    const abonosActuales = abonos.filter(a => a.cuenta_id === cobro.id).reduce((s, x) => s + x.monto, 0)
    const saldoRestante = cobro.monto - abonosActuales

    if (totalPagadoUSD > saldoRestante + 0.05) {
      toast(`⚠️ El total excede el saldo (${fmtUSD(saldoRestante)})`, 'warn'); return
    }

    try {
      const { addToSyncQueue, processSyncQueue } = await import('../../utils/syncManager');
      const now = new Date().toISOString()

      // 1. Procesar cada pago de la lista
      for (const p of pagosCxc) {
        // Registro Local
        const abonoLocalId = await db.abonos.add({
          cuenta_id: cobro.id,
          tipo_cuenta: 'COBRAR',
          fecha: new Date(),
          monto: p.monto,
          metodo: p.metodo
        })

        // Encolar Sincronización
        await addToSyncQueue('abonos', 'INSERT', {
          id: `abono-${cobro.id}-${abonoLocalId}-${Date.now()}`,
          cuenta_id: String(cobro.id),
          tipo_cuenta: 'COBRAR',
          fecha: now,
          monto: p.monto,
          metodo: p.metodo
        });
      }

      // 2. Si hay cuota seleccionada y el monto total coincide
      if (cuotaSeleccionada && Math.abs(totalPagadoUSD - cuotaSeleccionada.monto) < 0.05) {
        await db.cuotas_credito.update(cuotaSeleccionada.id, {
          estado: 'PAGADA',
          fecha_pago: now
        })
        await addToSyncQueue('cuotas_credito', 'UPDATE_ESTADO', {
          venta_id: String(cobro.venta_id),
          numero_cuota: cuotaSeleccionada.numero_cuota,
          estado: 'PAGADA',
          fecha_pago: now
        })
      }

      // 3. ACTUALIZAR CUENTA
      const nuevoTotalAbonado = abonosActuales + totalPagadoUSD
      const nuevoEstado = nuevoTotalAbonado >= cobro.monto - 0.05 ? 'COBRADA' : 'PARCIAL'

      await db.ctas_cobrar.update(cobro.id, {
        estado: nuevoEstado,
        monto_cobrado: nuevoTotalAbonado,
        fecha_cobro: nuevoEstado === 'COBRADA' ? new Date() : null
      })

      // Encolar Actualización en la Nube
      await addToSyncQueue('ctas_cobrar', 'INSERT', {
        id: cobro.id,
        id_local: cobro.id,
        cliente: cobro.cliente,
        monto: cobro.monto,
        monto_total: cobro.monto,
        monto_cobrado: nuevoTotalAbonado,
        estado: nuevoEstado,
        fecha_vencimiento: cobro.vencimiento || null,
        ultima_actualizacion: now
      });

      processSyncQueue();
      toast(`✅ Cobro de ${fmtUSD(totalPagadoUSD)} procesado con éxito`)

      // 4. Comisiones
      if (nuevoEstado === 'COBRADA' && cobro.venta_id) {
        try {
          const venta = cobro.venta_id ? await db.ventas.get(cobro.venta_id) : null
          if (venta) {
            const items = await db.venta_items.where('venta_id').equals(venta.id).toArray()
            const { processSaleCommissions } = await import('../../utils/comisiones')
            await processSaleCommissions(venta.id, { ...venta, tipo_pago: 'CONTADO' }, items)
          }
        } catch (err) { console.error('Error comisiones:', err) }
      }

      setCobro(null); setPagosCxc([]); setMontoCobro(''); setMetodoCobro('EFECTIVO_USD'); setCuotaSeleccionada(null)
    } catch (err) {
      console.error('Error procesando cobro:', err)
      toast('⚠️ Error al registrar cobro: ' + err.message, 'error')
    }
  }

  return (
    <div className="pr-2 pb-6">
      <div className="space-y-4">
        {vencidas.length > 0 && (
          <div className="bg-[var(--surface)] border-2 border-[var(--red-var)] rounded-none px-6 py-5 mb-4 flex flex-col md:flex-row items-center justify-between shadow-[var(--win-shadow)] relative transition-none border-l-8">
            <div className="flex items-center gap-4">
              <span className="material-icons-round text-[var(--red-var)] text-3xl">report_problem</span>
              <div>
                <p className="font-black text-[var(--red-var)] uppercase text-xs tracking-tighter mb-1">ALERTA: CRÉDITOS VENCIDOS</p>
                <p className="text-[10px] font-black text-[var(--text2)] uppercase tracking-widest">{vencidas.length} facturas han superado el plazo de pago</p>
              </div>
            </div>
            <div className="text-right mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-[var(--border-var)] w-full md:w-auto">
              <p className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest mb-1">Monto en Riesgo Total</p>
              <p className="text-2xl font-mono font-black text-[var(--red-var)] bg-[var(--surfaceDark)] px-3 py-1 shadow-inner border border-black/5">
                {fmtUSD(vencidas.reduce((s, c) => {
                  const pagos = abonos.filter(a => a.cuenta_id === c.id).reduce((sum, a) => sum + a.monto, 0)
                  return s + (c.monto - pagos)
                }, 0))}
              </p>
            </div>
          </div>
        )}

        <div className="panel p-0 overflow-hidden rounded-none shadow-[var(--win-shadow)] transition-none border-t-4 border-t-[var(--teal)]">
          <div className="p-5 border-b border-[var(--border-var)] bg-[var(--surface2)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xl font-black text-[var(--text-main)] mb-0 uppercase tracking-tighter flex items-center gap-2">
                <span className="material-icons-round text-[var(--teal)]">receipt_long</span>
                CUENTAS POR COBRAR
              </div>
              <p className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest mt-1">Control Analítico de Cartera y Cobranzas</p>
            </div>
            <div className="flex items-center gap-4 bg-[var(--surface)] p-3 border border-[var(--border-var)] shadow-inner">
              <div className="text-right">
                <p className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest leading-none mb-1">Saldo Total Pendiente</p>
                <p className="text-3xl font-mono font-black text-[var(--teal)] leading-none">{fmtUSD(totalPorCobrar)}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-[var(--surface)] border-b border-[var(--border-var)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
              {['TODOS', 'PENDIENTE', 'PARCIAL', 'COBRADA'].map(f => (
                <button key={f} onClick={() => setFiltro(f)}
                  className={`px-5 py-2 rounded-none text-[10px] font-black uppercase tracking-widest transition-none cursor-pointer border shadow-[var(--win-shadow)] flex-shrink-0
                ${filtro === f ? 'bg-[var(--teal)] text-white border-transparent' : 'bg-[var(--surface2)] text-[var(--text2)] border-[var(--border-var)] hover:bg-[var(--surfaceDark)]'}`}>
                  {f === 'TODOS' ? 'Ver Todo' : f}
                </button>
              ))}
            </div>
            <div className="w-full sm:w-64 relative">
              <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text2)] text-sm">search</span>
              <input
                type="text"
                placeholder="BUSCAR CLIENTE..."
                className="w-full pl-9 pr-4 py-2 text-[10px] font-black uppercase bg-[var(--surface2)] border border-[var(--border-var)] focus:border-[var(--teal)] outline-none shadow-inner"
                onChange={(e) => {
                  const val = e.target.value.toLowerCase()
                  const trs = document.querySelectorAll('.fila-cxc')
                  trs.forEach(tr => {
                    const text = tr.getAttribute('data-search')
                    if (text && text.includes(val)) tr.style.display = ''
                    else tr.style.display = 'none'
                  })
                }}
              />
            </div>
          </div>

          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Nota #</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Cliente</th>
                  <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Total</th>
                  <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Pendiente</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Vencimiento</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Estado</th>
                  <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cuentas.map(c => {
                  const pagos = abonos.filter(a => a.cuenta_id === c.id)
                  const abonado = pagos.reduce((s, x) => s + x.monto, 0)
                  const pendiente = c.monto - abonado
                  const venc = c.estado !== 'COBRADA' && isVencido(c.vencimiento)

                  return (
                    <tr key={c.id} data-search={c.cliente?.toLowerCase() || ''} className={`fila-cxc group transition-all duration-300 ease-in-out cursor-pointer 
                      hover:bg-[var(--teal)]/10 hover:scale-[1.01] hover:shadow-lg relative z-10
                      ${venc ? 'bg-red-50' : 'bg-white'} border-b border-slate-100`}
                      onClick={() => setClienteSeleccionado(c.cliente)}>
                      <td className="py-3 px-4 font-mono text-[var(--teal)] font-black text-xs uppercase transition-colors">
                        {c.venta_id ? `#${String(c.venta_id).padStart(6, '0')}` : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-black text-[var(--text-main)] text-xs uppercase tracking-tight transition-colors">{c.cliente}</div>
                        {pagos.length > 0 && (
                          <div className="text-[8px] font-black text-[var(--teal)] uppercase tracking-widest mt-0.5 transition-colors">{pagos.length} ABONOS REGISTRADOS</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--text2)] text-right text-xs font-bold transition-colors">{fmtUSD(c.monto)}</td>
                      <td className={`py-3 px-4 font-mono text-right font-black transition-colors ${pendiente > 0 ? 'text-[var(--text-main)]' : 'text-[var(--text2)] opacity-30 italic'}`}>
                        {fmtUSD(pendiente)}
                      </td>
                      <td className="py-3 px-4">
                        <div className={`font-black uppercase tracking-tighter text-[10px] transition-colors ${venc ? 'text-[var(--red-var)] bg-[var(--red-var)]/10 px-2 py-0.5' : 'text-[var(--text2)]'}`}>
                          {fmtDate(c.vencimiento)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`badge shadow-sm border border-black/5 transition-colors ${c.estado === 'COBRADA' ? 'badge-g' : c.estado === 'PARCIAL' ? 'bg-[var(--orange-var)] text-white' : venc ? 'bg-[var(--red-var)] text-white' : 'bg-[var(--orange-var)] text-white'}`}>
                          {venc && c.estado !== 'COBRADA' ? 'VENCIDA' : c.estado}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {c.estado !== 'COBRADA' && (
                          <button className="btn bg-[var(--teal)] text-white !py-1.5 !px-4 font-black text-[10px] transition-all shadow-sm cursor-pointer uppercase inline-flex items-center gap-2 hover:bg-[var(--tealDark)]"
                            onClick={(e) => { e.stopPropagation(); setCobro(c); setMontoCobro(pendiente.toFixed(2)) }}>
                            <span className="material-icons-round text-sm">payments</span>
                            <span>ABONAR</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {cuentas.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-[var(--text2)] py-20 tracking-widest text-[11px] font-black uppercase italic opacity-40">Sin registros de cobranza pendientes</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PANEL DE HISTORIAL DE ABONOS */}
        <div className="panel p-0 overflow-hidden transition-none shadow-[var(--win-shadow)] border-t-4 border-t-[var(--teal)] mt-6">
          <div className="p-4 border-b border-[var(--border-var)] bg-[var(--surface2)]">
            <div className="text-sm font-black text-[var(--text-main)] uppercase tracking-tighter flex items-center gap-2">
              <span className="material-icons-round text-[var(--teal)]">history</span>
              HISTORIAL DE ABONOS Y COBROS REALIZADOS
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--surfaceDark)] text-[9px] font-black uppercase text-[var(--text2)] border-b border-[var(--border-var)] sticky top-0 z-10">
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">Cliente / Nota</th>
                  <th className="py-3 px-4">Método</th>
                  <th className="py-3 px-4 text-right">Monto Cobrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-var)]">
                {[...abonos].reverse().map(a => {
                  const c = cuentas.find(x => x.id === a.cuenta_id)
                  return (
                    <tr key={a.id} className="text-[10px] hover:bg-[var(--surface2)] transition-none">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[var(--text2)]">{fmtDate(a.fecha)}</div>
                        <div className="text-[8px] opacity-50">{new Date(a.fecha).toLocaleTimeString()}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-black text-[var(--text-main)] uppercase">{c?.cliente || 'S/C'}</div>
                        <div className="text-[8px] text-[var(--text2)] uppercase truncate max-w-[200px]">Nota: {c?.venta_id ? `#${c.venta_id}` : 'S/N'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-[var(--surfaceDark)] border border-[var(--border-var)] text-[8px] font-black uppercase rounded">
                          {a.metodo?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-[var(--teal)] text-xs">
                        {fmtUSD(a.monto)}
                      </td>
                    </tr>
                  )
                })}
                {abonos.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-[var(--text2)] py-10 text-[10px] uppercase italic opacity-40 font-bold">No hay cobros registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Modal open={!!cobro} onClose={() => { setCobro(null); setCuotaSeleccionada(null); setPagosCxc([]); }} title="REGISTRAR ABONO A CUENTA">
          {cobro && (() => {
            const abonosCuenta = abonos.filter(a => a.cuenta_id === cobro.id).reduce((s, x) => s + x.monto, 0)
            const saldoActual = cobro.monto - abonosCuenta
            const pendienteFinal = saldoActual - totalPagadoUSD
            const cuotasActivas = (cobro.venta_id && cuotasAll) ? cuotasAll.filter(c => c.venta_id === String(cobro.venta_id)).sort((a, b) => a.numero_cuota - b.numero_cuota) : []

            return (
              <div className="space-y-6">
                <div className="p-4 border-2 border-[var(--border-var)] bg-[var(--surfaceDark)] rounded-none grid grid-cols-1 md:grid-cols-3 gap-4 shadow-inner relative overflow-hidden">
                  <div className="relative z-10 border-r md:border-r border-[var(--border-var)] pr-4">
                    <p className="text-[var(--text2)] text-[9px] font-black uppercase tracking-widest mb-1">DEUDA INICIAL</p>
                    <p className="text-sm font-black text-[var(--text-main)]">{fmtUSD(cobro.monto)}</p>
                  </div>
                  <div className="relative z-10 border-r md:border-r border-[var(--border-var)] px-4">
                    <p className="text-[var(--teal)] text-[9px] font-black uppercase tracking-widest mb-1">SALDO PENDIENTE</p>
                    <p className="text-xl font-mono font-black text-[var(--teal)]">{fmtUSD(saldoActual)}</p>
                  </div>
                  <div className="text-right relative z-10 pl-4">
                    <p className="text-[var(--orange-var)] text-[9px] font-black uppercase tracking-widest mb-1">POR PAGAR AHORA</p>
                    <p className={`font-mono font-black text-xl ${pendienteFinal < -0.01 ? 'text-[var(--red-var)]' : 'text-[var(--orange-var)]'}`}>
                      {fmtUSD(pendienteFinal)}
                    </p>
                  </div>
                </div>

                {/* VISOR DE PAGOS AÑADIDOS */}
                {pagosCxc.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-[var(--surface2)] border border-[var(--border-var)] shadow-inner">
                    {pagosCxc.map(p => (
                      <div key={p.id} className="flex items-center justify-between bg-[var(--surface)] p-2 border-l-4 border-[var(--teal)] shadow-sm">
                        <div>
                          <p className="text-[10px] font-black uppercase">{p.metodo.replace(/_/g, ' ')}</p>
                          <p className="text-[9px] text-[var(--text2)] font-mono">
                            {isBS(p.metodo) ? `${p.montoBS.toLocaleString('es-VE')} BS @ ${p.tasa}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-mono font-black text-xs text-[var(--teal)]">{fmtUSD(p.monto)}</p>
                          <button onClick={() => removePago(p.id)} className="material-icons-round text-sm text-[var(--red-var)] cursor-pointer hover:scale-110 transition-transform">delete</button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 flex justify-between border-t border-[var(--border-var)]">
                      <span className="text-[10px] font-black uppercase">Total a Procesar:</span>
                      <span className="text-sm font-black text-[var(--teal)]">{fmtUSD(totalPagadoUSD)}</span>
                    </div>
                  </div>
                )}

                {cuotasActivas.length > 0 && (
                  <div className="border border-[var(--border-var)] bg-[var(--surface)] shadow-inner mb-6">
                    <div className="bg-[var(--surfaceDark)] p-2 text-[10px] font-black uppercase tracking-widest text-[var(--teal)] border-b border-[var(--border-var)] flex items-center gap-2">
                      <span className="material-icons-round text-sm">calendar_month</span>
                      PLAN DE CUOTAS (KACHEA)
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[10px]">
                        <thead>
                          <tr className="bg-[var(--surface2)] border-b border-[var(--border-var)] uppercase text-[var(--text2)]">
                            <th className="p-2 font-black tracking-widest">Cuota</th>
                            <th className="p-2 font-black tracking-widest">Vencimiento</th>
                            <th className="p-2 font-black tracking-widest text-right">Monto</th>
                            <th className="p-2 font-black tracking-widest text-center">Estado</th>
                            <th className="p-2 font-black tracking-widest text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-var)]">
                          {cuotasActivas.map(cc => {
                            const vc = cc.estado !== 'PAGADA' && isVencido(cc.fecha_vencimiento)
                            const isSel = cuotaSeleccionada?.id === cc.id
                            return (
                              <tr key={cc.id} className={`transition-all duration-300 ${vc ? 'bg-red-500/10' : 'hover:bg-[var(--surface2)]'} ${isSel ? 'bg-[var(--teal)] text-white border-2 border-[var(--teal)] shadow-md translate-x-1' : ''}`}>
                                <td className="p-2 font-black tracking-widest">#{cc.numero_cuota}</td>
                                <td className={`p-2 font-bold ${vc && !isSel ? 'text-[var(--red-var)]' : ''}`}>{fmtDate(cc.fecha_vencimiento)}</td>
                                <td className="p-2 font-mono font-black text-right">{fmtUSD(cc.monto)}</td>
                                <td className="p-2 text-center">
                                  <span className={`px-2 py-0.5 border inline-block min-w-[70px] font-black uppercase tracking-widest text-[8px] shadow-sm ${cc.estado === 'PAGADA' ? 'bg-green-500 text-white border-green-600' : 'bg-[var(--surfaceDark)] text-[var(--text-main)] border-[var(--border-var)]'}`}>
                                    {cc.estado}
                                  </span>
                                </td>
                                <td className="p-2 text-right w-32">
                                  {cc.estado !== 'PAGADA' && (
                                    <button onClick={() => { setCuotaSeleccionada(cc); setMontoCobro(cc.monto.toFixed(2)); }}
                                      className={`px-3 py-1 font-black uppercase text-[8px] tracking-widest transition-all cursor-pointer shadow-sm ${isSel ? 'bg-white text-[var(--teal)]' : 'bg-[var(--surfaceDark)] text-[var(--text-main)] hover:bg-[var(--teal)] hover:text-white border border-[var(--border-var)] hover:border-transparent'}`}>
                                      {isSel ? '✔️ SELECCIONADA' : '💰 COBRAR ESTA'}
                                    </button>
                                  )}
                                  {cc.estado === 'PAGADA' && (
                                    <span className="text-[10px] font-black text-green-500 mr-2">OK</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative bg-[var(--surface2)] p-4 border border-[var(--border-var)]">
                  <div className="field">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text2)]">Canal de Pago</label>
                    <select className="inp !py-3 rounded-none focus:border-[var(--teal)] transition-none shadow-inner font-black uppercase text-[10px]" value={metodoCobro} onChange={e => setMetodoCobro(e.target.value)}>
                      <option value="EFECTIVO_USD">💵 EFECTIVO DOLAR ($)</option>
                      <option value="ZELLE">📱 ZELLE (USD)</option>
                      <option value="EFECTIVO_BS">💸 EFECTIVO BOLIVARES (BS)</option>
                      <option value="PAGO_MOVIL">📲 PAGO MÓVIL (BS)</option>
                      <option value="PUNTO_VENTA">💳 PUNTO DE VENTA (BS)</option>
                      <option value="TRANSFERENCIA">🏦 TRANSFERENCIA (BS)</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text2)]">
                      {isBS(metodoCobro) ? `Monto en Bolívares (BS @ ${tasa})` : 'Monto en Dólares ($)'}
                    </label>
                    <div className="relative">
                      <input className="inp font-mono font-black text-lg !py-3 rounded-none bg-[var(--surface)] focus:border-[var(--teal)] transition-none shadow-inner w-full pr-20" type="number"
                        value={montoCobro} onChange={e => { setMontoCobro(e.target.value); }} step="0.01" inputMode="decimal" placeholder="0.00" />

                      {isBS(metodoCobro) && montoCobro > 0 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-[var(--teal)]/10 px-2 py-1 border border-[var(--teal)]/20">
                          <p className="text-[10px] font-black text-[var(--teal)]">{fmtUSD(montoCobro / tasa)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <button
                      onClick={handleAddPago}
                      disabled={!montoCobro || parseFloat(montoCobro) <= 0}
                      className="w-full btn bg-slate-800 text-white !py-3 font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed">
                      <span className="material-icons-round text-sm group-hover:rotate-90 transition-transform">add_circle</span>
                      <span>AÑADIR FORMA DE PAGO</span>
                    </button>
                  </div>
                </div>

                <div className="border-t border-[var(--border-var)] pt-6">
                  <div className="flex gap-4">
                    <button className="btn bg-[var(--surfaceDark)] text-[var(--text-main)] flex-1 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer" onClick={() => { setCobro(null); setCuotaSeleccionada(null); setPagosCxc([]); }}>DESCARTAR</button>
                    <button
                      className="btn bg-[var(--teal)] text-white flex-2 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer tracking-widest disabled:opacity-50"
                      onClick={procesarCobro}
                      disabled={pagosCxc.length === 0}>
                      <span className="material-icons-round text-base">verified</span>
                      <span>{totalPagadoUSD >= saldoActual - 0.05 ? 'COMPLETAR COBRO' : 'REGISTRAR ABONO PARCIAL'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}
        </Modal>

        {/* MODAL DETALLES DEL CLIENTE */}
        <Modal open={!!clienteSeleccionado} onClose={() => setClienteSeleccionado(null)} title={`ESTADO DE CUENTA: ${clienteSeleccionado}`}>
          {clienteSeleccionado && (() => {
            const clientCuentas = cuentas.filter(c => c.cliente === clienteSeleccionado)
            const clientAbonos = abonos.filter(a => clientCuentas.some(c => c.id === a.cuenta_id))
            const totalDeudaC = clientCuentas.reduce((s, c) => s + c.monto, 0)
            const totalAbonadoC = clientAbonos.reduce((s, a) => s + a.monto, 0)
            const saldoTotalC = totalDeudaC - totalAbonadoC

            return (
              <div className="space-y-8 pb-4">
                {/* HERO STATS */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-red-500/10 p-6 rounded-2xl border border-red-500/20 text-center md:text-left">
                    <p className="text-xs font-bold text-[var(--red-var)] uppercase tracking-widest mb-1">Saldo Pendiente</p>
                    <div className="flex items-baseline gap-1 justify-center md:justify-start">
                      <span className="text-5xl font-black text-[var(--red-var)] tracking-tight">{fmtUSD(saldoTotalC)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[var(--surface2)] p-4 rounded-xl border border-[var(--border-var)]">
                      <p className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-widest mb-1">Total Cargado</p>
                      <p className="text-xl font-bold text-[var(--text-main)]">{fmtUSD(totalDeudaC)}</p>
                    </div>
                    <div className="bg-[var(--surface2)] p-4 rounded-xl border border-[var(--border-var)]">
                      <p className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-widest mb-1">Total Abonado</p>
                      <p className="text-xl font-bold text-[var(--text-main)]">{fmtUSD(totalAbonadoC)}</p>
                    </div>
                  </div>
                </div>

                {/* FACTURAS PENDIENTES */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider">Facturas Pendientes</h3>
                    <div className="h-px flex-1 bg-[var(--border-var)]"></div>
                  </div>
                  <div className="space-y-4">
                    {clientCuentas.filter(c => c.estado !== 'COBRADA').map(c => {
                      const pagosC = abonos.filter(a => a.cuenta_id === c.id)
                      const abonadoC = pagosC.reduce((s, x) => s + x.monto, 0)
                      const pendienteC = c.monto - abonadoC
                      return (
                        <div key={c.id} className="bg-[var(--surfaceDark)] rounded-2xl border border-[var(--border-var)] p-5 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500 mb-2">
                                NOTA #{c.venta_id || '—'}
                              </span>
                              <div className="flex items-center gap-1.5 text-[var(--text2)]">
                                <span className="material-icons-round text-[16px]">calendar_today</span>
                                <p className="text-xs font-medium">Vence: <span className={isVencido(c.vencimiento) ? 'text-[var(--red-var)] font-bold' : ''}>{fmtDate(c.vencimiento)}</span></p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-wider">Por Pagar</p>
                              <p className="text-2xl font-bold text-[var(--text-main)]">{fmtUSD(pendienteC)}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => { setClienteSeleccionado(null); setCobro(c); setMontoCobro(pendienteC.toFixed(2)) }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]">
                            <span className="material-icons-round text-[20px]">payments</span>
                            <span>ABONAR NOTA</span>
                          </button>
                        </div>
                      )
                    })}
                    {clientCuentas.filter(c => c.estado !== 'COBRADA').length === 0 && (
                      <div className="text-[10px] uppercase font-bold text-[var(--text2)] tracking-widest text-center py-6 bg-[var(--surface2)] rounded-xl border border-dashed border-[var(--border-var)]">
                        El cliente no tiene facturas pendientes
                      </div>
                    )}
                  </div>
                </div>

                {/* ÚLTIMOS PAGOS */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider">Últimos Pagos</h3>
                    <div className="h-px flex-1 bg-[var(--border-var)]"></div>
                  </div>
                  <div className="space-y-3 max-h-[250px] overflow-y-auto custom-scroll pr-2">
                    {[...clientAbonos].reverse().slice(0, 50).map(a => (
                      <div key={a.id} className="flex items-center justify-between p-4 bg-[var(--surface2)] rounded-xl border border-[var(--border-var)]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-emerald-500">check_circle</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[var(--text-main)]">{a.metodo?.replace(/_/g, ' ')}</p>
                            <div className="flex items-center gap-1 text-[11px] text-[var(--text2)]">
                              <span>{fmtDate(a.fecha)}</span>
                              <span>•</span>
                              <span>{new Date(a.fecha).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[var(--text-main)]">{fmtUSD(a.monto)}</p>
                        </div>
                      </div>
                    ))}
                    {clientAbonos.length === 0 && (
                      <div className="py-4 text-center">
                        <p className="text-xs text-[var(--text2)] font-medium hover:underline cursor-pointer">No hay pagos recientes registrados</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </Modal>
      </div>
    </div>
  )
}
