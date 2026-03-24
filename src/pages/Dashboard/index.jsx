import { useState, useEffect, useMemo } from 'react'
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
    primary: '#F97316', // Orange
    primaryDark: '#01152a', // Deep Blue
    primaryLight: '#326691', // Tech Blue
    bg: '#F8F9FB',
    g1: '#FFFFFF',
    g2: '#F1F5F9',
    g3: '#E2E8F0',
    borde: '#E2E8F0',
    muted: '#64748B',
    text: '#0F172A',
    green: '#10B981',
    amber: '#FEF3C7',
    red: '#EF4444'
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-white border border-slate-200 p-3 rounded-none shadow-xl">
            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-1 font-black">{label}</p>
            {payload.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                    <p style={{ color: COLORS.text }} className="font-mono text-xs font-black">
                        <span className="opacity-60">{p.name}:</span> {typeof p.value === 'number' && (p.name.includes('$') || p.name.includes('Venta')) ? fmtUSD(p.value) : p.value}
                    </p>
                </div>
            ))}
        </div>
    )
}

function calculateStats(ventas, articulos, ventaItems, cobrar, cuotas) {
    const normalizedVentas = ventas.map(v => ({
        ...v,
        total: v.total || v.total_usd,
        fecha: v.fecha || v.fecha_apertura,
        estado: v.estado
    }))

    const hoy = new Date().toISOString().split('T')[0]
    const cuotasVencidas = cuotas.filter(c => c.fecha_vencimiento <= hoy)

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
        const dailyVentaIds = dayVentas.map(x => x.id)
        const dayItems = ventaItems.filter(it => dailyVentaIds.includes(it.venta_id))
        const totalCosto = dayItems.reduce((s, it) => s + ((it.precio_compra || 0) * (it.qty || 0)), 0)
        const totalQty = dayItems.reduce((s, it) => s + (it.qty || 0), 0)

        return {
            name: date.split('-').slice(1).reverse().join('/'),
            total: totalVenta,
            profit: totalVenta > 0 ? (totalVenta - totalCosto) : 0,
            qty: totalQty
        }
    })

    const acc = {}
    normalizedVentas.filter(v => v.estado !== 'ANULADA').forEach(v => {
        if (v.pagos && v.pagos.length > 0) {
            v.pagos.forEach(p => {
                const m = p.metodo || 'OTRO'
                acc[m] = (acc[m] || 0) + (p.monto || 0)
            })
        } else {
            const metodos = [...new Set((v.tipo_pago || 'OTRO').split(',').map(m => m.trim()).filter(Boolean))]
            metodos.forEach(m => { acc[m] = (acc[m] || 0) + v.total })
        }
    })
    
    const radialData = Object.entries(acc).map(([name, value]) => ({
        name, value, fill: {
            'EFECTIVO_USD': '#f97316',
            'PAGO_MOVIL': '#14b8a6',
            'ZELLE': '#8b5cf6',
            'PUNTO_VENTA': '#3b82f6',
            'EFECTIVO_BS': '#eab308'
        }[name] || '#64748b'
    })).sort((a,b) => b.value - a.value).slice(0, 5)

    const stockMarcaMap = {}
    articulos.forEach(a => {
        const m = a.marca || 'GENERICO'
        stockMarcaMap[m] = (stockMarcaMap[m] || 0) + (a.stock || 0)
    })
    const stockMarcas = Object.entries(stockMarcaMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5)

    const itemsMap = {}
    ventaItems.forEach(it => { itemsMap[it.descripcion] = (itemsMap[it.descripcion] || 0) + (it.qty || 0) })
    const topVendidos = Object.entries(itemsMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5)

    return {
        ventasHist, radialData, stockMarcas, cuotasVencidas, topVendidos,
        totalVentas: normalizedVentas.reduce((s, v) => s + v.total, 0),
        totalUtilidad: normalizedVentas.reduce((s, v) => s + (v.total - (v.costo_total || 0)), 0),
        totalCobrar: cobrar.reduce((s, c) => s + (c.monto - (c.monto_cobrado || 0)), 0),
        stockTotal: articulos.reduce((s, a) => s + (a.stock || 0), 0),
        agotados: articulos.filter(a => (a.stock || 0) === 0).length
    }
}

