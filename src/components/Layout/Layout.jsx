import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import useStore from '../../store/useStore'
import Header from './Header'
import Sidebar from './Sidebar'
import QuickAccessBar from './QuickAccessBar'
import NavBottom from './NavBottom'
import SmartTicker from '../UI/SmartTicker'
import Toast from '../UI/Toast'
import AdminModal from '../UI/AdminModal'
import HelpModal from '../UI/HelpModal'
import MdiWindow from '../UI/MdiWindow'
import PedidosWebModal from '../UI/PedidosWebModal'
import SupabaseListener from '../SupabaseListener'
import LoadingOverlay from '../UI/LoadingOverlay'
import SubtleSync from '../UI/SubtleSync'

export default function Layout() {
  const [showWebOrders, setShowWebOrders] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const { configEmpresa, syncStatus } = useStore()
  const isInitialSync = syncStatus?.isInitialSync

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Fixed Header Section */}
      <div className="flex-none w-full z-[300] shadow-[0_8px_30px_rgb(0,0,0,0.08)] bg-white relative print:hidden">
        {/* Decorative Top Band */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-slate-900 via-[var(--teal)] to-slate-900" />
        <Header 
          onOpenWebOrders={() => setShowWebOrders(true)} 
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        />
      </div>

      <div className="flex-1 flex overflow-hidden w-full relative z-[1]">
        <Sidebar isOpen={isSidebarOpen} />
        
        <main className="flex-1 w-full max-w-[1920px] mx-auto animate-in fade-in duration-700 overflow-hidden min-h-0 bg-slate-50 print:pt-0 print:p-0 print:max-w-none print:m-0 print:opacity-100! print:animate-none">
          <MdiWindow>
            <div className="relative h-full min-h-0 flex flex-col">
              <Outlet />
            </div>
          </MdiWindow>
        </main>

        <QuickAccessBar />
      </div>

      {/* Ticker Band - High Visibility */}
      <div className="flex-none bg-slate-950 border-t border-white/5 h-8 flex items-center overflow-hidden z-10 hidden md:flex">
        <SmartTicker onOpenWebOrders={() => setShowWebOrders(true)} />
      </div>

      {/* Premium Footer Band */}
      <footer className="flex-none bg-slate-900 text-white py-1.5 px-6 border-t border-slate-800 relative z-10 hidden md:flex items-center justify-between">
        {/* Subtle Sync Loading In the Center */}
        <div className="flex-1">
          <SubtleSync />
        </div>

        <div className="text-right">
          <div className="text-xs font-black text-slate-300 uppercase tracking-widest">
            {configEmpresa?.nombre || 'AUTOMOTORES GUAICAIPURO C.A.'}
          </div>
        </div>
      </footer>

      {/* BLOQUEO FORZOSO: Nombre de PC Requerido */}
      {configEmpresa && (!configEmpresa.terminal_prefix || configEmpresa.terminal_prefix.trim() === '') && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-slate-800 p-10 max-w-lg w-full shadow-2xl rounded-[2.5rem] relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50"></div>

            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-orange-500/20 shadow-lg shadow-orange-500/5">
                <span className="material-icons-round text-5xl text-orange-500 animate-pulse">important_devices</span>
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-3">Identidad de la Estación</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] leading-relaxed max-w-xs mx-auto opacity-80">
                ES OBLIGATORIO ASIGNAR UN NOMBRE ÚNICO PARA <span className="text-orange-500">IDENTIFICAR ESTA PC</span> EN LA NUBE.
              </p>
            </div>

            <div className="space-y-6 relative z-10">
              <div className="group">
                <label className="block text-[9px] text-center uppercase font-black text-orange-500 tracking-[0.4em] mb-3 opacity-60 group-focus-within:opacity-100 transition-opacity">Nombre del Equipo</label>
                <input
                  type="text"
                  id="forcedTerminalInput"
                  placeholder="EJ: CAJA-01"
                  className="w-full bg-black border border-slate-800 focus:border-orange-500 p-5 text-center text-2xl font-black uppercase text-white outline-none rounded-2xl shadow-inner transition-all placeholder:text-slate-800"
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
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-[0.25em] py-5 rounded-2xl transition-all shadow-xl active:scale-95 cursor-pointer flex justify-center items-center gap-2"
              >
                <span className="material-icons-round text-sm">rocket_launch</span> VINCULAR ESTACIÓN
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
      <LoadingOverlay {...useStore(s => s.syncStatus)} />
    </div>
  )
}
