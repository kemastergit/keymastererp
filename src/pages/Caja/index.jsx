import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { fmtUSD, fmtBS, fmtDate, today } from '../../utils/format'
import useStore from '../../store/useStore'
import { logAction } from '../../utils/audit'
import { supabase } from '../../lib/supabase'
import { useReactToPrint } from 'react-to-print'
import TicketCierre from '../../components/Ticket/TicketCierre'
import { useRef } from 'react'

export default function Caja() {
    const { activeSession, loadSession, toast, askAdmin, tasa } = useStore()
    const [showApertura, setShowApertura] = useState(false)
    const [showCorteZ, setShowCorteZ] = useState(false)
    const [aperturaForm, setAperturaForm] = useState({ usd: '', bs: '', usuario: '' })
    const [cierreForm, setCierreForm] = useState({ usdFisico: '', bsFisico: '' })
    const [isZPrinting, setIsZPrinting] = useState(false)

    const ticketRef = useRef()
    const { configEmpresa, loadConfigEmpresa, currentUser } = useStore()

    useEffect(() => {
        loadConfigEmpresa()
    }, [])

    const handlePrint = useReactToPrint({
        contentRef: ticketRef,
        documentTitle: `Cierre_${isZPrinting ? 'Z' : 'X'}_${new Date().getTime()}`,
    })

    const handleCorteX = () => {
        setIsZPrinting(false)
        setTimeout(() => handlePrint(), 500)
    }

    const notes = useLiveQuery(async () => {
        if (!activeSession) return []
        return await db.ventas.where('id').anyOf(activeSession.notas_del_dia || []).toArray()
    }, [activeSession], [])

    const abonos = useLiveQuery(async () => {
        if (!activeSession) return []
        return await db.abonos.filter(a =>
            (activeSession.notas_del_dia || []).includes(a.cuenta_id) ||
            (new Date(a.fecha) >= new Date(activeSession.fecha_apertura))
        ).toArray()
    }, [activeSession], [])

    const cajaMovs = useLiveQuery(async () => {
        if (!activeSession) return []
        return await db.caja_chica.filter(m => {
            const date = m.created_at ? new Date(m.created_at) : new Date(m.fecha + 'T00:00:00')
            return date >= new Date(activeSession.fecha_apertura)
        }).toArray()
    }, [activeSession], [])

    const handleAbrir = async () => {
        if (!aperturaForm.usuario) { toast('Ingrese nombre del cajero', 'warn'); return }
        const now = new Date()
        const id = await db.sesiones_caja.add({
            fecha_apertura: now,
            hora_apertura: now.toLocaleTimeString(),
            monto_inicial_usd: parseFloat(aperturaForm.usd) || 0,
            monto_inicial_bs: parseFloat(aperturaForm.bs) || 0,
            usuario: currentUser.nombre,
            usuario_id: currentUser.id,
            estado: 'ABIERTA',
            notas_del_dia: []
        })
        logAction(currentUser, 'APERTURA_CAJA', { id, inicial_usd: aperturaForm.usd })
        await loadSession()
        setShowApertura(false)
        toast('✅ Caja abierta correctamente')
    }

    const handleCerrarZ = () => {
        askAdmin(async () => {
            if (!cierreForm.usdFisico || !cierreForm.bsFisico) {
                toast('Ingrese los montos físicos contados', 'warn'); return
            }
            const now = new Date()
            const stats = getCorteStats()

            const diffUsd = (parseFloat(cierreForm.usdFisico) || 0) - stats.esperadoUsd
            const diffBs = (parseFloat(cierreForm.bsFisico) || 0) - stats.esperadoBs

            const cierreData = {
                estado: 'CERRADA',
                fecha_cierre: now,
                hora_cierre: now.toLocaleTimeString(),
                monto_fisico_usd: parseFloat(cierreForm.usdFisico),
                monto_fisico_bs: parseFloat(cierreForm.bsFisico),
                diferencia_usd: diffUsd,
                diferencia_bs: diffBs,
                cierre_z: stats
            }

            try {
                // 1. GUARDADO LOCAL EN DEXIE
                await db.sesiones_caja.update(activeSession.id, cierreData)

                logAction(currentUser, 'CIERRE_CAJA_Z', {
                    id: activeSession.id,
                    esperado: stats.esperadoUsd,
                    fisico: cierreForm.usdFisico,
                    diferencia: diffUsd
                })

                // 2. SINCRONIZACIÓN CON SUPABASE
                const { error: syncError } = await supabase
                    .from('cierres_caja')
                    .upsert({
                        id_sesion_local: activeSession.id,
                        usuario: currentUser.nombre,
                        fecha_apertura: activeSession.fecha_apertura,
                        fecha_cierre: now,
                        ventas_totales_usd: stats.efectivoUsd + stats.zelle + stats.otros + stats.credito,
                        efectivo_usd: stats.efectivoUsd,
                        efectivo_bs: stats.efectivoBs,
                        diferencia_usd: diffUsd,
                        diferencia_bs: diffBs,
                        notas_count: stats.totalNotas,
                        desglose: stats // Guardamos todo el objeto stats para análisis profundo
                    }, { onConflict: 'id_sesion_local' })

                if (syncError) throw syncError
                toast('🛰️ Cierre reportado a la Nube con éxito', 'success')
            } catch (err) {
                console.error('Error al cerrar/sincronizar:', err)
                toast('⚠️ Cierre local exitoso, error en nube: ' + err.message, 'error')
            }

            await loadSession()
            setIsZPrinting(true)
            setTimeout(() => handlePrint(), 500)
            setShowCorteZ(false)
            toast('🏁 Caja cerrada definitivamente (Corte Z)')
        })
    }

    const getCorteStats = () => {
        if (!activeSession) return null
        const res = {
            efectivoUsd: 0, efectivoBs: 0, pagoMovil: 0, punto: 0, zelle: 0, otros: 0,
            credito: 0, igtf: 0, egresosCC: 0, ingresosCC: 0,
            cobranzaUsd: 0,
            totalNotas: notes.length,
            inicialUsd: activeSession.monto_inicial_usd,
            inicialBs: activeSession.monto_inicial_bs
        }

        res.igtf = notes.filter(n => n.estado !== 'ANULADA').reduce((s, n) => s + (n.igtf || 0), 0)

        abonos.filter(a => a.estado !== 'ANULADA').forEach(a => {
            const m = a.monto
            if (a.metodo === 'EFECTIVO_USD') res.efectivoUsd += m
            else if (a.metodo === 'EFECTIVO_BS') res.efectivoBs += (m * tasa)
            else if (a.metodo === 'PAGO_MOVIL') res.pagoMovil += (m * tasa)
            else if (a.metodo === 'PUNTO_VENTA') res.punto += (m * tasa)
            else if (a.metodo === 'ZELLE') res.zelle += m
            else res.otros += m

            if (a.tipo_cuenta === 'COBRAR') {
                res.cobranzaUsd += m
            }
        })

        cajaMovs.forEach(m => {
            if (m.tipo === 'EGRESO') res.egresosCC += m.monto
            else res.ingresosCC += m.monto
        })

        res.credito = notes.filter(n => n.tipo_pago === 'CREDITO' && n.estado !== 'ANULADA').reduce((s, n) => s + n.total, 0)
        res.esperadoUsd = res.inicialUsd + res.efectivoUsd + res.zelle + res.otros + res.ingresosCC - res.egresosCC
        res.esperadoBs = res.inicialBs + res.efectivoBs + res.pagoMovil + res.punto

        return res
    }

    const stats = getCorteStats()

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[var(--text-main)] uppercase tracking-tighter">Gestión de Caja</h1>
                    <p className="text-[var(--text2)] font-bold text-xs uppercase tracking-widest mt-1">Control de apertura y cierre diario</p>
                </div>
                {!activeSession ? (
                    <button className="btn bg-[var(--teal)] text-white !py-3 !px-8 font-black text-sm transition-none shadow-[var(--win-shadow)] cursor-pointer" onClick={() => setShowApertura(true)}>
                        <span className="material-icons-round">lock_open</span>
                        <span>ABRIR CAJA NUEVA</span>
                    </button>
                ) : (
                    <div className="flex gap-2 w-full md:w-auto">
                        <button className="btn btn-gr flex-1 md:flex-none justify-center cursor-pointer transition-none shadow-[var(--win-shadow)]" onClick={handleCorteX}>
                            <span className="material-icons-round">print</span>
                            <span>CORTE X (PARCIAL)</span>
                        </button>
                        <button className="btn bg-[var(--red-var)] text-white flex-1 md:flex-none justify-center cursor-pointer transition-none shadow-[var(--win-shadow)]" onClick={() => setShowCorteZ(true)}>
                            <span className="material-icons-round">task_alt</span>
                            <span>CORTE Z (CIERRE)</span>
                        </button>
                    </div>
                )}
            </div>

            {!activeSession && (
                <div className="panel flex flex-col items-center justify-center py-20 text-center bg-[var(--surfaceDark)] border-dashed transition-none">
                    <div className="w-20 h-20 bg-[var(--surface2)] rounded-none flex items-center justify-center mb-6 border border-[var(--border-var)] shadow-[var(--win-shadow)]">
                        <span className="material-icons-round text-4xl text-[var(--text2)]">no_accounts</span>
                    </div>
                    <h2 className="text-xl font-bold text-[var(--text-main)] uppercase">No hay sesión activa</h2>
                    <p className="text-[var(--text2)] text-sm max-w-xs mx-auto mt-2">
                        Debe realizar la apertura de caja para registrar ventas e ingresos el día de hoy.
                    </p>
                    <button className="btn bg-[var(--teal)] text-white mt-8 scale-110 transition-none shadow-[var(--win-shadow)] cursor-pointer" onClick={() => setShowApertura(true)}>Apertura de Caja</button>
                </div>
            )}

            {activeSession && stats && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:block">
                    <div className="lg:col-span-4 space-y-4">
                        <div className="panel bg-[var(--teal)] text-white border-none shadow-[var(--win-shadow)] transition-none">
                            <div className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-4">Sesión en Curso</div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-white/20 rounded-none flex items-center justify-center border border-white/30">
                                    <span className="material-icons-round text-2xl">person</span>
                                </div>
                                <div>
                                    <div className="text-lg font-black uppercase leading-none">{activeSession.usuario}</div>
                                    <div className="text-[10px] font-bold opacity-80 uppercase tracking-tighter mt-1">Cajero Responsable</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                <div>
                                    <div className="text-[9px] font-bold opacity-60 uppercase">Inició</div>
                                    <div className="text-sm font-mono font-bold">{activeSession.hora_apertura}</div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-bold opacity-60 uppercase">Fecha</div>
                                    <div className="text-sm font-mono font-bold">{fmtDate(activeSession.fecha_apertura)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="panel transition-none">
                            <div className="panel-title mb-4">Monto Inicial</div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-[var(--text2)] uppercase">Efectivo USD</span>
                                    <span className="font-mono font-bold text-[var(--text-main)]">{fmtUSD(activeSession.monto_inicial_usd)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-[var(--text2)] uppercase">Efectivo BS</span>
                                    <span className="font-mono font-bold text-[var(--text-main)]">{activeSession.monto_inicial_bs.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-8 space-y-6">
                        <div className="panel transition-none">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="panel-title !m-0">Ventas por Método de Pago</h3>
                                <span className="badge badge-g shadow-[var(--win-shadow)]">{stats.totalNotas} Notas Procesadas</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <MethodStat label="Efectivo USD" val={stats.efectivoUsd} type="usd" />
                                <MethodStat label="Efectivo BS" val={stats.efectivoBs} type="bs" />
                                <MethodStat label="Pago Móvil" val={stats.pagoMovil} type="bs" />
                                <MethodStat label="Punto de Venta" val={stats.punto} type="bs" />
                                <MethodStat label="Zelle" val={stats.zelle} type="usd" />
                                <MethodStat label="Ventas a Crédito" val={stats.credito} type="usd" color="text-[var(--orange-var)]" />
                                <MethodStat label="Cobranzas de Cartera" val={stats.cobranzaUsd} type="usd" color="text-[var(--teal)]" />
                                <MethodStat label="Recaudación IGTF (3%)" val={stats.igtf} type="usd" color="text-[var(--green-var)]" />
                                <MethodStat label="Ingresos Extra (C.C.)" val={stats.ingresosCC} type="usd" color="text-[var(--green-var)]" />
                                <MethodStat label="Egresos / Gastos (C.C.)" val={stats.egresosCC} type="usd" color="text-[var(--red-var)]" />
                            </div>

                            <div className="mt-10 pt-6 border-t border-[var(--border-var)] grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-[var(--surface2)] p-4 rounded-none border border-[var(--border-var)] shadow-inner">
                                    <div className="text-[10px] font-black text-[var(--text2)] uppercase mb-1">Total Esperado en Caja ($)</div>
                                    <div className="text-2xl font-mono font-black text-[var(--teal)]">{fmtUSD(stats.esperadoUsd)}</div>
                                </div>
                                <div className="bg-[var(--surface2)] p-4 rounded-none border border-[var(--border-var)] shadow-inner">
                                    <div className="text-[10px] font-black text-[var(--text2)] uppercase mb-1">Total Esperado en Caja (Bs)</div>
                                    <div className="text-2xl font-mono font-black text-[var(--text-main)]">Bs {stats.esperadoBs.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="panel transition-none">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="panel-title !m-0">Cobranzas de Cartera (Abonos)</h3>
                                <div className="text-[10px] text-[var(--text2)] font-bold uppercase tracking-widest">
                                    {abonos.filter(a => a.tipo_cuenta === 'COBRAR').length} registros
                                </div>
                            </div>
                            <div className="overflow-x-auto min-h-[200px]">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-[9px] uppercase text-[var(--text2)] border-b border-[var(--border-var)] bg-[var(--surface2)]">
                                            <th className="py-2 px-3">Hora</th>
                                            <th className="py-2 px-3">Método</th>
                                            <th className="py-2 px-3 text-right">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-var)]">
                                        {abonos.filter(a => a.tipo_cuenta === 'COBRAR').map((a, idx) => (
                                            <tr key={idx} className="text-[11px] hover:bg-[var(--surfaceDark)] transition-none">
                                                <td className="py-2 px-3 text-[var(--text2)] font-mono">
                                                    {new Date(a.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="py-2 px-3">
                                                    <span className="badge badge-g !text-[8px] !px-1.5 shadow-[var(--win-shadow)]">{a.metodo}</span>
                                                </td>
                                                <td className="py-2 px-3 text-right font-bold text-[var(--text-main)] font-mono">{fmtUSD(a.monto)}</td>
                                            </tr>
                                        ))}
                                        {abonos.filter(a => a.tipo_cuenta === 'COBRAR').length === 0 && (
                                            <tr>
                                                <td colSpan="3" className="py-12 text-center text-[var(--text2)] text-[10px] font-bold uppercase opacity-50 tracking-widest">
                                                    No hay cobranzas registradas hoy
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showApertura && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-[var(--surface)] p-6 rounded-none max-w-sm w-full border border-[var(--border-var)] shadow-[var(--win-shadow)] animate-in zoom-in-95">
                        <div className="w-16 h-16 bg-[var(--surface2)] rounded-none border border-[var(--border-var)] flex items-center justify-center mx-auto mb-4 shadow-[var(--win-shadow)]">
                            <span className="material-icons-round text-[var(--teal)] text-3xl">meeting_room</span>
                        </div>
                        <h2 className="text-xl font-black text-[var(--text-main)] mb-2 uppercase text-center tracking-tighter">Apertura de Caja</h2>
                        <div className="space-y-4">
                            <div className="field">
                                <label>Nombre del Cajero</label>
                                <input type="text" className="inp !py-3 rounded-none focus:border-[var(--teal)] transition-none" placeholder="Ej: Juan Pérez"
                                    value={aperturaForm.usuario} onChange={e => setAperturaForm({ ...aperturaForm, usuario: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="field">
                                    <label>Monto Inicial ($)</label>
                                    <input type="number" className="inp !py-3 font-mono rounded-none focus:border-[var(--teal)] transition-none" placeholder="0.00"
                                        value={aperturaForm.usd} onChange={e => setAperturaForm({ ...aperturaForm, usd: e.target.value })} />
                                </div>
                                <div className="field">
                                    <label>Monto Inicial (Bs)</label>
                                    <input type="number" className="inp !py-3 font-mono rounded-none focus:border-[var(--teal)] transition-none" placeholder="0.00"
                                        value={aperturaForm.bs} onChange={e => setAperturaForm({ ...aperturaForm, bs: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button className="btn btn-gr flex-1 cursor-pointer transition-none shadow-[var(--win-shadow)]" onClick={() => setShowApertura(false)}>Cancelar</button>
                                <button className="btn bg-[var(--teal)] text-white flex-1 font-black cursor-pointer transition-none shadow-[var(--win-shadow)]" onClick={handleAbrir}>ABRIR CAJA</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showCorteZ && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-[var(--surface)] p-6 rounded-none max-w-sm w-full border border-[var(--border-var)] shadow-[var(--win-shadow)] animate-in zoom-in-95">
                        <h2 className="text-xl font-black text-[var(--text-main)] mb-2 uppercase tracking-tighter">Corte Z — Cierre Definitivo</h2>
                        <div className="space-y-4">
                            <div className="field">
                                <label>Monto Físico Contado ($)</label>
                                <input type="number" className="inp !py-3 font-mono text-lg font-bold rounded-none focus:border-[var(--teal)] transition-none"
                                    autoFocus
                                    placeholder="0.00"
                                    value={cierreForm.usdFisico} onChange={e => setCierreForm({ ...cierreForm, usdFisico: e.target.value })} />
                            </div>
                            <div className="field">
                                <label>Monto Físico Contado (Bs)</label>
                                <input type="number" className="inp !py-3 font-mono text-lg font-bold rounded-none focus:border-[var(--teal)] transition-none"
                                    placeholder="0.00"
                                    value={cierreForm.bsFisico} onChange={e => setCierreForm({ ...cierreForm, bsFisico: e.target.value })} />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button className="btn btn-gr flex-1 cursor-pointer transition-none shadow-[var(--win-shadow)]" onClick={() => setShowCorteZ(false)}>Cancelar</button>
                                <button className="btn bg-[var(--red-var)] text-white flex-1 font-black cursor-pointer transition-none shadow-[var(--win-shadow)]" onClick={handleCerrarZ}>CERRAR CAJA</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'none' }}>
                <TicketCierre
                    ref={ticketRef}
                    session={activeSession ? { ...activeSession, stats_x: stats } : null}
                    config={configEmpresa}
                    isZ={isZPrinting}
                />
            </div>
        </div>
    )
}

function MethodStat({ label, val, type, color = 'text-[var(--text-main)]' }) {
    return (
        <div className="flex justify-between items-end border-b border-[var(--surface2)] pb-2 transition-none">
            <span className="text-[10px] font-bold text-[var(--text2)] uppercase tracking-widest">{label}</span>
            <span className={`font-mono font-black ${color} text-base`}>
                {type === 'usd' ? fmtUSD(val) : `Bs ${val.toFixed(2)}`}
            </span>
        </div>
    )
}
