import { useState, useEffect } from 'react'
import { fmtUSD, fmtBS } from '../../utils/format'
import ClienteSelector from '../../components/UI/ClienteSelector'
import { supabase } from '../../lib/supabase'

export default function PanelPago({
    cart, cartSubtotal, cartIva, cartIgtf, cartTotal, ivaEnabled, setIvaEnabled,
    tipoPago, setTipoPago, payments, paymentsTotal, openModalWithMethod, setShowPaymentModal,
    removePayment, tasa, vencFact, setVencFact, procesarCotizacion, clearCart,
    procesarNota, clienteFact, setClienteFact
}) {
    const [deuda, setDeuda] = useState(0)

    useEffect(() => {
        if (!clienteFact) { setDeuda(0); return }

        const fetchDeuda = async () => {
            try {
                const { data, error } = await supabase
                    .from('cuentas_por_cobrar')
                    .select('monto_total, monto_cobrado')
                    .eq('cliente_nombre', clienteFact)
                    .neq('estado', 'COBRADA')
                    .neq('estado', 'ANULADA')

                if (!error && data) {
                    const total = data.reduce((acc, curr) => acc + (curr.monto_total - (curr.monto_cobrado || 0)), 0)
                    setDeuda(total)
                }
            } catch (e) { console.error("Error deuda:", e) }
        }
        fetchDeuda()
    }, [clienteFact])
    return (
        <div className="col-pago bg-[var(--surface)] border border-[var(--border-var)] flex flex-col lg:h-full lg:overflow-y-auto custom-scroll relative min-h-0 w-full lg:min-w-[280px] lg:max-w-[320px]">

            {/* SECCIÓN CLIENTE */}
            <div className="p-4 border-b border-[var(--border-var)] bg-[var(--surface2)] shrink-0">
                <label className="text-[9px] font-['IBM_Plex_Mono'] !font-bold text-[var(--teal)] uppercase tracking-wider flex items-center gap-1 mb-2">
                    <span className="material-icons-round text-[13px]">person</span>
                    Cliente
                </label>
                <ClienteSelector value={clienteFact} onChange={setClienteFact} />

                {deuda > 0.01 && (
                    <div className="mt-3 p-2 bg-orange-100 border-l-4 border-orange-500 animate-pulse">
                        <div className="flex items-center gap-2">
                            <span className="material-icons-round text-orange-600 text-sm">warning</span>
                            <span className="text-[10px] font-black text-orange-800 uppercase tracking-tighter">
                                DEUDA PENDIENTE: {fmtUSD(deuda)}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 flex flex-col gap-4 flex-1 bg-[var(--surface)]">

                {/* TOTALES */}
                <div className="bg-[var(--surface2)] border border-[var(--border-var)] p-4 text-[var(--text-main)] shrink-0">
                    <div className="space-y-2 mb-3">
                        <div className="flex justify-between items-center opacity-70">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text2)]">Subtotal</span>
                            <span className="text-xs font-mono">{fmtUSD(cartSubtotal())}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text2)] flex items-center gap-2">
                                IVA (16%)
                                <button onClick={() => setIvaEnabled(!ivaEnabled)} className={`w-8 h-4 relative transition-all border border-[var(--border-var)] ${ivaEnabled ? 'bg-[var(--teal)]' : 'bg-[var(--surfaceDark)]'}`}>
                                    <div className={`absolute top-0.5 w-[10px] h-[10px] bg-white transition-all ${ivaEnabled ? 'left-4' : 'left-0.5'}`}></div>
                                </button>
                            </span>
                            <span className="text-xs font-mono text-[var(--teal)]">{fmtUSD(cartIva())}</span>
                        </div>
                        {cartIgtf() > 0 && (
                            <div className="flex justify-between items-center animate-in fade-in slide-in-from-right-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--orange-var)]">IGTF (3%)</span>
                                <span className="text-xs font-mono text-[var(--orange-var)]">{fmtUSD(cartIgtf())}</span>
                            </div>
                        )}
                    </div>

                    <div className="pt-3 border-t border-[var(--border-var)]">
                        <span className="text-[10px] font-black text-[var(--teal)] uppercase tracking-widest block mb-1">Total Final</span>
                        <div className="flex justify-between items-end">
                            <div className="text-3xl font-mono font-black text-[var(--teal)] leading-none">
                                {fmtUSD(cartTotal())}
                            </div>
                            <div className="text-[11px] font-mono font-bold text-[var(--text2)] opacity-70">
                                {fmtBS(cartTotal(), tasa)}
                            </div>
                        </div>
                    </div>

                    {/* QUICK PAYMENT SELECTOR */}
                    <div className="grid grid-cols-4 gap-1 mt-3">
                        {[
                            { id: 'EFECTIVO_USD', label: 'EFECTIVO', icon: 'payments' },
                            { id: 'PAGO_MOVIL', label: 'P.MÓVIL', icon: 'account_balance' },
                            { id: 'ZELLE', label: 'ZELLE', icon: 'credit_card' },
                            { id: 'EFECTIVO_BS', label: 'DIVISAS', icon: 'savings' },
                        ].map(m => (
                            <button
                                key={m.id}
                                onClick={() => openModalWithMethod(m.id)}
                                className="flex flex-col items-center justify-center p-2 bg-[var(--surfaceDark)] border border-[var(--border-var)] hover:border-[var(--teal)] hover:bg-[var(--surface2)] text-[var(--text2)] hover:text-[var(--teal)] transition-all group cursor-pointer"
                            >
                                <span className="material-icons-round text-lg group-hover:scale-110 transition-transform">{m.icon}</span>
                                <span className="text-[7px] font-black uppercase tracking-tighter mt-1">{m.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* PAGOS REALIZADOS */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-[var(--teal)] uppercase tracking-widest">Pagos</span>
                        <button onClick={() => setShowPaymentModal(true)} className="text-[var(--teal)] text-[10px] font-black uppercase hover:underline flex items-center">
                            <span className="material-icons-round text-[12px] mr-0.5">add</span> Agregar
                        </button>
                    </div>

                    <div className="space-y-2 flex-1 overflow-y-auto custom-scroll min-h-[50px]">
                        {payments.length === 0
                            ? <div className="text-[10px] text-[var(--text2)] italic text-center py-3 border border-dashed border-[var(--border-var)] bg-[var(--surface2)]">Pendiente</div>
                            : payments.map(p => (
                                <div key={p.id} className="flex items-center justify-between bg-[var(--surface)] p-2 text-[var(--text-main)] border border-[var(--border-var)] shadow-sm">
                                    <div className="flex flex-col">
                                        <div className="text-[9px] font-bold uppercase">{p.metodo.replace(/_/g, ' ')}</div>
                                        {['EFECTIVO_BS', 'PAGO_MOVIL', 'PUNTO_VENTA'].includes(p.metodo) && (
                                            <div className="text-[8px] font-mono text-[var(--text2)]">Bs {p.montoBS?.toFixed(2) || '—'}</div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="font-mono text-[11px] font-black">{fmtUSD(p.monto)}</div>
                                        <button onClick={() => removePayment(p.id)} className="text-[var(--red-var)] hover:text-white hover:bg-[var(--red-var)] transition-colors w-5 h-5 flex justify-center items-center">
                                            <span className="material-icons-round text-[14px]">cancel</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        }
                    </div>

                    {paymentsTotal() > 0 && paymentsTotal() < cartTotal() - 0.01 && (
                        <div className="bg-[var(--orange-var)]/10 p-2 border border-[var(--orange-var)]/50 mt-2 shrink-0">
                            <div className="flex justify-between items-center text-[var(--orange-var)]">
                                <span className="text-[9px] font-black uppercase">Falta:</span>
                                <span className="font-mono text-[11px] font-black">{fmtUSD(cartTotal() - paymentsTotal())}</span>
                            </div>
                        </div>
                    )}

                    {paymentsTotal() > cartTotal() + 0.01 && (
                        <div className="bg-[var(--teal)]/10 p-2 border border-[var(--teal)]/50 mt-2 shrink-0">
                            <div className="flex justify-between items-center text-[var(--tealDark)] py-0.5">
                                <span className="text-[9px] font-black uppercase tracking-tighter">Vuelto $:</span>
                                <span className="font-mono text-[11px] font-black">{fmtUSD(paymentsTotal() - cartTotal())}</span>
                            </div>
                            <div className="flex justify-between items-center text-[var(--teal)] border-t border-[var(--teal)]/30 pt-1 mt-1">
                                <span className="text-[9px] font-black uppercase tracking-tighter">Vuelto Bs:</span>
                                <span className="font-mono text-[11px] font-black">{fmtBS(paymentsTotal() - cartTotal(), tasa)}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* CONTADO / CREDITO */}
                <div className="shrink-0 space-y-3">
                    <div className="bg-[var(--surface2)] p-1 border border-[var(--border-var)] flex gap-1">
                        {['CONTADO', 'CREDITO'].map(t => (
                            <button key={t} onClick={() => setTipoPago(t)}
                                className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase transition-all
                ${tipoPago === t ? 'bg-[var(--teal)] text-white shadow-[var(--win-shadow)]' : 'text-[var(--text2)] hover:text-[var(--teal)]'}`}>
                                {t}
                            </button>
                        ))}
                    </div>

                    {tipoPago === 'CREDITO' && (
                        <div className="animate-in slide-in-from-top-2">
                            <label className="text-[9px] font-black text-[var(--teal)] mb-1 block uppercase">Vencimiento</label>
                            <input type="date" className="inp !py-1.5 !text-[11px] w-full bg-[var(--surface)]" value={vencFact} onChange={e => setVencFact(e.target.value)} />
                        </div>
                    )}

                    <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border-var)]">
                        <button className="w-full py-2 flex items-center justify-center gap-2 font-bold uppercase text-[10px] tracking-widest bg-[var(--surface2)] border border-[var(--border-var)] text-[var(--text2)] hover:bg-[var(--surface)] transition-all"
                            onClick={procesarCotizacion}>
                            <span className="material-icons-round text-[14px]">assignment</span>
                            <span>Solo Cotizar</span>
                        </button>

                        <div className="flex gap-2">
                            <button className="w-10 bg-[var(--red-var)]/10 text-[var(--red-var)] hover:bg-[var(--red-var)] hover:text-white flex items-center justify-center transition-colors shrink-0" onClick={clearCart} title="Vaciar Carrito">
                                <span className="material-icons-round text-[16px]">delete_sweep</span>
                            </button>
                            <button
                                className={`flex-1 py-2 flex items-center justify-center gap-2 font-black uppercase text-[11px] tracking-widest transition-all shadow-[var(--win-shadow)]
                  ${(tipoPago === 'CONTADO' && paymentsTotal() < cartTotal() - 0.01) ? 'bg-[var(--surface2)] text-[var(--text2)] cursor-not-allowed shadow-none' : 'bg-[var(--teal)] hover:bg-[var(--tealDark)] text-white'}`}
                                onClick={procesarNota}>
                                <span className="material-icons-round text-[16px]">check_circle</span>
                                <span>Cerrar Venta</span>
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
