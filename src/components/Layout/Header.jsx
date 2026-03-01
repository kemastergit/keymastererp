import { useEffect, useState } from 'react'
import { logAction } from '../../utils/audit'
import useStore from '../../store/useStore'
import { usePermiso } from '../../hooks/usePermiso'
import { menu } from './menu'
import MobileSidebar from './MobileSidebar'

export default function Header({ hideTasa = false, hideUser = false, onOpenWebOrders }) {
  const { tasa, setTasa, loadTasa, askAdmin, activeSession, loadSession, currentUser, logout, pedidosWeb, fetchPedidosWeb } = useStore()
  const { check } = usePermiso()
  const [showDrawer, setShowDrawer] = useState(false)

  useEffect(() => {
    if (!hideTasa) loadTasa()
    loadSession()
    fetchPedidosWeb() // Cargar pedidos iniciales
    const int = setInterval(fetchPedidosWeb, 15000) // Refrescar cada 15s
    return () => clearInterval(int)
  }, [hideTasa])

  const handleLogout = () => {
    if (confirm('¿Cerrar sesión de KEYMASTER?')) {
      logAction(currentUser, 'LOGOUT')
      logout()
    }
  }

  const filteredMenu = menu.map(item => {
    if (item.sub) {
      const sub = item.sub.filter(s => !s.perm || check(s.perm))
      if (sub.length === 0) return null
      return { ...item, sub }
    }
    if (item.perm && !check(item.perm)) return null
    return item
  }).filter(Boolean)

  return (
    <header className="bg-[var(--teal)] text-white shadow-md transition-all duration-300 relative overflow-hidden">
      {/* Red Accent Top - removed for cleaner look or using tealDark */}
      <div className="h-[2px] bg-[var(--tealDark)] w-full" />

      <div className="px-4 py-3 flex items-center justify-between gap-4 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4 min-w-0">
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setShowDrawer(true)}
            className="md:hidden w-[26px] h-[26px] border border-white/20 flex items-center justify-center text-white"
          >
            <span className="material-icons-round text-sm">menu</span>
          </button>

          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0 bg-[var(--tealDark)] flex items-center justify-center border border-white/20 shadow-sm">
              <span className="font-['IBM_Plex_Mono'] font-bold text-lg text-white">KM</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-['IBM_Plex_Mono'] font-bold text-lg md:text-xl tracking-wide leading-tight flex items-center">
                <span className="text-white">KEY</span>
                <span className="text-[var(--teal3)]">MASTER</span>
              </h1>
              <p className="text-[9px] text-[var(--teal4)] font-bold uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-1 rounded-none bg-[var(--teal3)] animate-pulse"></span>
                <span className="hidden sm:inline">TECNOLOGÍA DE GESTIÓN</span>
                <span className="sm:hidden">GESTIÓN</span>
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 border border-white/10 bg-black/10">
            {activeSession ? (
              <>
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping absolute inset-0 opacity-75"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 relative"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Caja</span>
                  <span className="text-[9px] font-bold text-green-400 uppercase tracking-tighter leading-none">Abierta</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-600"></div>
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Cerrada</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Acceso directo a Pedidos en Línea - solo desktop */}
          <a
            href="/pedidos-web"
            className="relative hidden md:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 text-white hover:bg-white/10 transition-all rounded-lg"
          >
            <span className="material-icons-round text-lg">shopping_cart_checkout</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Pedidos</span>
            {pedidosWeb.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[var(--tealDark)] shadow-lg animate-pulse">
                {pedidosWeb.length}
              </span>
            )}
          </a>

          {/* Tasa BCV */}
          {!hideTasa && (
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-2 rounded-2xl group cursor-pointer hover:bg-white/10 transition-all"
              onClick={() => {
                const edit = () => {
                  const val = prompt('Nueva Tasa BCV:', tasa)
                  if (val) setTasa(val)
                }
                if (currentUser?.rol === 'ADMIN') edit()
                else askAdmin(edit)
              }}>
              <div className="text-right">
                <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Tasa BCV</div>
                <div className="font-mono text-lg font-black text-white leading-none">
                  {tasa ? parseFloat(tasa).toFixed(2) : '0.00'}
                </div>
              </div>
              <div className="w-8 h-8 bg-[var(--tealDark)] flex items-center justify-center text-white border border-white/20">
                <span className="material-icons-round text-sm">currency_exchange</span>
              </div>
            </div>
          )}

          {/* Usuario Info */}
          {!hideUser && (
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <div className="text-white font-black text-[11px] uppercase tracking-tighter leading-none">{currentUser?.nombre}</div>
                <div className={`text-[8px] font-black uppercase tracking-widest mt-1 px-2 py-0.5 bg-black/20 inline-block
                  ${currentUser?.rol === 'ADMIN' ? 'text-[var(--orange-var)]' : 'text-[var(--teal3)]'}`}>
                  {currentUser?.rol}
                </div>
              </div>

              <button onClick={handleLogout}
                className="w-10 h-10 bg-[var(--teal)] border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-[var(--tealDark)] hover:border-white/30 transition-all group">
                <span className="material-icons-round text-xl group-hover:rotate-12 transition-transform">power_settings_new</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Red Accent Bottom */}
      <div className="h-[1px] bg-black/20 w-full" />

      {/* MOBILE COMPONENT */}
      <MobileSidebar
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        menu={filteredMenu}
        check={check}
      />
    </header>
  )
}
