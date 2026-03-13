import { useState, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { usePermiso } from '../../hooks/usePermiso'
import { menu } from './menu'
import useStore from '../../store/useStore'

function NavDropdown({ item, isOpen, onToggle }) {
  const loc = useLocation()
  const unreadOrders = useStore(s => s.unreadOrders)
  const isActive = item.sub?.some(s => s.to === loc.pathname)

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => onToggle()}
        className={`w-full flex items-center justify-between px-4 py-3 text-[11px] font-bold uppercase tracking-widest transition-all rounded-xl
          ${isActive || isOpen 
            ? 'bg-[var(--teal)] text-white shadow-lg shadow-[var(--teal)]/20 shadow-inner' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
      >
        <div className="flex items-center gap-3">
          <span className="material-icons-round text-lg">{item.ico}</span>
          <span className="text-left leading-none font-['IBM_Plex_Mono']">{item.label}</span>
        </div>
        <span className={`material-icons-round text-base transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>

      {/* Submenu Accordion */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100 mt-2 mb-2' : 'max-h-0 opacity-0'}`}>
        <div className="flex flex-col gap-1 pl-4 border-l-2 border-slate-700/50 ml-6 relative">
          {item.sub.map((s, idx) => (
            <NavLink
              key={s.label + idx}
              to={s.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-[10px] font-bold tracking-widest uppercase transition-all rounded-lg relative overflow-hidden group
                ${isActive
                  ? 'bg-slate-800 text-white font-black'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <span className="material-icons-round text-base opacity-70 group-hover:opacity-100">{s.ico}</span>
              <span className="truncate leading-none font-['IBM_Plex_Mono']">{s.label}</span>
              {s.to === '/pedidos-web' && unreadOrders > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-lg">
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
        `w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold uppercase tracking-widest transition-all rounded-xl mb-1
        ${isActive 
          ? 'bg-[var(--teal)] text-white shadow-lg shadow-[var(--teal)]/20 shadow-inner' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`
      }>
      <span className="material-icons-round text-lg">{item.ico}</span>
      <span className="font-['IBM_Plex_Mono'] leading-none">{item.label}</span>
    </NavLink>
  )
}

export default function Sidebar({ isOpen = true }) {
  const { check } = usePermiso()
  const { configEmpresa } = useStore()
  const [openIndex, setOpenIndex] = useState(null)

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
      className={`hidden md:flex flex-col bg-[#0a0f18] h-full overflow-y-auto no-scrollbar py-5 shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.15)] z-[100] border-slate-800/80 transition-all duration-300 ease-in-out select-none
        ${isOpen ? 'w-[260px] px-3 border-r opacity-100 translate-x-0' : 'w-0 px-0 border-r-0 opacity-0 -translate-x-full overflow-hidden'}`}
    >
      <div className="w-[236px]"> {/* Contenedor de ancho fijo para evitar que se aprieten las letras al colapsar */}
        {/* Etiqueta decorativa arriba */}
        <div className="mb-6 px-4 whitespace-nowrap">
          <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] relative inline-block">
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

        {/* Marca de agua abajo */}
        <div className="mt-10 px-4 pb-4 whitespace-nowrap">
          <div className="h-[1px] bg-slate-800/50 w-full mb-4"></div>
          <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest text-center">
              Keymaster OS v2.0
          </p>
        </div>
      </div>
    </aside>
  )
}
