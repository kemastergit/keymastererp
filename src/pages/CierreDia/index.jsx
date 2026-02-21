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

  const Card = ({ label, value, color = 'text-white' }) => (
    <div className="bg-g3 border border-borde rounded-lg p-3">
      <div className="text-xs text-muted tracking-widest uppercase mb-1">{label}</div>
      <div className={`font-bebas text-2xl ${color}`}>{fmtUSD(value)}</div>
    </div>
  )

  return (
    <div>
      <div className="panel mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="panel-title flex-1" style={{margin:0,paddingBottom:0,border:'none'}}>
            CIERRE DE DÍA
          </div>
          <div className="field" style={{margin:0}}>
            <input type="date" className="inp" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <button className="btn btn-r" onClick={cerrarDia}>📅 CERRAR DÍA</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
        <Card label="Total Ventas" value={totalVentas} color="text-rojo-bright" />
        <Card label="Ventas Contado" value={ventasContado} color="text-green-400" />
        <Card label="Ventas Crédito" value={ventasCredito} color="text-amber-400" />
        <Card label="Cobros del Día" value={totalCobros} color="text-blue-400" />
        <Card label="Ingresos Caja" value={ingresosCaja} color="text-green-400" />
        <Card label="Egresos Caja" value={egresosCaja} color="text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="panel">
          <div className="panel-title">VENTAS DEL DÍA ({ventas.length})</div>
          <div className="tabla-wrap tabla-scroll">
            <table>
              <thead><tr><th>N° NOTA</th><th>CLIENTE</th><th>TIPO PAGO</th><th>TOTAL $</th></tr></thead>
              <tbody>
                {ventas.map(v => (
                  <tr key={v.id}>
                    <td className="font-mono2 text-rojo-bright">#{v.nro}</td>
                    <td className="font-semibold">{v.cliente}</td>
                    <td><span className={`badge ${v.tipo_pago === 'CREDITO' ? 'badge-y' : 'badge-g'}`}>{v.tipo_pago}</span></td>
                    <td className="font-mono2">{fmtUSD(v.total)}</td>
                  </tr>
                ))}
                {ventas.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-muted py-4">SIN VENTAS</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">COBROS RECIBIDOS ({cobros.length})</div>
          <div className="tabla-wrap tabla-scroll">
            <table>
              <thead><tr><th>CLIENTE</th><th>MONTO $</th></tr></thead>
              <tbody>
                {cobros.map(c => (
                  <tr key={c.id}>
                    <td className="font-semibold">{c.cliente}</td>
                    <td className="font-mono2 text-green-400">{fmtUSD(c.monto_cobrado || c.monto)}</td>
                  </tr>
                ))}
                {cobros.length === 0 && (
                  <tr><td colSpan={2} className="text-center text-muted py-4">SIN COBROS</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
