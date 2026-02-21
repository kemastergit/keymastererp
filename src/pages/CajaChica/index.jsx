import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtDate, today } from '../../utils/format'

export default function CajaChica() {
  const toast = useStore(s => s.toast)
  const [form, setForm] = useState({ concepto:'', tipo:'EGRESO', monto:'', fecha: today() })
  const [filtroFecha, setFiltroFecha] = useState(today())

  const movimientos = useLiveQuery(
    () => db.caja_chica.where('fecha').equals(filtroFecha).toArray(),
    [filtroFecha], []
  )

  const ingresos = movimientos.filter(m => m.tipo === 'INGRESO').reduce((s,m) => s + m.monto, 0)
  const egresos = movimientos.filter(m => m.tipo === 'EGRESO').reduce((s,m) => s + m.monto, 0)
  const saldo = ingresos - egresos

  const save = async () => {
    if (!form.concepto.trim() || !form.monto) { toast('Completa todos los campos', 'warn'); return }
    await db.caja_chica.add({ ...form, monto: parseFloat(form.monto)||0 })
    toast(`${form.tipo === 'INGRESO' ? '📥' : '📤'} Movimiento registrado`)
    setForm(p => ({ ...p, concepto:'', monto:'' }))
  }

  const del = async (id) => {
    await db.caja_chica.delete(id)
    toast('Movimiento eliminado', 'warn')
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-3">

      {/* Formulario */}
      <div>
        <div className="panel">
          <div className="panel-title">REGISTRAR MOVIMIENTO</div>
          <div className="field">
            <label>Fecha</label>
            <input type="date" className="inp" value={form.fecha} onChange={e => f('fecha', e.target.value)} />
          </div>
          <div className="field">
            <label>Tipo</label>
            <div className="flex gap-2">
              {['INGRESO','EGRESO'].map(t => (
                <button key={t} onClick={() => f('tipo', t)}
                  className={`btn flex-1 ${form.tipo === t ? (t === 'INGRESO' ? 'btn-g' : 'btn-r') : 'btn-gr'}`}>
                  {t === 'INGRESO' ? '📥' : '📤'} {t}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Concepto *</label>
            <input className="inp" value={form.concepto} onChange={e => f('concepto', e.target.value)}
              placeholder="Descripción del movimiento..." />
          </div>
          <div className="field">
            <label>Monto $ *</label>
            <input className="inp" type="number" value={form.monto} onChange={e => f('monto', e.target.value)}
              step="0.01" inputMode="decimal" placeholder="0.00" />
          </div>
          <button className="btn btn-g btn-full mt-2" onClick={save}>💾 REGISTRAR</button>
        </div>

        {/* Resumen */}
        <div className="panel">
          <div className="panel-title">RESUMEN DEL DÍA</div>
          <div className="flex justify-between py-2 border-b border-borde text-sm">
            <span className="text-muted">INGRESOS:</span>
            <span className="text-green-400 font-mono2 font-bold">{fmtUSD(ingresos)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-borde text-sm">
            <span className="text-muted">EGRESOS:</span>
            <span className="text-red-400 font-mono2 font-bold">{fmtUSD(egresos)}</span>
          </div>
          <div className="flex justify-between py-2 font-bebas text-xl">
            <span className="text-muted">SALDO:</span>
            <span className={saldo >= 0 ? 'text-green-400' : 'text-red-400'}>{fmtUSD(saldo)}</span>
          </div>
        </div>
      </div>

      {/* Tabla movimientos */}
      <div>
        <div className="panel">
          <div className="flex items-center gap-2 mb-3">
            <span className="panel-title flex-1" style={{margin:0,paddingBottom:0,border:'none'}}>MOVIMIENTOS</span>
            <div className="field" style={{margin:0}}>
              <input type="date" className="inp" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} />
            </div>
          </div>
          <div className="tabla-wrap tabla-scroll" style={{maxHeight:'65vh'}}>
            <table>
              <thead><tr><th>TIPO</th><th>CONCEPTO</th><th>MONTO $</th><th></th></tr></thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.id}>
                    <td>
                      <span className={`badge ${m.tipo === 'INGRESO' ? 'badge-g' : 'badge-r'}`}>
                        {m.tipo === 'INGRESO' ? '📥' : '📤'} {m.tipo}
                      </span>
                    </td>
                    <td className="font-semibold">{m.concepto}</td>
                    <td className={`font-mono2 ${m.tipo === 'INGRESO' ? 'text-green-400' : 'text-red-400'}`}>
                      {m.tipo === 'EGRESO' ? '-' : '+'}{fmtUSD(m.monto)}
                    </td>
                    <td>
                      <button className="btn btn-r btn-sm" onClick={() => del(m.id)}>🗑</button>
                    </td>
                  </tr>
                ))}
                {movimientos.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-muted py-6">SIN MOVIMIENTOS</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
