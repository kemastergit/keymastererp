import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtDate, isVencido, today } from '../../utils/format'
import Modal from '../../components/UI/Modal'

const empty = { proveedor:'', concepto:'', monto:0, vencimiento:'', estado:'PENDIENTE' }

export default function CuentasPagar() {
  const toast = useStore(s => s.toast)
  const [form, setForm] = useState(empty)
  const [showModal, setShowModal] = useState(false)
  const [pago, setPago] = useState(null)

  const cuentas = useLiveQuery(() => db.ctas_pagar.orderBy('vencimiento').toArray(), [], [])
  const total = cuentas.filter(c => c.estado === 'PENDIENTE').reduce((s,c) => s + (c.monto||0), 0)

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.proveedor.trim() || !form.monto) { toast('Completa los campos requeridos', 'warn'); return }
    await db.ctas_pagar.add({ ...form, monto: parseFloat(form.monto)||0, fecha: new Date() })
    toast('Cuenta por pagar registrada')
    setForm(empty); setShowModal(false)
  }

  const pagar = async () => {
    if (!pago) return
    await db.ctas_pagar.update(pago.id, { estado: 'PAGADA', fecha_pago: new Date() })
    toast('✅ Pago registrado')
    setPago(null)
  }

  return (
    <div>
      <div className="panel">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="panel-title flex-1" style={{margin:0,paddingBottom:0,border:'none'}}>CUENTAS POR PAGAR</span>
          <span className="font-bebas text-lg text-white">PENDIENTE: {fmtUSD(total)}</span>
          <button className="btn btn-r btn-sm" onClick={() => setShowModal(true)}>+ NUEVA</button>
        </div>
        <div className="tabla-wrap tabla-scroll" style={{maxHeight:'65vh'}}>
          <table>
            <thead><tr>
              <th>PROVEEDOR</th><th>CONCEPTO</th><th>MONTO $</th>
              <th>VENCIMIENTO</th><th>ESTADO</th><th></th>
            </tr></thead>
            <tbody>
              {cuentas.map(c => {
                const venc = c.estado === 'PENDIENTE' && isVencido(c.vencimiento)
                return (
                  <tr key={c.id} className={venc ? 'bg-red-950/20' : ''}>
                    <td className="font-semibold">{c.proveedor}</td>
                    <td className="text-muted">{c.concepto}</td>
                    <td className="font-mono2">{fmtUSD(c.monto)}</td>
                    <td className={venc ? 'text-red-400 font-bold' : 'text-muted'}>{fmtDate(c.vencimiento)}</td>
                    <td>
                      <span className={`badge ${c.estado === 'PAGADA' ? 'badge-g' : venc ? 'badge-r' : 'badge-y'}`}>
                        {venc && c.estado === 'PENDIENTE' ? 'VENCIDA' : c.estado}
                      </span>
                    </td>
                    <td>
                      {c.estado === 'PENDIENTE' && (
                        <button className="btn btn-g btn-sm" onClick={() => setPago(c)}>💰 PAGAR</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {cuentas.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted py-6">SIN REGISTROS</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="NUEVA CUENTA POR PAGAR">
        <div className="grid grid-cols-2 gap-2">
          <div className="field col-span-2"><label>Proveedor *</label>
            <input className="inp" value={form.proveedor} onChange={e => f('proveedor', e.target.value)} /></div>
          <div className="field col-span-2"><label>Concepto</label>
            <input className="inp" value={form.concepto} onChange={e => f('concepto', e.target.value)} /></div>
          <div className="field"><label>Monto $ *</label>
            <input className="inp" type="number" value={form.monto} onChange={e => f('monto', e.target.value)} step="0.01" inputMode="decimal" /></div>
          <div className="field"><label>Vencimiento</label>
            <input className="inp" type="date" value={form.vencimiento} onChange={e => f('vencimiento', e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-3">
          <button className="btn btn-gr flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
          <button className="btn btn-g flex-1" onClick={save}>💾 GUARDAR</button>
        </div>
      </Modal>

      <Modal open={!!pago} onClose={() => setPago(null)} title="CONFIRMAR PAGO">
        {pago && (
          <>
            <p className="text-sm mb-1"><span className="text-muted">Proveedor:</span> <span className="text-white font-bold">{pago.proveedor}</span></p>
            <p className="text-sm mb-4"><span className="text-muted">Monto:</span> <span className="text-rojo-bright font-bold text-lg">{fmtUSD(pago.monto)}</span></p>
            <div className="flex gap-2">
              <button className="btn btn-gr flex-1" onClick={() => setPago(null)}>Cancelar</button>
              <button className="btn btn-g flex-1" onClick={pagar}>✅ CONFIRMAR PAGO</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
