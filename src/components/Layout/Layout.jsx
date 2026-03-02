import { Outlet } from 'react-router-dom'
import { useState } from 'react'
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
            <div className="text-xs font-black text-slate-300 uppercase tracking-widest mb-0.5">AUTOMOTORES GUAICAIPURO</div>
            <div className="text-[8px] uppercase font-bold text-slate-600 tracking-widest">
              &copy; 2026 KEYMASTER &bull; SOLUCIONES TECNOLÓGICAS PARA TU NEGOCIO
            </div>
          </div>
        </div>
      </footer>

      <NavBottom />
      <Toast />
      <AdminModal />
      <HelpModal />
      <PedidosWebModal open={showWebOrders} onClose={() => setShowWebOrders(false)} />
      <SupabaseListener />
    </div>
  )
}
