import { Outlet } from 'react-router-dom'
import Header from './Header'
import NavTop from './NavTop'
import NavBottom from './NavBottom'
import Toast from '../UI/Toast'
import AdminModal from '../UI/AdminModal'

export default function Layout() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Fixed Header Section */}
      <div className="flex-none w-full z-[300] shadow-2xl print:hidden">
        {/* Decorative Top Band */}
        <div className="h-1.5 bg-gradient-to-r from-slate-900 via-red-600 to-slate-900" />
        <Header />
        <NavTop />
      </div>

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-2.5 pt-2 md:px-4 animate-in fade-in duration-700 overflow-hidden min-h-0 print:pt-0 print:p-0 print:max-w-none print:m-0 print:opacity-100! print:animate-none">
        <Outlet />
      </main>

      {/* Premium Footer Band */}
      <footer className="flex-none bg-slate-900 text-white py-6 px-4 border-t-4 border-red-600 relative z-10 hidden md:block">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <img src="/logoguaicaipuro.jpeg" alt="Logo" className="h-10 w-10 rounded-lg grayscale brightness-200" />
            <div>
              <div className="font-bebas text-2xl tracking-[0.2em]">AUTOMOTORES GUAICAIPURO</div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Sistema de Gestión Profesional v2.4.0</div>
            </div>
          </div>
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest text-center md:text-right">
            &copy; {new Date().getFullYear()} KEMASTER &bull; SOLUCIONES TECNOLÓGICAS PARA TU NEGOCIO
          </div>
        </div>
      </footer>

      <NavBottom />
      <Toast />
      <AdminModal />
    </div>
  )
}
