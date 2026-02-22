import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { fmtUSD, fmtDate, today } from '../../utils/format'
import useStore from '../../store/useStore'

export default function CierreDia() {
  const toast = useStore(s => s.toast)
  const [fecha, setFecha] = useState(today())

  const ventas = useLiveQuery(
    () => db.ventas.filter(v => {
      const d = new Date(v.fecha)
      return d.toISOString().split('T')[0] === fecha
    }).toArray(),
    [fecha], []
  )

  const caja = useLiveQuery(
    () => db.caja_chica.where('fecha').equals(fecha).toArray(),
    [fecha], []
  )

  const cobros = useLiveQuery(
    () => db.ctas_cobrar.filter(c => {
      if (!c.fecha_cobro) return false
      const d = new Date(c.fecha_cobro)
      return d.toISOString().split('T')[0] === fecha
    }).toArray(),
    [fecha], []
  )

  const totalVentas = ventas.reduce((s, v) => s + (v.total || 0), 0)
  const ventasContado = ventas.filter(v => v.tipo_pago !== 'CREDITO').reduce((s, v) => s + v.total, 0)
  const ventasCredito = ventas.filter(v => v.tipo_pago === 'CREDITO').reduce((s, v) => s + v.total, 0)
  const totalCobros = cobros.reduce((s, c) => s + (c.monto_cobrado || c.monto || 0), 0)
  const ingresosCaja = caja.filter(m => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
  const egresosCaja = caja.filter(m => m.tipo === 'EGRESO').reduce((s, m) => s + m.monto, 0)

  const cerrarDia = async () => {
    await db.cierre_dia.add({
      fecha, total_ventas: totalVentas, ventas_contado: ventasContado,
      ventas_credito: ventasCredito, total_cobros: totalCobros,
      ingresos_caja: ingresosCaja, egresos_caja: egresosCaja,
      timestamp: new Date()
    })
    toast('✅ Cierre del día registrado')
  }

  const Card = ({ label, value, color = 'text-slate-800' }) => (
    <div className="panel border-l-4 flex flex-col justify-center" style={{ borderColor: label.includes('Ventas') ? 'var(--primary)' : '#e2e8f0' }}>
      <div className="text-[10px] text-slate-400 tracking-widest uppercase mb-1 font-bold">{label}</div>
      <div className={`font-mono font-bold text-2xl ${color}`}>{fmtUSD(value)}</div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1">
            <div className="panel-title !m-0 !p-0">Cierre de Día</div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Resumen contable diario</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="field !m-0">
              <input type="date" className="inp !py-2 !px-3" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <button className="btn btn-r" onClick={cerrarDia}>
              <span className="material-icons-round text-base">fact_check</span>
              <span>Procesar Cierre</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card label="Total Ventas" value={totalVentas} color="text-primary" />
        <Card label="Ventas Contado" value={ventasContado} color="text-green-600" />
        <Card label="Ventas Crédito" value={ventasCredito} color="text-amber-600" />
        <Card label="Cobros del Día" value={totalCobros} color="text-primary-dark" />
        <Card label="Ingresos Caja" value={ingresosCaja} color="text-green-600" />
        <Card label="Egresos Caja" value={egresosCaja} color="text-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div className="panel-title !m-0">Ventas del Día</div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{ventas.length} notas</span>
          </div>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>N° Nota</th><th>Cliente</th><th>Tipo Pago</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {ventas.map(v => (
                  <tr key={v.id}>
                    <td className="font-mono text-primary font-bold">#{v.nro}</td>
                    <td className="font-bold text-slate-700">{v.cliente}</td>
                    <td><span className={`badge ${v.tipo_pago === 'CREDITO' ? 'badge-y' : 'badge-g'}`}>{v.tipo_pago}</span></td>
                    <td className="font-mono text-right font-bold text-slate-800">{fmtUSD(v.total)}</td>
                  </tr>
                ))}
                {ventas.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-slate-400 py-12 tracking-widest text-[10px] font-bold uppercase opacity-50">Sin ventas registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div className="panel-title !m-0">Cobros Recibidos</div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cobros.length} recibos</span>
          </div>
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>Cliente</th><th className="text-right">Monto</th></tr></thead>
              <tbody>
                {cobros.map(c => (
                  <tr key={c.id}>
                    <td className="font-bold text-slate-700">{c.cliente}</td>
                    <td className="font-mono text-green-600 text-right font-bold">{fmtUSD(c.monto_cobrado || c.monto)}</td>
                  </tr>
                ))}
                {cobros.length === 0 && (
                  <tr><td colSpan={2} className="text-center text-slate-400 py-12 tracking-widest text-[10px] font-bold uppercase opacity-50">Sin cobros recibidos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
