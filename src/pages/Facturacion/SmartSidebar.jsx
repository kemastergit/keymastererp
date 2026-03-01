import { useState, useEffect } from 'react'
import { fmtUSD, fmtBS } from '../../utils/format'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'

export default function SmartSidebar({ tasa }) {
    const [time, setTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    return (
        <div className="flex flex-col h-full bg-[var(--surfaceDark)] border-l border-[var(--border-var)] overflow-hidden shadow-inner w-full">
            <div className="flex-1 overflow-y-auto custom-scroll p-3 space-y-4">

                {/* WIDGET: RELOJ Y TASA BCV */}
                <div className="bg-[var(--surface)] p-3 border border-[var(--border-var)] shadow-sm space-y-2">
                    <div className="flex items-center justify-between border-b border-[var(--border-var)] pb-2 mb-2">
                        <div className="text-[10px] font-black uppercase text-[var(--teal)] flex items-center gap-1">
                            <span className="material-icons-round text-xs">schedule</span>
                            HORA ACTUAL
                        </div>
                        <div className="font-mono text-xs font-black text-[var(--text-main)]">
                            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="text-[10px] font-black uppercase text-[var(--text2)]">TASA BCV</div>
                        <div className="font-mono text-xs font-black text-[var(--orange-var)] bg-[var(--orange-var)]/10 px-2 py-0.5 rounded">
                            {tasa.toFixed(2)} BS
                        </div>
                    </div>
                </div>

                {/* HERRAMIENTAS DE CÁLCULO */}
                <div className="space-y-2">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-[var(--text2)] opacity-50 px-1">Herramientas de Cálculo</h4>

                    {/* CONVERTIDOR */}
                    <div className="bg-[var(--surface)] p-3 border border-[var(--border-var)] shadow-sm group">
                        <CurrencyConverter tasa={tasa} />
                    </div>

                    {/* COSTO PONDERADO */}
                    <div className="bg-[var(--surface)] p-3 border border-[var(--border-var)] shadow-sm">
                        <CostCalculator />
                    </div>
                </div>

                {/* WIDGETS OPERATIVOS */}
                <div className="space-y-2">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-[var(--text2)] opacity-50 px-1">Widgets Operativos</h4>

                    {/* STOCK CRÍTICO */}
                    <div className="bg-[var(--surface)] p-3 border border-[var(--border-var)] shadow-sm">
                        <CriticalStock />
                    </div>
                </div>

                {/* ANALÍTICAS MOCK */}
                <div className="space-y-2">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-[var(--text2)] opacity-50 px-1">Mercado y Analíticas</h4>
                    <div className="bg-[var(--surface)] p-3 border border-[var(--border-var)] shadow-sm">
                        <div className="text-[9px] font-black uppercase text-[var(--text2)] mb-2 flex items-center gap-2">
                            <span className="material-icons-round text-xs text-[var(--teal)]">trending_up</span>
                            MONITOR DE PRECIOS
                        </div>
                        <div className="space-y-1.5 opacity-60">
                            {[
                                { n: 'Aceite 1L', p: '$1.85', c: '+2%' },
                                { n: 'Harina PAN', p: '$0.98', c: '-1%' }
                            ].map((i, idx) => (
                                <div key={idx} className="flex justify-between text-[10px] items-center">
                                    <span className="font-bold">{i.n}</span>
                                    <div className="flex gap-2">
                                        <span className="font-mono">{i.p}</span>
                                        <span className={i.c.includes('+') ? 'text-green-500' : 'text-red-500'}>{i.c}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>

            {/* FOOTER SMART PANEL */}
            <div className="p-2 bg-[var(--surfaceDark)] border-t border-[var(--border-var)] text-center">
                <p className="text-[8px] font-black uppercase tracking-tighter text-[var(--text2)] italic">SISTEMA INTELIGENTE ACTIVO</p>
            </div>
        </div>
    )
}

function CurrencyConverter({ tasa }) {
    const [val, setVal] = useState('')
    const [fromUSD, setFromUSD] = useState(true)

    const bs = fromUSD ? (parseFloat(val) || 0) * tasa : parseFloat(val) || 0
    const usd = fromUSD ? parseFloat(val) || 0 : (tasa > 0 ? (parseFloat(val) || 0) / tasa : 0)

    if (tasa <= 0) {
        return (
            <div className="space-y-2 p-2 bg-red-500/10 border border-red-500/20 text-center rounded">
                <p className="text-[8px] font-black text-red-500 uppercase">⚠️ TASA BCV NO CONFIGURADA</p>
                <p className="text-[7px] text-slate-500 font-bold">DEBE CARGAR LA TASA EN LA CABECERA</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <div className="text-[9px] font-black uppercase text-[var(--teal)] flex items-center justify-between">
                <span>CONVERTIDOR</span>
                <button onClick={() => { setFromUSD(!fromUSD); setVal('') }} className="material-icons-round text-[10px] hover:rotate-180 transition-all cursor-pointer">sync</button>
            </div>
            <div className="space-y-1">
                <div className="relative">
                    <input
                        className="inp !py-1 !px-2 text-[10px] font-mono font-black border-none bg-[var(--surface2)] shadow-inner w-full"
                        placeholder={fromUSD ? "$ USD" : "BS VES"}
                        value={val}
                        onChange={e => setVal(e.target.value)}
                        type="number"
                    />
                    <span className="absolute right-2 top-1.5 text-[8px] font-black opacity-40">{fromUSD ? 'USD' : 'VES'}</span>
                </div>
                <div className="p-1 px-2 bg-[var(--teal4)] border-l-2 border-[var(--teal)] flex justify-between items-center">
                    <span className="text-[8px] font-black uppercase opacity-60">{fromUSD ? 'A BOLÍVARES' : 'A DÓLARES'}</span>
                    <span className="font-mono text-[10px] font-black text-[var(--teal)]">
                        {fromUSD ? fmtBS(bs) : fmtUSD(usd)}
                    </span>
                </div>
            </div>
        </div>
    )
}

function CostCalculator() {
    const [stock, setStock] = useState('')
    const [costo, setCosto] = useState('')
    const [newQty, setNewQty] = useState('')
    const [newPrice, setNewPrice] = useState('')

    const s = parseFloat(stock) || 0
    const c = parseFloat(costo) || 0
    const nq = parseFloat(newQty) || 0
    const np = parseFloat(newPrice) || 0

    const totalQty = s + nq
    const weighted = totalQty > 0 ? ((s * c) + (nq * np)) / totalQty : 0

    return (
        <div className="space-y-2">
            <div className="text-[9px] font-black uppercase text-[var(--orange-var)]">COSTO PONDERADO</div>
            <div className="grid grid-cols-2 gap-1 px-1">
                <input className="inp !py-1 !px-1 text-[9px] bg-[var(--surface2)]" placeholder="Stock" type="number" value={stock} onChange={e => setStock(e.target.value)} />
                <input className="inp !py-1 !px-1 text-[9px] bg-[var(--surface2)]" placeholder="Costo" type="number" value={costo} onChange={e => setCosto(e.target.value)} />
                <input className="inp !py-1 !px-1 text-[9px] bg-[var(--surface2)]" placeholder="Entra" type="number" value={newQty} onChange={e => setNewQty(e.target.value)} />
                <input className="inp !py-1 !px-1 text-[9px] bg-[var(--surface2)]" placeholder="Costo N." type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
            </div>
            <div className="p-1 px-2 bg-[var(--orange-var)]/5 border-l-2 border-[var(--orange-var)] flex justify-between items-center">
                <span className="text-[8px] font-black uppercase opacity-60">NUEVO COSTO:</span>
                <span className="font-mono text-[10px] font-black text-[var(--orange-var)]">{fmtUSD(weighted)}</span>
            </div>
        </div>
    )
}

function CriticalStock() {
    const articles = useLiveQuery(() => db.articulos.filter(a => a.stock <= (a.stock_min || 5)).limit(5).toArray(), [], [])

    return (
        <div className="space-y-2">
            <div className="text-[9px] font-black uppercase text-[var(--red-var)] flex items-center gap-2">
                <span className="material-icons-round text-xs">warning</span>
                STOCK CRÍTICO
            </div>
            <div className="space-y-1">
                {articles?.map((a, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-[var(--red-var)]/5 p-1 rounded">
                        <span className="text-[9px] font-bold uppercase truncate max-w-[80px]">{a.descripcion}</span>
                        <span className="font-mono text-[10px] font-black text-[var(--red-var)] bg-[var(--red-var)]/10 px-1 rounded">{a.stock} {a.unidad}</span>
                    </div>
                ))}
                {articles?.length === 0 && <p className="text-[8px] opacity-40 italic text-center">Niveles óptimos</p>}
            </div>
        </div>
    )
}
