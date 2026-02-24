import { useEffect } from 'react'
import { logAction } from '../../utils/audit'
import useStore from '../../store/useStore'

export default function Header() {
  const { tasa, setTasa, loadTasa, askAdmin, activeSession, loadSession, currentUser, logout } = useStore()

  useEffect(() => { loadTasa(); loadSession() }, [])

  const handleLogout = () => {
    if (confirm('¿Cerrar sesión de KEMASTER?')) {
      logAction(currentUser, 'LOGOUT')
      logout()
    }
  }

  return (
    <header className="bg-slate-950 text-white shadow-2xl transition-all duration-300 relative overflow-hidden">
      {/* Red Accent Top */}
      <div className="h-[2px] bg-red-600 w-full" />

      <div className="px-4 py-4 flex items-center justify-between gap-4 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-6 min-w-0">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-12 h-12 flex-shrink-0 bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center rounded-2xl shadow-xl border border-red-500/20 transition-all group-hover:scale-110 group-hover:shadow-red-600/20 group-hover:rotate-3">
              <span className="font-bebas text-2xl text-white tracking-tighter">KM</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-bebas text-3xl tracking-[0.05em] leading-tight flex items-center">
                <span className="text-red-600">KE</span>
                <span className="text-white">MASTER</span>
              </h1>
              <p className="text-[10px] text-red-500 font-black uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                TECNOLOGÍA DE GESTIÓN AVANZADA
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            {activeSession ? (
              <>
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping absolute inset-0 opacity-75"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 relative"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Estado de Caja</span>
                  <span className="text-[10px] font-bold text-green-400 uppercase tracking-tighter">
                    {activeSession.usuario} &bull; CONECTADO
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-600"></div>
                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">CAJA CERRADA</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Tasa BCV */}
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
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/20">
              <span className="material-icons-round text-sm">currency_exchange</span>
            </div>
          </div>

          {/* Usuario Info */}
          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="text-right hidden sm:block">
              <div className="text-white font-black text-[11px] uppercase tracking-tighter leading-none">{currentUser?.nombre}</div>
              <div className={`text-[8px] font-black uppercase tracking-widest mt-1 px-2 py-0.5 rounded bg-white/5 inline-block
                ${currentUser?.rol === 'ADMIN' ? 'text-red-500 border border-red-900/50' : 'text-amber-500 border border-amber-900/50'}`}>
                {currentUser?.rol}
              </div>
            </div>

            <button onClick={handleLogout}
              className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-600 transition-all shadow-inner group">
              <span className="material-icons-round text-xl group-hover:rotate-12 transition-transform">power_settings_new</span>
            </button>
          </div>
        </div>
      </div>

      {/* Red Accent Bottom */}
      <div className="h-[1px] bg-white/5 w-full" />
    </header>
  )
}
