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

  const cuentas = useLiveQuery(
    () => filtro === 'TODOS'
      ? db.ctas_cobrar.orderBy('vencimiento').toArray()
      : db.ctas_cobrar.where('estado').equals(filtro).toArray(),
    [filtro], []
  )

  const total = cuentas.reduce((s, c) => s + (c.monto || 0), 0)
  const vencidas = cuentas.filter(c => c.estado === 'PENDIENTE' && isVencido(c.vencimiento))

  const procesarCobro = async () => {
    if (!cobro) return
    const monto = parseFloat(montoCobro) || cobro.monto
    await db.ctas_cobrar.update(cobro.id, { estado: 'COBRADA', monto_cobrado: monto, fecha_cobro: new Date() })
    toast(`✅ Cobro registrado: ${fmtUSD(monto)}`)
    setCobro(null); setMontoCobro('')
  }

  return (
    <div>
      {vencidas.length > 0 && (
        <div className="bg-red-900/20 border border-rojo-dark rounded-lg px-4 py-3 mb-3 text-rojo-bright text-sm">
          ⚠ {vencidas.length} cuenta(s) vencida(s) — Total: {fmtUSD(vencidas.reduce((s,c)=>s+c.monto,0))}
        </div>
      )}

      <div className="panel">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="panel-title flex-1" style={{margin:0,paddingBottom:0,border:'none'}}>
            CUENTAS POR COBRAR
          </span>
          <span className="font-bebas text-lg text-white">TOTAL: {fmtUSD(total)}</span>
        </div>

        <div className="flex gap-1.5 mb-3 flex-wrap">
          {['TODOS','PENDIENTE','COBRADA','VENCIDA'].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`btn btn-sm ${filtro === f ? 'btn-r' : 'btn-gr'}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="tabla-wrap tabla-scroll" style={{maxHeight:'65vh'}}>
          <table>
            <thead><tr>
              <th>NOTA #</th><th>CLIENTE</th><th>MONTO $</th>
              <th>VENCIMIENTO</th><th>ESTADO</th><th>ACCIÓN</th>
            </tr></thead>
            <tbody>
              {cuentas.map(c => {
                const venc = c.estado === 'PENDIENTE' && isVencido(c.vencimiento)
                return (
                  <tr key={c.id} className={venc ? 'bg-red-950/20' : ''}>
                    <td className="font-mono2 text-rojo-bright">
                      {c.venta_id ? `#${String(c.venta_id).padStart(6,'0')}` : '—'}
                    </td>
                    <td className="font-semibold">{c.cliente}</td>
                    <td className="font-mono2 text-white">{fmtUSD(c.monto)}</td>
                    <td className={venc ? 'text-red-400 font-bold' : 'text-muted'}>{fmtDate(c.vencimiento)}</td>
                    <td>
                      <span className={`badge ${
                        c.estado === 'COBRADA' ? 'badge-g' :
                        venc ? 'badge-r' : 'badge-y'
                      }`}>{venc && c.estado === 'PENDIENTE' ? 'VENCIDA' : c.estado}</span>
                    </td>
                    <td>
                      {c.estado === 'PENDIENTE' && (
                        <button className="btn btn-g btn-sm"
                          onClick={() => { setCobro(c); setMontoCobro(c.monto) }}>
                          💰 COBRAR
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {cuentas.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted py-6 tracking-widest">SIN REGISTROS</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!cobro} onClose={() => setCobro(null)} title="REGISTRAR COBRO">
        {cobro && (
          <>
            <p className="text-sm mb-1"><span className="text-muted">Cliente:</span> <span className="text-white font-bold">{cobro.cliente}</span></p>
            <p className="text-sm mb-3"><span className="text-muted">Monto original:</span> <span className="text-rojo-bright font-bold">{fmtUSD(cobro.monto)}</span></p>
            <div className="field">
              <label>Monto Cobrado $</label>
              <input className="inp" type="number" value={montoCobro}
                onChange={e => setMontoCobro(e.target.value)} step="0.01" inputMode="decimal" />
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-gr flex-1" onClick={() => setCobro(null)}>Cancelar</button>
              <button className="btn btn-g flex-1" onClick={procesarCobro}>✅ CONFIRMAR COBRO</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
