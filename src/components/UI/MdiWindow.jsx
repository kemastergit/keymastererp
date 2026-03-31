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
    
    // Estado para saber si la ventana está maximizada o no
    const [isMaximized, setIsMaximized] = React.useState(false);

    return (
        <div className="flex flex-col w-full h-full bg-[var(--bg)]">
            {/* Desktop/Tablet MDI Wrapper */}
            <div className={`flex-1 w-full flex flex-col items-center justify-start overflow-hidden transition-all duration-300 ${isMaximized ? 'p-0' : 'md:p-4'}`}>

                {/* The Window Frame */}
                <div
                    className={`flex flex-col w-full h-full bg-[var(--surface)] shadow-2xl overflow-hidden border-slate-200 transition-all duration-300 ${isMaximized ? 'rounded-none border-0' : 'rounded-[1.5rem] border'}`}
                    style={{
                        maxWidth: '100%',
                    }}
                >
                                    {/* Titlebar */}
                    <div 
                        className="flex items-center justify-between px-4 min-h-[42px] bg-slate-900 text-white select-none shrink-0 border-b border-slate-800 cursor-default shadow-sm"
                        onDoubleClick={() => setIsMaximized(!isMaximized)}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-[16px] filter grayscale opacity-80" style={{ cursor: 'pointer' }} onClick={() => setIsMaximized(!isMaximized)}>{windowIcon}</span>
                            <span className="font-['Outfit'] font-black text-[12px] uppercase tracking-[0.2em] opacity-90" style={{ cursor: 'pointer' }} onClick={() => setIsMaximized(!isMaximized)}>
                                {windowTitle}
                            </span>
                        </div>

                        {/* Window Controls */}
                        <div className="flex items-center gap-3">
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setIsMaximized(false)}
                                    className="w-3 h-3 rounded-full bg-slate-700 hover:bg-yellow-500 transition-colors focus:outline-none"
                                    title="Restaurar Tamaño"
                                />
                                <button 
                                    onClick={() => setIsMaximized(true)}
                                    className="w-3 h-3 rounded-full bg-slate-700 hover:bg-green-500 transition-colors focus:outline-none"
                                    title="Maximizar Ventana"
                                />
                            </div>
                            <button
                                onClick={() => navigate('/')}
                                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-600 transition-all active:scale-90 group focus:outline-none"
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
