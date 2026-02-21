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
    rojo: '#dc2626',
    rojoDark: '#991b1b',
    rojoBright: '#ef4444',
    bg: '#0a0a0a',
    g1: '#111111',
    g2: '#1a1a1a',
    g3: '#222222',
    borde: '#333333',
    muted: '#777777',
    white: '#e5e5e5'
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-g3 border border-borde p-3 rounded-lg shadow-2xl">
            <p className="text-muted text-[10px] uppercase tracking-widest mb-1 font-bold">{label}</p>
            {payload.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                    <p className="text-white font-mono2 text-xs">
                        <span className="opacity-60">{p.name}:</span> {typeof p.value === 'number' && (p.name.includes('$') || p.name.includes('Venta')) ? fmtUSD(p.value) : p.value}
                    </p>
                </div>
            ))}
        </div>
    )
}

export default function Dashboard() {
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
        const ventasHist = last15Days.map(date => ({
            name: date.split('-')[2],
            total: ventas.filter(v => new Date(v.fecha).toISOString().split('T')[0] === date).reduce((s, v) => s + v.total, 0),
            qty: ventaItems.filter(i => {
                const v = ventas.find(vx => vx.id === i.venta_id)
                return v && new Date(v.fecha).toISOString().split('T')[0] === date
            }).reduce((s, it) => s + (it.qty || 0), 0)
        }))

        // 2. Composición de Ingresos
        const radialData = [
            { name: 'CONTADO', value: ventas.filter(v => v.tipo_pago === 'CONTADO').reduce((s, v) => s + v.total, 0), fill: COLORS.rojoBright },
            { name: 'CRÉDITO', value: ventas.filter(v => v.tipo_pago === 'CREDITO').reduce((s, v) => s + v.total, 0), fill: COLORS.rojo },
            { name: 'TRANSF.', value: ventas.filter(v => v.tipo_pago === 'TRANSF.').reduce((s, v) => s + v.total, 0), fill: COLORS.rojoDark }
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

        return {
            ventasHist, radialData, stockMarcas, flujoData,
            totalVentas: ventas.reduce((s, v) => s + v.total, 0),
            totalCobrar: cobrar.reduce((s, c) => s + c.monto, 0),
            stockTotal: articulos.reduce((s, a) => s + (a.stock || 0), 0),
            agotados: articulos.filter(a => (a.stock || 0) === 0).length,
            topVendidos: Object.entries(ventaItems.reduce((acc, i) => { acc[i.descripcion] = (acc[i.descripcion] || 0) + i.qty; return acc }, {}))
                .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5)
        }
    }, [])

    if (!data) return <div className="h-screen flex items-center justify-center bg-negro font-bebas text-rojo-bright text-3xl animate-pulse tracking-widest">CARGANDO...</div>

    const KPI = ({ label, value, color, icon }) => (
        <div className="panel flex items-center justify-between border-l-2" style={{ borderColor: color }}>
            <div>
                <div className="text-[10px] text-muted uppercase tracking-widest mb-1 font-bold">{label}</div>
                <div className="font-bebas text-2xl text-white tracking-wider">{value}</div>
            </div>
            <div className="text-2xl opacity-10">{icon}</div>
        </div>
    )

    return (
        <div className="space-y-4 pb-10">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <KPI label="Total Ventas" value={fmtUSD(data.totalVentas)} color={COLORS.rojoBright} icon="💰" />
                <KPI label="Por Cobrar" value={fmtUSD(data.totalCobrar)} color={COLORS.rojo} icon="⏳" />
                <KPI label="Stock Total" value={data.stockTotal} color={COLORS.rojoDark} icon="📦" />
                <KPI label="Agotados" value={data.agotados} color={COLORS.rojo} icon="🚫" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                {/* VENTAS VS UNIDADES */}
                <div className="lg:col-span-8 panel min-h-[300px]">
                    <div className="panel-title text-sm uppercase flex justify-between">
                        <span>Rendimiento (15 Días)</span>
                        <div className="flex gap-3 text-[9px] font-bold">
                            <span className="text-rojo-bright">● VENTAS $</span>
                            <span className="text-white opacity-40">● UNIDADES</span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <ComposedChart data={data.ventasHist}>
                            <defs>
                                <linearGradient id="gradRojo" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.rojo} stopOpacity={0.2} />
                                    <stop offset="95%" stopColor={COLORS.rojo} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" fontSize={10} stroke={COLORS.muted} axisLine={false} tickLine={false} />
                            <YAxis fontSize={10} stroke={COLORS.muted} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="total" name="Venta $" stroke={COLORS.rojoBright} fill="url(#gradRojo)" strokeWidth={2} />
                            <Line type="monotone" dataKey="qty" name="Unidades" stroke={COLORS.white} strokeWidth={1} dot={{ r: 3, fill: COLORS.white }} opacity={0.3} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                {/* MIX DE PAGOS */}
                <div className="lg:col-span-4 panel min-h-[300px]">
                    <div className="panel-title text-sm uppercase text-center">Mezcla de Ingresos</div>
                    <ResponsiveContainer width="100%" height={250}>
                        <RadialBarChart innerRadius="30%" outerRadius="100%" data={data.radialData} startAngle={180} endAngle={0}>
                            <RadialBar background={{ fill: COLORS.g3 }} clockWise dataKey="value" />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend iconSize={8} wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }} />
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
                            <Bar dataKey="ingresos" name="Entradas" fill={COLORS.rojoBright} radius={[2, 2, 0, 0]} barSize={15} />
                            <Bar dataKey="egresos" name="Salidas" fill={COLORS.muted} radius={[2, 2, 0, 0]} barSize={15} />
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
                                        <span className="font-bold text-muted uppercase">{m.name}</span>
                                        <span className="font-mono2 text-white">{m.value} UND</span>
                                    </div>
                                    <div className="h-1 w-full bg-g3 rounded-full overflow-hidden">
                                        <div className="h-full bg-rojo transition-all duration-1000" style={{ width: `${percent}%` }} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* RANKING FINAL */}
                <div className="lg:col-span-12 panel">
                    <div className="panel-title text-sm uppercase">Ranking de Productos (Más Vendidos)</div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 py-2">
                        {data.topVendidos.map((p, i) => (
                            <div key={i} className="bg-g3/30 border border-borde p-3 rounded-lg text-center">
                                <div className="text-rojo-bright font-bebas text-2xl mb-1">#{i + 1}</div>
                                <div className="text-[10px] font-bold text-white uppercase truncate mb-1">{p.name}</div>
                                <div className="font-mono2 text-xs text-muted">{p.value} VENDIDOS</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