export default function Dashboard() {
    const navigate = useNavigate()
    const { check } = usePermiso()
    const canSeeFinances = check('MENU_REPORTES')
    const canSeeDashboard = check('MENU_DASHBOARD')

    const data = useLiveQuery(async () => {
        const ventas = await db.ventas.toArray()
        const articulos = await db.articulos.toArray()
        const ventaItems = await db.venta_items.toArray()
        const cobrar = await db.ctas_cobrar.where('estado').equals('PENDIENTE').toArray()
        const cuotas = await db.cuotas_credito.where('estado').equals('PENDIENTE').toArray()
        return calculateStats(ventas, articulos, ventaItems, cobrar, cuotas)
    }, [])

    if (!canSeeDashboard) return <Navigate to="/facturacion" replace />
    if (!data) return <div className="h-screen flex items-center justify-center bg-white font-bebas text-primary text-3xl animate-pulse tracking-widest text-[#0f172a]">CARGANDO...</div>

    const KPI = ({ label, value, color, icon, onClick, hidden = false }) => {
        if (hidden) return null
        return (
            <div className={`p-5 transition-all shadow-xl rounded-xl relative overflow-hidden group border-b-4 border-black/20 ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
                style={{ backgroundColor: color }}
                onClick={onClick}>
                <div className="relative z-10">
                    <div className="text-[9px] uppercase tracking-[0.2em] mb-1 font-black text-white/70">{label}</div>
                    <div className="text-2xl font-black font-mono tracking-tighter text-white drop-shadow-md">{value}</div>
                </div>
                <div className="absolute right-2 bottom-2 text-4xl opacity-20 brightness-0 invert transition-transform group-hover:scale-110">{icon}</div>
            </div>
        )
    }

    return (
        <div className="space-y-4 pb-24 md:pb-8 pr-2 relative min-h-0">
            {/* Cabecera */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 border-b-2 border-slate-900 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <span className="material-icons-round text-orange-500">dashboard</span>
                        PANEL DE CONTROL GENERAL
                    </h1>
                </div>
            </div>

            {/* ALERTAS */}
            {data.cuotasVencidas?.length > 0 && (
                <div className="bg-red-600 text-white p-5 shadow-lg flex flex-col md:flex-row items-center justify-between border-l-[10px] border-red-900 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <span className="material-icons-round text-3xl animate-pulse text-red-200">notification_important</span>
                        <div>
                            <p className="font-black text-[10px] uppercase tracking-widest text-red-200">Alertas de Cobranza</p>
                            <p className="text-[15px] font-black uppercase tracking-tighter">Hay {data.cuotasVencidas.length} pagos vencidos actualmente</p>
                        </div>
                    </div>
                </div>
            )}

            {/* KPIs con RELLENO SOLIDO */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <KPI label="Utilidad Est." value={canSeeFinances ? fmtUSD(data.totalUtilidad) : 'RESTRICTED'} color={COLORS.green} icon="📈" hidden={!canSeeFinances} />
                <KPI label="Total Ventas" value={fmtUSD(data.totalVentas)} color={COLORS.primaryLight} icon="💰" onClick={canSeeFinances ? () => navigate('/reportes') : () => navigate('/facturacion')} />
                <KPI label="Por Cobrar" value={fmtUSD(data.totalCobrar)} color={COLORS.primary} icon="⏳" onClick={() => navigate('/cobrar')} />
                <KPI label="Stock Total" value={data.stockTotal} color={COLORS.primaryDark} icon="📦" onClick={() => navigate('/inventario')} />
                <KPI label="Agotados" value={data.agotados} color={COLORS.red} icon="🚫" onClick={() => navigate('/inventario?filter=agotados')} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8 panel shadow-lg">
                    <div className="panel-title text-sm uppercase">Rendimiento Operativo (15 Días)</div>
                    <ResponsiveContainer width="100%" height={250}>
                        <ComposedChart data={data.ventasHist}>
                            <XAxis dataKey="name" fontSize={10} stroke="#94a3b8" axisLine={false} tickLine={false} />
                            <YAxis fontSize={10} stroke="#94a3b8" axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="total" name="Ventas $" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.1} strokeWidth={2} />
                            <Line type="monotone" dataKey="profit" name="Utilidad $" stroke={COLORS.green} strokeWidth={2} dot={{ r: 4, fill: COLORS.green }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                <div className="lg:col-span-4 panel shadow-lg">
                    <div className="panel-title text-sm uppercase text-center justify-center">Mezcla de Ingresos</div>
                    <ResponsiveContainer width="100%" height={250}>
                        <RadialBarChart innerRadius="30%" outerRadius="100%" data={data.radialData} startAngle={180} endAngle={0}>
                            <RadialBar background={{ fill: '#f1f5f9' }} clockWise dataKey="value" />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', paddingTop: '20px' }} />
                            <Tooltip content={<CustomTooltip />} />
                        </RadialBarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            
            {/* TOP VENDIDOS */}
            <div className="panel shadow-lg">
                 <div className="panel-title text-sm uppercase flex items-center gap-2">
                    <span className="material-icons-round text-orange-500">local_fire_department</span>
                    TOP 5 PRODUCTOS MÁS MOVIDOS
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mt-4">
                    {data.topVendidos.map((p, i) => (
                        <div key={i} className="bg-slate-50 border-l-4 border-orange-500 p-4 shadow-sm hover:bg-white transition-all">
                             <div className="text-[9px] font-black text-slate-400 uppercase mb-1">POSICIÓN {i + 1}</div>
                             <div className="text-[11px] font-black uppercase text-slate-900 truncate">{p.name}</div>
                             <div className="text-xl font-mono font-black text-orange-600">{p.value} <small className="text-[8px] opacity-70">UDS</small></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
