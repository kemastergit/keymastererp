import { useEffect, useState } from 'react'
import { logAction } from '../../utils/audit'
import useStore from '../../store/useStore'
import { usePermiso } from '../../hooks/usePermiso'
import { menu } from './menu'
import MobileSidebar from './MobileSidebar'
import { usePWA } from '../../hooks/usePWA'
import SyncModal from '../UI/SyncModal'

export default function Header({ hideTasa = false, hideUser = false, onOpenWebOrders, onToggleSidebar }) {
  const { tasa, setTasa, loadTasa, askAdmin, activeSession, loadSession, currentUser, logout, pedidosWeb, fetchPedidosWeb, pendingSyncCount, syncErrorCount } = useStore()
  const { check } = usePermiso()
  const { canInstall, install, isInstalled } = usePWA()
  const [showDrawer, setShowDrawer] = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)

  const tasaOficial = useStore(s => s.tasaOficial)
  const tasaOficialTime = useStore(s => s.tasaOficialTime)
  const tasaTime = useStore(s => s.tasaTime)

  useEffect(() => {
    if (!hideTasa) loadTasa()
    loadSession()
    fetchPedidosWeb()
    const int = setInterval(fetchPedidosWeb, 15000)
    return () => clearInterval(int)
  }, [hideTasa])

  const handleLogout = () => {
    if (confirm('¿Cerrar sesión de KEYMASTER?')) {
      logAction(currentUser, 'LOGOUT')
      logout()
    }
  }

  const filteredMenu = menu.map(item => {
    if (item.perm && !check(item.perm)) return null
    if (item.sub) {
      const sub = item.sub.filter(s => !s.perm || check(s.perm))
      if (sub.length === 0) return null
      return { ...item, sub }
    }
    return item
  }).filter(Boolean)

  return (
    <>
      <style>{`
        :root { --hdr-bg: #0f172a; }
        .hdr-root {
          background: var(--secondary, #0f172a);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .hw {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
        }
        .hw:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.13);
          transform: translateY(-1px);
        }
        .hw-accent {
          background: rgba(56,189,248,0.04);
          border-color: rgba(56,189,248,0.18);
        }
        .hw-accent:hover {
          background: rgba(56,189,248,0.08);
          border-color: rgba(56,189,248,0.28);
        }
        .hdr-pill {
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 999px;
          padding: 5px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hdr-divider {
          width: 1px;
          height: 32px;
          background: rgba(255,255,255,0.06);
        }
      `}</style>

      <header className="hdr-root sticky top-0 z-50 text-white">
        {/* Top blue accent line (band-top original) */}
        <div className="band-top" style={{ height: 3 }} />

        <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1600, margin: '0 auto' }}>

          {/* ── LEFT ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {/* Hamburger */}
            <button
              onClick={() => {
                if (window.innerWidth < 768) setShowDrawer(true)
                else if (onToggleSidebar) onToggleSidebar()
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
              aria-label="Menu"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4 8h16M4 16h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
            </button>

            {/* Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, background: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', flexShrink: 0 }}>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 900, fontSize: 14, color: '#0f172a', letterSpacing: '-0.05em' }}>KM</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Keymaster</span>
                <span style={{ color: '#475569', fontSize: 9, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 3 }}>Management OS</span>
              </div>
            </div>

            {/* Status Pills — only xl */}
            <div className="hidden xl:flex" style={{ alignItems: 'center', gap: 8 }}>
              <div className="hdr-pill">
                <span style={{ position: 'relative', display: 'flex', width: 6, height: 6 }}>
                  {activeSession && <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#10b981', opacity: 0.5, animation: 'ping 1s infinite' }} />}
                  <span style={{ position: 'relative', width: 6, height: 6, borderRadius: '50%', background: activeSession ? '#10b981' : '#ef4444', display: 'flex' }} />
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {activeSession ? 'Caja Activa' : 'Caja Cerrada'}
                </span>
              </div>
              <div className="hdr-pill">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', display: 'flex' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cloud Sync</span>
              </div>
            </div>
          </div>

          {/* ── CENTER ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'center', padding: '0 32px' }}>

            {/* Sync errors */}
            {(pendingSyncCount > 0 || syncErrorCount > 0) && (
              <button
                onClick={() => setShowSyncModal(true)}
                className="hw"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', color: syncErrorCount > 0 ? '#f87171' : '#fbbf24', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', animation: syncErrorCount > 0 ? 'pulse 2s infinite' : 'none', border: syncErrorCount > 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(251,191,36,0.3)' }}
              >
                <span className="material-icons-round" style={{ fontSize: 16 }}>{syncErrorCount > 0 ? 'error_outline' : 'cloud_upload'}</span>
                {syncErrorCount > 0 ? `${syncErrorCount} Error` : `${pendingSyncCount} Pend.`}
              </button>
            )}

            {/* Pedidos */}
            {currentUser?.rol !== 'VENDEDOR' && (
              <a href="/pedidos-web" className="hw" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', textDecoration: 'none', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.04)', transform: 'translateY(100%)', transition: 'transform 0.3s ease', borderRadius: 14 }} className="hw-reveal" />
                <svg width="15" height="15" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" style={{ position: 'relative', zIndex: 1 }}>
                  <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.12em', position: 'relative', zIndex: 1, whiteSpace: 'nowrap' }}>Pedidos</span>
                {pedidosWeb.length > 0 && (
                  <span style={{ position: 'absolute', top: -6, right: -6, background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 900, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0f172a', boxShadow: '0 0 8px rgba(220,38,38,0.6)', animation: 'pulse 2s infinite', zIndex: 2 }}>
                    {pedidosWeb.length}
                  </span>
                )}
              </a>
            )}

            {/* BCV Widget */}
            {!hideTasa && (
              <>
                <div className="hw hidden lg:flex" style={{ alignItems: 'center', gap: 16, padding: '10px 20px', minWidth: 180 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>BCV Oficial</span>
                      {tasaOficialTime && (
                        <span style={{ fontSize: 8, color: '#334155', fontFamily: 'monospace' }}>
                          {new Date(tasaOficialTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Bs.</span>
                      <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', fontFamily: 'IBM Plex Mono, monospace' }}>
                        {tasaOficial ? parseFloat(tasaOficial).toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </div>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-icons-round" style={{ fontSize: 16, color: '#475569' }}>account_balance</span>
                  </div>
                </div>

                {/* Tasa Sistema */}
                <div
                  className="hw hw-accent"
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 20px', minWidth: 175, cursor: currentUser?.rol === 'VENDEDOR' ? 'default' : 'pointer' }}
                  onClick={() => {
                    if (currentUser?.rol === 'VENDEDOR') return
                    const edit = () => {
                      const val = prompt('Nueva Tasa del Sistema (para cálculos):', tasa)
                      if (val && !isNaN(parseFloat(val))) setTasa(parseFloat(val))
                    }
                    if (currentUser?.rol === 'ADMIN' || currentUser?.rol === 'CAJERO') edit()
                    else askAdmin(edit)
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Tasa Sistema</span>
                      {tasaTime && (
                        <span style={{ fontSize: 8, color: 'rgba(56,189,248,0.5)', fontFamily: 'monospace' }}>
                          {new Date(tasaTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                      <span style={{ fontSize: 12, color: 'rgba(56,189,248,0.7)', fontWeight: 500 }}>Bs.</span>
                      <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', fontFamily: 'IBM Plex Mono, monospace' }}>
                        {tasa ? parseFloat(tasa).toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </div>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-icons-round" style={{ fontSize: 16, color: '#38bdf8' }}>currency_exchange</span>
                  </div>
                </div>
              </>
            )}

            {/* PWA Install */}
            {canInstall && !isInstalled && (
              <button onClick={install} className="hw" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', color: '#67e8f9', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', border: '1px solid rgba(103,232,249,0.2)', background: 'rgba(103,232,249,0.05)' }}>
                <span className="material-icons-round" style={{ fontSize: 16, animation: 'bounce 1s infinite' }}>install_desktop</span>
                Instalar
              </button>
            )}
          </div>

          {/* ── RIGHT: User ── */}
          {!hideUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div className="hidden sm:flex" style={{ flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  {currentUser?.nombre || 'Administrador'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: currentUser?.rol === 'ADMIN' ? '#fb923c' : '#38bdf8', display: 'inline-block' }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: currentUser?.rol === 'ADMIN' ? 'rgba(251,146,60,0.85)' : 'rgba(56,189,248,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {currentUser?.rol === 'ADMIN' ? 'Master Access' : currentUser?.rol}
                  </span>
                </div>
              </div>

              <div className="hdr-divider" />

              <button
                onClick={handleLogout}
                title="Cerrar Sesión"
                style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', transition: 'all 0.25s ease' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
              >
                <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Bottom line */}
        <div style={{ height: 1, background: 'rgba(0,0,0,0.3)' }} />

        <MobileSidebar open={showDrawer} onClose={() => setShowDrawer(false)} menu={filteredMenu} check={check} />
        <SyncModal open={showSyncModal} onClose={() => setShowSyncModal(false)} />
      </header>
    </>
  )
}
