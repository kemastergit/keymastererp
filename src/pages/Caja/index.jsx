import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { fmtUSD, fmtBS, fmtDate, today } from '../../utils/format'
import useStore from '../../store/useStore'
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
        // Get abonos related to notes in this session or created during session time
        return await db.abonos.filter(a =>
            (activeSession.notas_del_dia || []).includes(a.cuenta_id) ||
            (new Date(a.fecha) >= new Date(activeSession.fecha_apertura))
        ).toArray()
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

            await db.sesiones_caja.update(activeSession.id, {
                estado: 'CERRADA',
                fecha_cierre: now,
                hora_cierre: now.toLocaleTimeString(),
                monto_fisico_usd: parseFloat(cierreForm.usdFisico),
                monto_fisico_bs: parseFloat(cierreForm.bsFisico),
                diferencia_usd: diffUsd,
                diferencia_bs: diffBs,
                cierre_z: stats
            })

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
            efectivoUsd: 0,
            efectivoBs: 0,
            pagoMovil: 0,
            punto: 0,
            zelle: 0,
            otros: 0,
            credito: 0,
            totalNotas: notes.length,
            inicialUsd: activeSession.monto_inicial_usd,
            inicialBs: activeSession.monto_inicial_bs
        }

        // Sumar abonos registrados en la sesión
        abonos.forEach(a => {
            const m = a.monto
            if (a.metodo === 'EFECTIVO_USD') res.efectivoUsd += m
            else if (a.metodo === 'EFECTIVO_BS') res.efectivoBs += (m * tasa) // if saved in USD
            else if (a.metodo === 'PAGO_MOVIL') res.pagoMovil += (m * tasa)
            else if (a.metodo === 'PUNTO_VENTA') res.punto += (m * tasa)
            else if (a.metodo === 'ZELLE') res.zelle += m
            else res.otros += m
        })

        // Créditos pendientes de esta sesión
        res.credito = notes.filter(n => n.tipo_pago === 'CREDITO').reduce((s, n) => s + n.total, 0)

        res.esperadoUsd = res.inicialUsd + res.efectivoUsd + res.zelle + res.otros
        res.esperadoBs = res.inicialBs + res.efectivoBs + res.pagoMovil + res.punto

        return res
    }

    const stats = getCorteStats()

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header Caja */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Gestión de Caja</h1>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Control de apertura y cierre diario</p>
                </div>
                {!activeSession ? (
                    <button className="btn btn-primary !py-3 !px-8 font-black text-sm" onClick={() => setShowApertura(true)}>
                        <span className="material-icons-round">lock_open</span>
                        <span>ABRIR CAJA NUEVA</span>
                    </button>
                ) : (
                    <div className="flex gap-2 w-full md:w-auto">
                        <button className="btn btn-gr flex-1 md:flex-none justify-center" onClick={handleCorteX}>
                            <span className="material-icons-round">print</span>
                            <span>CORTE X (PARCIAL)</span>
                        </button>
                        <button className="btn btn-r flex-1 md:flex-none justify-center" onClick={() => setShowCorteZ(true)}>
                            <span className="material-icons-round">task_alt</span>
                            <span>CORTE Z (CIERRE)</span>
                        </button>
                    </div>
                )}
            </div>

            {!activeSession && (
                <div className="panel flex flex-col items-center justify-center py-20 text-center bg-slate-50/50 border-dashed">
                    <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-6">
                        <span className="material-icons-round text-4xl text-slate-400">no_accounts</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-700 uppercase">No hay sesión activa</h2>
                    <p className="text-slate-400 text-sm max-w-xs mx-auto mt-2">
                        Debe realizar la apertura de caja para registrar ventas e ingresos el día de hoy.
                    </p>
                    <button className="btn btn-primary mt-8 scale-110" onClick={() => setShowApertura(true)}>Apertura de Caja</button>
                </div>
            )}

            {activeSession && stats && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:block">
                    {/* Info Sesión */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="panel bg-primary text-white border-none shadow-amber-200/50 shadow-lg">
                            <div className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-4">Sesión en Curso</div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
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

                        <div className="panel">
                            <div className="panel-title mb-4">Monto Inicial</div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Efectivo USD</span>
                                    <span className="font-mono font-bold text-slate-800">{fmtUSD(activeSession.monto_inicial_usd)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Efectivo BS</span>
                                    <span className="font-mono font-bold text-slate-800">{activeSession.monto_inicial_bs.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Resumen Ventas */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="panel">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="panel-title !m-0">Ventas por Método de Pago</h3>
                                <span className="badge badge-g">{stats.totalNotas} Notas Procesadas</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <MethodStat label="Efectivo USD" val={stats.efectivoUsd} type="usd" />
                                <MethodStat label="Efectivo BS" val={stats.efectivoBs} type="bs" />
                                <MethodStat label="Pago Móvil" val={stats.pagoMovil} type="bs" />
                                <MethodStat label="Punto de Venta" val={stats.punto} type="bs" />
                                <MethodStat label="Zelle" val={stats.zelle} type="usd" />
                                <MethodStat label="Ventas a Crédito" val={stats.credito} type="usd" color="text-amber-500" />
                            </div>

                            <div className="mt-10 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-50 p-4 rounded-2xl">
                                    <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Esperado en Caja ($)</div>
                                    <div className="text-2xl font-mono font-black text-primary">{fmtUSD(stats.esperadoUsd)}</div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl">
                                    <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Esperado en Caja (Bs)</div>
                                    <div className="text-2xl font-mono font-black text-slate-800">Bs {stats.esperadoBs.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL APERTURA */}
            {showApertura && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-icons-round text-amber-600 text-3xl">meeting_room</span>
                        </div>
                        <h2 className="text-xl font-black text-slate-800 mb-2 uppercase text-center tracking-tighter">Apertura de Caja</h2>
                        <p className="text-slate-500 text-[11px] text-center mb-6 leading-relaxed">
                            Registre el monto inicial y el cajero responsable para habilitar el sistema.
                        </p>

                        <div className="space-y-4">
                            <div className="field">
                                <label>Nombre del Cajero</label>
                                <input type="text" className="inp !py-3" placeholder="Ej: Juan Pérez"
                                    value={aperturaForm.usuario} onChange={e => setAperturaForm({ ...aperturaForm, usuario: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="field">
                                    <label>Monto Inicial ($)</label>
                                    <input type="number" className="inp !py-3 font-mono" placeholder="0.00"
                                        value={aperturaForm.usd} onChange={e => setAperturaForm({ ...aperturaForm, usd: e.target.value })} />
                                </div>
                                <div className="field">
                                    <label>Monto Inicial (Bs)</label>
                                    <input type="number" className="inp !py-3 font-mono" placeholder="0.00"
                                        value={aperturaForm.bs} onChange={e => setAperturaForm({ ...aperturaForm, bs: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button className="btn btn-gr flex-1" onClick={() => setShowApertura(false)}>Cancelar</button>
                                <button className="btn btn-primary flex-1 font-black" onClick={handleAbrir}>ABRIR CAJA</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CORTE Z */}
            {showCorteZ && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95">
                        <h2 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tighter">Corte Z — Cierre Definitivo</h2>
                        <p className="text-slate-500 text-[11px] mb-6">
                            Ingrese el monto físico contado en caja para calcular diferencias y cerrar la sesión.
                        </p>

                        <div className="space-y-4">
                            <div className="field">
                                <label>Monto Físico Contado ($)</label>
                                <input type="number" className="inp !py-3 font-mono text-lg font-bold"
                                    value={cierreForm.usdFisico} onChange={e => setCierreForm({ ...cierreForm, usdFisico: e.target.value })} />
                            </div>
                            <div className="field">
                                <label>Monto Físico Contado (Bs)</label>
                                <input type="number" className="inp !py-3 font-mono text-lg font-bold"
                                    value={cierreForm.bsFisico} onChange={e => setCierreForm({ ...cierreForm, bsFisico: e.target.value })} />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button className="btn btn-gr flex-1" onClick={() => setShowCorteZ(false)}>Cancelar</button>
                                <button className="btn btn-r flex-1 font-black" onClick={handleCerrarZ}>CERRAR CAJA</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Ticket oculto para impresión */}
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

function MethodStat({ label, val, type, color = 'text-slate-800' }) {
    return (
        <div className="flex justify-between items-end border-b border-slate-50 pb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
            <span className={`font-mono font-black ${color} text-base`}>
                {type === 'usd' ? fmtUSD(val) : `Bs ${val.toFixed(2)}`}
            </span>
        </div>
    )
}
