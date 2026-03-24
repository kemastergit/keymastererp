import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Navigate, useNavigate } from 'react-router-dom'
import { usePermiso } from '../../hooks/usePermiso'
import { db } from '../../db/db'
import { fmtUSD } from '../../utils/format'
import { supabase } from '../../lib/supabase'
import useStore from '../../store/useStore'
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
    CartesianGrid, LabelList, RadialBarChart, RadialBar,
    ComposedChart, Line
} from 'recharts'

const COLORS = {
    primary: '#0F172A', // Deep Blue (matching header/footer)
    primaryDark: '#020617',
    primaryLight: '#1E293B',
    bg: '#F0F2F5',
    g1: '#FFFFFF',
    g2: '#E8EAED',
    g3: '#D1D5DB',
    borde: '#B0B8C4',
    muted: '#3C4043',
    text: '#202124',
    green: '#2D9A6C', // Green
    amber: '#F59E0B',
    red: '#D93025'
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-[var(--surface)] border border-[var(--border-var)] p-3 rounded-none shadow-[var(--win-shadow)]">
            <p className="text-[var(--text2)] text-[10px] uppercase tracking-widest mb-1 font-bold">{label}</p>
            {payload.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                    <p style={{ color: COLORS.text }} className="font-mono2 text-xs">
                        <span className="opacity-60">{p.name}:</span> {typeof p.value === 'number' && (p.name.includes('$') || p.name.includes('Venta')) ? fmtUSD(p.value) : p.value}
                    </p>
                </div>
            ))}
        </div>
    )
}

