import { useState } from 'react'
import { fmtUSD, fmtBS } from '../../utils/format'
import useStore from '../../store/useStore'
import Modal from '../../components/UI/Modal'

export default function PanelPago({
    tipoPago, setTipoPago, payments, paymentsTotal, openModalWithMethod, setShowPaymentModal,
    removePayment, handleEditPay, tasa, vencFact, setVencFact, procesarCotizacion, clearCart,
    procesarNota, currentUser, enviarCajaCentral,
    setShowNotasModal, notasPendientes, fetchNotasVendedores, loading,
    inicialCuotas, setInicialCuotas, metodoInicial, setMetodoInicial, 
    numCuotas, setNumCuotas, frecuenciaCuotas, setFrecuenciaCuotas,
    cartTotal, cartSubtotal 
}) {
    const { cartDescuento, setDescuento, descuentoReason, askAdmin } = useStore()
    const [showDescuentoModal, setShowDescuentoModal] = useState(false)
    const [tempDescuento, setTempDescuento] = useState('')
    const [tempMotivo, setTempMotivo] = useState('')

    return (
        <div className="bg-[#f8fafc] border border-slate-200 flex flex-col lg:h-full lg:overflow-y-auto custom-scroll relative min-h-0 w-full lg:min-w-[300px] lg:max-w-[340px]">

            {/* CARGAR NOTA VENDEDOR — Movido y Simplificado */}
            {(currentUser?.rol === 'ADMIN' || currentUser?.rol === 'CAJERO' || currentUser?.rol === 'SUPERVISOR') && (
                <div className="p-4 border-b border-slate-200 bg-white shadow-sm shrink-0">
                    <button
                        onClick={() => { fetchNotasVendedores(); setShowNotasModal(true) }}
                        className="w-full flex items-center justify-center gap-3 bg-white text-slate-600 border border-slate-200 border-dashed rounded-2xl py-3.5 text-[11px] font-bold uppercase tracking-widest hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-all group"
                    >
                        <span className="material-icons-round text-[20px] text-orange-500 group-hover:animate-bounce">cloud_download</span>
                        <span>Notas Pendientes</span>
                        {notasPendientes?.length > 0 && (
                            <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-1 font-black">
                                {notasPendientes.length}
                            </span>
                        )}
                    </button>
                </div>
            )}

            <div className="p-5 flex flex-col gap-5 flex-1 bg-[#f8fafc]">

                {/* El cuadro de totales ha sido movido al Header Global para ahorrar espacio */}

                {/* INTERFAZ CONDICIONAL */}
                {['CAJERO', 'ADMIN', 'SUPERVISOR'].includes(currentUser?.rol) ? (
                    <>
                        {/* PAGOS REALIZADOS */}
                        <div className="flex-1 min-h-[150px] flex flex-col mt-2">
                            <div className="flex items-center justify-between mb-3 px-1">
                                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest mt-1">
                                    Pagos Realizados
                                </span>
                                {/* Oculto en desktop porque ya estará el teclado fijo a la derecha */}
                                <button 
                                    onClick={() => setShowPaymentModal(true)} 
                                    className="lg:hidden bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-500 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center transition-all shadow-sm active:scale-95 cursor-pointer"
                                >
                                    <span className="material-icons-round text-[12px] mr-1">add_circle</span> 
                                    Añadir Pago
                                </button>
                                <button
                                    onClick={() => setShowDescuentoModal(true)}
                                    className="text-[9px] font-black uppercase tracking-widest bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1.5 cursor-pointer transition-all px-3 py-1.5 rounded-lg shadow-md hover:scale-105 active:scale-95"
                                >
                                    <span className="material-icons-round text-[13px]">local_offer</span>
                                    Descuento
                                </button>
                            </div>

                            <div className="space-y-2 flex-1 overflow-y-auto custom-scroll pr-1">
                                {payments.length === 0
                                    ? <div className="text-[11px] font-medium text-slate-400 italic text-center py-6 border border-dashed border-slate-300 rounded-xl bg-slate-50">Pendiente por asignar pagos</div>
                                    : payments.map(p => (
                                        <div
                                            key={p.id}
                                            onClick={() => handleEditPay(p)}
                                            className="flex items-center justify-between bg-white px-3 py-2.5 rounded-xl border border-slate-200 shadow-sm hover:border-[#F36E25] cursor-pointer group transition-all"
                                        >
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center group-hover:bg-orange-50 transition-colors">
                                                        <span className="material-icons-round text-slate-500 text-[12px] group-hover:text-[#F36E25]">receipt</span>
                                                    </span>
                                                    <div>
                                                        <div className="text-[10px] font-bold text-slate-700 uppercase tracking-widest group-hover:text-[#F36E25]">{p.metodo.replace(/_/g, ' ')}</div>
                                                        {['EFECTIVO_BS', 'PAGO_MOVIL', 'PUNTO_VENTA'].includes(p.metodo) && (
                                                            <div className="text-[9px] font-mono text-slate-400">Bs {p.montoBS?.toFixed(2) || '—'}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="font-mono text-[16px] font-black text-slate-800">{fmtUSD(p.monto)}</div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removePayment(p.id) }}
                                                    className="text-slate-300 hover:text-red-500 transition-colors flex justify-center items-center"
                                                >
                                                    <span className="material-icons-round text-[16px]">cancel</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>

                            {paymentsTotal() > 0 && paymentsTotal() < cartTotal() - 0.01 && (
                                <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 mt-3 shrink-0">
                                    <div className="flex justify-between items-center text-orange-600">
                                        <span className="text-[12px] font-bold uppercase tracking-widest">Falta:</span>
                                        <span className="font-mono text-[18px] font-black">{fmtUSD(cartTotal() - paymentsTotal())}</span>
                                    </div>
                                </div>
                            )}

                            {paymentsTotal() > cartTotal() + 0.01 && (
                                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 mt-3 shrink-0">
                                    <div className="flex justify-between items-center text-emerald-800 pb-1.5 border-b border-emerald-200/50">
                                        <span className="text-[12px] font-bold uppercase tracking-widest">Vuelto $:</span>
                                        <span className="font-mono text-[18px] font-black">{fmtUSD(paymentsTotal() - cartTotal())}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-emerald-600 pt-1.5">
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Vuelto Bs:</span>
                                        <span className="font-mono text-xs font-black">{fmtBS(paymentsTotal() - cartTotal(), tasa)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* CONTADO / CREDITO / CUOTAS */}
                        <div className="shrink-0 space-y-3 mt-4 pt-4 border-t border-slate-200">
                            <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                                {[
                                    { id: 'CONTADO', label: 'CONTADO' },
                                    { id: 'CREDITO', label: 'CRÉDITO' },
                                    { id: 'CREDITO_CUOTAS', label: 'CUOTAS' }
                                ].map(t => (
                                    <button key={t.id} onClick={() => setTipoPago(t.id)}
                                        className={`flex-1 py-2 text-[10px] font-extrabold uppercase rounded-lg transition-all
                                ${tipoPago === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            {tipoPago === 'CREDITO' && (
                                <div className="animate-in slide-in-from-top-2">
                                    <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase tracking-widest px-1">Vencimiento Crédito</label>
                                    <input type="date" className="inp bg-white border-slate-200 text-slate-700 w-full" value={vencFact} onChange={e => setVencFact(e.target.value)} />
                                </div>
                            )}

                            {tipoPago === 'CREDITO_CUOTAS' && (
                                <div className="animate-in slide-in-from-top-2 space-y-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                            <label className="text-[9px] font-bold text-slate-500 mb-1 block uppercase tracking-widest">Inicial ($)</label>
                                            <input type="number"
                                                className="inp !py-2 !px-3 font-mono text-right text-slate-800 font-bold bg-white"
                                                value={inicialCuotas || ''}
                                                onChange={e => setInicialCuotas(Number(e.target.value))}
                                                min="0"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[9px] font-bold text-slate-500 mb-1 block uppercase tracking-widest">Método</label>
                                            <select
                                                className="inp !py-2 !px-2 !text-[10px] bg-white font-bold text-slate-700"
                                                value={metodoInicial}
                                                onChange={e => setMetodoInicial(e.target.value)}
                                            >
                                                <option value="EFECTIVO_USD">Efectivo USD</option>
                                                <option value="EFECTIVO_BS">Efectivo BS</option>
                                                <option value="ZELLE">Zelle</option>
                                                <option value="PAGO_MOVIL">Pago Móvil</option>
                                                <option value="PUNTO_VENTA">T. Débito</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center bg-white rounded-lg p-2.5 border border-slate-200 shadow-sm">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Saldo a Diferir:</span>
                                        <span className="text-[13px] font-mono font-black text-red-500">{fmtUSD(Math.max(0, cartTotal() - inicialCuotas))}</span>
                                    </div>

                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                            <label className="text-[9px] font-bold text-slate-500 mb-1 block uppercase tracking-widest">Dividir</label>
                                            <select
                                                className="inp !py-2 !px-2 !text-[10px] bg-white font-bold text-slate-700"
                                                value={numCuotas}
                                                onChange={e => setNumCuotas(Number(e.target.value))}
                                            >
                                                <option value="1">1 Cuota</option>
                                                <option value="2">2 Cuotas</option>
                                                <option value="3">3 Cuotas</option>
                                                <option value="4">4 Cuotas</option>
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[9px] font-bold text-slate-500 mb-1 block uppercase tracking-widest">Frecuencia</label>
                                            <select
                                                className="inp !py-2 !px-2 !text-[10px] bg-white font-bold text-slate-700"
                                                value={frecuenciaCuotas}
                                                onChange={e => setFrecuenciaCuotas(e.target.value)}
                                            >
                                                <option value="SEMANAL">Semanal</option>
                                                <option value="QUINCENAL">Quincenal</option>
                                                <option value="MENSUAL">Mensual</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100 flex justify-between items-center text-emerald-800">
                                        <span className="text-[12px] font-bold uppercase tracking-widest block">A pagar por cuota:</span>
                                        <span className="text-[19px] font-mono font-black text-emerald-600">{fmtUSD(Math.max(0, (cartTotal() - inicialCuotas) / numCuotas))}</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-3 pt-3">
                                <button className="w-full py-3 flex items-center justify-center gap-2 font-bold uppercase text-[11px] tracking-widest bg-white rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:shadow-sm transition-all shadow-sm active:scale-[0.98]"
                                    onClick={procesarCotizacion}>
                                    <span className="material-icons-round text-[16px]">assignment</span>
                                    <span>Solo Cotizar</span>
                                </button>

                                <div className="flex gap-3">
                                    <button className="w-14 bg-white rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 flex items-center justify-center transition-all shadow-sm active:scale-[0.98] shrink-0" onClick={clearCart} title="Vaciar Carrito">
                                        <span className="material-icons-round text-[20px]">delete_sweep</span>
                                    </button>
                                    <button
                                        disabled={loading}
                                        className={`flex-1 py-4 rounded-xl flex items-center justify-center gap-2 font-black uppercase text-[15px] tracking-widest transition-all shadow-md active:scale-[0.98]
                                ${loading ? 'bg-slate-400 cursor-wait' : (tipoPago === 'CONTADO' && paymentsTotal() < cartTotal() - 0.01) ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none' : 'bg-[#009c85] hover:bg-[#007b69] text-white'}`}
                                        onClick={() => procesarNota(inicialCuotas, metodoInicial, numCuotas, frecuenciaCuotas)}>
                                        <span className={`material-icons-round text-[24px] ${loading ? 'animate-spin' : ''}`}>
                                            {loading ? 'sync' : 'save'}
                                        </span>
                                        <span>{loading ? 'Procesando...' : 'Finalizar Venta'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col gap-3 mt-4 flex-1 justify-end">
                        <div className="text-center p-4 border border-dashed border-emerald-300 bg-emerald-50 rounded-2xl mb-2">
                            <span className="material-icons-round text-emerald-500 text-4xl mb-2 block animate-bounce">storefront</span>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">El cliente pagará en la</p>
                            <p className="text-sm font-black text-emerald-700 uppercase tracking-widest">Caja Central</p>
                        </div>

                        <button className="w-full py-4 flex items-center justify-center gap-2 font-bold uppercase text-[11px] tracking-widest bg-white rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all shadow-sm active:scale-[0.98]"
                            onClick={procesarCotizacion}>
                            <span className="material-icons-round text-[18px]">assignment</span>
                            <span>Imprimir Cotización</span>
                        </button>

                        <div className="flex gap-3">
                            <button className="w-14 bg-white rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all shadow-sm active:scale-[0.98] shrink-0" onClick={clearCart} title="Vaciar Carrito">
                                <span className="material-icons-round text-[20px]">delete_sweep</span>
                            </button>
                            <button
                                className={`flex-1 py-4 rounded-xl flex items-center justify-center gap-3 font-black uppercase text-[12px] tracking-widest transition-all shadow-md active:scale-[0.98]
                                    bg-[#0f172a] hover:bg-slate-800 text-white`}
                                onClick={enviarCajaCentral}>
                                <span className="material-icons-round text-[20px]">send</span>
                                <span>Enviar a Caja</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <Modal open={showDescuentoModal} onClose={() => setShowDescuentoModal(false)} title="Aplicar Descuento">
                <div className="space-y-4">
                    {cartDescuento > 0 && (
                        <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 flex justify-between items-center">
                            <div className="text-orange-800 text-xs font-bold uppercase">Descuento Actual: {fmtUSD(cartDescuento)}</div>
                            <button className="btn btn-y !py-1 !font-bold text-[10px]" onClick={() => { setDescuento(0, '', ''); setShowDescuentoModal(false); }}>Remover</button>
                        </div>
                    )}
                    <div className="field">
                        <label>Monto a Descontar ($)</label>
                        <input type="number" step="0.01" min="0" className="inp w-full font-mono font-bold text-lg" value={tempDescuento} onChange={e => setTempDescuento(e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="field">
                        <label>Motivo del Descuento</label>
                        <input type="text" className="inp w-full" value={tempMotivo} onChange={e => setTempMotivo(e.target.value)} placeholder="Ej: Cliente Mayorista, Mercancía con detalle" />
                    </div>
                    <button className="btn bg-slate-800 text-white w-full uppercase font-black tracking-widest text-xs py-3 mt-2"
                        onClick={() => {
                            const val = parseFloat(tempDescuento)
                            if (!val || val <= 0) {
                                alert('Monto inválido'); return;
                            }
                            if (val > cartSubtotal()) {
                                alert('El descuento no puede ser mayor al subtotal'); return;
                            }
                            setShowDescuentoModal(false)
                            
                            // Pedir autorización usando el sistema global del store
                            askAdmin(() => {
                                setDescuento(val, tempMotivo || 'Descuento Especial', 'ADMIN')
                            })
                        }}>
                        Solicitar Autorización
                    </button>
                </div>
            </Modal>
        </div>
    )
}
