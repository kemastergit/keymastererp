import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { fmtDate } from '../../utils/format'
import { supabase } from '../../lib/supabase'

export default function Auditoria() {
    const [busq, setBusq] = useState('')
    const [selectedLog, setSelectedLog] = useState(null)

    const [loadingCloud, setLoadingCloud] = useState(false)

    const pullFromCloud = async () => {
        setLoadingCloud(true)
        try {
            const { data, error } = await supabase.from('auditoria').select('*').order('fecha', { ascending: false }).limit(200)
            if (error) throw error
            if (data) {
                for (const l of data) {
                    const existe = await db.auditoria.get(l.id)
                    if (!existe) await db.auditoria.add(l)
                }
            }
        } catch (e) { console.error(e) }
        setLoadingCloud(false)
    }

    const logs = useLiveQuery(
        async () => {
            let query = db.auditoria.orderBy('fecha').reverse()
            if (busq.trim()) {
                const b = busq.toLowerCase()
                return await query.filter(l =>
                    l.accion?.toLowerCase().includes(b) ||
                    l.usuario_nombre?.toLowerCase().includes(b) ||
                    l.table_name?.toLowerCase().includes(b) ||
                    l.metadata?.toLowerCase().includes(b)
                ).toArray()
            }
            return await query.limit(100).toArray()
        },
        [busq], []
    )

    const getIcon = (accion) => {
        if (accion.includes('LOGIN')) return 'login'
        if (accion.includes('CIERRE')) return 'lock'
        if (accion.includes('APERTURA')) return 'key'
        if (accion.includes('PRECIO')) return 'local_offer'
        if (accion.includes('PRICE')) return 'local_offer'
        if (accion.includes('DELETE')) return 'delete_forever'
        if (accion.includes('CREATE')) return 'add_circle'
        if (accion.includes('UPDATE')) return 'edit'
        if (accion.includes('ANULACION')) return 'block'
        if (accion.includes('CANCEL')) return 'block'
        if (accion.includes('AJUSTE')) return 'exposure'
        if (accion.includes('AUTORIZACION')) return 'admin_panel_settings'
        return 'info'
    }

    const getColor = (accion) => {
        if (accion.includes('DELETE') || accion.includes('CANCEL') || accion.includes('FAIL') || accion.includes('ANULACION')) return 'text-red-600 bg-red-50 border-red-100'
        if (accion.includes('PRICE') || accion.includes('PRECIO') || accion.includes('ROLE') || accion.includes('AJUSTE')) return 'text-orange-600 bg-orange-50 border-orange-100'
        if (accion.includes('CREATE')) return 'text-emerald-600 bg-emerald-50 border-emerald-100'
        if (accion.includes('UPDATE')) return 'text-blue-600 bg-blue-50 border-blue-100'
        if (accion.includes('LOGIN')) return 'text-indigo-600 bg-indigo-50 border-indigo-100'
        if (accion.includes('AUTORIZACION')) return 'text-cyan-600 bg-cyan-50 border-cyan-100 font-black'
        return 'text-slate-500 bg-slate-50 border-slate-100'
    }

    const renderJson = (val) => {
        if (!val) return 'N/A'
        try {
            const obj = typeof val === 'string' ? JSON.parse(val) : val
            return <pre className="text-[9px] font-mono leading-tight max-h-32 overflow-auto bg-slate-900 text-emerald-400 p-2 rounded-lg">{JSON.stringify(obj, null, 2)}</pre>
        } catch (e) { return String(val) }
    }

    return (
        <div className="space-y-6 flex flex-col min-h-0 pb-6 pr-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter leading-none mb-1">AUDITORÍA DE SISTEMA</h1>
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest opacity-80">TRAZABILIDAD INTEGRAL Y REGISTRO DE EVENTOS</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={pullFromCloud}
                        disabled={loadingCloud}
                        className="btn bg-blue-600 text-white !py-3 !px-6 transition-all shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                        <span className={`material-icons-round text-sm ${loadingCloud ? 'animate-spin' : ''}`}>sync</span>
                        <span>{loadingCloud ? 'ACTUALIZANDO...' : 'REFRESCAR NUBE'}</span>
                    </button>
                    <div className="bg-slate-800 text-white text-[9px] font-black px-4 py-3 rounded-xl shadow-lg border border-slate-700 tracking-[0.2em]">LIVE STATUS</div>
                </div>
            </div>

            <div className="panel p-0 flex flex-col min-h-0 flex-1 overflow-hidden shadow-xl border-none">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input className="inp !py-4 !pl-12 !pr-5 w-full font-bold shadow-inner !bg-white focus:scale-[1.01] transition-all"
                            placeholder="FILTRAR POR USUARIO, ACCIÓN, TABLA O DETALLE..."
                            value={busq} onChange={e => setBusq(e.target.value)} />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scroll overflow-x-auto">
                    <table className="w-full border-separate border-spacing-0">
                        <thead>
                            <tr className="bg-slate-800 text-white">
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Timestamp</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Origen (Tabla)</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Operador</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Acción</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Impacto / Cambios</th>
                                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">Detalle</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs?.map(l => {
                                const changes = (l.old_value || l.new_value)
                                return (
                                    <tr key={l.id} className="hover:bg-[var(--teal)]/5 transition-all group hover:scale-[1.005] cursor-default">
                                        <td className="p-4 whitespace-nowrap">
                                            <div className="text-[11px] font-black text-slate-700">{fmtDate(l.fecha)}</div>
                                            <div className="text-[10px] font-mono text-slate-400 font-bold">
                                                {new Date(l.fecha).toLocaleTimeString()}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{l.table_name || 'GENERAL'}</span>
                                                <span className="text-[9px] font-mono text-slate-400">ID: {l.record_id || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                                                    <span className="material-icons-round text-sm">person</span>
                                                </div>
                                                <div>
                                                    <div className="text-[11px] font-black text-slate-800 uppercase">{l.usuario_nombre}</div>
                                                    <div className="text-[9px] font-bold text-[#0d9488] uppercase tracking-widest">{l.rol}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded border ${getColor(l.accion)} shadow-sm`}>
                                                <span className="material-icons-round text-xs">{getIcon(l.accion)}</span>
                                                <span className="text-[9px] font-black uppercase tracking-tight">{l.accion.replace(/_/g, ' ')}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                {changes ? (
                                                    <div className="flex gap-1">
                                                        {l.old_value && <span className="inline-flex px-1.5 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 text-[8px] font-black rounded">OLD</span>}
                                                        <span className="material-icons-round text-xs text-slate-300">double_arrow</span>
                                                        {l.new_value && <span className="inline-flex px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[8px] font-black rounded">NEW</span>}
                                                    </div>
                                                ) : (
                                                    <span className="text-[9px] text-slate-400 italic font-black uppercase opacity-60">Info</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => setSelectedLog(l)}
                                                className="bg-white hover:bg-slate-800 hover:text-white text-slate-500 border border-slate-200 p-2 rounded transition-all shadow-sm cursor-pointer">
                                                <span className="material-icons-round text-sm">visibility</span>
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {logs?.length === 0 && (
                                <tr><td colSpan={6} className="text-center py-24 text-slate-300 font-black uppercase tracking-widest text-[10px] opacity-50 italic">No hay registros de trazabilidad disponibles</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Detalle de Auditoria */}
            {selectedLog && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Detalle de Operación</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID Log: {selectedLog.id}</p>
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="btn bg-white !p-2 rounded-xl text-slate-400 hover:text-slate-600">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scroll">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Estado Anterior</label>
                                    {renderJson(selectedLog.old_value)}
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Estado Nuevo</label>
                                    {renderJson(selectedLog.new_value)}
                                </div>
                            </div>
                            {selectedLog.metadata && selectedLog.metadata !== '{}' && (
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Metadatos Adicionales</label>
                                    {renderJson(selectedLog.metadata)}
                                </div>
                            )}
                            <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500 uppercase p-4 bg-white border border-slate-200 rounded-2xl">
                                <div><span className="opacity-40">IP:</span> {selectedLog.ip_address}</div>
                                <div><span className="opacity-40">Agente:</span> {selectedLog.user_agent?.substring(0, 50)}...</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

