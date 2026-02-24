import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtDate, isVencido } from '../../utils/format'
import Modal from '../../components/UI/Modal'

export default function CuentasCobrar() {
  const toast = useStore(s => s.toast)
  const [filtro, setFiltro] = useState('TODOS')
  const [cobro, setCobro] = useState(null)
  const [montoCobro, setMontoCobro] = useState('')
  const [metodoCobro, setMetodoCobro] = useState('EFECTIVO_USD')

  const cuentas = useLiveQuery(
    () => filtro === 'TODOS'
      ? db.ctas_cobrar.orderBy('vencimiento').toArray()
      : db.ctas_cobrar.where('estado').equals(filtro).toArray(),
    [filtro], []
  )

  const abonos = useLiveQuery(() => db.abonos.where('tipo_cuenta').equals('COBRAR').toArray(), [], [])

  const totalPorCobrar = cuentas.reduce((s, c) => {
    if (c.estado === 'COBRADA') return s
    const pagos = abonos.filter(a => a.cuenta_id === c.id).reduce((sum, a) => sum + a.monto, 0)
    return s + (c.monto - pagos)
  }, 0)

  const vencidas = cuentas.filter(c => c.estado !== 'COBRADA' && isVencido(c.vencimiento))

  const procesarCobro = async () => {
    if (!cobro) return
    const monto = parseFloat(montoCobro)
    if (!monto || monto <= 0) { toast('Monto inválido', 'error'); return }

    const abonosActuales = abonos.filter(a => a.cuenta_id === cobro.id).reduce((s, x) => s + x.monto, 0)
    const saldoRestante = cobro.monto - abonosActuales

    if (monto > saldoRestante + 0.01) {
      toast(`⚠️ El monto excede el saldo restante (${fmtUSD(saldoRestante)})`, 'warn'); return
    }

    await db.abonos.add({
      cuenta_id: cobro.id, tipo_cuenta: 'COBRAR',
      fecha: new Date(), monto, metodo: metodoCobro
    })

    const nuevoTotalAbonado = abonosActuales + monto
    const nuevoEstado = nuevoTotalAbonado >= cobro.monto - 0.01 ? 'COBRADA' : 'PARCIAL'

    await db.ctas_cobrar.update(cobro.id, {
      estado: nuevoEstado,
      monto_cobrado: nuevoTotalAbonado,
      fecha_cobro: nuevoEstado === 'COBRADA' ? new Date() : null
    })

    toast(`✅ Abono registrado: ${fmtUSD(monto)}`)
    setCobro(null); setMontoCobro(''); setMetodoCobro('EFECTIVO_USD')
  }

  return (
    <div className="h-full overflow-y-auto custom-scroll pr-2 pb-6">
      <div className="space-y-4">
        {vencidas.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-4 flex items-center justify-between shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>
            <div className="flex items-center gap-3">
              <span className="material-icons-round text-red-500">warning</span>
              <div>
                <p className="font-bold text-red-600 uppercase text-[10px] tracking-widest">Atención: Facturas Vencidas</p>
                <p className="text-sm font-medium text-red-500">{vencidas.length} cuentas pendientes han excedido su plazo</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Monto en Riesgo</p>
              <p className="text-xl font-mono font-bold text-red-600">
                {fmtUSD(vencidas.reduce((s, c) => {
                  const pagos = abonos.filter(a => a.cuenta_id === c.id).reduce((sum, a) => sum + a.monto, 0)
                  return s + (c.monto - pagos)
                }, 0))}
              </p>
            </div>
          </div>
        )}

        <div className="panel p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="panel-title mb-0 uppercase tracking-tighter">Cuentas por Cobrar</div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Control de Créditos y Cobranzas</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Total Pendiente</p>
                <p className="text-2xl font-mono font-black text-primary leading-none">{fmtUSD(totalPorCobrar)}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-b border-slate-50">
            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {['TODOS', 'PENDIENTE', 'PARCIAL', 'COBRADA'].map(f => (
                <button key={f} onClick={() => setFiltro(f)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all
                ${filtro === f ? 'bg-primary text-white shadow-xl' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}>
                  {f === 'TODOS' ? 'Ver Todo' : f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Nota #</th><th>Cliente</th><th className="text-right">Venta</th><th className="text-right">Pendiente</th><th>Vencimiento</th><th>Estado</th><th className="text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {cuentas.map(c => {
                  const pagos = abonos.filter(a => a.cuenta_id === c.id)
                  const abonado = pagos.reduce((s, x) => s + x.monto, 0)
                  const pendiente = c.monto - abonado
                  const venc = c.estado !== 'COBRADA' && isVencido(c.vencimiento)

                  return (
                    <tr key={c.id} className={`${venc ? 'bg-red-50/20' : ''} group/tr hover:bg-slate-50/50 transition-colors`}>
                      <td className="font-mono text-primary font-bold text-xs">
                        {c.venta_id ? `#${String(c.venta_id).padStart(6, '0')}` : '—'}
                      </td>
                      <td>
                        <div className="font-bold text-slate-700">{c.cliente}</div>
                        {pagos.length > 0 && (
                          <div className="text-[8px] font-black text-green-500 uppercase tracking-widest mt-0.5">{pagos.length} abonos realizados</div>
                        )}
                      </td>
                      <td className="font-mono text-slate-400 text-right text-xs">{fmtUSD(c.monto)}</td>
                      <td className={`font-mono text-right font-black ${pendiente > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                        {fmtUSD(pendiente)}
                      </td>
                      <td className={`font-bold ${venc ? 'text-red-500' : 'text-slate-400 text-[10px] uppercase tracking-tighter'}`}>
                        {fmtDate(c.vencimiento)}
                      </td>
                      <td>
                        <span className={`badge ${c.estado === 'COBRADA' ? 'badge-g' : c.estado === 'PARCIAL' ? 'badge-y' : venc ? 'badge-r' : 'badge-y'}`}>
                          {venc && c.estado !== 'COBRADA' ? 'VENCIDA' : c.estado}
                        </span>
                      </td>
                      <td className="text-right">
                        {c.estado !== 'COBRADA' && (
                          <button className="btn btn-primary !py-1 !px-3 font-black text-[9px]"
                            onClick={() => { setCobro(c); setMontoCobro(pendiente.toFixed(2)) }}>
                            <span className="material-icons-round text-sm">payments</span>
                            <span>ABONAR</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {cuentas.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-slate-300 py-16 tracking-widest text-[10px] font-black uppercase italic">Sin registros de cobranza</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Modal open={!!cobro} onClose={() => setCobro(null)} title="Registrar Abono">
          {cobro && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-2xl relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-24 bg-primary/20 -skew-x-12 blur-2xl"></div>
                <div className="relative z-10">
                  <p className="text-primary text-[9px] font-black uppercase tracking-widest mb-1">Cliente / Cuenta</p>
                  <p className="text-sm font-bold truncate max-w-[140px]">{cobro.cliente}</p>
                </div>
                <div className="text-right relative z-10">
                  <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Saldo Pendiente</p>
                  <p className="text-primary font-mono font-black text-xl">
                    {fmtUSD(cobro.monto - abonos.filter(a => a.cuenta_id === cobro.id).reduce((s, x) => s + x.monto, 0))}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="field">
                  <label>Método de Pago</label>
                  <select className="inp !py-3" value={metodoCobro} onChange={e => setMetodoCobro(e.target.value)}>
                    <option value="EFECTIVO_USD">EFECTIVO $</option>
                    <option value="EFECTIVO_BS">EFECTIVO BS</option>
                    <option value="PAGO_MOVIL">PAGO MÓVIL</option>
                    <option value="PUNTO_VENTA">PUNTO VENTA</option>
                  </select>
                </div>
                <div className="field">
                  <label>Monto a Abonar ($)</label>
                  <input className="inp font-mono font-black text-lg !py-3 !bg-slate-50 focus:!bg-white" type="number"
                    value={montoCobro} onChange={e => setMontoCobro(e.target.value)} step="0.01" inputMode="decimal" />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <div className="flex gap-3">
                  <button className="btn btn-gr flex-1 justify-center py-3" onClick={() => setCobro(null)}>Cancelar</button>
                  <button className="btn btn-primary flex-1 justify-center py-3 font-black shadow-xl" onClick={procesarCobro}>
                    <span className="material-icons-round text-base">verified</span>
                    <span>Guardar Abono</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  )
}
