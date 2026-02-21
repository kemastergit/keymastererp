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
  { to: '/caja', ico: '💰', label: 'Caja Chica' },
  { to: '/cierre', ico: '📅', label: 'Cierre' },
  { to: '/admin', ico: '🔐', label: 'Admin', admin: true },
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
        <div className="fixed inset-0 bg-black/60 z-[185] md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Drawer */}
      <div className={`fixed bottom-[60px] left-0 right-0 bg-g2 border-t border-rojo-dark z-[190]
        md:hidden transition-transform duration-300 p-3 grid grid-cols-3 gap-2 shadow-2xl
        ${open ? 'translate-y-0' : 'translate-y-full'}`}>
        {extra.map(item => (
          <button key={item.to} onClick={() => handleExtra(item)}
            className="bg-g3 border border-borde rounded-lg py-3 px-2 flex flex-col items-center gap-1
              font-raj text-[0.65rem] font-bold tracking-wide text-white/80
              hover:bg-red-950/20 hover:border-rojo-dark transition-all">
            <span className="text-2xl leading-none">{item.ico}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] bg-g1 border-t border-borde
        flex z-[200] shadow-[0_-4px_20px_rgba(0,0,0,0.5)] md:hidden">
        {main.map(l => (
          <NavLink key={l.to} to={l.to} end={l.to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5
              font-raj text-[0.5rem] font-bold tracking-wide uppercase
              border-t-2 transition-all
              ${isActive ? 'text-rojo-bright border-rojo bg-red-950/10' : 'text-muted border-transparent'}`
            }>
            {({ isActive }) => (
              <>
                <span className="text-xl leading-none">{l.ico}</span>
                {l.label}
              </>
            )}
          </NavLink>
        ))}
        <button onClick={() => setOpen(!open)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5
            font-raj text-[0.5rem] font-bold tracking-wide uppercase
            border-t-2 transition-all text-muted
            ${open ? 'border-rojo text-rojo-bright bg-red-950/10' : 'border-transparent'}`}>
          <span className="text-xl leading-none">{open ? '✕' : '☰'}</span>
          {open ? 'CERRAR' : 'MÁS'}
        </button>
      </nav>
    </>
  )
}
