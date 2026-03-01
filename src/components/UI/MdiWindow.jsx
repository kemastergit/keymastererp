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
                    className="flex flex-col w-full h-full bg-[var(--surface)] shadow-[var(--win-shadow)] overflow-hidden"
                    style={{
                        maxWidth: '100%',
                        // In tablet/desktop, we could constrain width or let it fill.
                        // Following rules: Tablet 95%, Desktop floats (here we let it fill its container but it could be constrained)
                    }}
                >
                    {/* Titlebar (24px) */}
                    <div className="flex items-center justify-between px-2 min-h-[24px] bg-[var(--teal)] text-white select-none">
                        <div className="flex items-center gap-2">
                            <span className="text-[12px]">{windowIcon}</span>
                            <span className="font-['IBM_Plex_Mono'] font-bold text-[11px] uppercase tracking-wider">
                                {windowTitle}
                            </span>
                        </div>

                        {/* Window Controls */}
                        <div className="flex items-center gap-1">
                            <button
                                className="w-[18px] h-[16px] flex items-center justify-center border border-white/40 hover:bg-white/20 transition-colors"
                                title="Minimizar"
                            >
                                <span className="block w-2.5 h-[1px] bg-white"></span>
                            </button>
                            <button
                                className="w-[18px] h-[16px] flex items-center justify-center border border-white/40 hover:bg-white/20 transition-colors"
                                title="Maximizar"
                            >
                                <div className="w-2.5 h-2.5 border border-white"></div>
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="w-[18px] h-[16px] flex items-center justify-center border border-white/40 hover:bg-red-500 hover:border-red-500 transition-colors"
                                title="Cerrar"
                            >
                                <div className="relative w-2.5 h-2.5">
                                    <span className="absolute top-1/2 left-0 w-full h-[1px] bg-white rotate-45 -translate-y-1/2"></span>
                                    <span className="absolute top-1/2 left-0 w-full h-[1px] bg-white -rotate-45 -translate-y-1/2"></span>
                                </div>
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
