import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD, fmtBS } from '../../utils/format'
import { Decimal } from 'decimal.js'
import Modal from '../../components/UI/Modal'

export default function Comisiones() {
    const { currentUser, tasa, toast } = useStore()
    const isAdmin = currentUser?.rol === 'ADMIN'
    const isSupervisor = currentUser?.rol === 'SUPERVISOR'
    const canSeeAll = isAdmin || isSupervisor

    const [period, setPeriod] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    })

    const usuarios = useLiveQuery(() => db.usuarios.filter(u => u.activo).toArray(), [], [])

    const logs = useLiveQuery(async () => {
        let query = db.comisiones_log
            .where('period_year').equals(period.year)
            .and(x => x.period_month === period.month)

        if (!canSeeAll) {
            query = query.filter(x => x.user_id === currentUser.id)
        }

        const data = await query.toArray()

        // Unir con datos del usuario e invoice
        const enriched = []
        for (const log of data) {
            const user = await db.usuarios.get(log.user_id)
            const venta = await db.ventas.get(log.invoice_id)
            enriched.push({
                ...log,
                user_name: user?.nombre || 'Desconocido',
                invoice_nro: venta?.nro || 'S/N'
            })
        }
        return enriched
    }, [period, currentUser, canSeeAll], [])

    const stats = useMemo(() => {
        if (!logs) return { total: 0, pagado: 0, pendiente: 0, ventas: 0 }
        return logs.reduce((acc, curr) => {
            const monto = new Decimal(curr.commission_usd)
            acc.total = acc.total.plus(monto)
            if (curr.paid) {
                acc.pagado = acc.pagado.plus(monto)
            } else {
                acc.pendiente = acc.pendiente.plus(monto)
            }
            acc.ventas += 1
            return acc
        }, { total: new Decimal(0), pagado: new Decimal(0), pendiente: new Decimal(0), ventas: 0 })
    }, [logs])

    const handlePay = async (log) => {
        if (!isAdmin) return
        try {
            await db.comisiones_log.update(log.id, {
                paid: true,
                paid_at: new Date(),
                paid_by: currentUser.id
            })
            toast('✅ Comisión marcada como pagada', 'success')
        } catch (err) {
            toast('Error al procesar pago', 'error')
        }
    }

    return (
        <div className="space-y-6 pr-2 pb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-[var(--surface2)] p-6 border-b-4 border-[var(--teal)] shadow-[var(--win-shadow)]">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-[var(--text-main)] uppercase tracking-tighter">RENDIMIENTO Y COMISIONES</h1>
                    <p className="text-[var(--text2)] font-black text-[10px] md:text-xs uppercase tracking-widest mt-1 opacity-60">
                        {canSeeAll ? 'CONTROL DE INCENTIVOS POR VENTAS Y RENTABILIDAD' : 'MI REGISTRO PERSONAL DE COMISIONES Y LOGROS'}
                    </p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <select className="inp text-xs font-black uppercase p-3 bg-[var(--surfaceDark)] border-[var(--border-var)] shadow-inner flex-1 md:flex-none"
                        value={period.month} onChange={e => setPeriod({ ...period, month: parseInt(e.target.value) })}>
                        {Array.from({ length: 12 }).map((_, i) => (
                            <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('es', { month: 'long' }).toUpperCase()}</option>
                        ))}
                    </select>
                    <select className="inp text-xs font-black uppercase p-3 bg-[var(--surfaceDark)] border-[var(--border-var)] shadow-inner flex-1 md:flex-none"
                        value={period.year} onChange={e => setPeriod({ ...period, year: parseInt(e.target.value) })}>
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 px-1 md:px-0">
                <div className="panel p-3 md:p-4 bg-[var(--surface2)] border-l-4 border-[var(--teal)]">
                    <div className="text-[9px] font-black uppercase text-[var(--text2)]">Ventas</div>
                    <div className="text-xl md:text-2xl font-black text-[var(--text-main)]">{stats.ventas}</div>
                </div>
                <div className="panel p-3 md:p-4 bg-[var(--surface2)] border-l-4 border-[var(--orange-var)]">
                    <div className="text-[9px] font-black uppercase text-[var(--text2)]">Total Com.</div>
                    <div className="text-xl md:text-2xl font-black text-[var(--orange-var)]">{fmtUSD(stats.total.toNumber())}</div>
                </div>
                <div className="panel p-3 md:p-4 bg-[var(--surface2)] border-l-4 border-[var(--teal)]">
                    <div className="text-[9px] font-black uppercase text-[var(--text2)]">Pagado</div>
                    <div className="text-xl md:text-2xl font-black text-[var(--teal)]">{fmtUSD(stats.pagado.toNumber())}</div>
                </div>
                <div className="panel p-3 md:p-4 bg-[var(--surface2)] border-l-4 border-[var(--red-var)]">
                    <div className="text-[9px] font-black uppercase text-[var(--text2)]">Pendiente</div>
                    <div className="text-xl md:text-2xl font-black text-[var(--red-var)]">{fmtUSD(stats.pendiente.toNumber())}</div>
                </div>
            </div>

            {/* VISTA TABLET/DESKTOP */}
            <div className="hidden md:block panel p-0 overflow-hidden shadow-[var(--win-shadow)]">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-800 text-white">
                            {canSeeAll && <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Empleado</th>}
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Invoice #</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Venta ($)</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Utilidad ($)</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Comisión ($)</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Estado</th>
                            {isAdmin && <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">Acción</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {logs?.map(log => (
                            <tr key={log.id} className="hover:bg-[var(--surfaceDark)] transition-none text-[11px]">
                                {canSeeAll && <td className="font-black py-3 px-4">{log.user_name}</td>}
                                <td className="py-3 px-4 font-mono">{log.invoice_nro}</td>
                                <td className="py-3 px-4 font-mono">{fmtUSD(log.invoice_total_usd)}</td>
                                <td className="py-3 px-4 font-mono text-[var(--teal)]">{fmtUSD(log.profit_usd)}</td>
                                <td className="py-3 px-4 font-black text-[var(--orange-var)]">
                                    {fmtUSD(log.commission_usd)}
                                    <span className="text-[9px] opacity-40 ml-1">({log.percentage}%)</span>
                                </td>
                                <td className="py-3 px-4">
                                    <span className={`badge uppercase text-[9px] ${log.paid ? 'bg-[var(--teal)] text-white' : 'bg-[var(--red-var)] text-white'}`}>
                                        {log.paid ? 'PAGADA' : 'PENDIENTE'}
                                    </span>
                                </td>
                                {isAdmin && (
                                    <td className="py-3 px-4 text-right">
                                        {!log.paid && (
                                            <button className="btn btn-primary !py-1 !px-2 text-[9px]" onClick={() => handlePay(log)}>
                                                MARCAR PAGADA
                                            </button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* VISTA MÓVIL (CARDS) */}
            <div className="md:hidden space-y-3 px-1">
                {logs?.map(log => (
                    <div key={log.id} className="panel p-4 bg-[var(--surface2)] border border-[var(--border-var)] space-y-3">
                        <div className="flex justify-between items-start border-b border-[var(--border-var)] pb-2">
                            <div>
                                <div className="text-[10px] font-black text-[var(--teal)] uppercase tracking-tighter">#{log.invoice_nro}</div>
                                {canSeeAll && <div className="text-[11px] font-black text-[var(--text-main)] uppercase">{log.user_name}</div>}
                            </div>
                            <span className={`badge uppercase text-[9px] ${log.paid ? 'bg-[var(--teal)] text-white' : 'bg-[var(--red-var)] text-white'}`}>
                                {log.paid ? 'PAGADA' : 'PENDIENTE'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-[9px] font-black text-[var(--text2)] uppercase">Venta Total</div>
                                <div className="text-xs font-mono font-bold">{fmtUSD(log.invoice_total_usd)}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[9px] font-black text-[var(--text2)] uppercase">Comisión</div>
                                <div className="text-sm font-mono font-black text-[var(--orange-var)]">{fmtUSD(log.commission_usd)}</div>
                                <div className="text-[8px] opacity-40 font-black">{log.percentage}% s/ {log.commission_type === 'PROFIT_PCT' ? 'Utilidad' : 'Venta'}</div>
                            </div>
                        </div>

                        {isAdmin && !log.paid && (
                            <button className="btn btn-primary w-full py-3 text-[10px] font-black uppercase mt-2 shadow-[var(--win-shadow)]" onClick={() => handlePay(log)}>
                                <span className="material-icons-round text-sm">payments</span>
                                MARCAR COMO PAGADA
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {logs?.length === 0 && (
                <div className="py-12 text-center text-[var(--text2)] font-black uppercase text-xs opacity-40 bg-[var(--surface2)] border border-dashed border-[var(--border-var)]">
                    No se encontraron comisiones para este período
                </div>
            )}
        </div>
    )
}
