import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'

const main = [
  { to: '/', ico: '🏠', label: 'Inicio' },
  { to: '/facturacion', ico: '⚡', label: 'Ventas' },
  { to: '/inventario', ico: '📦', label: 'Stock' },
  { to: '/reportes', ico: '📊', label: 'Reportes' },
]

const extra = [
  { to: '/cobrar', ico: '💳', label: 'Ctas.Cobrar' },
  { to: '/cotizaciones', ico: '📋', label: 'Cotizaciones' },
  { to: '/clientes', ico: '👥', label: 'Clientes' },
  { to: '/proveedores', ico: '🏭', label: 'Proveedores' },
  { to: '/pagar', ico: '🏦', label: 'Ctas.Pagar' },
  { to: '/devoluciones', ico: '🔄', label: 'Devoluciones' },
  { to: '/caja', ico: '🏧', label: 'Caja' },
  { to: '/caja-chica', ico: '💰', label: 'Caja Chica' },
  { to: '/cierre', ico: '📅', label: 'Cierre' },
  { to: '/etiquetas', ico: '🏷️', label: 'Etiquetas' },
  { to: '/config', ico: '🏢', label: 'Empresa', admin: true },
  { to: '/admin', ico: '🔐', label: 'Seguridad', admin: true },
  { to: '/planes', ico: '💎', label: 'Planes' },
]

export default function NavBottom() {
  const [open, setOpen] = useState(false)
  const askAdmin = useStore(s => s.askAdmin)
  const navigate = useNavigate()

  const handleExtra = (item) => {
    setOpen(false)
    if (item.admin) {
      askAdmin(() => navigate('/admin'))
    } else {
      navigate(item.to)
    }
  }

  return (
    <>
      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/30 z-[185] md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Drawer */}
      <div className={`fixed bottom-[60px] left-0 right-0 bg-white border-t border-borde z-[190]
        md:hidden transition-transform duration-300 p-3 grid grid-cols-3 gap-2
        ${open ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' }}>
        {extra.map(item => (
          <button key={item.to} onClick={() => handleExtra(item)}
            className="bg-g3 border border-borde rounded-lg py-3 px-2 flex flex-col items-center gap-1
              font-raj text-[0.65rem] font-bold tracking-wide transition-all"
            style={{ color: '#323130' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#deecf9'; e.currentTarget.style.borderColor = '#0078d4' }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.borderColor = '' }}>
            <span className="text-2xl leading-none">{item.ico}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] bg-white border-t border-borde
        flex z-[200] md:hidden"
        style={{ boxShadow: '0 -2px 8px rgba(0,0,0,0.08)' }}>
        {main.map(l => (
          <NavLink key={l.to} to={l.to} end={l.to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5
              font-raj text-[0.5rem] font-bold tracking-wide uppercase
              border-t-2 transition-all
              ${isActive ? 'border-rojo' : 'border-transparent'}`
            }
            style={({ isActive }) => ({
              color: isActive ? '#0078d4' : '#605e5c',
              background: isActive ? '#deecf9' : 'transparent',
            })}>
            {({ isActive }) => (
              <>
                <span className="text-xl leading-none">{l.ico}</span>
                {l.label}
              </>
            )}
          </NavLink>
        ))}
        <button onClick={() => setOpen(!open)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5
            font-raj text-[0.5rem] font-bold tracking-wide uppercase
            border-t-2 transition-all"
          style={{
            color: open ? '#0078d4' : '#605e5c',
            borderColor: open ? '#0078d4' : 'transparent',
            background: open ? '#deecf9' : 'transparent',
          }}>
          <span className="text-xl leading-none">{open ? '✕' : '☰'}</span>
          {open ? 'CERRAR' : 'MÁS'}
        </button>
      </nav>
    </>
  )
}
