import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtDate } from '../../utils/format'
import Modal from '../../components/UI/Modal'
import { logAction } from '../../utils/audit'

export default function Devoluciones() {
  const toast = useStore(s => s.toast)
  const [busqVenta, setBusqVenta] = useState('')
  const [ventaSel, setVentaSel] = useState(null)
  const [ventaItems, setVentaItems] = useState([])
  const [selItems, setSelItems] = useState({}) // { [itemId]: qty }
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

  const updateItemQty = (id, val, max) => {
    const qty = Math.max(0, Math.min(max, parseInt(val) || 0))
    setSelItems(p => ({ ...p, [id]: qty }))
  }

  const procesarDevolucion = async () => {
    const devItems = ventaItems.filter(i => (selItems[i.id] || 0) > 0).map(i => ({ ...i, qty_dev: selItems[i.id] }))
    if (devItems.length === 0) { toast('Establezca la cantidad a devolver', 'warn'); return }
    if (!motivo.trim()) { toast('Ingresa el motivo técnico', 'warn'); return }

    try {
      await db.transaction('rw', [db.devoluciones, db.dev_items, db.articulos, db.ventas, db.bajas_inventario, db.auditoria], async () => {
        const currentUser = useStore.getState().currentUser
        const totalUSD = devItems.reduce((s, i) => s + i.precio * i.qty_dev, 0)

        const devId = await db.devoluciones.add({
          venta_id: ventaSel.id,
          nro_venta: ventaSel.nro,
          cliente: ventaSel.cliente,
          motivo,
          fecha: new Date(),
          total: totalUSD,
          reingreso_stock: reingresarStock,
          usuario_id: currentUser?.id
        })

        for (const item of devItems) {
          await db.dev_items.add({
            devolucion_id: devId,
            articulo_id: item.articulo_id,
            descripcion: item.descripcion,
            codigo: item.codigo,
            qty: item.qty_dev,
            precio: item.precio
          })

          if (reingresarStock) {
            const art = await db.articulos.get(item.articulo_id)
            if (art) {
              await db.articulos.update(art.id, { stock: (art.stock || 0) + item.qty_dev })
            }
          } else {
            await db.bajas_inventario.add({
              articulo_id: item.articulo_id,
              fecha: new Date(),
              qty: item.qty_dev,
              motivo: `DEVOLUCIÓN DAÑADA: ${motivo}`,
              usuario_id: currentUser?.id
            })
          }
        }

        await logAction(currentUser, 'DEVOLUCION_PROCESADA', {
          nota: ventaSel.nro,
          total: totalUSD,
          merma: !reingresarStock
        })

        await db.ventas.update(ventaSel.id, { estado: 'DEVUELTA_PARCIAL' })
      })

      toast(reingresarStock ? '✅ Stock reintegrado correctamente' : '⚠️ Registrado como DAÑADO (Pérdida)')
      setShowModal(false)
      setVentaSel(null)
      setMotivo('')
    } catch (err) {
      console.error(err)
      toast('❌ Error al procesar: ' + err.message, 'error')
    }
  }

  return (
    <div className="pr-2 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <div className="panel p-0 overflow-hidden rounded-none shadow-[var(--win-shadow)] transition-none border-t-4 border-t-[var(--teal)]">
          <div className="p-5 border-b border-[var(--border-var)] bg-[var(--surface2)]">
            <div className="text-xl font-black text-[var(--text-main)] mb-1 uppercase tracking-tighter">BÚSQUEDA DE VENTAS PARA DEVOLUCIÓN</div>
            <p className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest">Identifique el comprobante original de la transacción</p>
          </div>
          <div className="p-5 bg-[var(--surface)]">
            <div className="field !m-0">
              <input className="inp !py-4 rounded-none focus:border-[var(--teal)] transition-none shadow-inner" placeholder="🔍 BUSCAR POR NRO DE NOTA O NOMBRE DEL CLIENTE..."
                value={busqVenta} onChange={e => setBusqVenta(e.target.value.toUpperCase())} />
            </div>
          </div>
          <div className="overflow-x-auto min-h-[350px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--surfaceDark)] text-[10px] font-black uppercase text-[var(--text2)] border-b border-[var(--border-var)]">
                  <th className="py-3 px-4">Nota Ref.</th>
                  <th className="py-3 px-4">Cliente / Comprador</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4 text-right">Total USD</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-var)]">
                {ventas.map(v => (
                  <tr key={v.id} className="hover:bg-[var(--surface2)] transition-none">
                    <td className="py-3 px-4 font-mono text-[var(--teal)] font-black text-xs uppercase">#{v.nro}</td>
                    <td className="py-3 px-4 font-black text-[var(--text-main)] text-xs uppercase">{v.cliente}</td>
                    <td className="py-3 px-4 text-[var(--text2)] text-[10px] font-black uppercase tracking-tighter">{fmtDate(v.fecha)}</td>
                    <td className="py-3 px-4 font-mono text-right font-black text-[var(--text-main)] text-xs">{fmtUSD(v.total)}</td>
                    <td className="py-3 px-4 text-right">
                      <button className="btn bg-[var(--orange-var)] text-white !py-2 !px-4 !text-[10px] font-black uppercase tracking-widest shadow-[var(--win-shadow)] transition-none cursor-pointer inline-flex items-center gap-2" onClick={() => selVenta(v)}>
                        <span className="material-icons-round text-sm">assignment_return</span>
                        <span>DEVOLVER</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <div className="panel p-0 overflow-hidden rounded-none shadow-[var(--win-shadow)] transition-none border-t-4 border-t-[var(--red-var)]">
          <div className="p-5 border-b border-[var(--border-var)] bg-[var(--surface2)]">
            <div className="text-xl font-black text-[var(--red-var)] mb-1 uppercase tracking-tighter">HISTORIAL DE DEVOLUCIONES</div>
            <p className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest">Control Histórico de Mermas y Ajustes de Venta</p>
          </div>
          <div className="overflow-x-auto min-h-[350px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--surfaceDark)] text-[10px] font-black uppercase text-[var(--text2)] border-b border-[var(--border-var)]">
                  <th className="py-3 px-4">Ref. Venta</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4 text-right">Monto Dev.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-var)]">
                {historial.map(d => (
                  <tr key={d.id} className="hover:bg-[var(--surface2)] transition-none italic opacity-80">
                    <td className="py-3 px-4 font-mono text-[var(--text2)] font-black text-[11px] uppercase">#{d.nro_venta}</td>
                    <td className="py-3 px-4 font-black text-[var(--text-main)] text-xs uppercase">{d.cliente}</td>
                    <td className="py-3 px-4 font-mono text-[var(--red-var)] text-right font-black uppercase">-{fmtUSD(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="GESTIÓN DE REVERSIÓN Y DEVOLUCIÓN" wide>
        {ventaSel && (
          <div className="space-y-6">
            <div className="bg-[var(--surfaceDark)] p-5 border-2 border-[var(--border-var)] flex items-center justify-between shadow-inner rounded-none">
              <div className="flex flex-col">
                <p className="text-[var(--text2)] text-[10px] font-black uppercase tracking-widest mb-1">COMPROBANTE ORIGINAL / TITULAR</p>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[var(--teal)] font-black text-lg uppercase">#{ventaSel.nro}</span>
                  <span className="text-[var(--text-main)] font-black uppercase text-sm">{ventaSel.cliente}</span>
                </div>
              </div>
              <div className="text-right border-l border-[var(--border-var)] pl-6">
                <p className="text-[var(--text2)] text-[10px] font-black uppercase tracking-widest mb-1">TOTAL FACTURADO</p>
                <p className="text-2xl font-mono font-black text-[var(--text-main)]">{fmtUSD(ventaSel.total)}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-[var(--text2)] mb-3 tracking-widest uppercase font-black">Establezca cantidades a retornar:</p>
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scroll">
                {ventaItems.map(i => (
                  <div key={i.id} className={`flex items-center gap-4 p-4 border-2 transition-none rounded-none shadow-sm
                    ${(selItems[i.id] || 0) > 0 ? 'bg-[var(--teal)]/5 border-[var(--teal)]' : 'bg-[var(--surface)] border-[var(--border-var)]'}`}>
                    <div className="flex-1">
                      <div className="text-sm font-black text-[var(--text-main)] uppercase tracking-tight">{i.descripcion}</div>
                      <div className="text-[10px] font-mono text-[var(--teal)] font-black uppercase tracking-widest">#{i.codigo} | Comprado: {i.qty}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-black uppercase text-[var(--text2)] mr-1">Cant. Devolver:</label>
                      <input
                        type="number"
                        className="inp !w-20 !py-2 text-center font-mono font-black !bg-[var(--surfaceDark)]"
                        value={selItems[i.id] || 0}
                        onChange={e => updateItemQty(i.id, e.target.value, i.qty)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`p-5 border-2 transition-none rounded-none shadow-inner ${reingresarStock ? 'bg-[var(--teal)]/5 border-[var(--teal)]/30' : 'bg-[var(--red-var)]/5 border-[var(--red-var)]/30'}`}>
              <label className="flex items-center gap-5 cursor-pointer">
                <input type="checkbox" checked={reingresarStock} onChange={e => setReingresarStock(e.target.checked)}
                  className={`w-7 h-7 rounded-none border-2 transition-none accent-current ${reingresarStock ? 'text-[var(--teal)]' : 'text-[var(--red-var)]'}`} />
                <div>
                  <div className={`text-sm font-black uppercase tracking-widest ${reingresarStock ? 'text-[var(--teal)]' : 'text-[var(--red-var)]'}`}>
                    {reingresarStock ? 'RESTAURAR EXISTENCIAS EN INVENTARIO' : 'REGISTRAR COMO PRODUCTO DAÑADO / MERMA'}
                  </div>
                  <div className={`text-[10px] font-black uppercase tracking-widest opacity-60 mt-1 ${reingresarStock ? 'text-[var(--teal)]' : 'text-[var(--red-var)]'}`}>
                    {reingresarStock ? 'La cantidad retornada se sumará al stock disponible para la venta' : 'Los productos NO entrarán al stock (se registran como baja por daño)'}
                  </div>
                </div>
              </label>
            </div>

            <div className="field">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">JUSTIFICACIÓN TÉCNICA DE LA DEVOLUCIÓN (POR QUÉ REGRESA?) *</label>
              <input className="inp !py-4 rounded-none focus:border-[var(--teal)] transition-none shadow-inner uppercase text-[11px] font-black" value={motivo} onChange={e => setMotivo(e.target.value.toUpperCase())}
                placeholder="EJ. ERROR DE DESPACHO, CAMBIO POR TALLA, PRODUCTO DAÑADO..." />
            </div>

            <div className="flex gap-4 pt-4 border-t border-[var(--border-var)]">
              <button className="btn bg-[var(--surfaceDark)] text-[var(--text-main)] flex-1 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer" onClick={() => setShowModal(false)}>CONSERVAR VENTA</button>
              <button className="btn bg-[var(--orange-var)] text-white flex-2 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer tracking-widest" onClick={procesarDevolucion}>
                <span className="material-icons-round text-base">swap_horiz</span>
                <span>EJECUTAR DEVOLUCIÓN</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
