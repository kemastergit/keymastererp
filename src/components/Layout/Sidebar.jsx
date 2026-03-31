import { useState, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { usePermiso } from '../../hooks/usePermiso'
import { menu } from './menu'
import useStore from '../../store/useStore'
import { logAction } from '../../utils/audit'

function NavDropdown({ item, isOpen, onToggle }) {
  const loc = useLocation()
  const unreadOrders = useStore(s => s.unreadOrders)
  const isActive = item.sub?.some(s => s.to === loc.pathname)

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => onToggle()}
        className={`w-full flex items-center justify-between px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all rounded-[4px]
          ${isActive || isOpen 
            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' 
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
      >
        <div className="flex items-center gap-3">
          <span className="material-icons-round text-lg">{item.ico}</span>
          <span className="text-left leading-none font-dm">{item.label}</span>
        </div>
        <span className={`material-icons-round text-base transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>

      {/* Submenu Accordion */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
        <div className="flex flex-col gap-1 pl-4 border-l-2 border-slate-100 ml-6 relative">
          {item.sub.map((s, idx) => (
            <NavLink
              key={s.label + idx}
              to={s.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-[10px] font-bold tracking-widest uppercase transition-all rounded-[4px] relative overflow-hidden group
                ${isActive
                  ? 'bg-orange-50 text-orange-600 font-black'
                  : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
                }`
              }
            >
              <span className="material-icons-round text-base opacity-70 group-hover:opacity-100">{s.ico}</span>
              <span className="truncate leading-none font-dm">{s.label}</span>
              {s.to === '/pedidos-web' && unreadOrders > 0 && (
                <span className="ml-auto bg-orange-600 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                  {unreadOrders}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}

function NavItem({ item }) {
  return (
    <NavLink 
      to={item.to} 
      end={item.to === '/'}
      className={({ isActive }) =>
        `w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all rounded-[4px] mb-1
        ${isActive 
          ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`
      }>
      <span className="material-icons-round text-lg">{item.ico}</span>
      <span className="font-dm leading-none">{item.label}</span>
    </NavLink>
  )
}

export default function Sidebar({ isOpen = true }) {
  const { check } = usePermiso()
  const { configEmpresa, currentUser, logout } = useStore()
  const [openIndex, setOpenIndex] = useState(null)

  const handleLogout = () => {
    if (confirm('¿Cerrar sesión de KEYMASTER?')) {
      logAction(currentUser, 'LOGOUT')
      logout()
    }
  }

  const filteredMenu = menu.map(item => {
    const hasParentPerm = !item.perm || check(item.perm)
    const hasParentFeature = !item.feature || configEmpresa?.[item.feature] === true
    if (!hasParentPerm || !hasParentFeature) return null

    if (item.sub) {
      const sub = item.sub.filter(s => {
        const hasPerm = !s.perm || check(s.perm)
        const hasFeature = !s.feature || configEmpresa?.[s.feature] === true
        return hasPerm && hasFeature
      })
      if (sub.length === 0) return null
      return { ...item, sub }
    }
    return item
  }).filter(Boolean)

  const toggleDropdown = (index) => {
    setOpenIndex(prev => prev === index ? null : index)
  }

  return (
    <aside 
      className={`hidden md:flex flex-col bg-white h-full overflow-y-auto no-scrollbar py-5 shrink-0 shadow-sm z-[100] border-slate-200 transition-all duration-300 ease-in-out select-none
        ${isOpen ? 'w-[260px] px-3 border-r opacity-100 translate-x-0' : 'w-0 px-0 border-r-0 opacity-0 -translate-x-full overflow-hidden'}`}
    >
      <div className="w-[236px] flex flex-col h-full">

        {/* Brand Header directly in Sidebar */}
        <div className="flex items-center gap-3 px-4 mb-8 pt-2">
          <div className="w-12 h-10 bg-[#0f172a] rounded-[8px] flex items-center justify-center shrink-0 shadow-md">
            <span className="text-white font-black text-xl leading-none font-bebas tracking-tighter">KM</span>
          </div>
          <h1 className="text-[22px] font-black text-slate-900 uppercase tracking-[0.1em] font-bebas leading-none">KEYMASTER</h1>
        </div>

        {/* Etiqueta decorativa arriba */}
        <div className="mb-6 px-4 whitespace-nowrap">
          <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] relative inline-block">
            Módulos Principales
          </h3>
        </div>

        <div className="flex-1 space-y-0.5">
          {filteredMenu.map((m, i) =>
            m.sub ? (
              <NavDropdown
                key={i}
                item={m}
                isOpen={openIndex === i}
                onToggle={() => toggleDropdown(i)}
              />
            ) : (
              <NavItem key={i} item={m} />
            )
          )}
        </div>

        {/* Spacer to push user profile to bottom */}
        <div className="flex-1"></div>

        {/* User Profile Card */}
        <div className="mt-8 px-2 pb-2">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between gap-2 shadow-sm">
             <div className="flex items-center gap-3 overflow-hidden">
               <div className="flex-none w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                 <span className="text-slate-600 font-bold text-[10px]">{(currentUser?.nombre || 'AD').substring(0,2).toUpperCase()}</span>
               </div>
               <div className="flex flex-col min-w-0">
                 <span className="text-slate-700 font-bold text-[10px] truncate uppercase tracking-wider">{currentUser?.rol || 'ADMINISTRADOR'}</span>
                 <span className="text-slate-400 font-medium text-[8px] truncate uppercase">{currentUser?.nombre || 'USUARIO'}</span>
               </div>
             </div>
             
             <button onClick={handleLogout} className="flex-none text-red-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors" title="Cerrar Sesión">
               <span className="material-icons-round text-[16px]">logout</span>
             </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
