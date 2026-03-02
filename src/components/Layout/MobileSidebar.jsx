import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import useStore from '../../store/useStore'

export default function MobileSidebar({ open, onClose, menu, check }) {
    const [openCategory, setOpenCategory] = useState(null)
    const { unreadOrders } = useStore()

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[1000] md:hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="absolute top-0 left-0 bottom-0 w-[280px] bg-white shadow-2xl animate-in slide-in-from-left duration-300 flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                            <span className="font-bebas text-white text-lg">KM</span>
                        </div>
                        <span className="font-bebas text-xl tracking-wider text-slate-800">MENU PRINCIPAL</span>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                        <span className="material-icons-round text-sm">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto py-4 custom-scroll">
                    {menu.map((item, idx) => {
                        const hasSub = item.sub && item.sub.length > 0
                        const isCatOpen = openCategory === idx

                        return (
                            <div key={idx} className="px-3 mb-1">
                                {hasSub ? (
                                    <>
                                        <button
                                            onClick={() => setOpenCategory(isCatOpen ? null : idx)}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${isCatOpen ? 'bg-red-50 text-red-600' : 'hover:bg-slate-50 text-slate-600'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="material-icons-round text-xl opacity-70">{item.ico}</span>
                                                <span className="text-[11px] font-black uppercase tracking-wider">{item.label}</span>
                                            </div>
                                            <span className={`material-icons-round text-sm transition-transform ${isCatOpen ? 'rotate-180' : ''}`}>expand_more</span>
                                        </button>

                                        {isCatOpen && (
                                            <div className="mt-1 ml-4 border-l-2 border-red-100 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                                {item.sub.map((s, sIdx) => (
                                                    <NavLink
                                                        key={sIdx}
                                                        to={s.to}
                                                        onClick={onClose}
                                                        className={({ isActive }) =>
                                                            `flex items-center gap-3 p-2.5 pl-5 rounded-r-xl text-[10px] font-bold uppercase tracking-widest transition-all
                                                            ${isActive ? 'bg-red-600 text-white shadow-md' : 'text-slate-500 hover:text-red-600'}`
                                                        }
                                                    >
                                                        <span className="material-icons-round text-lg">{s.ico}</span>
                                                        {s.label}
                                                        {s.to === '/pedidos-web' && unreadOrders > 0 && (
                                                            <span className="ml-auto bg-red-600 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                                                                {unreadOrders}
                                                            </span>
                                                        )}
                                                    </NavLink>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <NavLink
                                        to={item.to}
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 p-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all
                                            ${isActive ? 'bg-red-600 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-600'}`
                                        }
                                    >
                                        <span className="material-icons-round text-xl">{item.ico}</span>
                                        {item.label}
                                    </NavLink>
                                )}
                            </div>
                        )
                    })}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">KEYMASTER POS v2.5.0</p>
                </div>
            </div>
        </div>
    )
}
