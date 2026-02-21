import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nextNro } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtBS, today } from '../../utils/format'
import { printNota } from '../../utils/print'

export default function Facturacion() {
  const {
    tasa, cart, addToCart, removeFromCart, updateQty, clearCart,
    tipoPago, setTipoPago, clienteFact, setClienteFact,
    vencFact, setVencFact, cartTotal, toast
  } = useStore()

  const [busq, setBusq] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [showDemoModal, setShowDemoModal] = useState(false)
  const [demoKey, setDemoKey] = useState('')

  const ventasCount = useLiveQuery(() => db.ventas.count(), [], 0)
  const isUnlocked = useLiveQuery(() => db.config.get('demo_unlocked'), [], { valor: false })

  const articulos = useLiveQuery(
    () => busq.trim().length > 0
      ? db.articulos.filter(a =>
        a.codigo?.toLowerCase().includes(busq.toLowerCase()) ||
        a.descripcion?.toLowerCase().includes(busq.toLowerCase()) ||
        a.marca?.toLowerCase().includes(busq.toLowerCase())
      ).limit(20).toArray()
      : db.articulos.orderBy('descripcion').limit(30).toArray(),
    [busq], []
  )

  const procesarNota = async () => {
    // Verificar límite de demo
    if (!isUnlocked?.valor && ventasCount >= 50) {
      setShowDemoModal(true)
      return
    }

    if (!clienteFact.trim()) { toast('Ingresa el nombre del cliente', 'warn'); return }
    if (cart.length === 0) { toast('El carrito está vacío', 'warn'); return }
    if (tipoPago === 'CREDITO' && !vencFact) { toast('Selecciona fecha de vencimiento', 'warn'); return }

    const total = cartTotal()
    const nro = await nextNro('nro_nota')

    const venta = {
      nro, fecha: new Date(), cliente: clienteFact,
      tipo_pago: tipoPago, total, estado: 'ACTIVA',
      vencimiento: vencFact || null
    }
    const ventaId = await db.ventas.add(venta)

    // Guardar items y descontar stock
    for (const item of cart) {
      await db.venta_items.add({
        venta_id: ventaId, articulo_id: item.id,
        codigo: item.codigo, descripcion: item.descripcion,
        marca: item.marca || '', precio: item.precio, qty: item.qty
      })
      await db.articulos.update(item.id, { stock: Math.max(0, (item.stock || 0) - item.qty) })
    }

    // Crear cuenta por cobrar si es crédito
    if (tipoPago === 'CREDITO') {
      await db.ctas_cobrar.add({
        venta_id: ventaId, cliente: clienteFact,
        monto: total, vencimiento: vencFact, estado: 'PENDIENTE',
        fecha: new Date()
      })
    }

    toast(`✅ Nota #${nro} procesada — Total: ${fmtUSD(total)}`)
    printNota({ ...venta, nro }, cart, tasa)
    clearCart()
  }

  const unlockDemo = async () => {
    if (demoKey === '11863') {
      await db.config.put({ clave: 'demo_unlocked', valor: true })
      toast('✅ Versión completa desbloqueada', 'success')
      setShowDemoModal(false)
    } else {
      toast('❌ Clave incorrecta', 'error')
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">

        {/* === IZQUIERDO === */}
        <div>
          <div className="panel">
            <div className="panel-title">NUEVA NOTA DE ENTREGA</div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2">
              <div className="field flex-1">
                <label>Cliente</label>
                <input className="inp" value={clienteFact}
                  onChange={e => setClienteFact(e.target.value)}
                  placeholder="Nombre del cliente..." />
              </div>
            </div>

            {/* Buscador */}
            <div className="relative mt-2">
              <input className="inp" value={busq}
                onChange={e => { setBusq(e.target.value); setShowDrop(true) }}
                onFocus={() => setShowDrop(true)}
                placeholder="🔍 Buscar por código o descripción..."
                autoComplete="off" inputMode="search" />
              {showDrop && articulos.length > 0 && (
                <div className="absolute z-10 w-full bg-g3 border border-rojo-dark border-t-0
                rounded-b-md max-h-52 overflow-y-auto shadow-xl">
                  {articulos.map(a => (
                    <div key={a.id}
                      className="px-3 py-2 cursor-pointer border-b border-borde hover:bg-red-950/20 transition-colors"
                      onClick={() => { addToCart(a); setBusq(''); setShowDrop(false) }}>
                      <span className="font-mono2 text-rojo-bright text-xs">{a.codigo}</span>
                      <span className="font-semibold text-white ml-2 text-sm">{a.descripcion}</span>
                      <span className="text-muted text-xs ml-2">{a.marca}</span>
                      <span className="float-right text-xs text-green-400">
                        Stock: {a.stock ?? 0} — {fmtUSD(a.precio)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tabla inventario rápido */}
          <div className="panel">
            <div className="panel-title">PRODUCTOS</div>
            <div className="tabla-wrap tabla-scroll">
              <table>
                <thead><tr>
                  <th>CÓD.</th><th>DESCRIPCIÓN</th><th>MARCA</th>
                  <th>UBIC.</th><th>STOCK</th><th>PRECIO $</th><th></th>
                </tr></thead>
                <tbody>
                  {articulos.map(a => (
                    <tr key={a.id}>
                      <td className="font-mono2 text-rojo-bright">{a.codigo}</td>
                      <td className="font-semibold">{a.descripcion}</td>
                      <td className="text-muted">{a.marca}</td>
                      <td className="text-muted">{a.ubicacion}</td>
                      <td>
                        <span className={`badge ${(a.stock ?? 0) === 0 ? 'badge-r' : (a.stock ?? 0) <= 3 ? 'badge-y' : 'badge-g'}`}>
                          {a.stock ?? 0}
                        </span>
                      </td>
                      <td className="font-mono2 text-white">{fmtUSD(a.precio)}</td>
                      <td>
                        <button className="btn btn-r btn-sm"
                          onClick={() => addToCart(a)}
                          disabled={(a.stock ?? 0) === 0}>
                          +
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* === DERECHO: CARRITO === */}
        <div>
          <div className="panel">
            <div className="panel-title">DETALLE</div>

            <div className="max-h-60 lg:max-h-80 overflow-y-auto">
              {cart.length === 0
                ? <div className="text-center text-muted py-6 text-xs tracking-widest">CARRITO VACÍO</div>
                : cart.map(item => (
                  <div key={item.id} className="bg-g3 border border-borde rounded-md p-2 flex items-center gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono2 text-rojo-bright text-xs">{item.codigo}</div>
                      <div className="text-sm font-semibold truncate">{item.descripcion}</div>
                      <div className="text-muted text-xs">{fmtUSD(item.precio)} c/u</div>
                    </div>
                    <input type="number" value={item.qty} min="1"
                      onChange={e => updateQty(item.id, parseInt(e.target.value) || 1)}
                      className="w-12 bg-g2 border border-borde text-white text-center
                      rounded px-1 py-0.5 font-mono2 text-sm outline-none focus:border-rojo" />
                    <div className="font-bebas text-base min-w-[52px] text-right">
                      {fmtUSD(item.precio * item.qty)}
                    </div>
                    <button className="text-rojo-bright text-base px-1 hover:text-red-300"
                      onClick={() => removeFromCart(item.id)}>✕</button>
                  </div>
                ))
              }
            </div>

            {/* Totales */}
            <div className="bg-g3 border border-borde rounded-md px-3 py-2 mt-2">
              <div className="flex justify-between py-1 text-sm text-muted">
                <span>SUBTOTAL:</span><span>{fmtUSD(cartTotal())}</span>
              </div>
              <div className="flex justify-between font-bebas text-xl text-rojo-bright
              border-t border-rojo-dark mt-1 pt-1">
                <span>TOTAL $</span><span>{fmtUSD(cartTotal())}</span>
              </div>
              <div className="flex justify-between font-bebas text-base text-white">
                <span>TOTAL Bs</span><span>{fmtBS(cartTotal(), tasa)}</span>
              </div>
            </div>

            {/* Tipo de pago */}
            <div className="field mt-2">
              <label>Tipo de Pago</label>
              <div className="flex gap-1">
                {['CONTADO', 'CREDITO', 'TRANSF.'].map(t => (
                  <button key={t} onClick={() => setTipoPago(t)}
                    className={`flex-1 py-1.5 px-1 rounded border text-xs font-raj font-bold tracking-wide transition-all
                    ${tipoPago === t ? 'bg-rojo border-rojo text-white' : 'bg-g3 border-borde text-muted hover:text-white'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {tipoPago === 'CREDITO' && (
              <div className="field">
                <label>Vencimiento</label>
                <input type="date" className="inp" value={vencFact}
                  onChange={e => setVencFact(e.target.value)} />
              </div>
            )}

            <button className="btn btn-g btn-full mt-2" onClick={procesarNota}>
              ✅ PROCESAR NOTA
            </button>
            <button className="btn btn-gr btn-full mt-1.5" onClick={clearCart}>
              🗑 LIMPIAR CARRITO
            </button>
          </div>
        </div>

      </div>

      {/* Modal Demo */}
      {showDemoModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="bg-g2 border-2 border-rojo-bright p-6 rounded-xl max-w-sm w-full text-center shadow-[0_0_50px_rgba(220,38,38,0.3)]">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="font-bebas text-3xl text-rojo-bright mb-2">LÍMITE DE DEMO ALCANZADO</h2>
            <p className="text-muted text-sm mb-6">
              Esta versión de prueba está limitada a 50 ventas.
              Para continuar operando, por favor ingresa la clave de activación.
            </p>
            <input
              type="password"
              className="inp text-center text-xl tracking-[1em] mb-4"
              placeholder="*****"
              value={demoKey}
              onChange={e => setDemoKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && unlockDemo()}
            />
            <div className="flex gap-2">
              <button className="btn btn-gr flex-1" onClick={() => setShowDemoModal(false)}>CERRAR</button>
              <button className="btn btn-r flex-1" onClick={unlockDemo}>DESBLOQUEAR</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
