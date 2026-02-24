import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { fmtDate } from '../../utils/format'

export default function Auditoria() {
    const [busq, setBusq] = useState('')

    const logs = useLiveQuery(
        async () => {
            let query = db.auditoria.orderBy('fecha').reverse()
            if (busq.trim()) {
                const b = busq.toLowerCase()
                return await query.filter(l =>
                    l.accion?.toLowerCase().includes(b) ||
                    l.usuario_nombre?.toLowerCase().includes(b) ||
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
        if (accion.includes('STOCK')) return 'inventory_2'
        if (accion.includes('ELIMINADO')) return 'delete_forever'
        if (accion.includes('ACTUALIZADO')) return 'edit'
        return 'info'
    }

    const getColor = (accion) => {
        if (accion.includes('ELIMINADO')) return 'text-red-500 bg-red-50'
        if (accion.includes('CIERRE')) return 'text-amber-500 bg-amber-50'
        if (accion.includes('AJUSTE')) return 'text-blue-500 bg-blue-50'
        if (accion.includes('LOGIN')) return 'text-green-500 bg-green-50'
        return 'text-slate-500 bg-slate-50'
    }

    return (
        <div className="space-y-6 h-full flex flex-col min-h-0 pb-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Auditoría del Sistema</h1>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Registro inmutable de acciones críticas (Núcleo 7)</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="badge badge-g">Conexión Local Segura</span>
                </div>
            </div>

            <div className="panel p-0 flex flex-col min-h-0 flex-1 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <input className="inp !py-2.5 !px-5" placeholder="🔍 Buscar por acción, usuario o detalle..."
                        value={busq} onChange={e => setBusq(e.target.value)} />
                </div>

                <div className="flex-1 overflow-y-auto custom-scroll">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-white z-10">
                            <tr>
                                <th>Fecha / Hora</th>
                                <th>Usuario</th>
                                <th>Acción</th>
                                <th>Detalles / Metadata</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs?.map(l => {
                                let meta = {}
                                try { meta = JSON.parse(l.metadata || '{}') } catch (e) { }

                                return (
                                    <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="whitespace-nowrap">
                                            <div className="text-[11px] font-bold text-slate-700">{fmtDate(l.fecha)}</div>
                                            <div className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter">
                                                {new Date(l.fecha).toLocaleTimeString()}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                    <span className="material-icons-round text-sm">person</span>
                                                </div>
                                                <div>
                                                    <div className="text-[11px] font-black text-slate-800 uppercase">{l.usuario_nombre}</div>
                                                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{l.rol}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-current/10 ${getColor(l.accion)}`}>
                                                <span className="material-icons-round text-sm">{getIcon(l.accion)}</span>
                                                <span className="text-[10px] font-black uppercase tracking-tight">{l.accion.replace(/_/g, ' ')}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="max-w-md">
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                    {Object.entries(meta).map(([k, v]) => (
                                                        <div key={k} className="flex items-center gap-2">
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase shrink-0">{k}:</span>
                                                            <span className="text-[10px] font-mono font-bold text-slate-600 truncate">{String(v)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {logs?.length === 0 && (
                                <tr><td colSpan={4} className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest text-xs opacity-50 italic">No hay registros de auditoría aún</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
