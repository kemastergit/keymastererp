import { useEffect, useState } from 'react'
import { logAction } from '../../utils/audit'
import useStore from '../../store/useStore'
import { usePermiso } from '../../hooks/usePermiso'
import { menu } from './menu'
import MobileSidebar from './MobileSidebar'
import { usePWA } from '../../hooks/usePWA'
import SyncModal from '../UI/SyncModal'

export default function Header({ hideTasa = false, onOpenWebOrders, onToggleSidebar }) {
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
      <header className="hdr-root sticky top-0 z-50 text-white" style={{ background: 'var(--secondary, #0f172a)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Top accent line */}
        <div className="band-top" style={{ height: 2 }} />

        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1600, margin: '0 auto' }}>

          {/* ── LEFT ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Hamburger */}
            <button
              onClick={() => {
                if (window.innerWidth < 768) setShowDrawer(true)
                else if (onToggleSidebar) onToggleSidebar()
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
              aria-label="Menu"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4 8h16M4 16h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
            </button>

            {/* Session Indicator only, Brand moved to Sidebar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: activeSession ? '#10b981' : '#ef4444', display: 'inline-block', flexShrink: 0, boxShadow: activeSession ? '0 0 8px #10b981' : 'none' }} title={activeSession ? 'Caja Activa' : 'Caja Cerrada'} />
            </div>
          </div>

          {/* ── CENTER ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center', padding: '0 16px' }}>

            {/* Sync errors */}
            {(pendingSyncCount > 0 || syncErrorCount > 0) && (
              <button
                onClick={() => setShowSyncModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', color: syncErrorCount > 0 ? '#f87171' : '#fbbf24', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(255,255,255,0.03)', border: syncErrorCount > 0 ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(251,191,36,0.25)', borderRadius: 6, cursor: 'pointer' }}
              >
                <span className="material-icons-round" style={{ fontSize: 12 }}>{syncErrorCount > 0 ? 'error_outline' : 'cloud_upload'}</span>
                {syncErrorCount > 0 ? `${syncErrorCount} Err` : `${pendingSyncCount} Pend`}
              </button>
            )}

            {/* Pedidos */}
            {currentUser?.rol !== 'VENDEDOR' && (
              <a href="/pedidos-web" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 5, padding: '2px 10px', textDecoration: 'none', background: 'rgba(255,255,255,0.04)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)' }}>
                <svg width="11" height="11" fill="none" stroke="#94a3b8" viewBox="0 0 24 24">
                  <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                </svg>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>Pedidos</span>
                {pedidosWeb.length > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, background: '#dc2626', color: '#fff', fontSize: 7, fontWeight: 900, width: 13, height: 13, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0f172a', zIndex: 2 }}>
                    {pedidosWeb.length}
                  </span>
                )}
              </a>
            )}

            {/* Tasas — compact inline */}
            {!hideTasa && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="hidden lg:flex" style={{ alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 8, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>BCV</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '-0.02em' }}>
                    {tasaOficial ? parseFloat(tasaOficial).toFixed(2) : '0.00'}
                  </span>
                </div>

                <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: currentUser?.rol === 'VENDEDOR' ? 'default' : 'pointer' }}
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
                  <span style={{ fontSize: 8, color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>SIS</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#fff', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '-0.02em' }}>
                    {tasa ? parseFloat(tasa).toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>
            )}

            {/* PWA Install */}
            {canInstall && !isInstalled && (
              <button onClick={install} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', color: '#67e8f9', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', border: '1px solid rgba(103,232,249,0.2)', background: 'rgba(103,232,249,0.05)', borderRadius: 6, cursor: 'pointer' }}>
                <span className="material-icons-round" style={{ fontSize: 12 }}>install_desktop</span>
                App
              </button>
            )}
          </div>

          {/* ── RIGHT: User moved to Sidebar ── */}
        </div>

        {/* Bottom line */}
        <div style={{ height: 1, background: 'rgba(0,0,0,0.3)' }} />

        <MobileSidebar open={showDrawer} onClose={() => setShowDrawer(false)} menu={filteredMenu} check={check} />
        <SyncModal open={showSyncModal} onClose={() => setShowSyncModal(false)} />
      </header>
    </>
  )
}
