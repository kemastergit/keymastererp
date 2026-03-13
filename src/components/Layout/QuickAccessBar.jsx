import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useStore from '../../store/useStore'

const ALL_SHORTCUTS = (rol) => {
  const base = [
    { icon: 'receipt', label: 'Facturación', path: '/facturacion' },
    { icon: 'inventory_2', label: 'Inventario', path: '/inventario' },
    { icon: 'people', label: 'Clientes', path: '/clientes' },
    { icon: 'request_quote', label: 'Cotizaciones', path: '/cotizaciones' },
  ]
  const adminSolo = [
    { icon: 'local_shipping', label: 'Proveedores', path: '/proveedores' },
    { icon: 'receipt_long', label: 'Reportes', path: '/reportes' },
    { icon: 'point_of_sale', label: 'Caja', path: '/caja' },
    { icon: 'assignment_return', label: 'Devoluciones', path: '/devoluciones' },
    { icon: 'shopping_cart', label: 'Compras', path: '/compras' },
    { icon: 'account_balance_wallet', label: 'Caja Chica', path: '/caja-chica' },
    { icon: 'account_balance', label: 'Ctas x Cobrar', path: '/cuentas-cobrar' },
    { icon: 'summarize', label: 'Cierre', path: '/cierre' },
    { icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
    { icon: 'security', label: 'Auditoría', path: '/auditoria' },
  ]

  if (['CAJERO', 'ADMIN', 'SUPERVISOR'].includes(rol)) {
    return [...base, ...adminSolo]
  }
  return base
}

const DEFAULT_PATHS = ['/inventario', '/clientes', '/reportes', '/caja', '/devoluciones']

export default function QuickAccessBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { tasa, currentUser } = useStore()
  const [editing, setEditing] = useState(false)
  
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('quick_access_buttons')
      return saved ? JSON.parse(saved) : DEFAULT_PATHS
    } catch { return DEFAULT_PATHS }
  })

  const toggle = (path) => {
    setEnabled(prev => {
      const next = prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
      localStorage.setItem('quick_access_buttons', JSON.stringify(next))
      return next
    })
  }

  const roleShortcuts = ALL_SHORTCUTS(currentUser?.rol)
  const visibleButtons = roleShortcuts.filter(s => enabled.includes(s.path))

  return (
    <div className={`h-full hidden lg:flex lg:flex-col lg:flex-none border-l border-slate-200 items-center pt-3 relative transition-all duration-300 ${editing ? 'lg:w-[200px]' : 'lg:w-[68px]'} bg-white z-[90]`}>

      {/* MODO NORMAL */}
      {!editing && (
        <>
          <div className="flex flex-col gap-3 p-3 items-center flex-1 overflow-y-auto no-scrollbar w-full">
            {visibleButtons.map(a => {
              const isActive = location.pathname === a.path;
              return (
                <button key={a.path} onClick={() => navigate(a.path)} title={a.label}
                  className={`w-12 h-12 flex items-center justify-center transition-all duration-300 group cursor-pointer rounded-2xl shadow-sm hover:shadow-md shrink-0 active:scale-95 relative border
                    ${isActive 
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-200' 
                      : 'bg-white border-slate-200 hover:border-[#009c85] hover:bg-emerald-50 text-slate-500 hover:text-[#009c85]'}`}
                >
                  <span className={`material-icons-round text-[22px] transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>{a.icon}</span>
                  {/* Indicador sutil lateral */}
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-md transition-all duration-300
                    ${isActive ? 'h-8 bg-white/40' : 'h-0 bg-[#009c85] group-hover:h-6'}`}></div>
                </button>
              );
            })}
            {visibleButtons.length === 0 && (
              <div className="text-[9px] font-black text-slate-300 uppercase text-center mt-6 px-1 tracking-widest leading-tight">
                Sin<br/>accesos
              </div>
            )}
          </div>
          <div className="shrink-0 pb-4 pt-3 text-center border-t border-slate-100 w-full bg-slate-50/50">
            <div className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">TASA</div>
            <div className="text-[11px] font-mono font-black text-[#009c85]">{tasa?.toFixed(2) || '0.00'}</div>
          </div>
          <button onClick={() => setEditing(true)} title="Configurar accesos"
            className="shrink-0 w-12 h-12 mb-4 bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-[#009c85] hover:border-[#009c85] hover:bg-emerald-50 rounded-2xl transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md active:scale-95 group"
          >
            <span className="material-icons-round text-[20px] group-hover:rotate-90 transition-transform duration-500">settings</span>
          </button>
        </>
      )}

      {/* MODO EDICIÓN */}
      {editing && (
        <div className="flex flex-col h-full w-full bg-slate-50 animate-in fade-in duration-300 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-white shrink-0 shadow-sm relative z-10">
            <div className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 mb-1">
              <span className="material-icons-round text-[15px] text-[#009c85]">tune</span>
              Personalizar
            </div>
            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Accesos rápidos</div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2">
            {roleShortcuts.map(s => (
              <label key={s.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border shadow-sm select-none
                  ${enabled.includes(s.path)
                    ? 'bg-emerald-50 text-[#009c85] border-[#009c85]/40 ring-1 ring-[#009c85]/20'
                    : 'bg-white text-slate-500 hover:border-slate-300 border-slate-200'
                  }`}
              >
                <input type="checkbox" checked={enabled.includes(s.path)} onChange={() => toggle(s.path)}
                  className="accent-[#009c85] w-4 h-4 shrink-0 cursor-pointer" />
                <span className={`material-icons-round text-[18px] shrink-0 ${enabled.includes(s.path) ? 'text-[#009c85]' : 'text-slate-400'}`}>{s.icon}</span>
                <span className="text-[10px] font-black uppercase tracking-wider truncate mt-0.5">{s.label}</span>
              </label>
            ))}
          </div>

          <div className="shrink-0 p-3 pt-1 bg-white border-t border-slate-100">
            <button onClick={() => setEditing(false)}
              className="w-full py-3 bg-[#0a0f18] text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
            >
              <span className="material-icons-round text-[16px]">check_circle</span>
              Finalizar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
