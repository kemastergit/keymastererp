import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import useStore from '../../store/useStore'

export default function Radar() {
    const { currentUser } = useStore()
    const [terminals, setTerminals] = useState({})

    useEffect(() => {
        // Escuchar "latidos" (heartbeats) de todas las terminales
        const healthChannel = supabase.channel('terminal-health')
            .on('broadcast', { event: 'heartbeat' }, ({ payload }) => {
                setTerminals(prev => ({
                    ...prev,
                    [payload.user]: { ...payload, last_pulse: new Date() }
                }))
            })
            .subscribe()

        // Limpiador de terminales "muertas" (más de 35s sin pulso)
        const cleanup = setInterval(() => {
            const now = new Date()
            setTerminals(prev => {
                const next = { ...prev }
                Object.keys(next).forEach(key => {
                    if (now - next[key].last_pulse > 35000) {
                        next[key].online = false
                    }
                })
                return next
            })
        }, 10000)

        return () => {
            supabase.removeChannel(healthChannel)
            clearInterval(cleanup)
        }
    }, [])

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in zoom-in duration-500">
            {/* Command Header */}
            <div className="bg-slate-900 border border-slate-700/50 p-8 rounded-[2rem] flex flex-col md:flex-row items-center justify-between shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-teal-500/10 rounded-full blur-[100px] animate-pulse"></div>

                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(20,184,166,0.4)] animate-pulse">
                        <span className="material-icons-round text-white text-3xl">radar</span>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-2">Monitor Swarm Radar</h1>
                        <p className="text-[10px] font-black text-teal-400 uppercase tracking-[0.3em] opacity-80">Sincronización Transaccional en Tiempo Real</p>
                    </div>
                </div>

                <div className="hidden md:flex flex-col text-right relative z-10 mt-6 md:mt-0">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Estado de la Red Local</span>
                    <div className="bg-slate-800/50 border border-slate-700 px-4 py-2 rounded-xl inline-flex items-center gap-3">
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Enlace Estable</span>
                    </div>
                </div>
            </div>

            {/* Terminal Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {Object.values(terminals).length > 0 ? (
                    Object.values(terminals).sort((a, b) => b.online - a.online).map(term => (
                        <div key={term.user} className={`relative bg-white rounded-[1.5rem] border-2 transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 overflow-hidden ${term.online ? 'border-emerald-100 shadow-emerald-900/5' : 'border-red-100 shadow-red-900/5grayscale opacity-70'}`}>
                            {/* Card Header Status */}
                            <div className={`h-1.5 w-full ${term.online ? 'bg-emerald-500' : 'bg-red-500'}`}></div>

                            <div className="p-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${term.online ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                            <span className="material-icons-round text-2xl">{term.online ? 'terminal' : 'cloud_off'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Estación de Trabajo</span>
                                            <h3 className="text-xl font-black text-slate-800 tracking-tighter uppercase">{term.user}</h3>
                                        </div>
                                    </div>

                                    <div className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tight flex items-center gap-2 border ${term.online ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${term.online ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                                        {term.online ? 'Online' : 'Offline'}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Sync Status Badge */}
                                    <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${term.pending_sync > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                                        <div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Cola de Transacciones</span>
                                            <span className={`text-sm font-black ${term.pending_sync > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                                                {term.pending_sync === 0 ? '✓ SINCRONIZADO' : `${term.pending_sync} TRANS. PENDIENTES`}
                                            </span>
                                        </div>
                                        {term.pending_sync > 0 ? (
                                            <span className="material-icons-round text-amber-500 animate-bounce">upload_file</span>
                                        ) : (
                                            <span className="material-icons-round text-emerald-500">task_alt</span>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="material-icons-round text-xs opacity-50">history</span>
                                            Último Pulso
                                        </div>
                                        <span className="text-slate-600 font-mono tracking-tighter bg-slate-100 px-2 py-0.5 rounded">
                                            {new Date(term.last_pulse).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-32 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                        <div className="relative inline-block">
                            <span className="material-icons-round text-8xl text-slate-200 animate-ping absolute top-0 left-0 opacity-20">radar</span>
                            <span className="material-icons-round text-8xl text-slate-200 relative">radar</span>
                        </div>
                        <p className="mt-8 text-slate-400 font-black uppercase tracking-[0.3em] text-xs">Escaneando Frecuencias Swarm...</p>
                        <p className="text-[10px] text-slate-300 font-bold uppercase mt-2">Esperando señales de terminales activas</p>
                    </div>
                )}
            </div>

            {/* Documentation / Info */}
            <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 relative overflow-hidden group">
                <div className="absolute right-0 top-0 h-full w-1 bg-teal-500 group-hover:w-2 transition-all"></div>
                <div className="flex flex-col md:flex-row items-start gap-8">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-teal-600 shadow-xl shadow-slate-200 shrink-0 border border-slate-100">
                        <span className="material-icons-round">bolt</span>
                    </div>
                    <div className="space-y-3">
                        <h4 className="text-lg font-black text-slate-800 uppercase tracking-tighter leading-none">Arquitectura de Sincronización Swarm</h4>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-loose max-w-4xl opacity-70">
                            El sistema Radar utiliza un protocolo de "Heartbeats" (pulsos de vida) UDP-over-Broadcasting vía Supabase Realtime. Cada terminal KEYMASTER emite un pulso cada <strong className="text-slate-800">10 segundos</strong>. Si una terminal pierde conexión con la red o falla el proceso crítico de sincronización por más de <strong className="text-slate-800">35 segundos</strong>, el monitor la marcará como inactiva. El indicador de pendientes refleja transacciones almacenadas localmente en IndexDB que están en cola para ser persistidas en el cluster central.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