export default function Dashboard() {
    const navigate = useNavigate()
    const toast = useStore(s => s.toast)

    const { check } = usePermiso()
    const canSeeFinances = check('MENU_REPORTES')
    const canSeeDashboard = check('MENU_DASHBOARD')

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    // ─── CARGA DE DATOS (DEXIE) ───
    const data = useLiveQuery(async () => {
        const ventas = await db.ventas.toArray()
        const articulos = await db.articulos.toArray()
        const ventaItems = await db.venta_items.toArray()
        const cobrar = await db.ctas_cobrar.where('estado').equals('PENDIENTE').toArray()
        const cuotas = await db.cuotas_credito.where('estado').equals('PENDIENTE').toArray()
        const cajaChica = await db.caja_chica.toArray()

        return calculateStats(ventas, articulos, ventaItems, cobrar, cuotas)
    }, [])

    function calculateStats(ventas, articulos, ventaItems, cobrar, cuotas) {
        const normalizedVentas = ventas.map(v => ({
            ...v,
            total: v.total || v.total_usd,
            fecha: v.fecha || v.fecha_apertura,
            estado: v.estado
        }))

        // Alertas de Cobranza
        const hoy = new Date().toISOString().split('T')[0]
        const cuotasVencidas = cuotas.filter(c => c.fecha_vencimiento <= hoy)

        // 1. Histórico de Ventas (últimos 15 días)
        const last15Days = [...Array(15)].map((_, i) => {
            const d = new Date()
            d.setDate(d.getDate() - (14 - i))
            return d.toISOString().split('T')[0]
        })

        const ventasHist = last15Days.map(date => {
            const dayVentas = normalizedVentas.filter(v =>
                new Date(v.fecha).toISOString().split('T')[0] === date && v.estado !== 'ANULADA'
            )
            const totalVenta = dayVentas.reduce((s, v) => s + (v.total || 0), 0)
            
            // Cálculo de utilidad basado en costos reales de los items vendidos
            const dailyVentaIds = dayVentas.map(x => x.id)
            const dayItems = ventaItems.filter(it => dailyVentaIds.includes(it.venta_id))
            const totalCosto = dayItems.reduce((acc, it) => acc + ((it.costo || 0) * (it.qty || 0)), 0)
            const profit = totalVenta - totalCosto

            return {
                name: date.split('-')[2],
                total: totalVenta,
                profit: profit,
                qty: dayVentas.length
            }
        })

        // 2. Composición de Ingresos (Desglose Real por Método)
        const paymentMap = {}
        const methodColors = {
            'EFECTIVO_USD': '#f59e0b', // naranja
            'PAGO_MOVIL': '#14b8a6',   // teal
            'ZELLE': '#8b5cf6',        // violeta
            'PUNTO_VENTA': '#3b82f6',  // azul
            'EFECTIVO_BS': '#fbbf24',   // amarillo
            'CREDITO': '#f97316'       // orange-deep (extra)
        }

        normalizedVentas.filter(v => v.estado !== 'ANULADA').forEach(v => {
            const pagos = v.pagos || []
            if (pagos.length > 0) {
                pagos.forEach(p => {
                    const m = p.metodo || 'OTRO'
                    paymentMap[m] = (paymentMap[m] || 0) + (p.monto || 0)
                })
            } else {
                const metodos = [...new Set((v.tipo_pago || 'OTRO').split(',').map(x => x.trim()).filter(Boolean))]
                metodos.forEach(m => {
                    paymentMap[m] = (paymentMap[m] || 0) + (v.total / (metodos.length || 1))
                })
            }
        })

        const radialData = Object.entries(paymentMap).map(([name, value]) => ({
            name,
            value,
            fill: methodColors[name] || '#94a3b8' // gris para otros
        })).sort((a, b) => b.value - a.value).slice(0, 6)

        // 3. Top Marcas
        const marcasMap = {}
        articulos.forEach(a => { marcasMap[a.marca || 'S/M'] = (marcasMap[a.marca || 'S/M'] || 0) + (a.stock || 0) })
        const stockMarcas = Object.entries(marcasMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6)

        // 4. Ranking de más vendidos
        const itemsMap = {}
        ventaItems.forEach(it => {
            itemsMap[it.descripcion] = (itemsMap[it.descripcion] || 0) + (it.qty || 0)
        })
        const topVendidos = Object.entries(itemsMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5)

        return {
            ventasHist, radialData, stockMarcas, cuotasVencidas, topVendidos,
            totalVentas: normalizedVentas.reduce((s, v) => s + v.total, 0),
            totalUtilidad: normalizedVentas.reduce((s, v) => s + (v.total - (v.costo_total || 0)), 0),
            totalCobrar: cobrar.reduce((s, c) => s + (c.monto - (c.monto_cobrado || 0)), 0),
            stockTotal: articulos.reduce((s, a) => s + (a.stock || 0), 0),
            agotados: articulos.filter(a => (a.stock || 0) === 0).length
        }
    }

    if (!canSeeDashboard) {
        return <Navigate to="/facturacion" replace />
    }

    if (!data) return <div className="h-screen flex items-center justify-center bg-white font-bebas text-primary text-3xl animate-pulse tracking-widest">CARGANDO...</div>

    const KPI = ({ label, value, color, icon, onClick, hidden = false }) => {
        if (hidden) return null
        return (
            <div className={`panel flex items-center justify-between border-l-4 transition-none shadow-[var(--win-shadow)] ${onClick ? 'cursor-pointer active:translate-x-0.5 active:translate-y-0.5' : ''}`}
                style={{ borderColor: color }}
                onClick={onClick}>
                <div className="flex-1">
                    <div className="text-[10px] text-[var(--text2)] uppercase tracking-widest mb-1 font-black">{label}</div>
                    <div className="text-2xl font-black text-[var(--text-main)] font-mono">{value}</div>
                </div>
                <div className="text-3xl opacity-20 filter grayscale">{icon}</div>
            </div>
        )
    }

    return (
        <div className="space-y-4 pb-24 md:pb-8 pr-2 relative min-h-0">
            {/* Cabecera simplificada */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[var(--surface2)] p-4 border-b-2 border-[var(--teal)] shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-[var(--text-main)] uppercase tracking-tighter flex items-center gap-2">
                        <span className="material-icons-round text-[var(--teal)]">dashboard</span>
                        PANEL DE CONTROL GENERAL
                    </h1>
                    <p className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest mt-0.5">
                        Visualización de rendimiento y estadísticas en tiempo real
                    </p>
                </div>
            </div>

            {/* ALERTAS DE COBRANZA */}
            {data.cuotasVencidas?.length > 0 && (
                <div className="bg-red-600 text-white p-5 shadow-lg flex flex-col md:flex-row items-center justify-between border-l-[10px] border-red-900 border-t border-r border-b border-red-800 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center animate-pulse">
                            <span className="material-icons-round text-3xl">notification_important</span>
                        </div>
                        <div>
                            <p className="font-black text-[10px] uppercase tracking-widest text-red-200">Alerta: Compromisos de Pago</p>
                            <p className="text-[15px] font-black uppercase tracking-tighter">
                                Hay {data.cuotasVencidas.length} cuotas de crédito vencidas el día de hoy
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/cobrar')}
                        className="bg-white text-red-600 px-6 py-2.5 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-red-50 transition-all shadow-xl active:scale-95 flex items-center gap-2"
                    >
                        <span className="material-icons-round text-sm">payments</span>
                        Gestionar Cobros
                    </button>
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                <KPI label="Utilidad Estimada" value={canSeeFinances ? fmtUSD(data.totalUtilidad) : 'RESTRICTED'} color={COLORS.green} icon="📈" hidden={!canSeeFinances} />
                <KPI label="Total Ventas" value={fmtUSD(data.totalVentas)} color={COLORS.primaryLight} icon="💰" onClick={canSeeFinances ? () => navigate('/reportes') : () => navigate('/facturacion')} />
                <KPI label="Por Cobrar" value={canSeeFinances ? fmtUSD(data.totalCobrar) : 'NO DISPONIBLE'} color={COLORS.primary} icon="⏳" onClick={canSeeFinances ? () => navigate('/cobrar') : null} />
                <KPI label="Stock Total" value={data.stockTotal} color={COLORS.primaryDark} icon="📦" onClick={() => navigate('/inventario')} />
                <KPI label="Agotados" value={data.agotados} color={COLORS.primary} icon="🚫" onClick={() => navigate('/inventario?filter=agotados')} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                {/* VENTAS VS UNIDADES */}
                <div className="lg:col-span-8 panel min-h-[300px]">
                    <div className="panel-title text-sm uppercase flex justify-between">
                        <span>Rendimiento (15 Días)</span>
                        <div className="flex gap-3 text-[9px] font-bold">
                            <span style={{ color: COLORS.green }}>● GANANCIA $</span>
                            <span style={{ color: COLORS.primary }}>● VENTAS $</span>
                            <span style={{ color: COLORS.text }} className="opacity-40">● UNIDADES</span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <ComposedChart data={data.ventasHist}>
                            <defs>
                                <linearGradient id="gradRojo" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.2} />
                                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradVerde" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.2} />
                                    <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" fontSize={10} stroke={COLORS.muted} axisLine={false} tickLine={false} />
                            <YAxis fontSize={10} stroke={COLORS.muted} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="total" name="Venta $" stroke={COLORS.primaryLight} fill="url(#gradRojo)" strokeWidth={2} />
                            <Area type="monotone" dataKey="profit" name="Ganancia $" stroke={COLORS.green} fill="url(#gradVerde)" strokeWidth={2} />
                            <Line type="monotone" dataKey="qty" name="Unidades" stroke={COLORS.text} strokeWidth={1} dot={{ r: 3, fill: COLORS.text }} opacity={0.3} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                {/* MIX DE PAGOS */}
                <div className="lg:col-span-4 panel min-h-[300px]">
                    <div className="panel-title text-sm uppercase text-center justify-center">Mezcla de Ingresos</div>
                    <ResponsiveContainer width="100%" height={250}>
                        <RadialBarChart innerRadius="30%" outerRadius="100%" data={data.radialData} startAngle={180} endAngle={0}>
                            <RadialBar background={{ fill: COLORS.g3 }} clockWise dataKey="value" />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend iconSize={8} wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', paddingTop: '20px' }} />
                        </RadialBarChart>
                    </ResponsiveContainer>
                </div>

                {/* BALANCE SEMANAL */}
                <div className="lg:col-span-6 panel min-h-[300px]">
                    <div className="panel-title text-sm uppercase">Balance (Entradas vs Salidas)</div>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={data.flujoData}>
                            <XAxis dataKey="name" fontSize={10} stroke={COLORS.muted} axisLine={false} tickLine={false} />
                            <YAxis fontSize={10} stroke={COLORS.muted} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="ingresos" name="Entradas" fill={COLORS.green} radius={[4, 4, 0, 0]} barSize={15} />
                            <Bar dataKey="egresos" name="Salidas" fill={COLORS.muted} radius={[4, 4, 0, 0]} barSize={15} opacity={0.3} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* CONCENTRACIÓN STOCK */}
                <div className="lg:col-span-6 panel min-h-[300px]">
                    <div className="panel-title text-sm uppercase">Concentración de Stock</div>
                    <div className="space-y-4 mt-2">
                        {data.stockMarcas.map((m, i) => {
                            const percent = (m.value / data.stockTotal * 100) || 0
                            return (
                                <div key={i}>
                                    <div className="flex justify-between text-[10px] mb-1">
                                        <span className="font-bold text-[var(--text2)] uppercase">{m.name}</span>
                                        <span className="font-mono text-[var(--text-main)]">{m.value} UND</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[var(--surface2)] rounded-none overflow-hidden">
                                        <div className="h-full bg-[var(--teal)] transition-none rounded-none" style={{ width: `${percent}%` }} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* RANKING FINAL */}
                <div className="lg:col-span-12 panel transition-none shadow-[var(--win-shadow)]">
                    <div className="panel-title text-sm uppercase flex items-center gap-2">
                        <span className="material-icons-round text-base text-[var(--teal)]">trending_up</span>
                        PRODUCTOS MÁS VENDIDOS
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-2">
                        {data.topVendidos.map((p, i) => (
                            <div key={i} className="bg-[var(--surfaceDark)] border border-[var(--border-var)] p-4 rounded-none text-center group hover:bg-[var(--surface2)] hover:border-[var(--teal)] transition-none shadow-[var(--win-shadow)] cursor-default">
                                <div className="text-[var(--teal)] font-black text-2xl mb-1 opacity-20 group-hover:opacity-100 transition-none font-mono">0{i + 1}</div>
                                <div className="text-[11px] font-bold uppercase truncate mb-1 text-[var(--text-main)] font-sans">{p.name}</div>
                                <div className="font-mono text-[10px] text-[var(--text2)] font-bold">{p.value} UNIDADES</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
