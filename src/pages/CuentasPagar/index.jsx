import { useState } from 'react'
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

  const cuentas = useLiveQuery(() => db.ctas_pagar.orderBy('vencimiento').toArray(), [], [])
  const abonos = useLiveQuery(() => db.abonos.where('tipo_cuenta').equals('PAGAR').toArray(), [], [])

  const totalPendiente = cuentas.reduce((s, c) => {
    if (c.estado === 'PAGADA') return s
    const abonado = abonos.filter(a => a.cuenta_id === c.id).reduce((sum, a) => sum + a.monto, 0)
    return s + (c.monto - abonado)
  }, 0)

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.proveedor.trim() || !form.monto) { toast('Completa los campos requeridos', 'warn'); return }
    await db.ctas_pagar.add({ ...form, monto: parseFloat(form.monto) || 0, fecha: new Date() })
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
    <div className="space-y-4">
      <div className="panel p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="panel-title mb-0 uppercase tracking-tighter">Cuentas por Pagar</div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Control de Obligaciones con Proveedores</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Total Pendiente</p>
              <p className="text-2xl font-mono font-black text-rose-500 leading-none">{fmtUSD(totalPendiente)}</p>
            </div>
            <button className="btn btn-r shadow-lg font-black" onClick={() => setShowModal(true)}>
              <span className="material-icons-round text-base">add_box</span>
              <span>Nueva Deuda</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table>
            <thead>
              <tr>
                <th>Proveedor</th><th>Concepto</th><th className="text-right">Total</th><th className="text-right">Pendiente</th><th>Vencimiento</th><th>Estado</th><th className="text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {cuentas.map(c => {
                const pagos = abonos.filter(a => a.cuenta_id === c.id)
                const abonado = pagos.reduce((s, x) => s + x.monto, 0)
                const pendiente = c.monto - abonado
                const venc = c.estado !== 'PAGADA' && isVencido(c.vencimiento)

                return (
                  <tr key={c.id} className={`${venc ? 'bg-rose-50/20' : ''} group/tr hover:bg-slate-50/50 transition-colors`}>
                    <td>
                      <div className="font-bold text-slate-700">{c.proveedor}</div>
                      {pagos.length > 0 && (
                        <div className="text-[8px] font-black text-rose-400 uppercase tracking-widest mt-0.5">{pagos.length} pagos parciales realizados</div>
                      )}
                    </td>
                    <td className="text-slate-500 text-[10px] font-bold uppercase tracking-tighter">{c.concepto || '—'}</td>
                    <td className="font-mono text-slate-400 text-right text-xs">{fmtUSD(c.monto)}</td>
                    <td className={`font-mono text-right font-black ${pendiente > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                      {fmtUSD(pendiente)}
                    </td>
                    <td className={`font-bold ${venc ? 'text-rose-500' : 'text-slate-400 text-[10px] uppercase tracking-tighter'}`}>{fmtDate(c.vencimiento)}</td>
                    <td>
                      <span className={`badge ${c.estado === 'PAGADA' ? 'badge-g' : c.estado === 'PARCIAL' ? 'badge-y' : venc ? 'badge-r' : 'badge-y'}`}>
                        {venc && c.estado !== 'PAGADA' ? 'VENCIDA' : c.estado}
                      </span>
                    </td>
                    <td className="text-right">
                      {c.estado !== 'PAGADA' && (
                        <button className="btn btn-r !py-1 !px-3 font-black text-[9px]" onClick={() => { setPago(c); setMontoPago(pendiente.toFixed(2)) }}>
                          <span className="material-icons-round text-sm">payments</span>
                          <span>PAGAR</span>
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {cuentas.length === 0 && (
                <tr><td colSpan={7} className="text-center text-slate-300 py-16 tracking-widest text-[10px] font-black uppercase italic">Sin cuentas por pagar registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva Deuda">
        <div className="space-y-4">
          <div className="field"><label>Proveedor *</label>
            <input className="inp !py-3" value={form.proveedor} onChange={e => f('proveedor', e.target.value)} placeholder="Ej. Distribuidora Polar" /></div>
          <div className="field"><label>Concepto (Factura #)</label>
            <input className="inp !py-3" value={form.concepto} onChange={e => f('concepto', e.target.value)} placeholder="Ej. Factura #1234 - Repuestos" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="field"><label>Monto ($) *</label>
              <input className="inp !py-3 font-mono font-black text-rose-600" type="number" value={form.monto} onChange={e => f('monto', e.target.value)} step="0.01" inputMode="decimal" /></div>
            <div className="field"><label>Vencimiento</label>
              <input className="inp !py-3" type="date" value={form.vencimiento} onChange={e => f('vencimiento', e.target.value)} /></div>
          </div>
          <div className="flex gap-3 pt-5 border-t border-slate-50">
            <button className="btn btn-gr flex-1 justify-center py-3" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary flex-1 justify-center py-3 font-black shadow-xl" onClick={save}>
              <span className="material-icons-round text-base">save</span>
              <span>Guardar Deuda</span>
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!pago} onClose={() => setPago(null)} title="Registrar Pago">
        {pago && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-2xl relative overflow-hidden text-left">
              <div className="absolute right-0 top-0 bottom-0 w-24 bg-rose-500/20 -skew-x-12 blur-2xl"></div>
              <div className="relative z-10">
                <p className="text-rose-400 text-[9px] font-black uppercase tracking-widest mb-1">Proveedor / Factura</p>
                <p className="text-sm font-bold truncate max-w-[140px]">{pago.proveedor}</p>
              </div>
              <div className="text-right relative z-10">
                <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Saldo a Liquidar</p>
                <p className="text-rose-400 font-mono font-black text-xl">
                  {fmtUSD(pago.monto - abonos.filter(a => a.cuenta_id === pago.id).reduce((s, x) => s + x.monto, 0))}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="field">
                <label>Método de Pago</label>
                <select className="inp !py-3" value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                  <option value="EFECTIVO_USD">EFECTIVO $</option>
                  <option value="EFECTIVO_BS">EFECTIVO BS</option>
                  <option value="PAGO_MOVIL">PAGO MÓVIL</option>
                  <option value="PUNTO_VENTA">PUNTO VENTA</option>
                </select>
              </div>
              <div className="field">
                <label>Monto del Pago ($)</label>
                <input className="inp font-mono font-black text-lg !py-3 !bg-slate-50 focus:!bg-white" type="number"
                  value={montoPago} onChange={e => setMontoPago(e.target.value)} step="0.01" inputMode="decimal" />
              </div>
            </div>

            <div className="flex gap-3 pt-5 border-t border-slate-50">
              <button className="btn btn-gr flex-1 justify-center py-3" onClick={() => setPago(null)}>Cancelar</button>
              <button className="btn btn-r flex-1 justify-center py-3 font-black shadow-xl" onClick={procesarPago}>
                <span className="material-icons-round text-base">verified</span>
                <span>Confirmar Pago</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
