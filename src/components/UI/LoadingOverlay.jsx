import React from 'react';

export default function LoadingOverlay({ message, submessage, progress, total }) {
    if (!message) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="max-w-md w-full bg-[#0a0f1a] border border-white/10 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden text-center group">
                {/* Decorative Top Line */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>

                {/* Animated Icon Container */}
                <div className="mb-8 relative">
                    <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20 shadow-lg shadow-blue-500/5 relative z-10">
                        <span className="material-icons-round text-5xl text-blue-400 animate-spin">sync</span>
                    </div>
                    {/* Pulse Effect */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-blue-500/20 rounded-full animate-ping opacity-20"></div>
                </div>

                {/* Text Section */}
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-3">
                    {message}
                </h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] leading-relaxed max-w-xs mx-auto mb-8 opacity-80">
                    {submessage || 'Sincronizando datos con la nube de Keymaster API'}
                </p>

                {/* Progress Display */}
                {total > 0 && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-[10px] font-black text-blue-400 tracking-widest uppercase">Progreso</span>
                            <div className="text-right">
                                <span className="text-xl font-black text-white tabular-nums">
                                    {Math.round((progress / total) * 100)}%
                                </span>
                            </div>
                        </div>

                        {/* Progress Bar Container */}
                        <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                            <div
                                className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 ease-out relative"
                                style={{ width: `${(progress / total) * 100}%` }}
                            >
                                {/* Glossy overlay */}
                                <div className="absolute inset-0 bg-white/10 opacity-30"></div>
                            </div>
                        </div>

                        <div className="text-center">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em]">
                                {progress.toLocaleString()} de {total.toLocaleString()} registros
                            </span>
                        </div>
                    </div>
                )}

                {/* Floating background particles (CSS) */}
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
            </div>
        </div>
    );
}
