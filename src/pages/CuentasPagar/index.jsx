import { useState } from 'react'
import { addToSyncQueue } from '../../utils/syncManager'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtDate, isVencido, today } from '../../utils/format'
import Modal from '../../components/UI/Modal'

const empty = { proveedor: '', concepto: '', monto: 0, vencimiento: '', estado: 'PENDIENTE' }

export default function CuentasPagar() {
  const toast = useStore(s => s.toast)
  const [form, setForm] = useState(empty)
  const [showModal, setShowModal] = useState(false)
  const [pago, setPago] = useState(null)
  const [montoPago, setMontoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState('EFECTIVO_USD')
  const [selectedCompra, setSelectedCompra] = useState(null)
  const [compraItems, setCompraItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)

  const cuentasRaw = useLiveQuery(() => db.ctas_pagar.orderBy('vencimiento').toArray(), [], [])
  const abonos = useLiveQuery(() => db.abonos.where('tipo_cuenta').equals('PAGAR').toArray(), [], [])
  const proveedores = useLiveQuery(() => db.proveedores.toArray(), [], [])

  const cuentas = useLiveQuery(async () => {
    if (!cuentasRaw) return []
    const result = []
    for (const c of cuentasRaw) {
      let provName = c.proveedor
      if (c.proveedor_id && !provName) {
        const p = proveedores?.find(x => x.id === parseInt(c.proveedor_id))
        provName = p?.nombre || 'Proveedor #' + c.proveedor_id
      }
      result.push({ ...c, proveedorLabel: provName })
    }
    return result
  }, [cuentasRaw, proveedores], [])

  const handleViewCompra = async (cuenta) => {
    if (!cuenta.nro_factura) return
    setLoadingItems(true)
    try {
      // Buscar la compra por nro_factura y proveedor_id
      const comp = await db.compras.where('nro_factura').equals(cuenta.nro_factura)
        .filter(x => parseInt(x.proveedor_id) === parseInt(cuenta.proveedor_id))
        .first()

      if (!comp) {
        toast('No se encontró el registro original de la factura', 'warn')
        return
      }

      setSelectedCompra({ ...comp, proveedor: cuenta.proveedorLabel })
      const items = await db.compra_items.where('compra_id').equals(comp.id).toArray()
      const fullItems = []
      for (const item of items) {
        const art = await db.articulos.get(item.articulo_id)
        fullItems.push({
          ...item,
          descripcion: art?.descripcion || 'Producto no encontrado',
          codigo: art?.codigo || 'S/C'
        })
      }
      setCompraItems(fullItems)
    } catch (err) {
      console.error(err)
      toast('Error al cargar la factura', 'error')
    } finally {
      setLoadingItems(false)
    }
  }

  const totalPendiente = (cuentas || []).reduce((s, c) => {
    if (c.estado === 'PAGADA') return s
    const abonado = abonos.filter(a => a.cuenta_id === c.id).reduce((sum, a) => sum + a.monto, 0)
    return s + (c.monto - abonado)
  }, 0)

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.proveedor.trim() || !form.monto) { toast('Completa los campos requeridos', 'warn'); return }
    const newCxp = { ...form, monto: parseFloat(form.monto) || 0, fecha: new Date() }
    await db.ctas_pagar.add(newCxp)
    // ☁️ Sync a Supabase — tabla cuentas_por_pagar
    await addToSyncQueue('cuentas_por_pagar', 'INSERT', newCxp)
    toast('✅ Cuenta por pagar registrada', 'success')
    setForm(empty); setShowModal(false)
  }

  const procesarPago = async () => {
    if (!pago) return
    const monto = parseFloat(montoPago)
    if (!monto || monto <= 0) { toast('Monto inválido', 'error'); return }

    const abonosActuales = abonos.filter(a => a.cuenta_id === pago.id).reduce((s, x) => s + x.monto, 0)
    const saldoRestante = pago.monto - abonosActuales

    if (monto > saldoRestante + 0.01) {
      toast(`⚠️ El monto excede el saldo restante (${fmtUSD(saldoRestante)})`, 'warn'); return
    }

    await db.abonos.add({
      cuenta_id: pago.id, tipo_cuenta: 'PAGAR',
      fecha: new Date(), monto, metodo: metodoPago
    })

    const nuevoTotalAbonado = abonosActuales + monto
    const nuevoEstado = nuevoTotalAbonado >= pago.monto - 0.01 ? 'PAGADA' : 'PARCIAL'

    await db.ctas_pagar.update(pago.id, {
      estado: nuevoEstado
    })

    toast(`✅ Egreso registrado: ${fmtUSD(monto)}`)
    setPago(null); setMontoPago(''); setMetodoPago('EFECTIVO_USD')
  }

  return (
    <div className="space-y-4 pr-2 pb-6">
      <div className="panel p-0 overflow-hidden transition-none shadow-[var(--win-shadow)] border-t-4 border-t-[var(--red-var)]">
        <div className="p-5 border-b border-[var(--border-var)] bg-[var(--surface2)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xl font-black text-[var(--text-main)] mb-0 uppercase tracking-tighter flex items-center gap-2">
              <span className="material-icons-round text-[var(--red-var)]">payments</span>
              CUENTAS POR PAGAR
            </div>
            <p className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest mt-1">Control Analítico de Obligaciones y Egresos</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right bg-[var(--surface)] p-3 border border-[var(--border-var)] shadow-inner">
              <p className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest leading-none mb-1">Total Pendiente</p>
              <p className="text-3xl font-mono font-black text-[var(--red-var)] leading-none">{fmtUSD(totalPendiente)}</p>
            </div>
            <button className="btn bg-[var(--red-var)] text-white shadow-[var(--win-shadow)] font-black transition-none cursor-pointer h-12 px-6 uppercase text-xs" onClick={() => setShowModal(true)}>
              <span className="material-icons-round text-base">add_box</span>
              <span>NUEVA DEUDA</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[200px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Proveedor</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Concepto</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Total</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Pendiente</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Vencimiento</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Estado</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cuentas?.map(c => {
                const pagos = abonos.filter(a => a.cuenta_id === c.id)
                const abonado = pagos.reduce((s, x) => s + x.monto, 0)
                const pendiente = c.monto - abonado
                const venc = c.estado !== 'PAGADA' && isVencido(c.vencimiento)

                return (
                  <tr key={c.id} className={`${venc ? 'bg-[var(--red-var)]/5 italic' : ''} group/tr hover:bg-[var(--surface2)] transition-none`}>
                    <td className="py-3 px-4">
                      <div className="font-black text-[var(--text-main)] text-xs uppercase tracking-tight flex items-center gap-2">
                        {c.proveedorLabel}
                        {c.nro_factura && (
                          <button
                            onClick={() => handleViewCompra(c)}
                            className="w-5 h-5 flex items-center justify-center bg-[var(--teal4)] text-[var(--teal)] rounded hover:bg-[var(--teal)] hover:text-white transition-all shadow-sm"
                            title="Ver Factura Original"
                          >
                            <span className="material-icons-round text-[10px]">receipt</span>
                          </button>
                        )}
                      </div>
                      {pagos.length > 0 && (
                        <div className="text-[8px] font-black text-[var(--red-var)] uppercase tracking-widest mt-0.5">{pagos.length} PAGOS REALIZADOS</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[var(--text2)] text-[10px] font-black uppercase tracking-tighter opacity-70">{c.concepto || c.nro_factura || '—'}</td>
                    <td className="py-3 px-4 font-mono text-[var(--text2)] text-right text-xs font-bold">{fmtUSD(c.monto)}</td>
                    <td className={`py-3 px-4 font-mono text-right font-black ${pendiente > 0 ? 'text-[var(--red-var)]' : 'text-[var(--text2)] opacity-30 italic'}`}>
                      {fmtUSD(pendiente)}
                    </td>
                    <td className="py-3 px-4">
                      <div className={`font-black uppercase tracking-tighter text-[10px] ${venc ? 'text-[var(--red-var)] bg-[var(--red-var)]/10 px-2 py-0.5' : 'text-[var(--text2)]'}`}>
                        {fmtDate(c.vencimiento)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge shadow-[var(--win-shadow)] border border-black/5 ${c.estado === 'PAGADA' ? 'badge-g' : c.estado === 'PARCIAL' ? 'bg-[var(--orange-var)] text-white' : venc ? 'bg-[var(--red-var)] text-white' : 'bg-[var(--orange-var)] text-white'}`}>
                        {venc && c.estado !== 'PAGADA' ? 'VENCIDA' : c.estado}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {c.estado !== 'PAGADA' && (
                        <button className="btn bg-[var(--red-var)] text-white !py-1.5 !px-4 font-black text-[10px] transition-none shadow-[var(--win-shadow)] cursor-pointer uppercase inline-flex items-center gap-2" onClick={() => { setPago(c); setMontoPago(pendiente.toFixed(2)) }}>
                          <span className="material-icons-round text-sm">payments</span>
                          <span>PAGAR</span>
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {cuentas?.length === 0 && (
                <tr><td colSpan={7} className="text-center text-[var(--text2)] py-20 tracking-widest text-[11px] font-black uppercase italic opacity-40">Sin cuentas por pagar registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PANEL DE HISTORIAL DE ABONOS */}
      <div className="panel p-0 overflow-hidden transition-none shadow-[var(--win-shadow)] border-t-4 border-t-[var(--teal)] mt-6">
        <div className="p-4 border-b border-[var(--border-var)] bg-[var(--surface2)]">
          <div className="text-sm font-black text-[var(--text-main)] uppercase tracking-tighter flex items-center gap-2">
            <span className="material-icons-round text-[var(--teal)]">history</span>
            HISTORIAL DE ABONOS Y PAGOS REALIZADOS
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--surfaceDark)] text-[9px] font-black uppercase text-[var(--text2)] border-b border-[var(--border-var)] sticky top-0 z-10">
                <th className="py-3 px-4">Fecha / Hora</th>
                <th className="py-3 px-4">Proveedor / Concepto</th>
                <th className="py-3 px-4">Método</th>
                <th className="py-3 px-4 text-right">Monto Pagado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-var)]">
              {[...abonos].reverse().map(a => {
                const c = (cuentas || []).find(x => x.id === a.cuenta_id)
                return (
                  <tr key={a.id} className="text-[10px] hover:bg-[var(--surface2)] transition-none">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[var(--text2)]">{fmtDate(a.fecha)}</div>
                      <div className="text-[8px] opacity-50">{new Date(a.fecha).toLocaleTimeString()}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-black text-[var(--text-main)] uppercase">{c?.proveedorLabel || 'S/P'}</div>
                      <div className="text-[8px] text-[var(--text2)] uppercase truncate max-w-[200px]">{c?.concepto || c?.nro_factura || 'S/C'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-[var(--surfaceDark)] border border-[var(--border-var)] text-[8px] font-black uppercase rounded">
                        {a.metodo?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-[var(--teal)] text-xs">
                      {fmtUSD(a.monto)}
                    </td>
                  </tr>
                )
              })}
              {abonos.length === 0 && (
                <tr><td colSpan={4} className="text-center text-[var(--text2)] py-10 text-[10px] uppercase italic opacity-40 font-bold">No hay abonos registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="REGISTRAR NUEVO COMPROMISO DE PAGO">
        <div className="space-y-4">
          <div className="field">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">Proveedor *</label>
            <input className="inp !py-3 rounded-none focus:border-[var(--red-var)] transition-none shadow-inner uppercase" value={form.proveedor} onChange={e => f('proveedor', e.target.value.toUpperCase())} placeholder="EJ. DISTRIBUIDORA POLAR" />
          </div>
          <div className="field">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">Concepto / Referencia</label>
            <input className="inp !py-3 rounded-none focus:border-[var(--red-var)] transition-none shadow-inner uppercase" value={form.concepto} onChange={e => f('concepto', e.target.value.toUpperCase())} placeholder="EJ. FACTURA #1234 - REPUESTOS" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="field">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">Monto ($) *</label>
              <input className="inp !py-3 font-mono font-black text-[var(--red-var)] rounded-none focus:border-[var(--red-var)] transition-none shadow-inner" type="number" value={form.monto} onChange={e => f('monto', e.target.value)} step="0.01" inputMode="decimal" />
            </div>
            <div className="field">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">Fecha Vencimiento</label>
              <input className="inp !py-3 rounded-none focus:border-[var(--red-var)] transition-none shadow-inner font-black" type="date" value={form.vencimiento} onChange={e => f('vencimiento', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-4 pt-6 border-t border-[var(--border-var)]">
            <button className="btn bg-[var(--surfaceDark)] text-[var(--text-main)] flex-1 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer" onClick={() => setShowModal(false)}>CANCELAR</button>
            <button className="btn bg-[var(--red-var)] text-white flex-2 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer tracking-widest" onClick={save}>
              <span className="material-icons-round text-base">save</span>
              <span>GUARDAR DEUDA</span>
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!pago} onClose={() => setPago(null)} title="REGISTRAR EGRESO / LIQUIDACIÓN">
        {pago && (
          <div className="space-y-6">
            <div className="p-5 border-2 border-[var(--border-var)] bg-[var(--surfaceDark)] rounded-none flex items-center justify-between shadow-inner relative overflow-hidden text-left">
              <div className="absolute right-0 top-0 bottom-0 w-32 bg-[var(--red-var)]/5 -skew-x-12 blur-xl"></div>
              <div className="relative z-10">
                <p className="text-[var(--red-var)] text-[10px] font-black uppercase tracking-widest mb-1">PROVEEDOR / ACREEDOR</p>
                <p className="text-sm font-black text-[var(--text-main)] truncate max-w-[180px] uppercase">{pago.proveedorLabel}</p>
              </div>
              <div className="text-right relative z-10 border-l border-[var(--border-var)] pl-4">
                <p className="text-[var(--text2)] text-[10px] font-black uppercase tracking-widest mb-1">SALDO A LIQUIDAR</p>
                <p className="text-[var(--red-var)] font-mono font-black text-2xl">
                  {fmtUSD(pago.monto - abonos.filter(a => a.cuenta_id === pago.id).reduce((s, x) => s + x.monto, 0))}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="field">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">Método de Desembolso</label>
                <select className="inp !py-3 rounded-none focus:border-[var(--red-var)] transition-none shadow-inner font-black uppercase text-xs" value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                  <option value="EFECTIVO_USD">EFECTIVO DOLAR ($)</option>
                  <option value="EFECTIVO_BS">EFECTIVO BOLIVARES (BS)</option>
                  <option value="PAGO_MOVIL">PAGO MÓVIL / ZELLE</option>
                  <option value="PUNTO_VENTA">TRANSFERENCIA BANCARIA</option>
                </select>
              </div>
              <div className="field">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">Monto a Descontar ($)</label>
                <input className="inp font-mono font-black text-xl !py-4 rounded-none bg-[var(--surface2)] focus:border-[var(--red-var)] transition-none shadow-inner" type="number"
                  value={montoPago} onChange={e => setMontoPago(e.target.value)} step="0.01" inputMode="decimal" />
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-[var(--border-var)]">
              <button className="btn bg-[var(--surfaceDark)] text-[var(--text-main)] flex-1 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer" onClick={() => setPago(null)}>DESCARTAR</button>
              <button className="btn bg-[var(--red-var)] text-white flex-2 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer tracking-widest" onClick={procesarPago}>
                <span className="material-icons-round text-base">verified</span>
                <span>CONFIRMAR PAGO</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Detalle de Factura Original */}
      <Modal
        open={!!selectedCompra}
        onClose={() => setSelectedCompra(null)}
        title={`DETALLE DE COMPRA FACTURADA: ${selectedCompra?.nro_factura}`}
        wide
      >
        {selectedCompra && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[var(--surface2)] p-4 border border-[var(--border-var)] shadow-inner">
              <div>
                <label className="text-[10px] font-black text-[var(--text2)] uppercase">Proveedor</label>
                <p className="font-black text-xs uppercase text-[var(--text-main)]">{selectedCompra.proveedor}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-[var(--text2)] uppercase">Fecha de Recepción</label>
                <p className="font-mono font-bold text-xs">{fmtDate(selectedCompra.fecha)}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-[var(--text2)] uppercase">Monto de Factura</label>
                <p className="font-mono font-black text-sm text-[var(--teal)]">{fmtUSD(selectedCompra.total_usd)}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-[var(--text2)] uppercase">Nro. Factura</label>
                <p className="font-mono font-bold text-xs uppercase">{selectedCompra.nro_factura}</p>
              </div>
            </div>

            <div className="panel p-0 overflow-hidden border border-[var(--border-var)] max-h-[300px] overflow-y-auto custom-scroll">
              <table className="w-full text-left">
                <thead className="bg-[var(--surfaceDark)] border-b border-[var(--border-var)] sticky top-0 z-10">
                  <tr className="text-[9px] uppercase font-black text-[var(--text2)]">
                    <th className="py-3 px-4">Producto Recibido</th>
                    <th className="py-3 px-4 text-center">Cant.</th>
                    <th className="py-3 px-4 text-right">Costo ($)</th>
                    <th className="py-3 px-4 text-right">Subtotal ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-var)]">
                  {loadingItems ? (
                    <tr>
                      <td colSpan="4" className="py-10 text-center animate-pulse text-[10px] font-black uppercase text-[var(--text2)]">Accediendo a base de datos...</td>
                    </tr>
                  ) : compraItems.map((item, idx) => (
                    <tr key={idx} className="text-xs hover:bg-[var(--surfaceDark)]">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[var(--text-main)] uppercase">{item.descripcion}</div>
                        <div className="text-[9px] font-mono text-[var(--text2)] uppercase">{item.codigo}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">{item.qty}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">{fmtUSD(item.costo_unit)}</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-[var(--teal)]">{fmtUSD(item.qty * item.costo_unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4 border-t border-[var(--border-var)]">
              <button
                onClick={() => setSelectedCompra(null)}
                className="btn bg-[var(--surfaceDark)] !px-8 !py-3 font-black text-xs uppercase shadow-[var(--win-shadow)] border border-[var(--border-var)]"
              >
                SALIR
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
