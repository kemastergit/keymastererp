import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtDate, today } from '../../utils/format'

const CATEGORIAS_GASTO = [
  { value: 'ALQUILER', label: '🏠 Alquiler', color: 'badge-y' },
  { value: 'NOMINA', label: '👥 Nómina', color: 'badge-r' },
  { value: 'SERVICIOS', label: '💡 Servicios (Agua/Luz/Internet)', color: 'badge-g' },
  { value: 'TRANSPORTE', label: '🚚 Transporte', color: 'badge-y' },
  { value: 'MANTENIMIENTO', label: '🔧 Mantenimiento', color: 'badge-y' },
  { value: 'CAJA_CHICA_GENERAL', label: '💰 Caja Chica General', color: 'badge-gr' },
  { value: 'OTRO', label: '📝 Otro (especificar)', color: 'badge-gr' },
]

export default function CajaChica() {
  const toast = useStore(s => s.toast)
  const [form, setForm] = useState({ concepto: '', tipo: 'EGRESO', categoria: 'CAJA_CHICA_GENERAL', categoria_otro: '', monto: '', fecha: today() })
  const [filtroFecha, setFiltroFecha] = useState(today())

  const movimientos = useLiveQuery(
    () => db.caja_chica.where('fecha').equals(filtroFecha).toArray(),
    [filtroFecha], []
  )

  const ingresos = movimientos.filter(m => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
  const egresos = movimientos.filter(m => m.tipo === 'EGRESO').reduce((s, m) => s + m.monto, 0)
  const saldo = ingresos - egresos

  const save = async () => {
    if (!form.concepto.trim() || !form.monto) { toast('Completa todos los campos', 'warn'); return }
    if (form.tipo === 'EGRESO' && form.categoria === 'OTRO' && !form.categoria_otro.trim()) {
      toast('Especifica la categoría personalizada', 'warn'); return
    }
    const registro = {
      ...form,
      monto: parseFloat(form.monto) || 0,
      categoria: form.tipo === 'EGRESO' ? (form.categoria === 'OTRO' ? form.categoria_otro.toUpperCase() : form.categoria) : null,
      created_at: new Date()
    }
    delete registro.categoria_otro
    await db.caja_chica.add(registro)
    toast(`${form.tipo === 'INGRESO' ? '📥' : '📤'} Movimiento registrado`)
    setForm(p => ({ ...p, concepto: '', monto: '', categoria_otro: '' }))
  }

  const del = async (id) => {
    await db.caja_chica.delete(id)
    toast('Movimiento eliminado', 'warn')
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="pr-2 pb-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-3">

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
              {['INGRESO', 'EGRESO'].map(t => (
                <button key={t} onClick={() => f('tipo', t)}
                  className={`btn flex-1 ${form.tipo === t ? (t === 'INGRESO' ? 'btn-g' : 'btn-r') : 'btn-gr'}`}>
                  {t === 'INGRESO' ? '📥' : '📤'} {t}
                </button>
              ))}
            </div>
          </div>
          {form.tipo === 'EGRESO' && (
            <div className="field">
              <label>Categoría de Gasto *</label>
              <select className="inp" value={form.categoria} onChange={e => f('categoria', e.target.value)}>
                {CATEGORIAS_GASTO.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {form.categoria === 'OTRO' && (
                <input className="inp mt-2" value={form.categoria_otro}
                  onChange={e => f('categoria_otro', e.target.value)}
                  placeholder="Especifique la categoría..." />
              )}
            </div>
          )}
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
            <span className="panel-title flex-1" style={{ margin: 0, paddingBottom: 0, border: 'none' }}>MOVIMIENTOS</span>
            <div className="field" style={{ margin: 0 }}>
              <input type="date" className="inp" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} />
            </div>
          </div>
          <div className="tabla-wrap tabla-scroll overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">TIPO</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">CATEGORÍA</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">CONCEPTO</th>
                  <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-r border-slate-700">MONTO $</th>
                  <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movimientos.map(m => {
                  const catInfo = CATEGORIAS_GASTO.find(c => c.value === m.categoria)
                  return (
                    <tr key={m.id}>
                      <td>
                        <span className={`badge ${m.tipo === 'INGRESO' ? 'badge-g' : 'badge-r'}`}>
                          {m.tipo === 'INGRESO' ? '📥' : '📤'} {m.tipo}
                        </span>
                      </td>
                      <td>
                        {m.categoria ? (
                          <span className={`badge ${catInfo?.color || 'badge-gr'}`} style={{ fontSize: '9px' }}>
                            {catInfo?.label || m.categoria}
                          </span>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="font-semibold">{m.concepto}</td>
                      <td className={`font-mono2 ${m.tipo === 'INGRESO' ? 'text-green-400' : 'text-red-400'}`}>
                        {m.tipo === 'EGRESO' ? '-' : '+'}{fmtUSD(m.monto)}
                      </td>
                      <td>
                        <button className="btn btn-r btn-sm" onClick={() => del(m.id)}>🗑</button>
                      </td>
                    </tr>)
                })}
                {movimientos.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted py-6">SIN MOVIMIENTOS</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
