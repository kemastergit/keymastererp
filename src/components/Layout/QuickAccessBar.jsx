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

const DEFAULT_PATHS = ['/facturacion', '/inventario', '/clientes', '/reportes', '/caja', '/devoluciones']

const PALETTE = [
  '#3b82f6', // Azul Eléctrico (Vivid Blue)
  '#10b981', // Verde Esmeralda (Vivid Emerald)
  '#facc15', // Amarillo Neón (Vivid Yellow)
  '#ef4444', // Rojo Fuego (Fire Red)
  '#a855f7', // Púrpura Eléctrico (Electric Purple)
  '#ec4899', // Rosa Fucsia (Hot Pink)
  '#06b6d4', // Cyan Brillante (Electric Cyan)
  '#6366f1', // Indigo Neon
  '#f97316', // Naranja Eléctrico (Electric Orange)
  '#84cc16', // Lima Neón (Lime)
]

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

  // ✅ Soporte de colores como en la otra app
  const [colors, setColors] = useState(() => {
    try {
      const saved = localStorage.getItem('quick_access_colors')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })

  const toggle = (path) => {
    setEnabled(prev => {
      const next = prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
      localStorage.setItem('quick_access_buttons', JSON.stringify(next))
      return next
    })
  }

  const setColor = (path, color) => {
    setColors(prev => {
      const next = { ...prev, [path]: color }
      localStorage.setItem('quick_access_colors', JSON.stringify(next))
      return next
    })
  }

  const roleShortcuts = ALL_SHORTCUTS(currentUser?.rol)
  const visibleButtons = roleShortcuts.filter(s => enabled.includes(s.path))

  return (
    <div className={`h-full hidden lg:flex lg:flex-col lg:flex-none border-l border-slate-200 items-center pt-3 relative transition-all duration-300 ${editing ? 'lg:w-[240px]' : 'lg:w-[72px]'} bg-white z-[90]`}>

      {/* MODO NORMAL */}
      {!editing && (
        <>
          <div className="flex flex-col gap-4 p-3 items-center flex-1 overflow-y-auto no-scrollbar w-full">
            {visibleButtons.map(a => {
              const isActive = location.pathname === a.path;
              const buttonColor = colors[a.path] || '#475569';
              
              return (
                <button 
                  key={a.path} 
                  onClick={() => navigate(a.path)} 
                  title={a.label}
                  className={`w-12 h-12 flex items-center justify-center transition-all duration-300 group cursor-pointer shadow-xl shrink-0 hover:scale-110 active:scale-95 relative border border-white/10 hover:brightness-125 overflow-hidden`}
                  style={{
                    backgroundColor: buttonColor,
                    color: 'white',
                    borderRadius: '50%', // ✅ Forzado por estilo en línea
                    filter: isActive ? 'none' : 'saturate(0.9) opacity(0.95)',
                    transform: isActive ? 'scale(1.1) translateY(-2px)' : 'none',
                    boxShadow: isActive ? `0 12px 20px -5px ${buttonColor}aa` : `0 4px 10px -2px rgba(0, 0, 0, 0.2)`
                  }}
                >
                  <span className={`material-icons-round text-[24px] transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>{a.icon}</span>
                  
                  {/* Tooltip personalizado al hover (hacia la izquierda) */}
                  <div className="absolute right-full mr-3 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-bold uppercase tracking-widest z-50">
                    {a.label}
                  </div>
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

          <button onClick={() => setEditing(true)} title="Configurar Accesos"
            className="shrink-0 w-12 h-12 mb-4 bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-all duration-300 cursor-pointer active:scale-95 group"
          >
            <span className="material-icons-round text-[20px] group-hover:rotate-90 transition-transform duration-500">settings</span>
          </button>
        </>
      )}

      {/* MODO EDICIÓN (Sincronizado con la imagen) */}
      {editing && (
        <div className="flex flex-col h-full w-full bg-slate-50 animate-in slide-in-from-right duration-300 overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-white shrink-0">
            <div className="text-[12px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-1">
              <span className="material-icons-round text-blue-600">palette</span>
              Personalizar
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Accesos Rápidos</p>
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-3">
            {roleShortcuts.map(s => {
              const isEnabled = enabled.includes(s.path);
              const shortcutColor = colors[s.path] || '#475569';

              return (
                <div key={s.path}
                  className={`flex flex-col gap-3 p-3 rounded-2xl border transition-all duration-300
                    ${isEnabled ? 'bg-white border-slate-300 shadow-md ring-1 ring-slate-200' : 'bg-slate-100/50 text-slate-400 border-slate-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggle(s.path)}
                      className={`w-12 h-12 flex items-center justify-center transition-all overflow-hidden ${isEnabled ? 'shadow-lg scale-105' : 'grayscale opacity-50'}`}
                      style={{ 
                        backgroundColor: isEnabled ? shortcutColor : '#e2e8f0', 
                        color: isEnabled ? 'white' : '#94a3b8',
                        borderRadius: '50%' // ✅ Forzado por estilo en línea
                      }}
                    >
                      <span className="material-icons-round text-[20px]">{s.icon}</span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-wider truncate mb-1">{s.label}</div>
                      <div 
                        onClick={() => toggle(s.path)}
                        className={`text-[8px] font-bold px-2 py-0.5 rounded-full inline-block cursor-pointer transition-colors
                          ${isEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}
                      >
                        {isEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
                      </div>
                    </div>
                  </div>
                  
                  {isEnabled && (
                    <div className="grid grid-cols-5 gap-2 pt-2 border-t border-slate-50">
                      {PALETTE.map(c => (
                        <button
                          key={c}
                          onClick={() => setColor(s.path, c)}
                          className={`aspect-square rounded-lg border-2 transition-all active:scale-75
                            ${colors[s.path] === c ? 'border-slate-800 scale-110 shadow-sm' : 'border-white hover:scale-105'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="shrink-0 p-5 bg-white border-t border-slate-100 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
            <button onClick={() => setEditing(false)}
              className="w-full py-4 bg-[#0f172a] text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
            >
              <span className="material-icons-round text-emerald-400">check_circle</span>
              FINALIZAR
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
