import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { fmtUSD } from '../../utils/format'
import { useState, useEffect } from 'react'
import useStore from '../../store/useStore'
import { usePermiso } from '../../hooks/usePermiso'

export default function SmartTicker({ onOpenWebOrders }) {
    const { configEmpresa, pedidosWeb, fetchPedidosWeb } = useStore()
    const [time, setTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000)
        // Polling de pedidos cada 45 segundos
        const ordersTimer = setInterval(fetchPedidosWeb, 45000)
        fetchPedidosWeb()
        return () => {
            clearInterval(timer)
            clearInterval(ordersTimer)
        }
    }, [])

    const { check } = usePermiso()

    const alerts = useLiveQuery(async () => {
        if (!configEmpresa) return []

        const messages = []
        const canSeeProcesses = check('MENU_CAJA')
        const canSeeFinances = check('MENU_REPORTES')

        // WEB ORDERS ALERT (MAX PRIORITY) - Only for Cashiers/Admins
        if (canSeeProcesses && pedidosWeb && pedidosWeb.length > 0) {
            messages.push({
                type: 'web_order',
                icon: 'shopping_cart_checkout',
                text: `${pedidosWeb.length} NUEVO(S) PEDIDO(S) WEB PENDIENTE(S) - CLICK PARA VER`,
                color: 'text-red-500 animate-pulse'
            })
        }

        // Custom User Message (High Priority)
        if (configEmpresa.ticker_mensaje_personalizado) {
            messages.push({
                type: 'custom',
                icon: 'campaign',
                text: configEmpresa.ticker_mensaje_personalizado,
                color: 'text-white'
            })
        }

        // Stock Alerts (Everyone sees this)
        if (configEmpresa.ticker_mostrar_stock !== false) {
            const criticalStock = await db.articulos
                .filter(a => a.stock <= (a.stock_min || 5))
                .limit(3)
                .toArray()

            criticalStock.forEach(a => {
                messages.push({
                    type: 'stock',
                    icon: 'inventory_2',
                    text: `STOCK BAJO: ${a.descripcion} (${a.stock} ${a.unidad})`,
                    color: 'text-orange-400'
                })
            })
        }

        // Debts Alerts - Only for Finance/Admin
        if (canSeeFinances && configEmpresa.ticker_mostrar_deudas !== false) {
            const pendingDebts = await db.ctas_pagar
                .where('estado')
                .equals('PENDIENTE')
                .limit(3)
                .toArray()

            pendingDebts.forEach(d => {
                messages.push({
                    type: 'debt',
                    icon: 'outbound',
                    text: `POR PAGAR: ${d.proveedor} - ${fmtUSD(d.monto)}`,
                    color: 'text-red-400'
                })
            })
        }

        // Receivables Alerts - Only for Finance/Cashier
        if (canSeeFinances && configEmpresa.ticker_mostrar_cobranzas !== false) {
            const pendingReceivables = await db.ctas_cobrar
                .where('estado')
                .equals('PENDIENTE')
                .limit(3)
                .toArray()

            pendingReceivables.forEach(r => {
                messages.push({
                    type: 'receivable',
                    icon: 'payments',
                    text: `POR COBRAR: ${r.cliente} - ${fmtUSD(r.monto)}`,
                    color: 'text-green-400'
                })
            })
        }

        // Operational Messages
        const hour = time.getHours()
        const mins = time.getMinutes()

        if (hour === 12 && mins >= 30 && mins <= 59) {
            messages.push({
                type: 'info',
                icon: 'restaurant',
                text: 'HORA DE ALMUERZO RECOMENDADA (12:30 PM - 1:30 PM)',
                color: 'text-blue-400'
            })
        }

        if (hour >= 17) {
            messages.push({
                type: 'info',
                icon: 'logout',
                text: 'RECORDATORIO: REVISAR CIERRE DE CAJA ANTES DE SALIR',
                color: 'text-amber-400'
            })
        }

        // Default message if empty
        if (messages.length === 0) {
            messages.push({
                type: 'info',
                icon: 'check_circle',
                text: 'SISTEMA OPERATIVO - TODO EN ORDEN',
                color: 'text-slate-400'
            })
        }

        return messages
    }, [configEmpresa, time])

    if (!alerts || alerts.length === 0) return null

    const speed = configEmpresa?.ticker_velocidad || 40

    return (
        <div
            className="flex-1 overflow-hidden relative select-none flex items-center h-full cursor-pointer hover:bg-red-950/20 transition-colors"
            onClick={onOpenWebOrders}
        >
            <div className="flex whitespace-nowrap animate-ticker items-center gap-24 px-12 h-full" style={{ animationDuration: `${speed}s` }}>
                {/* Double the list for seamless loop */}
                {[...alerts, ...alerts].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 shrink-0 h-full">
                        <span className={`material-icons-round text-sm text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]`}>
                            {item.icon}
                        </span>
                        <span className={`text-xs font-black uppercase tracking-[0.3em] text-white filter brightness-150 font-mono leading-none flex items-center h-full`}>
                            {item.text}
                        </span>
                        <span className="w-2 h-[2px] bg-white/20 mx-4" />
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes ticker {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-ticker {
                    display: inline-flex;
                    animation: ticker linear infinite;
                    will-change: transform;
                }
                .animate-ticker:hover {
                    animation-play-state: paused;
                }
            `}</style>
        </div>
    )
}




