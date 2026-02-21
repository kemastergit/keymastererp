import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { fmtUSD, fmtDate, today } from '../../utils/format'
import { printReporte } from '../../utils/print'

const primerDiaMes = () => {
  const d = new Date(); d.setDate(1)
  return d.toISOString().split('T')[0]
}

export default function Reportes() {
  const [desde, setDesde] = useState(primerDiaMes())
  const [hasta, setHasta] = useState(today())
  const [tab, setTab] = useState('ventas')

  const ventas = useLiveQuery(
    () => db.ventas.filter(v => {
      const d = new Date(v.fecha).toISOString().split('T')[0]
      return d >= desde && d <= hasta
    }).toArray(),
    [desde, hasta], []
  )

  const articulos = useLiveQuery(() => db.articulos.toArray().then(arr => [...arr].sort((a, b) => (a.stock || 0) - (b.stock || 0))), [], [])
  const cobrar = useLiveQuery(() => db.ctas_cobrar.where('estado').equals('PENDIENTE').toArray(), [], [])
  const pagar = useLiveQuery(() => db.ctas_pagar.where('estado').equals('PENDIENTE').toArray(), [], [])

  const totalVentas = ventas.reduce((s, v) => s + (v.total || 0), 0)
  const porTipo = ventas.reduce((acc, v) => {
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
      const data = cobrar.map(c => [c.cliente, fmtUSD(c.monto), fmtDate(c.vencimiento), c.estado])
      printReporte('Cuentas por Cobrar Pendientes', ['CLIENTE', 'MONTO', 'VENCIMIENTO', 'ESTADO'], data, { 'TOTAL POR COBRAR': fmtUSD(cobrar.reduce((s, c) => s + c.monto, 0)) })
    } else if (tab === 'pagar') {
      const data = pagar.map(c => [c.proveedor, c.concepto, fmtUSD(c.monto), fmtDate(c.vencimiento)])
      printReporte('Cuentas por Pagar Pendientes', ['PROVEEDOR', 'CONCEPTO', 'MONTO', 'VENCIMIENTO'], data, { 'TOTAL POR PAGAR': fmtUSD(pagar.reduce((s, c) => s + c.monto, 0)) })
    }
  }

  const Stat = ({ label, value, sub, color = 'text-rojo-bright' }) => (
    <div className="bg-g3 border border-borde rounded-lg p-3 shadow-lg hover:border-rojo-dark transition-all">
      <div className="text-[10px] text-muted tracking-widest uppercase mb-1">{label}</div>
      <div className={`font-bebas text-2xl ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted italic">{sub}</div>}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Filtros fecha */}
      <div className="panel flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="field" style={{ margin: 0 }}>
            <label className="text-xs uppercase tracking-tighter text-muted">Desde</label>
            <input type="date" className="inp w-36" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="text-xs uppercase tracking-tighter text-muted">Hasta</label>
            <input type="date" className="inp w-36" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
        </div>
        <button onClick={handlePrint} className="btn btn-r w-full sm:w-auto flex items-center justify-center gap-2">
          <span>🖨️ IMPRIMIR REPORTE</span>
        </button>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total Ventas $" value={fmtUSD(totalVentas)} sub={`${ventas.length} notas en total`} />
        <Stat label="Por Cobrar" value={fmtUSD(cobrar.reduce((s, c) => s + c.monto, 0))}
          sub={`${cobrar.length} facturas pendientes`} color="text-amber-400" />
        <Stat label="Por Pagar" value={fmtUSD(pagar.reduce((s, c) => s + c.monto, 0))}
          sub={`${pagar.length} cuentas pendientes`} color="text-red-400" />
        <Stat label="Criticos" value={agotados.length}
          sub={`${bajoStock.length} productos bajo stock`} color="text-orange-500" />
      </div>

      {/* Tabs con diseño moderno */}
      <div className="flex gap-1 bg-g2 p-1 rounded-lg border border-borde w-fit">
        {[
          ['ventas', '📊'], ['inventario', '📦'],
          ['cobrar', '💳'], ['pagar', '🏦']
        ].map(([k, icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-md font-bebas tracking-widest text-sm transition-all flex items-center gap-2 ${tab === k ? 'bg-rojo text-white shadow-lg' : 'text-muted hover:text-white hover:bg-g3'}`}>
            <span>{icon}</span>
            <span className="hidden sm:inline uppercase">{k}</span>
          </button>
        ))}
      </div>

      {tab === 'ventas' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="panel overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-borde">
              <div className="panel-title" style={{ margin: 0 }}>DETALLE DE VENTAS</div>
              <div className="text-xs text-muted font-mono">{ventas.length} registros</div>
            </div>
            <div className="tabla-wrap tabla-scroll" style={{ maxHeight: '60vh' }}>
              <table className="w-full">
                <thead><tr><th>N° NOTA</th><th>FECHA</th><th>CLIENTE</th><th>FORMA</th><th>TOTAL $</th></tr></thead>
                <tbody>
                  {ventas.map(v => (
                    <tr key={v.id} className="hover:bg-white/5">
                      <td className="font-mono2 text-rojo-bright whitespace-nowrap">#{v.nro}</td>
                      <td className="text-[11px] text-muted whitespace-nowrap">{fmtDate(v.fecha)}</td>
                      <td className="font-semibold text-sm max-w-[200px] truncate">{v.cliente}</td>
                      <td>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${v.tipo_pago === 'CREDITO' ? 'bg-amber-900/30 text-amber-400 border border-amber-400/30' : 'bg-green-900/30 text-green-400 border border-green-400/30'}`}>
                          {v.tipo_pago}
                        </span>
                      </td>
                      <td className="font-mono2 text-white text-right">{fmtUSD(v.total)}</td>
                    </tr>
                  ))}
                  {ventas.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-muted py-12 tracking-widest opacity-50">NO SE ENCONTRARON VENTAS</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="panel">
              <div className="panel-title mb-4 border-b border-borde pb-2">DISTRIBUCIÓN DE PAGOS</div>
              <div className="space-y-4">
                {Object.entries(porTipo).map(([tipo, total]) => {
                  const porc = (total / totalVentas * 100) || 0
                  return (
                    <div key={tipo}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted tracking-widest uppercase">{tipo}</span>
                        <span className="text-white font-mono2">{fmtUSD(total)}</span>
                      </div>
                      <div className="h-2 bg-g2 rounded-full overflow-hidden border border-borde">
                        <div className={`h-full transition-all duration-500 rounded-full ${tipo === 'CREDITO' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'}`}
                          style={{ width: `${porc}%` }} />
                      </div>
                      <div className="text-[9px] text-right text-muted mt-1">{porc.toFixed(1)}% del total</div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-6 pt-4 border-t border-borde">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted">GRAN TOTAL:</span>
                  <span className="font-bebas text-2xl text-rojo-bright">{fmtUSD(totalVentas)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-rojo/20 to-black p-4 rounded-xl border border-rojo-dark">
              <div className="text-xs text-rojo-bright font-bold mb-1 tracking-widest">INFO</div>
              <p className="text-[11px] text-muted">
                Los montos mostrados corresponden a las ventas brutas realizadas entre las fechas seleccionadas.
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === 'inventario' && (
        <div className="panel">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-borde">
            <div className="panel-title" style={{ margin: 0 }}>ESTADO DE INVENTARIO</div>
            <div className="text-xs text-muted font-mono">{articulos.length} items</div>
          </div>
          <div className="tabla-wrap tabla-scroll" style={{ maxHeight: '65vh' }}>
            <table className="w-full">
              <thead><tr><th>CÓD.</th><th>DESCRIPCIÓN</th><th>MARCA</th><th className="text-center">STOCK</th><th>P. UNIT $</th><th>VALOR TOTAL</th></tr></thead>
              <tbody>
                {articulos.map(a => (
                  <tr key={a.id} className="hover:bg-white/5">
                    <td className="font-mono2 text-rojo-bright">{a.codigo}</td>
                    <td className="font-semibold text-sm">{a.descripcion}</td>
                    <td className="text-muted text-[11px]">{a.marca}</td>
                    <td className="text-center">
                      <div className="flex flex-col items-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${(a.stock ?? 0) === 0 ? 'bg-red-900/40 text-red-500 border border-red-500/30' : (a.stock ?? 0) <= 3 ? 'bg-orange-900/40 text-orange-400 border border-orange-400/30' : 'bg-green-900/40 text-green-400 border border-green-500/30'}`}>
                          {a.stock ?? 0}
                        </span>
                        {/* Pequeña barra visual de stock */}
                        <div className="w-12 h-1 bg-g3 rounded-full mt-1 overflow-hidden">
                          <div className={`h-full ${a.stock > 10 ? 'bg-green-500' : a.stock > 3 ? 'bg-orange-400' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, (a.stock / 20) * 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="font-mono2 text-[11px] text-muted">{fmtUSD(a.precio)}</td>
                    <td className="font-mono2 text-white text-right">{fmtUSD((a.stock || 0) * a.precio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'cobrar' && (
        <div className="panel">
          <div className="panel-title mb-4 border-b border-borde pb-2 uppercase tracking-tighter">Cuentas por Cobrar Pendientes</div>
          <div className="tabla-wrap tabla-scroll" style={{ maxHeight: '65vh' }}>
            <table className="w-full">
              <thead><tr><th>CLIENTE</th><th>MONTO $</th><th>VENCIMIENTO</th><th>DÍAS REST.</th><th>ESTADO</th></tr></thead>
              <tbody>
                {cobrar.map(c => {
                  const dias = Math.ceil((new Date(c.vencimiento) - new Date()) / (1000 * 60 * 60 * 24))
                  return (
                    <tr key={c.id} className="hover:bg-white/5">
                      <td className="font-semibold text-sm">{c.cliente}</td>
                      <td className="font-mono2 text-white">{fmtUSD(c.monto)}</td>
                      <td className="text-muted text-[11px]">{fmtDate(c.vencimiento)}</td>
                      <td>
                        <span className={`text-[10px] font-bold ${dias < 0 ? 'text-red-500' : dias <= 3 ? 'text-orange-400' : 'text-blue-400'}`}>
                          {dias < 0 ? `VENCIDO (${Math.abs(dias)})` : `${dias} días`}
                        </span>
                      </td>
                      <td><span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-400/30 font-bold">PENDIENTE</span></td>
                    </tr>
                  )
                })}
                {cobrar.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted py-12 tracking-widest opacity-50">SIN CUENTAS PENDIENTES ✅</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'pagar' && (
        <div className="panel">
          <div className="panel-title mb-4 border-b border-borde pb-2 uppercase tracking-tighter">Cuentas por Pagar Pendientes</div>
          <div className="tabla-wrap tabla-scroll" style={{ maxHeight: '65vh' }}>
            <table className="w-full">
              <thead><tr><th>PROVEEDOR</th><th>CONCEPTO</th><th>MONTO $</th><th>VENCIMIENTO</th></tr></thead>
              <tbody>
                {pagar.map(c => (
                  <tr key={c.id} className="hover:bg-white/5">
                    <td className="font-semibold text-sm">{c.proveedor}</td>
                    <td className="text-muted text-[11px]">{c.concepto}</td>
                    <td className="font-mono2 text-red-400">{fmtUSD(c.monto)}</td>
                    <td className="text-muted text-[11px] font-mono">{fmtDate(c.vencimiento)}</td>
                  </tr>
                ))}
                {pagar.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-muted py-12 tracking-widest opacity-50">SIN CUENTAS PENDIENTES ✅</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
