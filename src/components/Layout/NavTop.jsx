import { useState, useRef, useEffect, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { usePermiso } from '../../hooks/usePermiso'
import { menu } from './menu'
import useStore from '../../store/useStore'

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
        className={`absolute top-full w-60 bg-white border border-slate-200 shadow-2xl rounded-b-2xl overflow-hidden z-[500] transition-all duration-200 origin-top
          ${(item.label === 'Sistema' || item.label === 'Reportes') ? 'left-auto right-0' : 'left-0'}
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

  const { configEmpresa } = useStore()

  const filteredMenu = menu.map(item => {
    if (item.sub) {
      const sub = item.sub.filter(s => {
        const hasPerm = !s.perm || check(s.perm)
        const hasFeature = !s.feature || configEmpresa?.[s.feature] === true
        return hasPerm && hasFeature
      })
      if (sub.length === 0) return null
      return { ...item, sub }
    }
    const hasPerm = !item.perm || check(item.perm)
    const hasFeature = !item.feature || configEmpresa?.[item.feature] === true
    if (!hasPerm || !hasFeature) return null
    return item
  }).filter(Boolean)

  const toggleDropdown = (index) => {
    setOpenIndex(prev => prev === index ? null : index)
  }

  return (
    <nav
      ref={navRef}
      className="hidden md:block bg-white/95 backdrop-blur-md border-b border-slate-100 transition-all duration-300 z-50 overflow-visible"
    >
      <div className="flex max-w-[1600px] mx-auto w-full gap-x-1 gap-y-0.5 flex-wrap px-4 py-1 justify-center no-scrollbar overflow-visible">
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
          padding: 6px 10px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          white-space: nowrap;
          border-bottom: 3px solid transparent;
          color: var(--text-main);
          font-family: 'IBM Plex Mono', monospace;
          cursor: pointer;
          transition: none;
          background: none;
          border-left: none;
          border-right: none;
          border-top: none;
          outline: none;
          text-decoration: none;
          position: relative;
        }
        @media (min-width: 768px) {
          .nav-item {
            padding: 8px 16px;
            font-size: 10px;
            gap: 4px;
          }
        }
        .nav-item:hover {
          color: var(--teal);
          background-color: var(--teal4);
        }
        .nav-item--active {
          border-bottom-color: var(--teal) !important;
          color: var(--teal) !important;
          background-color: var(--teal4) !important;
        }
        .nav-item--open {
          color: var(--teal) !important;
          background-color: var(--teal4) !important;
          border-bottom-color: var(--teal) !important;
        }
        .nav-item-icon {
          color: var(--text2);
          transition: none;
        }
        .nav-item--active .nav-item-icon,
        .nav-item--open .nav-item-icon {
          color: var(--teal) !important;
        }
        .nav-item-label {
          display: flex;
          align-items: center;
        }
      `}</style>
    </nav>
  )
}
