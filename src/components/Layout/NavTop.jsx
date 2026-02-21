import { NavLink } from 'react-router-dom'
import useStore from '../../store/useStore'

const links = [
  { to: '/', label: '🏠 Dashboard' },
  { to: '/facturacion', label: '⚡ Facturación' },
  { to: '/cotizaciones', label: '📋 Cotizaciones' },
  { to: '/inventario', label: '📦 Inventario' },
  { to: '/clientes', label: '👥 Clientes' },
  { to: '/proveedores', label: '🏭 Proveedores' },
  { to: '/cobrar', label: '💳 Ctas.Cobrar' },
  { to: '/pagar', label: '🏦 Ctas.Pagar' },
  { to: '/devoluciones', label: '🔄 Devoluciones' },
  { to: '/caja', label: '💰 Caja Chica' },
  { to: '/cierre', label: '📅 Cierre Día' },
  { to: '/reportes', label: '📊 Reportes' },
  { to: '/planes', label: '💎 Planes' },
]

export default function NavTop() {
  const askAdmin = useStore(s => s.askAdmin)

  return (
    <nav className="hidden md:flex bg-g1 border-b border-borde sticky top-14 z-[190] overflow-x-auto scrollbar-none">
      {links.map(l => (
        <NavLink key={l.to} to={l.to} end={l.to === '/'}
          className={({ isActive }) =>
            `px-3.5 py-2 font-raj font-bold text-xs tracking-wide uppercase whitespace-nowrap
            border-b-2 transition-all hover:text-white hover:bg-white/5
            ${isActive ? 'text-rojo-bright border-rojo bg-red-950/10' : 'text-muted border-transparent'}`
          }>
          {l.label}
        </NavLink>
      ))}
      <button
        onClick={() => askAdmin(() => window.location.assign('/admin'))}
        className="px-3.5 py-2 font-raj font-bold text-xs tracking-wide uppercase whitespace-nowrap
          border-b-2 border-transparent text-muted hover:text-white hover:bg-white/5 transition-all ml-auto">
        🔐 Admin
      </button>
    </nav>
  )
}
