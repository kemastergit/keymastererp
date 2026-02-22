import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtDate } from '../../utils/format'
import Modal from '../../components/UI/Modal'

export default function Devoluciones() {
  const toast = useStore(s => s.toast)
  const [busqVenta, setBusqVenta] = useState('')
  const [ventaSel, setVentaSel] = useState(null)
  const [ventaItems, setVentaItems] = useState([])
  const [selItems, setSelItems] = useState({})
  const [motivo, setMotivo] = useState('')
  const [reingresarStock, setReingresarStock] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const ventas = useLiveQuery(
    () => busqVenta.trim()
      ? db.ventas.filter(v =>
        v.nro?.includes(busqVenta) ||
        v.cliente?.toLowerCase().includes(busqVenta.toLowerCase())
      ).limit(10).toArray()
      : db.ventas.orderBy('fecha').reverse().limit(20).toArray(),
    [busqVenta], []
  )

  const historial = useLiveQuery(() => db.devoluciones.orderBy('fecha').reverse().limit(30).toArray(), [], [])

  const selVenta = async (v) => {
    setVentaSel(v)
    const items = await db.venta_items.where('venta_id').equals(v.id).toArray()
    setVentaItems(items)
    setSelItems({})
    setReingresarStock(true)
    setShowModal(true)
  }

  const toggleItem = (id) => setSelItems(p => ({ ...p, [id]: !p[id] }))

  const procesarDevolucion = async () => {
    const devItems = ventaItems.filter(i => selItems[i.id])
    if (devItems.length === 0) { toast('Selecciona al menos un producto', 'warn'); return }
    if (!motivo.trim()) { toast('Ingresa el motivo', 'warn'); return }

    const devId = await db.devoluciones.add({
      venta_id: ventaSel.id, nro_venta: ventaSel.nro,
      cliente: ventaSel.cliente, motivo, fecha: new Date(),
      total: devItems.reduce((s, i) => s + i.precio * i.qty, 0),
      reingreso_stock: reingresarStock
    })

    for (const item of devItems) {
      const { id, ...itemData } = item
      await db.dev_items.add({ devolucion_id: devId, ...itemData })
      // Devolver al stock solo si se seleccionó reingresar
      if (reingresarStock) {
        const art = await db.articulos.get(item.articulo_id)
        if (art) await db.articulos.update(art.id, { stock: (art.stock || 0) + item.qty })
      }
    }

    toast(reingresarStock ? '✅ Devolución procesada — Stock actualizado' : '⚠️ Devolución registrada como MERMA (Stock no afectado)')
    // Marcar la venta como devuelta
    await db.ventas.update(ventaSel.id, { estado: 'DEVUELTA' })
    setShowModal(false); setVentaSel(null); setMotivo('')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <div className="panel p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="panel-title mb-0 uppercase tracking-tighter">Buscar Nota de Entrega</div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Seleccione la factura original</p>
          </div>
          <div className="p-4">
            <div className="field !m-0">
              <input className="inp !py-2 !px-4 !bg-slate-50" placeholder="🔍 Buscar por N° nota o cliente..."
                value={busqVenta} onChange={e => setBusqVenta(e.target.value)} />
            </div>
          </div>
          <div className="overflow-x-auto min-h-[300px]">
            <table>
              <thead><tr><th>Nota</th><th>Cliente</th><th>Fecha</th><th className="text-right">Total</th><th></th></tr></thead>
              <tbody>
                {ventas.map(v => (
                  <tr key={v.id}>
                    <td className="font-mono text-primary font-bold">#{v.nro}</td>
                    <td className="font-bold text-slate-700">{v.cliente}</td>
                    <td className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{fmtDate(v.fecha)}</td>
                    <td className="font-mono text-right font-bold text-slate-800">{fmtUSD(v.total)}</td>
                    <td className="text-right">
                      {v.estado === 'DEVUELTA' ? (
                        <span className="text-[8px] font-black tracking-widest text-slate-300 bg-slate-100 px-2 py-0.5 rounded-full uppercase">
                          YA DEVUELTA
                        </span>
                      ) : (
                        <button className="btn btn-y !py-1 !px-3 !text-[9px]" onClick={() => selVenta(v)}>
                          <span className="material-icons-round text-sm">assignment_return</span>
                          <span>DEVOLVER</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {ventas.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-12 tracking-widest text-[10px] font-bold uppercase opacity-50">No se encontraron notas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <div className="panel p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="panel-title mb-0 uppercase tracking-tighter">Historial Reciente</div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Últimas devoluciones procesadas</p>
          </div>
          <div className="overflow-x-auto min-h-[300px]">
            <table>
              <thead><tr><th>Ref</th><th>Cliente</th><th>Motivo</th><th className="text-right">Monto</th></tr></thead>
              <tbody>
                {historial.map(d => (
                  <tr key={d.id}>
                    <td className="font-mono text-slate-400 font-bold text-[11px]">#{d.nro_venta}</td>
                    <td className="font-bold text-slate-700">{d.cliente}</td>
                    <td className="text-[10px] text-slate-500 font-bold uppercase truncate max-w-[120px]">{d.motivo}</td>
                    <td className="font-mono text-red-500 text-right font-black">-{fmtUSD(d.total)}</td>
                  </tr>
                ))}
                {historial.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-slate-400 py-12 tracking-widest text-[10px] font-bold uppercase opacity-50">Sin historial de devoluciones</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Procesar Devolución" wide>
        {ventaSel && (
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Nota Ref / Cliente</p>
                <p className="text-slate-800 font-bold">#{ventaSel.nro} — {ventaSel.cliente}</p>
              </div>
              <div className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Original: {fmtUSD(ventaSel.total)}
              </div>
            </div>

            <div>
              <p className="text-[10px] text-slate-400 mb-3 tracking-widest uppercase font-bold">Seleccionar productos a devolver:</p>
              <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2 custom-scroll">
                {ventaItems.map(i => (
                  <label key={i.id} className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer
                    ${selItems[i.id] ? 'bg-primary/10 border-primary/20' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}>
                    <input type="checkbox" checked={!!selItems[i.id]} onChange={() => toggleItem(i.id)}
                      className="w-5 h-5 rounded-lg border-slate-300 text-primary focus:ring-primary/20 accent-primary" />
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-800">{i.descripcion}</div>
                      <div className="text-[10px] font-mono text-primary font-bold">{i.codigo}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-slate-700">Cant: {i.qty}</div>
                      <div className="text-[10px] font-mono text-slate-400">{fmtUSD(i.precio * i.qty)}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className={`p-4 rounded-2xl border transition-all ${reingresarStock ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <label className="flex items-center gap-4 cursor-pointer">
                <input type="checkbox" checked={reingresarStock} onChange={e => setReingresarStock(e.target.checked)}
                  className={`w-6 h-6 rounded-full transition-all accent-current ${reingresarStock ? 'text-green-600' : 'text-amber-600'}`} />
                <div>
                  <div className={`text-sm font-black uppercase tracking-tight ${reingresarStock ? 'text-green-800' : 'text-amber-800'}`}>
                    {reingresarStock ? 'Reingresar al Inventario' : 'Registrar como Merma'}
                  </div>
                  <div className={`text-[10px] font-medium opacity-70 ${reingresarStock ? 'text-green-700' : 'text-amber-700'}`}>
                    {reingresarStock ? 'El stock de los productos aumentará automáticamente' : 'El producto está dañado, el stock no se verá afectado'}
                  </div>
                </div>
              </label>
            </div>

            <div className="field">
              <label>Motivo de devolución *</label>
              <input className="inp !py-3 !px-4" value={motivo} onChange={e => setMotivo(e.target.value)}
                placeholder="Ej. Producto defectuoso, error en pedido..." />
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn btn-gr flex-1 justify-center" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-r flex-1 justify-center font-bold" onClick={procesarDevolucion}>
                <span className="material-icons-round text-base">assignment_return</span>
                <span>Procesar Devolución</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
