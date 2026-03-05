import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import useStore from '../../store/useStore'
import Header from './Header'
import NavTop from './NavTop'
import NavBottom from './NavBottom'
import SmartTicker from '../UI/SmartTicker'
import Toast from '../UI/Toast'
import AdminModal from '../UI/AdminModal'
import HelpModal from '../UI/HelpModal'
import MdiWindow from '../UI/MdiWindow'
import PedidosWebModal from '../UI/PedidosWebModal'
import SupabaseListener from '../SupabaseListener'

export default function Layout() {
  const [showWebOrders, setShowWebOrders] = useState(false)
  const { configEmpresa } = useStore()

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Fixed Header Section */}
      <div className="flex-none w-full z-[300] shadow-2xl print:hidden">
        {/* Decorative Top Band */}
        <div className="h-1.5 bg-gradient-to-r from-slate-900 via-red-600 to-slate-900" />
        <Header onOpenWebOrders={() => setShowWebOrders(true)} />
        <NavTop />
      </div>

      <main className="flex-1 w-full mx-auto animate-in fade-in duration-700 overflow-hidden min-h-0 print:pt-0 print:p-0 print:max-w-none print:m-0 print:opacity-100! print:animate-none">
        <MdiWindow>
          <div className="relative h-full min-h-0 flex flex-col">
            <Outlet />
          </div>
        </MdiWindow>
      </main>

      {/* Ticker Band - High Visibility */}
      <div className="flex-none bg-slate-950 border-t border-white/5 h-8 flex items-center overflow-hidden z-10 hidden md:flex">
        <SmartTicker onOpenWebOrders={() => setShowWebOrders(true)} />
      </div>

      {/* Premium Footer Band */}
      <footer className="flex-none bg-slate-900 text-white py-3 px-6 border-t border-slate-800 relative z-10 hidden md:block">
        <div className="max-w-[1700px] mx-auto flex justify-between items-center">
          <div className="flex flex-col">
            <div className="font-bebas text-xl tracking-[0.3em] text-white">KEYMASTER</div>
            <div className="text-[8px] uppercase font-black text-slate-500 tracking-[0.3em]">Sistema de Gestión Profesional v2.5.0</div>
          </div>

          <div className="text-right">
            <div className="text-sm font-black text-slate-300 uppercase tracking-widest mb-0.5">
              {configEmpresa?.nombre || 'KEYMASTER ERP'}
            </div>
            <div className="text-[8px] uppercase font-bold text-slate-600 tracking-widest">
              &copy; {new Date().getFullYear()} KEYMASTER &bull; SOLUCIONES TECNOLÓGICAS PARA TU NEGOCIO
            </div>
          </div>
        </div>
      </footer>

      {/* BLOQUEO FORZOSO: Nombre de PC Requerido */}
      {configEmpresa && (!configEmpresa.terminal_prefix || configEmpresa.terminal_prefix.trim() === '') && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 shadow-2xl">
          <div className="bg-[var(--surfaceDark)] border-2 border-[var(--orange-var)] p-10 max-w-lg w-full shadow-[0_0_80px_rgba(245,158,11,0.15)] rounded-none relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[var(--orange-var)] to-transparent opacity-50"></div>

            <div className="text-center mb-8">
              <span className="material-icons-round text-7xl text-[var(--orange-var)] mb-3 animate-pulse drop-shadow-md">important_devices</span>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Bautice esta Estación</h2>
              <p className="text-[10px] text-[var(--text2)] font-bold uppercase tracking-[0.2em] mt-3 leading-relaxed max-w-sm mx-auto">
                ATENCIÓN: Para operar y evitar choque de facturas en la Nube, es <span className="text-[var(--orange-var)]">MANDATORIO</span> asignarle un nombre único a esta PC.
              </p>
            </div>

            <div className="space-y-6 relative z-10">
              <div>
                <label className="block text-[10px] text-center uppercase font-black text-[var(--orange-var)] tracking-[0.3em] mb-2">Nombre Único del Equipo</label>
                <input
                  type="text"
                  id="forcedTerminalInput"
                  placeholder="EJEMPLO: CAJA-PRINCIPAL"
                  className="w-full bg-slate-900 border-2 border-slate-700 focus:border-[var(--orange-var)] p-4 text-center text-xl font-black uppercase text-white outline-none shadow-inner transition-colors placeholder:text-slate-600"
                  autoFocus
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      const val = e.target.value.toUpperCase().trim()
                      if (!val) return useStore.getState().toast('⚠️ Ingrese un nombre válido', 'error')
                      await useStore.getState().updateConfigEmpresa({ terminal_prefix: val })
                    }
                  }}
                />
              </div>
              <button
                onClick={async () => {
                  const val = document.getElementById('forcedTerminalInput').value.toUpperCase().trim()
                  if (!val) return useStore.getState().toast('⚠️ Ingrese un nombre válido', 'error')
                  await useStore.getState().updateConfigEmpresa({ terminal_prefix: val })
                }}
                className="w-full bg-[var(--orange-var)] text-white font-black text-xs uppercase tracking-[0.2em] py-4 hover:bg-orange-600 transition-none shadow-[var(--win-shadow)] active:translate-y-0.5 cursor-pointer flex justify-center items-center gap-2"
              >
                <span className="material-icons-round text-sm">save</span> CONECTAR TERMINAL
              </button>
            </div>
          </div>
        </div>
      )}

      <NavBottom />
      <Toast />
      <AdminModal />
      <HelpModal />
      <PedidosWebModal open={showWebOrders} onClose={() => setShowWebOrders(false)} />
      <SupabaseListener />
    </div>
  )
}
