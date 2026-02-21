import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nextNro } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtBS, fmtDate } from '../../utils/format'
import { printCotizacion } from '../../utils/print'

export default function Cotizaciones() {
  const { tasa, cartCot, addToCotCart, removeFromCotCart, updateCotQty,
    clearCotCart, clienteCot, setClienteCot, cotTotal, toast } = useStore()

  const [busq, setBusq] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [tab, setTab] = useState('nueva') // 'nueva' | 'historial'

  const articulos = useLiveQuery(
    () => busq.trim()
      ? db.articulos.filter(a =>
          a.codigo?.toLowerCase().includes(busq.toLowerCase()) ||
          a.descripcion?.toLowerCase().includes(busq.toLowerCase())
        ).limit(20).toArray()
      : db.articulos.orderBy('descripcion').limit(30).toArray(),
    [busq], []
  )

  const historial = useLiveQuery(() => db.cotizaciones.orderBy('fecha').reverse().limit(50).toArray(), [], [])

  const procesarCot = async () => {
    if (!clienteCot.trim()) { toast('Ingresa el nombre del cliente', 'warn'); return }
    if (cartCot.length === 0) { toast('Agrega al menos un producto', 'warn'); return }

    const nro = await nextNro('nro_cot')
    const total = cotTotal()
    const cot = { nro, fecha: new Date(), cliente: clienteCot, total }
    const cotId = await db.cotizaciones.add(cot)

    for (const item of cartCot) {
      await db.cot_items.add({ cot_id: cotId, ...item })
    }

    toast(`📋 Cotización #${nro} generada`)
    printCotizacion({ ...cot, nro }, cartCot, tasa)
    clearCotCart()
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {['nueva','historial'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`btn ${tab === t ? 'btn-r' : 'btn-gr'}`}>
            {t === 'nueva' ? '📋 NUEVA COTIZACIÓN' : '🕒 HISTORIAL'}
          </button>
        ))}
      </div>

      {tab === 'nueva' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
          <div>
            <div className="panel">
              <div className="panel-title">COTIZACIÓN / PRESUPUESTO</div>
              <div className="field">
                <label>Cliente</label>
                <input className="inp" value={clienteCot} onChange={e => setClienteCot(e.target.value)} placeholder="Nombre del cliente..." />
              </div>
              <div className="relative mt-2">
                <input className="inp" value={busq}
                  onChange={e => { setBusq(e.target.value); setShowDrop(true) }}
                  onFocus={() => setShowDrop(true)}
                  placeholder="🔍 Buscar producto..." autoComplete="off" />
                {showDrop && articulos.length > 0 && (
                  <div className="absolute z-10 w-full bg-g3 border border-rojo-dark border-t-0 rounded-b-md max-h-52 overflow-y-auto shadow-xl">
                    {articulos.map(a => (
                      <div key={a.id}
                        className="px-3 py-2 cursor-pointer border-b border-borde hover:bg-red-950/20"
                        onClick={() => { addToCotCart(a); setBusq(''); setShowDrop(false) }}>
                        <span className="font-mono2 text-rojo-bright text-xs">{a.codigo}</span>
                        <span className="font-semibold text-white ml-2 text-sm">{a.descripcion}</span>
                        <span className="float-right text-xs text-white/60">{fmtUSD(a.precio)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="panel">
              <div className="panel-title">DETALLE COTIZACIÓN</div>
              <div className="max-h-64 overflow-y-auto">
                {cartCot.length === 0
                  ? <div className="text-center text-muted py-6 text-xs tracking-widest">VACÍO</div>
                  : cartCot.map(item => (
                    <div key={item.id} className="bg-g3 border border-borde rounded-md p-2 flex items-center gap-2 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono2 text-rojo-bright text-xs">{item.codigo}</div>
                        <div className="text-sm font-semibold truncate">{item.descripcion}</div>
                        <div className="text-muted text-xs">{fmtUSD(item.precio)} c/u</div>
                      </div>
                      <input type="number" value={item.qty} min="1"
                        onChange={e => updateCotQty(item.id, parseInt(e.target.value)||1)}
                        className="w-12 bg-g2 border border-borde text-white text-center rounded px-1 py-0.5 font-mono2 text-sm outline-none focus:border-rojo" />
                      <div className="font-bebas text-base min-w-[52px] text-right">{fmtUSD(item.precio*item.qty)}</div>
                      <button className="text-rojo-bright text-base px-1 hover:text-red-300"
                        onClick={() => removeFromCotCart(item.id)}>✕</button>
                    </div>
                  ))
                }
              </div>
              <div className="bg-g3 border border-borde rounded-md px-3 py-2 mt-2">
                <div className="flex justify-between font-bebas text-xl text-rojo-bright">
                  <span>TOTAL $</span><span>{fmtUSD(cotTotal())}</span>
                </div>
                <div className="flex justify-between font-bebas text-base text-white">
                  <span>TOTAL Bs</span><span>{fmtBS(cotTotal(), tasa)}</span>
                </div>
              </div>
              <button className="btn btn-b btn-full mt-2" onClick={procesarCot}>📋 GENERAR COTIZACIÓN</button>
              <button className="btn btn-gr btn-full mt-1.5" onClick={clearCotCart}>🗑 LIMPIAR</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'historial' && (
        <div className="panel">
          <div className="panel-title">HISTORIAL DE COTIZACIONES</div>
          <div className="tabla-wrap tabla-scroll" style={{maxHeight:'65vh'}}>
            <table>
              <thead><tr><th>N°</th><th>FECHA</th><th>CLIENTE</th><th>TOTAL $</th><th></th></tr></thead>
              <tbody>
                {historial.map(c => (
                  <tr key={c.id}>
                    <td className="font-mono2 text-rojo-bright">#{c.nro}</td>
                    <td className="text-muted">{fmtDate(c.fecha)}</td>
                    <td className="font-semibold">{c.cliente}</td>
                    <td className="font-mono2 text-white">{fmtUSD(c.total)}</td>
                    <td>
                      <button className="btn btn-b btn-sm" onClick={async () => {
                        const items = await db.cot_items.where('cot_id').equals(c.id).toArray()
                        printCotizacion(c, items, tasa)
                      }}>🖨 IMPRIMIR</button>
                    </td>
                  </tr>
                ))}
                {historial.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted py-6">SIN COTIZACIONES</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
