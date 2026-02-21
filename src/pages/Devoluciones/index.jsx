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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div>
        <div className="panel">
          <div className="panel-title">BUSCAR NOTA DE ENTREGA</div>
          <input className="inp mb-2" placeholder="🔍 Buscar por N° nota o cliente..."
            value={busqVenta} onChange={e => setBusqVenta(e.target.value)} />
          <div className="tabla-wrap tabla-scroll">
            <table>
              <thead><tr><th>N° NOTA</th><th>CLIENTE</th><th>FECHA</th><th>TOTAL $</th><th></th></tr></thead>
              <tbody>
                {ventas.map(v => (
                  <tr key={v.id}>
                    <td className="font-mono2 text-rojo-bright">#{v.nro}</td>
                    <td className="font-semibold">{v.cliente}</td>
                    <td className="text-muted">{fmtDate(v.fecha)}</td>
                    <td className="font-mono2">{fmtUSD(v.total)}</td>
                    <td>
                      {v.estado === 'DEVUELTA' ? (
                        <span className="text-[10px] font-bold text-muted bg-g3 px-2 py-1 rounded inline-block">
                          YA DEVUELTA ↩️
                        </span>
                      ) : (
                        <button className="btn btn-y btn-sm" onClick={() => selVenta(v)}>
                          DEVOLVER
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {ventas.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted py-4">SIN NOTAS</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <div className="panel">
          <div className="panel-title">HISTORIAL DE DEVOLUCIONES</div>
          <div className="tabla-wrap tabla-scroll">
            <table>
              <thead><tr><th>NOTA REF.</th><th>CLIENTE</th><th>MOTIVO</th><th>FECHA</th><th>TOTAL $</th></tr></thead>
              <tbody>
                {historial.map(d => (
                  <tr key={d.id}>
                    <td className="font-mono2 text-rojo-bright">#{d.nro_venta}</td>
                    <td className="font-semibold">{d.cliente}</td>
                    <td className="text-muted">{d.motivo}</td>
                    <td className="text-muted">{fmtDate(d.fecha)}</td>
                    <td className="font-mono2 text-red-400">-{fmtUSD(d.total)}</td>
                  </tr>
                ))}
                {historial.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted py-4">SIN DEVOLUCIONES</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="PROCESAR DEVOLUCIÓN" wide>
        {ventaSel && (
          <>
            <p className="text-sm mb-3">
              <span className="text-muted">Nota #</span><span className="text-white font-bold ml-1">{ventaSel.nro}</span>
              <span className="text-muted ml-3">Cliente:</span><span className="text-white font-bold ml-1">{ventaSel.cliente}</span>
            </p>
            <div className="mb-3">
              <p className="text-xs text-muted mb-1 tracking-widest uppercase">Seleccionar productos a devolver:</p>
              {ventaItems.map(i => (
                <label key={i.id} className="flex items-center gap-3 py-2 border-b border-borde cursor-pointer hover:bg-g3/50">
                  <input type="checkbox" checked={!!selItems[i.id]} onChange={() => toggleItem(i.id)}
                    className="w-4 h-4 accent-red-600" />
                  <span className="font-mono2 text-rojo-bright text-xs">{i.codigo}</span>
                  <span className="flex-1 text-sm">{i.descripcion}</span>
                  <span className="text-muted text-xs">x{i.qty}</span>
                  <span className="font-mono2 text-sm">{fmtUSD(i.precio * i.qty)}</span>
                </label>
              ))}
            </div>
            <div className="bg-g3 p-3 rounded-lg border border-borde mb-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={reingresarStock} onChange={e => setReingresarStock(e.target.checked)}
                  className="w-5 h-5 accent-green-600" />
                <div>
                  <div className="text-sm font-bold text-white uppercase tracking-tighter">¿Regresar productos al inventario?</div>
                  <div className="text-[10px] text-muted capitalize">Desmarca esto si el producto está dañado (Merma)</div>
                </div>
              </label>
            </div>
            <div className="field">
              <label>Motivo de devolución *</label>
              <input className="inp" value={motivo} onChange={e => setMotivo(e.target.value)}
                placeholder="Producto defectuoso, error en pedido..." />
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-gr flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-r flex-1" onClick={procesarDevolucion}>✅ PROCESAR DEVOLUCIÓN</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
