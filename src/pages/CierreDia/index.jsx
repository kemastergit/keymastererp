import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { fmtUSD, fmtBS, fmtDate, today } from '../../utils/format'
import { printReporte } from '../../utils/print'
import useStore from '../../store/useStore'

export default function CierreDia() {
  const { toast, currentUser, tasa } = useStore()
  const [fecha, setFecha] = useState(today())

  // Estado para Arqueo Físico
  const [arqueo, setArqueo] = useState({
    efectivo_usd: '',
    efectivo_bs: '',
    punto_venta: '',
    pago_movil: '',
    gastos_justificados: ''
  })

  const handleArqueoChange = (k, v) => setArqueo(prev => ({ ...prev, [k]: v }))

  const ventas = useLiveQuery(
    () => db.ventas.filter(v => {
      const d = new Date(v.fecha)
      return d.toISOString().split('T')[0] === fecha && v.estado !== 'ANULADA'
    }).toArray(),
    [fecha], []
  )

  const cobros = useLiveQuery(
    () => db.abonos.filter(a => {
      const d = new Date(a.fecha)
      return d.toISOString().split('T')[0] === fecha && a.estado !== 'ANULADA'
    }).toArray(),
    [fecha], []
  )

  // Cálculos del Sistema (Teóricos)
  const totalVentas = ventas.reduce((s, v) => s + (v.total || 0), 0)

  // Desglose por método (de los abonos/pagos recibidos hoy)
  const porMetodo = (metodo) => cobros.filter(c => c.metodo === metodo).reduce((s, c) => s + (c.monto || 0), 0)

  const sysEfectivoUSD = porMetodo('EFECTIVO_USD')
  const sysEfectivoBS = porMetodo('EFECTIVO_BS')
  const sysPunto = porMetodo('PUNTO_VENTA')
  const sysPagoMovil = porMetodo('PAGO_MOVIL') + porMetodo('ZELLE')

  // Totales Físicos vs Sistema
  const fisicoUSD = parseFloat(arqueo.efectivo_usd) || 0
  const fisicoBS = parseFloat(arqueo.efectivo_bs) || 0
  const fisicoPunto = parseFloat(arqueo.punto_venta) || 0
  const fisicoPM = parseFloat(arqueo.pago_movil) || 0

  const difUSD = fisicoUSD - sysEfectivoUSD
  const difBS = fisicoBS - sysEfectivoBS
  const difPunto = fisicoPunto - sysPunto
  const difPM = fisicoPM - sysPagoMovil

  const imprimirCierre = () => {
    const columnas = ['CATEGORÍA', 'SISTEMA (TEÓRICO)', 'CONTEO FÍSICO', 'DIFERENCIA']
    const data = [
      ['EFECTIVO USD', fmtUSD(sysEfectivoUSD), fmtUSD(fisicoUSD), fmtUSD(difUSD)],
      ['EFECTIVO BS', fmtBS(sysEfectivoBS * tasa, tasa), fmtBS(fisicoBS * tasa, tasa), fmtBS(difBS * tasa, tasa)],
      ['PUNTO DE VENTA', fmtUSD(sysPunto), fmtUSD(fisicoPunto), fmtUSD(difPunto)],
      ['PAGO MÓVIL / ZELLE', fmtUSD(sysPagoMovil), fmtUSD(fisicoPM), fmtUSD(difPM)],
      [''],
      ['RESUMEN DE VENTAS', '', '', ''],
      ['TOTAL VENTAS BRUTAS', fmtUSD(totalVentas), '', ''],
      ['NOTAS PROCESADAS', String(ventas.length), '', '']
    ]

    printReporte(`CIERRE DE CAJA - ${fecha}`, columnas, data, {
      'DIFERENCIA TOTAL USD': fmtUSD(difUSD + (difBS / tasa) + difPunto + difPM),
      'TOTAL EN CAJA (CONTEO)': fmtUSD(fisicoUSD + (fisicoBS / tasa) + fisicoPunto + fisicoPM)
    })
  }

  const cerrarDia = async () => {
    if (fecha > today()) { toast('❌ No puede cerrar un día que aún no ha llegado', 'error'); return }
    if (!confirm('¿CONFIRMAR CIERRE? El arqueo será registrado y auditado como inmutable.')) return

    await db.cierre_dia.add({
      fecha,
      sys_usd: sysEfectivoUSD,
      fisico_usd: fisicoUSD,
      diferencia_usd: difUSD,
      ventas_totales: totalVentas,
      timestamp: new Date(),
      usuario_id: currentUser?.id
    })

    const { logAction } = await import('../../utils/audit')
    logAction(currentUser, 'CIERRE_Z', {
      fecha,
      diferencia_global: difUSD + (difBS / tasa),
      ventas: ventas.length
    })

    toast('✅ Cierre y Arqueo registrados exitosamente', 'ok')
    imprimirCierre()
  }

  const Card = ({ label, value, color = 'text-slate-800', sysValue }) => (
    <div className="bg-[var(--surface)] border-l-4 p-4 shadow-sm border-[var(--border-var)] flex flex-col justify-center"
      style={{ borderLeftColor: label.includes('Ventas') ? '#0d9488' : label.includes('Faltante') ? '#dc2626' : '#e2e8f0' }}>
      <div className="text-[9px] text-slate-400 tracking-widest uppercase mb-1 font-black">{label}</div>
      <div className={`font-mono font-bold text-xl ${color}`}>{fmtUSD(value)}</div>
      {sysValue !== undefined && (
        <div className="text-[9px] text-slate-400 mt-1 font-bold">SISTEMA: {fmtUSD(sysValue)}</div>
      )}
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--surface2)]">
      {/* HEADER PROFESIONAL */}
      <div className="flex-none bg-[var(--surface)] border-b-2 border-[var(--border-var)] p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0d9488] flex items-center justify-center text-white shadow-lg rounded-lg">
              <span className="material-icons-round">account_balance_wallet</span>
            </div>
            <div>
              <h2 className="font-black text-lg uppercase tracking-tight text-slate-800">
                Arqueo de Caja y Cierre Z
              </h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Auditoría y cuadre de efectivo diario
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-100 p-1 px-2 border border-slate-200">
              <span className="material-icons-round text-sm text-slate-400">calendar_today</span>
              <input type="date" className="bg-transparent border-none text-[11px] font-black focus:ring-0 p-1 uppercase"
                max={today()}
                value={fecha} onChange={e => { if (e.target.value > today()) { toast('⚠️ No se permite fecha futura', 'warn'); return } setFecha(e.target.value) }} />
            </div>
            <button className="bg-[#0d9488] text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-[#0b7a6f] transition-all flex items-center gap-2 shadow-sm"
              onClick={imprimirCierre}>
              <span className="material-icons-round text-sm">print</span>
              Pre-Cierre
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scroll">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* PANEL DE CONTEO FÍSICO */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-[var(--surface)] border-2 border-[var(--border-var)] overflow-hidden shadow-sm">
              <div className="p-3 bg-slate-50 border-b border-[var(--border-var)] flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                  <span className="material-icons-round text-sm text-[#0d9488]">payments</span>
                  Conteo Físico de Efectivo y Medios
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Valores en tiempo real</span>
              </div>

              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Efectivo USD ($)</label>
                  <div className="relative">
                    <input type="number"
                      className="w-full bg-slate-50 border-2 border-slate-200 p-3 font-mono font-black text-xl text-emerald-600 focus:border-[#0d9488] focus:bg-white transition-all outline-none"
                      placeholder="0.00" value={arqueo.efectivo_usd} onChange={e => handleArqueoChange('efectivo_usd', e.target.value)} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">TOTAL $ EN CAJA</span>
                  </div>
                  <div className="flex justify-between px-1">
                    <span className="text-[9px] font-bold text-slate-400">DIFERENCIA:</span>
                    <span className={`text-[9px] font-black ${difUSD < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmtUSD(difUSD)}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Efectivo BS (Bs)</label>
                  <div className="relative">
                    <input type="number"
                      className="w-full bg-slate-50 border-2 border-slate-200 p-3 font-mono font-black text-xl text-indigo-600 focus:border-[#0d9488] focus:bg-white transition-all outline-none"
                      placeholder="0.00" value={arqueo.efectivo_bs} onChange={e => handleArqueoChange('efectivo_bs', e.target.value)} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">TOTAL Bs EN CAJA</span>
                  </div>
                  <div className="flex justify-between px-1">
                    <span className="text-[9px] font-bold text-slate-400">DIFERENCIA:</span>
                    <span className={`text-[9px] font-black ${difBS < 0 ? 'text-red-600' : 'text-indigo-600'}`}>{fmtBS(difBS * tasa, tasa)}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Punto de Venta ($)</label>
                  <input type="number"
                    className="w-full bg-slate-50 border-2 border-slate-200 p-3 font-mono font-black text-xl text-blue-600 focus:border-[#0d9488] focus:bg-white transition-all outline-none"
                    placeholder="0.00" value={arqueo.punto_venta} onChange={e => handleArqueoChange('punto_venta', e.target.value)} />
                  <div className="flex justify-between px-1">
                    <span className="text-[9px] font-bold text-slate-400">CIERRE LOTE:</span>
                    <span className={`text-[9px] font-black ${difPunto < 0 ? 'text-red-600' : 'text-blue-600'}`}>{fmtUSD(difPunto)}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Pago Móvil / Zelle ($)</label>
                  <input type="number"
                    className="w-full bg-slate-50 border-2 border-slate-200 p-3 font-mono font-black text-xl text-purple-600 focus:border-[#0d9488] focus:bg-white transition-all outline-none"
                    placeholder="0.00" value={arqueo.pago_movil} onChange={e => handleArqueoChange('pago_movil', e.target.value)} />
                  <div className="flex justify-between px-1">
                    <span className="text-[9px] font-bold text-slate-400">TRANSFERENCIAS:</span>
                    <span className={`text-[9px] font-black ${difPM < 0 ? 'text-red-600' : 'text-purple-600'}`}>{fmtUSD(difPM)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-[var(--border-var)] flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Diferencia Neta</div>
                    <div className={`font-mono font-black text-lg ${difUSD + (difBS / tasa) + difPunto + difPM < 0 ? 'text-red-600' : 'text-[#0d9488]'}`}>
                      {fmtUSD(difUSD + (difBS / tasa) + difPunto + difPM)}
                    </div>
                  </div>
                  <div className="w-[1px] h-8 bg-slate-200 hidden sm:block"></div>
                  <div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estado</div>
                    <div className={`inline-flex items-center px-2 py-0.5 text-[8px] font-black uppercase border ${Math.abs(difUSD + difPunto) < 0.1 ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-red-100 text-red-700 border-red-300'}`}>
                      {Math.abs(difUSD + difPunto) < 0.1 ? 'CUADRADO' : 'DESCUADRE DETECTADO'}
                    </div>
                  </div>
                </div>
                <button className="w-full sm:w-auto bg-[#0d9488] text-white px-8 py-3 text-xs font-black uppercase tracking-widest hover:bg-[#0b7a6f] shadow-lg flex items-center justify-center gap-2"
                  onClick={cerrarDia}>
                  <span className="material-icons-round">lock_person</span>
                  Cerrar y Sellar Día
                </button>
              </div>
            </div>

            {/* TABLAS DE RESPALDO (Ventas y Cobros) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-[var(--surface)] border-2 border-[var(--border-var)] overflow-hidden shadow-sm">
                <div className="p-3 bg-slate-50 border-b border-[var(--border-var)] flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Facturas del Período</span>
                  <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[8px] font-black rounded">{ventas.length}</span>
                </div>
                <div className="max-h-60 overflow-y-auto custom-scroll">
                  <table className="w-full text-[11px]">
                    <thead><tr className="bg-slate-800 text-white"><th className="p-2 text-[9px] font-black uppercase tracking-widest border-r border-slate-700">N°</th><th className="p-2 text-[9px] font-black uppercase tracking-widest border-r border-slate-700">Cliente</th><th className="p-2 text-right text-[9px] font-black uppercase tracking-widest">Total</th></tr></thead>
                    <tbody>
                      {ventas.map(v => (
                        <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="p-2 font-mono text-[#0d9488] font-bold">#{v.nro}</td>
                          <td className="p-2 font-bold opacity-70 truncate max-w-[100px]">{v.cliente}</td>
                          <td className="p-2 text-right font-mono font-black">{fmtUSD(v.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-[var(--surface)] border-2 border-[var(--border-var)] overflow-hidden shadow-sm">
                <div className="p-3 bg-slate-50 border-b border-[var(--border-var)] flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Abonos y Cobranzas</span>
                  <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[8px] font-black rounded">{cobros.length}</span>
                </div>
                <div className="max-h-60 overflow-y-auto custom-scroll">
                  <table className="w-full text-[11px]">
                    <thead><tr className="bg-slate-800 text-white"><th className="p-2 text-[9px] font-black uppercase tracking-widest border-r border-slate-700">Medio</th><th className="p-2 text-right text-[9px] font-black uppercase tracking-widest">Monto</th></tr></thead>
                    <tbody>
                      {cobros.map(c => (
                        <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="p-2">
                            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200">
                              {c.metodo?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-600">{fmtUSD(c.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* KPIs DE CONTROL LATERAL */}
          <div className="space-y-4">
            <Card label="Total Ventas (Facturado)" value={totalVentas} color="text-[#0d9488]" />
            <Card label="Efectivo en Sistema ($)" value={sysEfectivoUSD} color="text-emerald-700" />
            <Card label="Efectivo en Sistema (Bs)" value={sysEfectivoBS} color="text-indigo-700" />
            <div className="h-[1px] bg-slate-200 my-2"></div>
            <Card label="Diferencia USD" value={difUSD} color={difUSD < 0 ? 'text-red-600' : 'text-emerald-600'} sysValue={sysEfectivoUSD} />
            <Card label="Diferencia BS" value={difBS} color={difBS < 0 ? 'text-red-500' : 'text-indigo-600'} sysValue={sysEfectivoBS} />
            <Card label="Diferencia Punto" value={difPunto} color={difPunto < 0 ? 'text-red-600' : 'text-blue-600'} sysValue={sysPunto} />

            <div className="bg-orange-50 border-2 border-orange-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-orange-700">
                <span className="material-icons-round text-sm">info</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">Protocolo Z</span>
              </div>
              <p className="text-[9px] text-orange-600 leading-relaxed font-bold">
                El Cierre Z sincroniza los datos con la NUBE. Una vez sellado, no podrá editar el conteo físico de este día. Asegúrese de que el Punto de Venta esté cuadrado con sus vouchers.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
