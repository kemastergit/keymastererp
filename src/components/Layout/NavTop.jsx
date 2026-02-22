import { useState, useRef, useEffect, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { usePermiso } from '../../hooks/usePermiso'

const menu = [
  { to: '/', ico: 'dashboard', label: 'Dashboard' },
  {
    label: 'Ventas',
    ico: 'receipt_long',
    sub: [
      { label: 'Facturación', to: '/facturacion', ico: 'bolt' },
      { label: 'Cotizaciones', to: '/cotizaciones', ico: 'assignment' },
      { label: 'Devoluciones', to: '/devoluciones', ico: 'history' },
      { label: 'Caja Chica', to: '/caja-chica', ico: 'payments' },
    ]
  },
  { label: '🏧 CIERRE TURNOS', to: '/caja', ico: 'point_of_sale' },
  {
    label: 'Créditos',
    ico: 'account_balance_wallet',
    sub: [
      { label: 'Cuentas por Cobrar', to: '/cobrar', ico: 'call_received' },
      { label: 'Cuentas por Pagar', to: '/pagar', ico: 'call_made' },
    ]
  },
  {
    label: 'Stock',
    ico: 'inventory_2',
    sub: [
      { label: 'Maestro de Inventario', to: '/inventario', ico: 'inventory_2' },
      { label: 'Etiquetas y Códigos', to: '/etiquetas', ico: 'qr_code_2' },
    ]
  },
  {
    label: 'Entidades',
    ico: 'groups',
    sub: [
      { label: 'Directorio Clientes', to: '/clientes', ico: 'person' },
      { label: 'Directorio Proveedores', to: '/proveedores', ico: 'factory' },
    ]
  },
  {
    label: 'Reportes',
    ico: 'insert_chart',
    sub: [
      { label: 'Consolidado Diario', to: '/reportes?tab=ventas', ico: 'summarize' },
      { label: 'Historial de Cierres Z', to: '/reportes?tab=cierres', ico: 'history' },
    ]
  },
  {
    label: 'Sistema',
    ico: 'settings',
    sub: [
      { label: 'Gestión de Usuarios', to: '/usuarios', ico: 'manage_accounts', perm: 'CREAR_USUARIOS' },
      { label: 'Configuración Empresa', to: '/config', ico: 'business', perm: 'CONFIGURACION' },
      { label: 'Seguridad Sistema', to: '/admin', ico: 'admin_panel_settings', perm: 'CONFIGURACION' },
      { label: 'Planes y Soporte', to: '/planes', ico: 'help_outline' },
    ]
  }
]

/* ─── Single nav item (no dropdown) ─── */
function NavItem({ item }) {
  return (
    <NavLink to={item.to} end={item.to === '/'}
      className={({ isActive }) =>
        `nav-item group ${isActive ? 'nav-item--active' : ''}`
      }>
      <span className="material-icons-round text-xl nav-item-icon group-hover:text-primary">{item.ico}</span>
      <span className="nav-item-label">{item.label}</span>
    </NavLink>
  )
}

/* ─── Dropdown nav item (click-only) ─── */
function NavDropdown({ item, isOpen, onToggle }) {
  const loc = useLocation()
  const isActive = item.sub?.some(s => s.to === loc.pathname)

  return (
    <div className="relative">
      {/* Trigger — click only */}
      <button
        type="button"
        onClick={() => onToggle()}
        className={`nav-item group ${isActive ? 'nav-item--active' : ''} ${isOpen ? 'nav-item--open' : ''}`}
      >
        <span className={`material-icons-round text-xl nav-item-icon ${isActive || isOpen ? 'text-primary' : 'group-hover:text-primary'}`}>
          {item.ico}
        </span>
        <span className="nav-item-label">
          {item.label}
          <span className={`ml-1 inline-block text-[8px] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
        </span>
      </button>

      {/* Dropdown panel */}
      <div
        className={`absolute top-full left-0 w-60 bg-white border border-slate-200 shadow-2xl rounded-b-2xl overflow-hidden z-[500] transition-all duration-200 origin-top
          ${isOpen
            ? 'opacity-100 scale-y-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-y-95 -translate-y-1 pointer-events-none'
          }`}
        style={{ borderTop: isOpen ? '3px solid var(--primary)' : 'none' }}
      >
        <div className="py-1">
          {item.sub.map((s, idx) => (
            <NavLink
              key={s.label + idx}
              to={s.to}
              onClick={() => onToggle(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-[11px] font-bold tracking-wide transition-colors border-l-4
                ${isActive
                  ? 'bg-amber-50 text-primary border-primary'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-primary border-transparent'
                }`
              }
            >
              <span className="material-icons-round text-lg">{s.ico}</span>
              {s.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Main NavTop ─── */
export default function NavTop() {
  const { check } = usePermiso()
  const [openIndex, setOpenIndex] = useState(null)
  const navRef = useRef(null)

  // Close dropdown when clicking outside
  const handleClickOutside = useCallback((e) => {
    if (navRef.current && !navRef.current.contains(e.target)) {
      setOpenIndex(null)
    }
  }, [])

  // Close dropdown on Escape key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') setOpenIndex(null)
  }, [])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleClickOutside, handleKeyDown])

  const filteredMenu = menu.map(item => {
    if (item.sub) {
      const sub = item.sub.filter(s => !s.perm || check(s.perm))
      if (sub.length === 0) return null
      return { ...item, sub }
    }
    if (item.perm && !check(item.perm)) return null
    return item
  }).filter(Boolean)

  const toggleDropdown = (index) => {
    setOpenIndex(prev => prev === index ? null : index)
  }

  return (
    <nav
      ref={navRef}
      className={`bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 transition-all duration-300
        ${openIndex !== null ? 'overflow-visible' : 'overflow-x-auto no-scrollbar scroll-smooth'}`}
    >
      <div className="flex max-w-[1600px] mx-auto w-full gap-1 flex-nowrap py-1">
        {filteredMenu.map((m, i) =>
          m.sub ? (
            <NavDropdown
              key={i}
              item={m}
              isOpen={openIndex === i}
              onToggle={(forceClose) => {
                if (forceClose === false) {
                  setOpenIndex(null)
                } else {
                  toggleDropdown(i)
                }
              }}
            />
          ) : (
            <NavItem key={i} item={m} />
          )
        )}
      </div>

      {/* Inline styles for nav items */}
      <style>{`
        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px 16px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
          border-bottom: 3px solid transparent;
          color: #0f172a;
          cursor: pointer;
          transition: all 0.15s ease;
          background: none;
          border-left: none;
          border-right: none;
          border-top: none;
          outline: none;
          text-decoration: none;
          position: relative;
        }
        .nav-item:hover {
          color: var(--primary);
          background-color: rgba(245, 158, 11, 0.04);
        }
        .nav-item--active {
          border-bottom-color: var(--primary) !important;
          color: var(--primary) !important;
          background-color: rgba(245, 158, 11, 0.06) !important;
        }
        .nav-item--open {
          color: var(--primary) !important;
          background-color: rgba(245, 158, 11, 0.06) !important;
          border-bottom-color: var(--primary) !important;
        }
        .nav-item-icon {
          color: #0f172a;
          transition: color 0.15s ease;
        }
        .nav-item--active .nav-item-icon,
        .nav-item--open .nav-item-icon {
          color: var(--primary) !important;
        }
        .nav-item-label {
          display: flex;
          align-items: center;
        }
      `}</style>
    </nav>
  )
}
