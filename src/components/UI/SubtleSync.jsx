import React from 'react';
import useStore from '../../store/useStore';

export default function SubtleSync() {
    const syncStatus = useStore(s => s.syncStatus);

    if (!syncStatus || syncStatus.isInitialSync) return null;

    const { progress, total, message } = syncStatus;
    const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;

    return (
        <div className="flex flex-col items-center justify-center min-w-[200px] animate-in fade-in zoom-in-95 duration-500">
            {/* Texto KEYMASTER con efecto de llenado */}
            <div className="relative font-bebas text-2xl tracking-[0.4em] leading-none select-none overflow-hidden">
                {/* Capa de fondo (Gris/Transparente) */}
                <span className="text-white/20">KEYMASTER</span>

                {/* Capa superior (Verde) que se revela con el progreso */}
                <div
                    className="absolute top-0 left-0 h-full overflow-hidden transition-all duration-700 ease-out"
                    style={{ width: `${percentage}%` }}
                >
                    <span className="text-green-500 whitespace-nowrap">KEYMASTER</span>
                </div>
            </div>

            {/* Barra de progreso sutil y texto de estado */}
            <div className="w-full mt-1 space-y-0.5">
                <div className="h-[2px] w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-green-500 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <div className="flex justify-between items-center px-1">
                    <span className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-400 animate-pulse">
                        {message === 'Guardando Datos' ? 'Procesando...' : 'Sincronizando...'}
                    </span>
                    <span className="text-[7px] font-mono font-bold text-green-500/80">
                        {percentage}%
                    </span>
                </div>
            </div>
        </div>
    );
}
