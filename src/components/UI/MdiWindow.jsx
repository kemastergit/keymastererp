import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';

export default function MdiWindow({ children, title, icon }) {
    const navigate = useNavigate();
    // Get route path segment or use provided title
    const location = useLocation();
    const pathName = location.pathname.substring(1).toUpperCase() || 'DASHBOARD';

    const windowTitle = title || pathName;
    const windowIcon = icon || '📟';

    const setHideNav = useStore(s => s.setHideNav)

    return (
        <div className="flex flex-col w-full h-full bg-[var(--bg)]">
            {/* Desktop/Tablet MDI Wrapper */}
            <div className="flex-1 w-full md:p-4 flex flex-col items-center justify-start overflow-hidden">

                {/* The Window Frame */}
                <div
                    className="flex flex-col w-full h-full bg-[var(--surface)] shadow-2xl overflow-hidden rounded-[1.5rem] border border-slate-200 transition-all"
                    style={{
                        maxWidth: '100%',
                    }}
                >
                    {/* Titlebar (32px) */}
                    <div className="flex items-center justify-between px-4 min-h-[42px] bg-slate-900 text-white select-none shrink-0 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <span className="text-[16px] filter grayscale opacity-80">{windowIcon}</span>
                            <span className="font-['Outfit'] font-black text-[12px] uppercase tracking-[0.2em] opacity-90">
                                {windowTitle}
                            </span>
                        </div>

                        {/* Window Controls */}
                        <div className="flex items-center gap-3">
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                                <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                            </div>
                            <button
                                onClick={() => navigate('/')}
                                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-600 transition-all active:scale-90 group"
                                title="Cerrar"
                            >
                                <span className="material-icons-round text-lg text-slate-500 group-hover:text-white">close</span>
                            </button>
                        </div>
                    </div>

                    {/* Window Body (flex-1 overflow-auto) */}
                    <div className="flex-1 overflow-hidden bg-[var(--surface)] relative custom-scroll flex flex-col min-h-0">
                        <div
                            className="flex-1 overflow-auto min-h-0 relative pb-24 md:pb-0 scroll-smooth"
                        >
                            {children}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
