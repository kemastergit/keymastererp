import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { fmtUSD } from '../../utils/format'
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

import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
    const navigate = useNavigate()
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const data = useLiveQuery(async () => {
        const ventas = await db.ventas.toArray()
        const articulos = await db.articulos.toArray()
        const ventaItems = await db.venta_items.toArray()
        const cobrar = await db.ctas_cobrar.where('estado').equals('PENDIENTE').toArray()
        const cajaChica = await db.caja_chica.toArray()

        // 1. Histórico de Ventas (últimos 15 días)
        const last15Days = [...Array(15)].map((_, i) => {
            const d = new Date()
            d.setDate(d.getDate() - (14 - i))
            return d.toISOString().split('T')[0]
        })
        const ventasHist = last15Days.map(date => {
            const dayVentas = ventas.filter(v => new Date(v.fecha).toISOString().split('T')[0] === date && v.estado !== 'ANULADA')
            const totalVenta = dayVentas.reduce((s, v) => s + v.total, 0)

            // Calc daily profit based on items sold that day
            const dailyVentaIds = dayVentas.map(v => v.id)
            const dayItems = ventaItems.filter(i => dailyVentaIds.includes(i.venta_id))
            const totalCosto = dayItems.reduce((s, i) => s + ((i.costo || 0) * (i.qty || 0)), 0)

            return {
                name: date.split('-')[2],
                total: totalVenta,
                profit: totalVenta - totalCosto,
                qty: dayItems.reduce((s, it) => s + (it.qty || 0), 0)
            }
        })

        // 2. Composición de Ingresos
        const radialData = [
            { name: 'CONTADO', value: ventas.filter(v => v.tipo_pago === 'CONTADO').reduce((s, v) => s + v.total, 0), fill: COLORS.primaryLight },
            { name: 'CRÉDITO', value: ventas.filter(v => v.tipo_pago === 'CREDITO').reduce((s, v) => s + v.total, 0), fill: COLORS.primary },
            { name: 'TRANSF.', value: ventas.filter(v => v.tipo_pago === 'TRANSF.').reduce((s, v) => s + v.total, 0), fill: COLORS.primaryDark }
        ].filter(d => d.value > 0).sort((a, b) => b.value - a.value)

        // 3. Top Marcas
        const marcasMap = {}
        articulos.forEach(a => { marcasMap[a.marca || 'S/M'] = (marcasMap[a.marca || 'S/M'] || 0) + (a.stock || 0) })
        const stockMarcas = Object.entries(marcasMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6)

        // 4. Flujo de Caja
        const flujoData = last15Days.slice(-7).map(date => {
            const ing = cajaChica.filter(m => m.fecha === date && m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
            const egr = cajaChica.filter(m => m.fecha === date && m.tipo === 'EGRESO').reduce((s, m) => s + m.monto, 0)
            const vts = ventas.filter(v => new Date(v.fecha).toISOString().split('T')[0] === date).reduce((s, v) => s + v.total, 0)
            return { name: date.split('-')[2], ingresos: ing + vts, egresos: egr }
        })

        const totalVentas = ventas.reduce((s, v) => s + v.total, 0)
        const totalCosto = ventaItems.reduce((s, i) => s + ((i.costo || 0) * (i.qty || 0)), 0)
        const totalUtilidad = totalVentas - totalCosto

        return {
            ventasHist, radialData, stockMarcas, flujoData,
            totalVentas,
            totalUtilidad,
            totalCobrar: cobrar.reduce((s, c) => s + c.monto, 0),
            stockTotal: articulos.reduce((s, a) => s + (a.stock || 0), 0),
            agotados: articulos.filter(a => (a.stock || 0) === 0).length,
            topVendidos: Object.entries(ventaItems.reduce((acc, i) => { acc[i.descripcion] = (acc[i.descripcion] || 0) + i.qty; return acc }, {}))
                .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5)
        }
    }, [])

    if (!data) return <div className="h-screen flex items-center justify-center bg-white font-bebas text-primary text-3xl animate-pulse tracking-widest">CARGANDO...</div>

    const KPI = ({ label, value, color, icon, onClick }) => (
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

    return (
        <div className="space-y-4 pb-24 md:pb-8 pr-2 relative min-h-0">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                <KPI label="Utilidad Estimada" value={fmtUSD(data.totalUtilidad)} color={COLORS.green} icon="📈" />
                <KPI label="Total Ventas" value={fmtUSD(data.totalVentas)} color={COLORS.primaryLight} icon="💰" onClick={() => navigate('/reportes')} />
                <KPI label="Por Cobrar" value={fmtUSD(data.totalCobrar)} color={COLORS.primary} icon="⏳" onClick={() => navigate('/cobrar')} />
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
