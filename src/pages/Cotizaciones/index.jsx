import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nextNro } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtBS, fmtDate } from '../../utils/format'
import { printCotizacion } from '../../utils/print'
import ClienteSelector from '../../components/UI/ClienteSelector'

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
    <div className="pr-2 pb-6">
      <div className="flex gap-1 mb-4">
        {['nueva', 'historial'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-6 py-3 rounded-none text-[10px] font-black uppercase tracking-widest transition-none cursor-pointer border shadow-[var(--win-shadow)]
            ${tab === t ? 'bg-[var(--teal)] text-white border-transparent' : 'bg-[var(--surface2)] text-[var(--text2)] border-[var(--border-var)] hover:bg-[var(--surfaceDark)]'}`}>
            {t === 'nueva' ? '📋 NUEVA COTIZACIÓN' : '🕒 HISTORIAL DE PRESUPUESTOS'}
          </button>
        ))}
      </div>

      {tab === 'nueva' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
          <div>
            <div className="panel rounded-none shadow-[var(--win-shadow)] transition-none border-t-4 border-t-[var(--teal)]">
              <div className="text-xl font-black text-[var(--text-main)] mb-6 uppercase tracking-tighter">EMISIÓN DE PRESUPUESTO</div>
              <div className="field">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">Información del Cliente</label>
                <ClienteSelector value={clienteCot} onChange={setClienteCot} />
              </div>
              <div className="relative mt-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">Búsqueda de Artículos</label>
                <input className="inp rounded-none focus:border-[var(--teal)] transition-none shadow-inner !py-4" value={busq}
                  onChange={e => { setBusq(e.target.value); setShowDrop(true) }}
                  onFocus={() => setShowDrop(true)}
                  placeholder="🔍 ESCRIBE CÓDIGO O DESCRIPCIÓN..." autoComplete="off" />
                {showDrop && articulos.length > 0 && (
                  <div className="absolute z-20 w-full bg-[var(--surface)] border-2 border-[var(--border-var)] rounded-none max-h-64 overflow-y-auto shadow-[var(--win-shadow)] mt-1">
                    {articulos.map(a => (
                      <div key={a.id}
                        className="px-4 py-3 cursor-pointer border-b border-[var(--border-var)] hover:bg-[var(--surfaceDark)] transition-none flex justify-between items-center"
                        onClick={() => { addToCotCart(a); setBusq(''); setShowDrop(false) }}>
                        <div className="flex flex-col">
                          <span className="font-mono text-[var(--teal)] text-xs font-black uppercase">{a.codigo}</span>
                          <span className="font-black text-[var(--text-main)] text-sm uppercase">{a.descripcion}</span>
                        </div>
                        <span className="font-mono font-black text-[var(--teal)] bg-[var(--surfaceDark)] px-2 py-1 shadow-inner border border-black/5 text-sm">{fmtUSD(a.precio)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="panel rounded-none shadow-[var(--win-shadow)] transition-none bg-[var(--surface2)]">
              <div className="text-[10px] font-black text-[var(--text2)] mb-4 uppercase tracking-widest">RESUMEN DE PARTIDAS</div>
              <div className="max-h-[400px] overflow-y-auto pr-1">
                {cartCot.length === 0
                  ? <div className="text-center text-[var(--text2)] py-12 text-[10px] tracking-widest font-black uppercase opacity-40 italic border-2 border-dashed border-[var(--border-var)]">CART VACIÓ</div>
                  : cartCot.map(item => (
                    <div key={item.id} className="bg-[var(--surface)] border border-[var(--border-var)] rounded-none p-3 flex items-center gap-3 mb-2 shadow-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[var(--teal)] text-[10px] font-black uppercase">{item.codigo}</div>
                        <div className="text-xs font-black text-[var(--text-main)] truncate uppercase">{item.descripcion}</div>
                        <div className="text-[var(--text2)] text-[10px] font-black uppercase">{fmtUSD(item.precio)} C/U</div>
                      </div>
                      <input type="number" value={item.qty} min="1"
                        onChange={e => updateCotQty(item.id, parseInt(e.target.value) || 1)}
                        className="w-14 bg-[var(--surface2)] border-2 border-[var(--border-var)] text-center rounded-none px-1 py-1 font-mono text-sm outline-none focus:border-[var(--teal)] font-black transition-none shadow-inner" />
                      <div className="font-mono text-sm min-w-[60px] text-right font-black text-[var(--text-main)]">{fmtUSD(item.precio * item.qty)}</div>
                      <button className="text-[var(--red-var)] bg-[var(--red-var)]/10 hover:bg-[var(--red-var)] hover:text-white transition-none p-1 rounded-none cursor-pointer"
                        onClick={() => removeFromCotCart(item.id)}>
                        <span className="material-icons-round text-sm">close</span>
                      </button>
                    </div>
                  ))
                }
              </div>
              <div className="bg-[var(--surfaceDark)] border-2 border-[var(--border-var)] rounded-none p-4 mt-4 shadow-inner">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-[var(--text2)] uppercase tracking-widest">TOTAL DIVISA</span>
                  <span className="text-2xl font-mono font-black text-[var(--teal)]">{fmtUSD(cotTotal())}</span>
                </div>
                <div className="flex justify-between items-center opacity-60">
                  <span className="text-[10px] font-black text-[var(--text2)] uppercase tracking-widest">TOTAL BOLÍVARES</span>
                  <span className="text-sm font-mono font-black text-[var(--text-main)]">{fmtBS(cotTotal(), tasa)}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 mt-4">
                <button className="btn bg-[var(--teal)] text-white w-full py-4 text-xs font-black tracking-widest transition-none shadow-[var(--win-shadow)] cursor-pointer uppercase" onClick={procesarCot}>
                  <span className="material-icons-round text-base">receipt</span>
                  GENERAR Y DESCARGAR
                </button>
                <button className="btn bg-[var(--surfaceDark)] text-[var(--text-main)] w-full py-3 text-[10px] font-black tracking-widest transition-none shadow-[var(--win-shadow)] cursor-pointer uppercase" onClick={clearCotCart}>
                  <span className="material-icons-round text-base">delete_sweep</span>
                  LIMPIAR LISTA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'historial' && (
        <div className="panel rounded-none shadow-[var(--win-shadow)] transition-none p-0 overflow-hidden border-t-4 border-t-[var(--teal)]">
          <div className="p-5 bg-[var(--surface2)] border-b border-[var(--border-var)]">
            <div className="text-xl font-black text-[var(--text-main)] mb-1 uppercase tracking-tighter">HISTORIAL DE COTIZACIONES</div>
            <p className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest">Control Histórico de Presupuestos Emitidos</p>
          </div>
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--surfaceDark)] text-[10px] font-black uppercase text-[var(--text2)] border-b border-[var(--border-var)]">
                  <th className="py-3 px-4">N°</th>
                  <th className="py-3 px-4">FECHA</th>
                  <th className="py-3 px-4">CLIENTE / TITULAR</th>
                  <th className="py-3 px-4 text-right">TOTAL USD</th>
                  <th className="py-3 px-4 text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-var)]">
                {historial.map(c => (
                  <tr key={c.id} className="hover:bg-[var(--surface2)] transition-none">
                    <td className="py-3 px-4 font-mono text-[var(--teal)] font-black text-xs">#{c.nro}</td>
                    <td className="py-3 px-4 text-[var(--text2)] text-[10px] font-black uppercase tracking-tighter">{fmtDate(c.fecha)}</td>
                    <td className="py-3 px-4 font-black text-[var(--text-main)] text-xs uppercase">{c.cliente}</td>
                    <td className="py-3 px-4 font-mono font-black text-xs text-right text-[var(--text-main)]">{fmtUSD(c.total)}</td>
                    <td className="py-3 px-4 text-right">
                      <button className="btn bg-[var(--surfaceDark)] text-[var(--text-main)] hover:bg-[var(--teal)] hover:text-white transition-none px-4 py-2 text-[9px] font-black uppercase tracking-widest shadow-[var(--win-shadow)] cursor-pointer inline-flex items-center gap-2" onClick={async () => {
                        const items = await db.cot_items.where('cot_id').equals(c.id).toArray()
                        printCotizacion(c, items, tasa)
                      }}>
                        <span className="material-icons-round text-sm">print</span>
                        RE-IMPRIMIR
                      </button>
                    </td>
                  </tr>
                ))}
                {historial.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-[var(--text2)] py-24 tracking-widest text-[11px] font-black uppercase italic opacity-40">Sin registros de cotizaciones en el historial</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
