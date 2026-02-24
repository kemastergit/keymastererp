import { fmtUSD, fmtBS } from '../../utils/format'
import ClienteSelector from '../../components/UI/ClienteSelector'

export default function PanelPago({
    cart, cartSubtotal, cartIva, cartIgtf, cartTotal, ivaEnabled, setIvaEnabled,
    tipoPago, setTipoPago, payments, paymentsTotal, setShowPaymentModal,
    removePayment, tasa, vencFact, setVencFact, procesarCotizacion, clearCart,
    procesarNota, clienteFact, setClienteFact
}) {
    return (
        <div className="col-pago bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col h-full overflow-y-auto custom-scroll relative min-h-0" style={{ flex: 1, minWidth: '280px', maxWidth: '320px' }}>

            {/* SECCIÓN CLIENTE */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <label className="!text-[9px] !font-black !text-slate-400 !uppercase !tracking-widest flex items-center gap-1 mb-2">
                    <span className="material-icons-round text-xs">person</span>
                    Cliente
                </label>
                <ClienteSelector value={clienteFact} onChange={setClienteFact} />
            </div>

            <div className="p-4 flex flex-col gap-4 flex-1">

                {/* TOTALES */}
                <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-lg shrink-0">
                    <div className="space-y-2 mb-3">
                        <div className="flex justify-between items-center opacity-70">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Subtotal</span>
                            <span className="text-xs font-mono">{fmtUSD(cartSubtotal())}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                                IVA (16%)
                                <button onClick={() => setIvaEnabled(!ivaEnabled)} className={`w-8 h-4 rounded-full relative transition-all ${ivaEnabled ? 'bg-primary' : 'bg-slate-700'}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${ivaEnabled ? 'left-4.5' : 'left-0.5'}`}></div>
                                </button>
                            </span>
                            <span className="text-xs font-mono text-primary">{fmtUSD(cartIva())}</span>
                        </div>
                        {cartIgtf() > 0 && (
                            <div className="flex justify-between items-center animate-in fade-in slide-in-from-right-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">IGTF (3%)</span>
                                <span className="text-xs font-mono text-emerald-400">{fmtUSD(cartIgtf())}</span>
                            </div>
                        )}
                    </div>

                    <div className="pt-3 border-t border-slate-700/50">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-1">Total Final</span>
                        <div className="flex justify-between items-end">
                            <div className="text-3xl font-mono font-black text-primary leading-none">
                                {fmtUSD(cartTotal())}
                            </div>
                            <div className="text-[11px] font-mono font-bold text-slate-400 opacity-70">
                                {fmtBS(cartTotal(), tasa)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* PAGOS REALIZADOS */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pagos</span>
                        <button onClick={() => setShowPaymentModal(true)} className="text-primary text-[10px] font-black uppercase hover:underline flex items-center">
                            <span className="material-icons-round text-[12px] mr-0.5">add</span> Agregar
                        </button>
                    </div>

                    <div className="space-y-2 flex-1 overflow-y-auto min-h-[50px] custom-scroll">
                        {payments.length === 0
                            ? <div className="text-[10px] text-slate-400 italic text-center py-3 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">Pendiente</div>
                            : payments.map(p => (
                                <div key={p.id} className="flex items-center justify-between bg-white p-2 text-slate-600 rounded-xl border border-slate-100 shadow-sm">
                                    <div className="text-[9px] font-bold uppercase">{p.metodo.replace('_', ' ')}</div>
                                    <div className="flex items-center gap-2">
                                        <div className="font-mono text-[11px] font-black">{fmtUSD(p.monto)}</div>
                                        <button onClick={() => removePayment(p.id)} className="text-red-400 hover:text-red-600">
                                            <span className="material-icons-round text-[14px]">cancel</span>
                                        </button>
                                    </div>
                                </div>
                            ))
                        }
                    </div>

                    {paymentsTotal() > 0 && paymentsTotal() < cartTotal() - 0.01 && (
                        <div className="bg-amber-50 p-2 rounded-xl border border-amber-100 mt-2 shrink-0">
                            <div className="flex justify-between items-center text-amber-800">
                                <span className="text-[9px] font-black uppercase">Falta:</span>
                                <span className="font-mono text-[11px] font-black">{fmtUSD(cartTotal() - paymentsTotal())}</span>
                            </div>
                        </div>
                    )}

                    {paymentsTotal() > cartTotal() + 0.01 && (
                        <div className="bg-green-50 p-2 rounded-xl border border-green-100 mt-2 shrink-0">
                            <div className="flex justify-between items-center text-green-800 py-0.5">
                                <span className="text-[9px] font-black uppercase tracking-tighter">Vuelto $:</span>
                                <span className="font-mono text-[11px] font-black">{fmtUSD(paymentsTotal() - cartTotal())}</span>
                            </div>
                            <div className="flex justify-between items-center text-green-700 border-t border-green-200/50 pt-1 mt-1">
                                <span className="text-[9px] font-black uppercase tracking-tighter">Vuelto Bs:</span>
                                <span className="font-mono text-[11px] font-black">{fmtBS(paymentsTotal() - cartTotal(), tasa)}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* CONTADO / CREDITO */}
                <div className="shrink-0 space-y-3">
                    <div className="bg-slate-100 p-1 rounded-2xl flex gap-1 shadow-inner">
                        {['CONTADO', 'CREDITO'].map(t => (
                            <button key={t} onClick={() => setTipoPago(t)}
                                className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase rounded-xl transition-all
                ${tipoPago === t ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                {t}
                            </button>
                        ))}
                    </div>

                    {tipoPago === 'CREDITO' && (
                        <div className="animate-in slide-in-from-top-2">
                            <label className="text-[9px] font-black text-slate-400 mb-1 block uppercase">Vencimiento</label>
                            <input type="date" className="inp !py-1.5 !text-[11px] w-full bg-slate-50" value={vencFact} onChange={e => setVencFact(e.target.value)} />
                        </div>
                    )}

                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                        <button className="w-full rounded-xl py-2 flex items-center justify-center gap-2 font-bold uppercase text-[10px] tracking-widest bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 transition-all"
                            onClick={procesarCotizacion}>
                            <span className="material-icons-round text-[14px]">assignment</span>
                            <span>Solo Cotizar</span>
                        </button>

                        <div className="flex gap-2">
                            <button className="w-10 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors shrink-0" onClick={clearCart} title="Vaciar Carrito">
                                <span className="material-icons-round text-[16px]">delete_sweep</span>
                            </button>
                            <button
                                className={`flex-1 rounded-xl py-2 flex items-center justify-center gap-2 font-black uppercase text-[11px] tracking-widest shadow-lg transition-all
                  ${(tipoPago === 'CONTADO' && paymentsTotal() < cartTotal() - 0.01) ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/30'}`}
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
