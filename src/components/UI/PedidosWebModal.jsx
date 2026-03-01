
import React, { useEffect } from 'react'
import useStore from '../../store/useStore'
import Modal from './Modal'
import { fmtUSD } from '../../utils/format'

export default function PedidosWebModal({ open, onClose }) {
    const { pedidosWeb, fetchPedidosWeb, procesarPedidoWeb, loadingPedidos } = useStore()

    useEffect(() => {
        if (open) {
            fetchPedidosWeb()
            const interval = setInterval(fetchPedidosWeb, 30000) // Refrescar cada 30s
            return () => clearInterval(interval)
        }
    }, [open])

    const handleProcesar = async (id) => {
        await procesarPedidoWeb(id)
        onClose()
    }

    return (
        <Modal open={open} onClose={onClose} title="PEDIDOS RECIBIDOS DESDE LA WEB (CATÁLOGO)" wide>
            <div className="flex flex-col gap-4">
                {pedidosWeb.length === 0 ? (
                    <div className="text-center py-10 bg-[var(--surface2)] border border-dashed border-[var(--border-var)]">
                        <span className="material-icons-round text-4xl text-[var(--text3)] mb-2">cloud_off</span>
                        <p className="text-[10px] font-black uppercase text-[var(--text2)] tracking-[0.2em]">No hay pedidos pendientes en el buzón</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {pedidosWeb.map(p => (
                            <div key={p.id} className="bg-[var(--surface)] border-2 border-[var(--border-var)] overflow-hidden shadow-[var(--win-shadow)] flex flex-col md:flex-row">
                                {/* Info Cliente */}
                                <div className="p-4 bg-[var(--surface2)] border-r border-[var(--border-var)] md:w-64 shrink-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                                        <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">NUEVO PEDIDO</span>
                                    </div>
                                    <h3 className="font-black text-sm uppercase text-[var(--text-main)] mb-1">{p.cliente || 'CLIENTE WEB'}</h3>
                                    <p className="text-[10px] font-mono font-bold text-[var(--teal)] mb-3">📞 {p.telefono || 'Sin teléfono'}</p>

                                    <div className="text-[8px] font-black text-[var(--text3)] uppercase tracking-tighter mb-1">Recibido:</div>
                                    <div className="text-[9px] font-mono text-[var(--text2)]">{new Date(p.fecha).toLocaleString()}</div>
                                </div>

                                {/* Items del Pedido */}
                                <div className="flex-1 p-4 flex flex-col justify-between">
                                    <div className="space-y-2 mb-4">
                                        {p.items?.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center text-[11px] border-b border-black/5 pb-1">
                                                <span className="font-bold text-[var(--text2)]">
                                                    <span className="text-[var(--teal)] font-black mr-2">x{item.qty}</span>
                                                    {item.descripcion}
                                                </span>
                                                <span className="font-mono font-black">{fmtUSD(item.precio * item.qty)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-[var(--border-var)]">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-[var(--text3)] uppercase tracking-widest">Total Estimado</span>
                                            <span className="text-xl font-mono font-black text-[var(--teal)]">{fmtUSD(p.total || 0)}</span>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => window.open(`https://wa.me/${p.telefono?.replace(/\D/g, '')}`, '_blank')}
                                                className="btn bg-green-600 text-white !py-2 !px-4 hover:bg-green-700 transition-colors"
                                            >
                                                <span className="material-icons-round text-sm">whatsapp</span>
                                            </button>
                                            <button
                                                onClick={() => handleProcesar(p.id)}
                                                className="btn bg-[var(--teal)] text-white !py-2 !px-6 hover:bg-black transition-all flex items-center gap-2"
                                            >
                                                <span className="material-icons-round text-sm">login</span>
                                                <span className="font-black text-[10px] tracking-widest">IMPORTAR A VENTA</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 flex items-start gap-3">
                    <span className="material-icons-round text-base">info</span>
                    <p className="text-[9px] font-bold uppercase tracking-wider leading-relaxed">
                        Al "Importar", se cargará este pedido en tu carrito actual, permitiéndote cerrar la venta, aplicar descuentos o impuestos y emitir el ticket final.
                    </p>
                </div>
            </div>
        </Modal>
    )
}
