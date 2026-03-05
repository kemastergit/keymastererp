import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtDate, isVencido } from '../../utils/format'
import { supabase } from '../../lib/supabase'
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

    try {
      // 1. GUARDADO LOCAL (ABONO Y ESTADO)
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

      toast(`✅ Abono local registrado: ${fmtUSD(monto)}`)

      // 2. SINCRONIZACIÓN EN LA NUBE (Actualizamos la cuenta principal)
      const { error: syncError } = await supabase
        .from('cuentas_por_cobrar')
        .upsert({
          id_local: cobro.id, // Referencia para evitar duplicados
          cliente: cobro.cliente,
          monto: cobro.monto,       // Enviamos ambos para compatibilidad total
          monto_total: cobro.monto,
          monto_cobrado: nuevoTotalAbonado,
          estado: nuevoEstado,
          fecha_vencimiento: cobro.vencimiento,
          ultima_actualizacion: new Date()
        }, { onConflict: 'id_local' })

      if (syncError) throw syncError
      toast('🛰️ Saldo en Nube actualizado', 'success')

      // Procesar comisiones si aplica
      if (nuevoEstado === 'COBRADA' && cobro.venta_id) {
        try {
          const venta = await db.ventas.get(cobro.venta_id)
          if (venta) {
            const items = await db.venta_items.where('venta_id').equals(venta.id).toArray()
            const { processSaleCommissions } = await import('../../utils/comisiones')
            await processSaleCommissions(venta.id, { ...venta, tipo_pago: 'CONTADO' }, items)
          }
        } catch (err) { console.error('Error comisiones:', err) }
      }

      setCobro(null); setMontoCobro(''); setMetodoCobro('EFECTIVO_USD')
    } catch (err) {
      console.error('Error sync abono:', err)
      toast('⚠️ Guardado localmente, error al subir a la nube: ' + err.message, 'error')
      setCobro(null)
    }
  }

  return (
    <div className="pr-2 pb-6">
      <div className="space-y-4">
        {vencidas.length > 0 && (
          <div className="bg-[var(--surface)] border-2 border-[var(--red-var)] rounded-none px-6 py-5 mb-4 flex flex-col md:flex-row items-center justify-between shadow-[var(--win-shadow)] relative transition-none border-l-8">
            <div className="flex items-center gap-4">
              <span className="material-icons-round text-[var(--red-var)] text-3xl">report_problem</span>
              <div>
                <p className="font-black text-[var(--red-var)] uppercase text-xs tracking-tighter mb-1">ALERTA: CRÉDITOS VENCIDOS</p>
                <p className="text-[10px] font-black text-[var(--text2)] uppercase tracking-widest">{vencidas.length} facturas han superado el plazo de pago</p>
              </div>
            </div>
            <div className="text-right mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-[var(--border-var)] w-full md:w-auto">
              <p className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest mb-1">Monto en Riesgo Total</p>
              <p className="text-2xl font-mono font-black text-[var(--red-var)] bg-[var(--surfaceDark)] px-3 py-1 shadow-inner border border-black/5">
                {fmtUSD(vencidas.reduce((s, c) => {
                  const pagos = abonos.filter(a => a.cuenta_id === c.id).reduce((sum, a) => sum + a.monto, 0)
                  return s + (c.monto - pagos)
                }, 0))}
              </p>
            </div>
          </div>
        )}

        <div className="panel p-0 overflow-hidden rounded-none shadow-[var(--win-shadow)] transition-none border-t-4 border-t-[var(--teal)]">
          <div className="p-5 border-b border-[var(--border-var)] bg-[var(--surface2)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xl font-black text-[var(--text-main)] mb-0 uppercase tracking-tighter flex items-center gap-2">
                <span className="material-icons-round text-[var(--teal)]">receipt_long</span>
                CUENTAS POR COBRAR
              </div>
              <p className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest mt-1">Control Analítico de Cartera y Cobranzas</p>
            </div>
            <div className="flex items-center gap-4 bg-[var(--surface)] p-3 border border-[var(--border-var)] shadow-inner">
              <div className="text-right">
                <p className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest leading-none mb-1">Saldo Total Pendiente</p>
                <p className="text-3xl font-mono font-black text-[var(--teal)] leading-none">{fmtUSD(totalPorCobrar)}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-[var(--surface)] border-b border-[var(--border-var)]">
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              {['TODOS', 'PENDIENTE', 'PARCIAL', 'COBRADA'].map(f => (
                <button key={f} onClick={() => setFiltro(f)}
                  className={`px-5 py-2 rounded-none text-[10px] font-black uppercase tracking-widest transition-none cursor-pointer border shadow-[var(--win-shadow)]
                ${filtro === f ? 'bg-[var(--teal)] text-white border-transparent' : 'bg-[var(--surface2)] text-[var(--text2)] border-[var(--border-var)] hover:bg-[var(--surfaceDark)]'}`}>
                  {f === 'TODOS' ? 'Ver Todo' : f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Nota #</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Cliente</th>
                  <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Total</th>
                  <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Pendiente</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Vencimiento</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Estado</th>
                  <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cuentas.map(c => {
                  const pagos = abonos.filter(a => a.cuenta_id === c.id)
                  const abonado = pagos.reduce((s, x) => s + x.monto, 0)
                  const pendiente = c.monto - abonado
                  const venc = c.estado !== 'COBRADA' && isVencido(c.vencimiento)

                  return (
                    <tr key={c.id} className={`${venc ? 'bg-[var(--red-var)]/5 italic' : ''} group/tr hover:bg-[var(--surface2)] transition-none`}>
                      <td className="py-3 px-4 font-mono text-[var(--teal)] font-black text-xs uppercase">
                        {c.venta_id ? `#${String(c.venta_id).padStart(6, '0')}` : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-black text-[var(--text-main)] text-xs uppercase tracking-tight">{c.cliente}</div>
                        {pagos.length > 0 && (
                          <div className="text-[8px] font-black text-[var(--teal)] uppercase tracking-widest mt-0.5">{pagos.length} ABONOS REGISTRADOS</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--text2)] text-right text-xs font-bold">{fmtUSD(c.monto)}</td>
                      <td className={`py-3 px-4 font-mono text-right font-black ${pendiente > 0 ? 'text-[var(--text-main)]' : 'text-[var(--text2)] opacity-30 italic'}`}>
                        {fmtUSD(pendiente)}
                      </td>
                      <td className="py-3 px-4">
                        <div className={`font-black uppercase tracking-tighter text-[10px] ${venc ? 'text-[var(--red-var)] bg-[var(--red-var)]/10 px-2 py-0.5' : 'text-[var(--text2)]'}`}>
                          {fmtDate(c.vencimiento)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`badge shadow-[var(--win-shadow)] border border-black/5 ${c.estado === 'COBRADA' ? 'badge-g' : c.estado === 'PARCIAL' ? 'bg-[var(--orange-var)] text-white' : venc ? 'bg-[var(--red-var)] text-white' : 'bg-[var(--orange-var)] text-white'}`}>
                          {venc && c.estado !== 'COBRADA' ? 'VENCIDA' : c.estado}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {c.estado !== 'COBRADA' && (
                          <button className="btn bg-[var(--teal)] text-white !py-1.5 !px-4 font-black text-[10px] transition-none shadow-[var(--win-shadow)] cursor-pointer uppercase inline-flex items-center gap-2"
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
                  <tr><td colSpan={7} className="text-center text-[var(--text2)] py-20 tracking-widest text-[11px] font-black uppercase italic opacity-40">Sin registros de cobranza pendientes</td></tr>
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
              HISTORIAL DE ABONOS Y COBROS REALIZADOS
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--surfaceDark)] text-[9px] font-black uppercase text-[var(--text2)] border-b border-[var(--border-var)] sticky top-0 z-10">
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">Cliente / Nota</th>
                  <th className="py-3 px-4">Método</th>
                  <th className="py-3 px-4 text-right">Monto Cobrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-var)]">
                {[...abonos].reverse().map(a => {
                  const c = cuentas.find(x => x.id === a.cuenta_id)
                  return (
                    <tr key={a.id} className="text-[10px] hover:bg-[var(--surface2)] transition-none">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[var(--text2)]">{fmtDate(a.fecha)}</div>
                        <div className="text-[8px] opacity-50">{new Date(a.fecha).toLocaleTimeString()}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-black text-[var(--text-main)] uppercase">{c?.cliente || 'S/C'}</div>
                        <div className="text-[8px] text-[var(--text2)] uppercase truncate max-w-[200px]">Nota: {c?.venta_id ? `#${c.venta_id}` : 'S/N'}</div>
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
                  <tr><td colSpan={4} className="text-center text-[var(--text2)] py-10 text-[10px] uppercase italic opacity-40 font-bold">No hay cobros registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Modal open={!!cobro} onClose={() => setCobro(null)} title="REGISTRAR ABONO A CUENTA">
          {cobro && (
            <div className="space-y-6">
              <div className="p-5 border-2 border-[var(--border-var)] bg-[var(--surfaceDark)] rounded-none flex items-center justify-between shadow-inner relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-32 bg-[var(--teal)]/5 -skew-x-12 blur-xl"></div>
                <div className="relative z-10">
                  <p className="text-[var(--text2)] text-[10px] font-black uppercase tracking-widest mb-1">CLIENTE / TITULAR</p>
                  <p className="text-sm font-black text-[var(--text-main)] truncate max-w-[180px] uppercase">{cobro.cliente}</p>
                </div>
                <div className="text-right relative z-10 border-l border-[var(--border-var)] pl-4">
                  <p className="text-[var(--text2)] text-[10px] font-black uppercase tracking-widest mb-1">SALDO PENDIENTE</p>
                  <p className="text-[var(--teal)] font-mono font-black text-2xl">
                    {fmtUSD(cobro.monto - abonos.filter(a => a.cuenta_id === cobro.id).reduce((s, x) => s + x.monto, 0))}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="field">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">Método de Captación</label>
                  <select className="inp !py-3 rounded-none focus:border-[var(--teal)] transition-none shadow-inner font-black uppercase text-xs" value={metodoCobro} onChange={e => setMetodoCobro(e.target.value)}>
                    <option value="EFECTIVO_USD">EFECTIVO DOLAR ($)</option>
                    <option value="EFECTIVO_BS">EFECTIVO BOLIVARES (BS)</option>
                    <option value="PAGO_MOVIL">PAGO MÓVIL / TRANSFERENCIA</option>
                    <option value="PUNTO_VENTA">PUNTO DE VENTA (DEBITO)</option>
                  </select>
                </div>
                <div className="field">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">Monto de la Cobranza ($)</label>
                  <input className="inp font-mono font-black text-xl !py-4 rounded-none bg-[var(--surface2)] focus:border-[var(--teal)] transition-none shadow-inner" type="number"
                    value={montoCobro} onChange={e => setMontoCobro(e.target.value)} step="0.01" inputMode="decimal" />
                </div>
              </div>

              <div className="border-t border-[var(--border-var)] pt-6">
                <div className="flex gap-4">
                  <button className="btn bg-[var(--surfaceDark)] text-[var(--text-main)] flex-1 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer" onClick={() => setCobro(null)}>DESCARTAR</button>
                  <button className="btn bg-[var(--teal)] text-white flex-2 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer tracking-widest" onClick={procesarCobro}>
                    <span className="material-icons-round text-base">verified</span>
                    <span>PROCESAR PAGO</span>
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
