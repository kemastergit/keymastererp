import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'

import { usePermiso } from '../../hooks/usePermiso'

const mainConfig = [
  { to: '/', ico: '🏠', label: 'Inicio', perm: 'MENU_DASHBOARD' },
  { to: '/facturacion', ico: '⚡', label: 'Ventas', perm: 'MENU_VENTAS' },
  { to: '/inventario', ico: '📦', label: 'Stock', perm: 'MENU_INVENTARIO' },
  { to: '/reportes', ico: '📊', label: 'Reportes', perm: 'MENU_REPORTES' },
]

const extraConfig = [
  { to: '/cobrar', ico: '💳', label: 'Por Cobrar', perm: 'MENU_COBRAR' },
  { to: '/cotizaciones', ico: '📋', label: 'Cotizaciones', perm: 'MENU_COTIZACIONES' },
  { to: '/clientes', ico: '👥', label: 'Clientes', perm: 'MENU_CLIENTES' },
  { to: '/proveedores', ico: '🏭', label: 'Proveedores', perm: 'MENU_PROVEEDORES' },
  { to: '/pagar', ico: '🏦', label: 'Por Pagar', perm: 'MENU_PAGAR' },
  { to: '/caja', ico: '🏧', label: 'Caja', perm: 'MENU_CAJA' },
  { to: '/etiquetas', ico: '🏷️', label: 'Etiquetas', perm: 'MENU_INVENTARIO' },
  { id: 'help', ico: '❓', label: 'Ayuda', perm: null },
  { to: '/config', ico: '⚙️', label: 'Config', perm: 'CONFIGURACION' },
]

export default function NavBottom() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { check } = usePermiso()
  const setShowHelp = useStore(s => s.setShowHelp)
  const hideNav = useStore(s => s.hideNav)
  const setHideNav = useStore(s => s.setHideNav)

  const main = mainConfig.filter(item => !item.perm || check(item.perm))
  const extra = extraConfig.filter(item => !item.perm || check(item.perm))

  const handleExtra = (item) => {
    setOpen(false)
    if (item.id === 'help') {
      setShowHelp(true)
    } else {
      navigate(item.to)
    }
  }

  return (
    <div className="md:hidden">
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[900]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Grid Menu (Regresado a los "Cuadros" originales) */}
      <div className={`fixed bottom-[85px] left-0 right-0 bg-white z-[901] transition-all duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] p-4 grid grid-cols-3 gap-3 rounded-t-3xl border-t border-slate-100
        ${open ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
        {extra.map(item => (
          <button
            key={item.label}
            onClick={() => handleExtra(item)}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-slate-50 border border-slate-100 active:bg-slate-200 transition-colors"
          >
            <span className="text-3xl leading-none">{item.ico}</span>
            <span className="text-[10px] font-black uppercase tracking-tighter text-slate-700">{item.label}</span>
          </button>
        ))}
      </div>

      <div className={`fixed bottom-0 left-0 right-0 z-[1000] flex flex-col transition-transform duration-500 ease-in-out ${hideNav && !open ? 'translate-y-full' : 'translate-y-0'}`}>
        {/* Franja Azul con Nombre del Negocio */}
        <div className="bg-slate-950 px-3 py-1.5 border-t border-white/5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse shrink-0" />
            <span className="text-[9px] font-black text-white/80 uppercase tracking-widest truncate">AUTOMOTORES GUAICAIPURO</span>
          </div>
          <div className="flex items-center shrink-0">
            <button
              onClick={() => setHideNav(true)}
              className="bg-white/10 hover:bg-white/20 text-white rounded px-2 py-0.5 flex items-center transition-colors md:hidden cursor-pointer"
              title="Ocultar menú inferior"
            >
              <span className="material-icons-round text-[16px] leading-none">keyboard_arrow_down</span>
            </button>
          </div>
        </div>

        {/* Barra de Navegación Principal (Iconos Emojis como originalmente) */}
        <nav className="h-[65px] bg-white border-t border-slate-100 flex items-center">
          {main.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}
              className={({ isActive }) =>
                `flex-1 h-full flex flex-col items-center justify-center gap-1 transition-all
                ${isActive ? 'bg-red-50 text-red-600' : 'text-slate-500'}`
              }>
              <span className="text-2xl leading-none">{l.ico}</span>
              <span className="text-[9px] font-black uppercase tracking-widest">{l.label}</span>
            </NavLink>
          ))}

          <button onClick={() => setOpen(!open)}
            className={`flex-1 h-full flex flex-col items-center justify-center gap-1 transition-all
              ${open ? 'bg-red-50 text-red-600' : 'text-slate-500 grayscale'}`}>
            <span className="text-2xl leading-none">{open ? '❌' : '☰'}</span>
            <span className="text-[9px] font-black uppercase tracking-widest">{open ? 'Cerrar' : 'Más'}</span>
          </button>
        </nav>
      </div>

      {/* Floating button to unhide */}
      {hideNav && !open && (
        <button
          onClick={() => setHideNav(false)}
          className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[1000] bg-white text-slate-800 w-16 h-8 rounded-t-2xl shadow-[0_-4px_15px_rgba(0,0,0,0.1)] flex items-center justify-center border-t border-x border-slate-200 md:hidden cursor-pointer"
        >
          <span className="material-icons-round text-2xl">keyboard_arrow_up</span>
        </button>
      )}
    </div>
  )
}
