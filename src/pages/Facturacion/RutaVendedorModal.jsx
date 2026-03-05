import { useState, useEffect } from 'react'
import Modal from '../../components/UI/Modal'
import { db } from '../../db/db'
import { fmtUSD } from '../../utils/format'
import useStore from '../../store/useStore'

export default function RutaVendedorModal({ open, onClose }) {
    const { currentUser } = useStore()
    const [rutas, setRutas] = useState([])

    useEffect(() => {
        if (!open || !currentUser) return

        const fetchRutas = async () => {
            try {
                // Conseguir el inicio del día local
                const hoy = new Date()
                hoy.setHours(0, 0, 0, 0)

                // Buscar log de auditoría filtrando por hoy y el vendedor logueado
                const logs = await db.auditoria
                    .filter(a =>
                        a.usuario_id === currentUser.id &&
                        new Date(a.fecha) >= hoy &&
                        (a.accion === 'COTIZACION_GENERADA' || a.accion === 'PEDIDO_CAJA_ENVIADO')
                    )
                    .reverse()
                    .sortBy('fecha')

                setRutas(logs)
            } catch (err) {
                console.error("Error al cargar ruta:", err)
            }
        }
        fetchRutas()
    }, [open, currentUser])

    return (
        <Modal open={open} onClose={onClose} title="MI RUTA DE HOY">
            <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto custom-scroll p-1">
                {rutas.length === 0 ? (
                    <div className="text-center py-10 text-[var(--text3)] uppercase font-black text-xs opacity-50 border-2 border-dashed border-[var(--border-var)] bg-[var(--surfaceDark)] rounded-xl">
                        Aún no tienes pedidos registrados hoy
                    </div>
                ) : (
                    rutas.map(r => {
                        const esCot = r.accion === 'COTIZACION_GENERADA'
                        let extra = {}
                        try { extra = JSON.parse(r.metadata || '{}') } catch (e) { }

                        return (
                            <div key={r.id} className="flex flex-col bg-[var(--surface2)] border border-[var(--border-var)] p-3 rounded-xl shadow-sm relative overflow-hidden group hover:border-[var(--teal)] transition-all">
                                <div className={`absolute top-0 left-0 w-1.5 h-full ${esCot ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>

                                <div className="flex justify-between items-start pl-3">
                                    <div className="flex-1">
                                        <div className="text-[9px] font-black uppercase tracking-widest text-[var(--text3)] flex items-center gap-1.5 mb-1">
                                            <span className="material-icons-round text-[12px]">{esCot ? 'description' : 'send'}</span>
                                            {esCot ? `COTIZACIÓN #${extra.nro || ''}` : 'ENVÍO A CAJA'}
                                        </div>
                                        <div className="text-sm font-black text-[var(--text-main)] uppercase leading-tight">
                                            {extra.cliente || 'CLIENTE DESCONOCIDO'}
                                        </div>
                                        <div className="text-[10px] font-bold text-[var(--teal)] mt-1">
                                            <span className="material-icons-round text-[10px] align-middle mr-1">schedule</span>
                                            {new Date(r.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0 bg-[var(--surface)] px-3 py-1.5 rounded-lg border border-[var(--border-var)]">
                                        <div className="text-[8px] font-black text-[var(--text3)] uppercase">Total</div>
                                        <div className="font-mono font-black text-[var(--text-main)]">{fmtUSD(extra.total || 0)}</div>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--border-var)] flex justify-between items-center text-[11px]">
                <span className="font-bold text-[var(--text2)] uppercase">Total Atendidos:</span>
                <span className="font-black text-[var(--teal)] bg-[var(--teal)]/10 px-3 py-1 rounded-full">{rutas.length}</span>
            </div>

            <div className="mt-4">
                <button className="btn w-full justify-center bg-[var(--surface)] border border-[var(--border-var)] py-3 font-black text-xs text-[var(--text2)] hover:bg-[var(--surface2)]" onClick={onClose}>CERRAR</button>
            </div>
        </Modal>
    )
}
