import { useEffect, useState } from 'react'
import { logAction } from '../../utils/audit'
import useStore from '../../store/useStore'
import { usePermiso } from '../../hooks/usePermiso'
import { menu } from './menu'
import MobileSidebar from './MobileSidebar'
import { usePWA } from '../../hooks/usePWA'
import SyncModal from '../UI/SyncModal'

export default function Header({ hideTasa = false, hideUser = false, onOpenWebOrders }) {
  const { tasa, setTasa, loadTasa, askAdmin, activeSession, loadSession, currentUser, logout, pedidosWeb, fetchPedidosWeb, pendingSyncCount, syncErrorCount } = useStore()
  const { check } = usePermiso()
  const { canInstall, install, isInstalled } = usePWA()
  const [showDrawer, setShowDrawer] = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)

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
    if (item.perm && !check(item.perm)) return null // <-- SE AÑADIÓ ESTO PRIMERO

    if (item.sub) {
      const sub = item.sub.filter(s => !s.perm || check(s.perm))
      if (sub.length === 0) return null
      return { ...item, sub }
    }
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

            <div className="w-[1px] h-6 bg-white/10 mx-1" />

            <div className="flex items-center gap-2">
              <span className="material-icons-round text-xs text-cyan-400 animate-pulse">radar</span>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Radar</span>
                <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-tighter leading-none">Cloud</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* BANDEJA DE SALIDA (PENDIENTES NUBE) */}
          {(pendingSyncCount > 0 || syncErrorCount > 0) && (
            <button 
              onClick={() => setShowSyncModal(true)}
              className={`flex items-center gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-xl border ${syncErrorCount > 0 ? 'bg-red-500/10 border-red-500/30 text-red-500 animate-pulse' : 'bg-amber-500/10 border-amber-500/30 text-amber-500'}`}
            >
              <span className="material-icons-round text-xs md:text-sm">
                {syncErrorCount > 0 ? 'error_outline' : 'cloud_upload'}
              </span>
              <div className="flex flex-col text-left">
                <span className={`text-[7px] md:text-[8px] font-black uppercase tracking-widest leading-none ${syncErrorCount > 0 ? 'text-red-400' : 'text-amber-600'}`}>
                  {syncErrorCount > 0 ? 'Error Sync' : 'Pendientes'}
                </span>
                <span className={`text-[9px] md:text-[10px] font-bold leading-none ${syncErrorCount > 0 ? 'text-red-500 font-mono scale-110 ml-0.5' : 'text-amber-500'}`}>
                  {syncErrorCount > 0 ? `${syncErrorCount}` : pendingSyncCount}
                </span>
              </div>
            </button>
          )}

          {/* Acceso directo a Pedidos en Línea - solo desktop */}
          {currentUser?.rol !== 'VENDEDOR' && (
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
          )}

          {/* Tasas (Sistema y BCV) */}
          {!hideTasa && (
            <div className="flex items-center gap-2">
              {/* Tasa BCV Oficial (Reference only) */}
              <div className="hidden lg:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl">
                <div className="text-right">
                  <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    BCV Oficial
                    {useStore.getState().tasaOficialTime && (
                      <span className="text-[6px] text-slate-500 lowercase font-normal">
                        ({new Date(useStore.getState().tasaOficialTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-sm font-black text-slate-300 leading-none">
                    {useStore.getState().tasaOficial ? parseFloat(useStore.getState().tasaOficial).toFixed(2) : '0.00'}
                  </div>
                </div>
                <div className="w-6 h-6 bg-slate-800 flex items-center justify-center text-slate-400 border border-white/10">
                  <span className="material-icons-round text-xs">account_balance</span>
                </div>
              </div>

              {/* Tasa Sistema (Manual/Paralelo para cálculos) */}
              <div
                className={`flex items-center gap-3 bg-white/5 border border-white/20 p-2 rounded-2xl group transition-all ${currentUser?.rol === 'VENDEDOR' ? 'cursor-default opacity-90' : 'cursor-pointer hover:bg-white/10 hover:border-white/40'}`}
                onClick={() => {
                  if (currentUser?.rol === 'VENDEDOR') {
                    toast('Solo Administradores o Cajeros pueden actualizar la tasa', 'warn')
                    return
                  }

                  const edit = () => {
                    const val = prompt('Nueva Tasa del Sistema (para cálculos):', tasa)
                    if (val && !isNaN(parseFloat(val))) setTasa(parseFloat(val))
                  }

                  if (currentUser?.rol === 'ADMIN' || currentUser?.rol === 'CAJERO') edit()
                  else askAdmin(edit)
                }}
              >
                <div className="text-right">
                  <div className="text-[8px] font-black text-cyan-400 uppercase tracking-widest flex items-center justify-end gap-1">
                    Tasa Sistema
                    {useStore.getState().tasaTime && (
                      <span className="text-[7px] text-cyan-600/70 lowercase font-normal">
                        ({new Date(useStore.getState().tasaTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-lg font-black text-white leading-none">
                    {tasa ? parseFloat(tasa).toFixed(2) : '0.00'}
                  </div>
                </div>
                <div className="w-8 h-8 bg-[var(--tealDark)] flex items-center justify-center text-white border border-white/20">
                  <span className="material-icons-round text-sm">currency_exchange</span>
                </div>
              </div>
            </div>
          )}

          {/* BOTÓN INSTALAR PWA */}
          {canInstall && !isInstalled && (
            <button
              onClick={install}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-cyan-700 border border-cyan-400 px-3 md:px-4 py-1.5 md:py-2 text-white hover:scale-105 transition-all rounded-xl shadow-lg shadow-cyan-900/40"
            >
              <span className="material-icons-round text-lg animate-bounce">install_desktop</span>
              <div className="flex flex-col items-start leading-none">
                <span className="text-[7px] font-black uppercase tracking-widest text-cyan-200">Disponible</span>
                <span className="text-[10px] font-black uppercase tracking-tight">Instalar</span>
              </div>
            </button>
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
      
      {/* MODAL DE SINCRONIZACIÓN */}
      <SyncModal open={showSyncModal} onClose={() => setShowSyncModal(false)} />
    </header>
  )
}
