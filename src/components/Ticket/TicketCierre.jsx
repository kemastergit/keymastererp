import { forwardRef } from 'react'
import './TicketStyles.css'

const TicketCierre = forwardRef(({ session, config, isZ = false }, ref) => {
    if (!session || !config) return null

    const stats = isZ ? session.cierre_z : session.stats_x // statistics from session
    const fecha = new Date(session.fecha_apertura).toLocaleDateString()
    const hora = new Date().toLocaleTimeString()

    return (
        <div ref={ref} className="ticket-container">
            <div className="ticket-header">
                <div className="ticket-title">{config.nombre}</div>
                <div className="ticket-title">CORTE {isZ ? 'Z' : 'X'} (CIERRE)</div>
                <div className="ticket-divider"></div>
            </div>

            <div className="ticket-info">
                <div>Cajero: {session.usuario}</div>
                <div>Fecha: {fecha}</div>
                <div>Hora: {hora}</div>
                <div>Estado: {session.estado}</div>
            </div>

            <div className="ticket-divider"></div>

            <div className="ticket-totals">
                <div className="ticket-row">
                    <span>MONTO INICIAL USD:</span>
                    <span>$ {session.monto_inicial_usd.toFixed(2)}</span>
                </div>
                <div className="ticket-row border-b border-dashed border-zinc-200 pb-1 mb-1">
                    <span>MONTO INICIAL BS:</span>
                    <span>Bs {session.monto_inicial_bs.toFixed(2)}</span>
                </div>

                <div className="ticket-row">
                    <span>VENTAS EFECTIVO $:</span>
                    <span>$ {stats?.efectivoUsd.toFixed(2) || '0.00'}</span>
                </div>
                <div className="ticket-row">
                    <span>VENTAS EFECTIVO BS:</span>
                    <span>Bs {stats?.efectivoBs.toFixed(2) || '0.00'}</span>
                </div>
                <div className="ticket-row">
                    <span>PAGO MOVIL:</span>
                    <span>Bs {stats?.pagoMovil.toFixed(2) || '0.00'}</span>
                </div>
                <div className="ticket-row">
                    <span>PUNTO DE VENTA:</span>
                    <span>Bs {stats?.punto.toFixed(2) || '0.00'}</span>
                </div>
                <div className="ticket-row">
                    <span>ZELLE:</span>
                    <span>$ {stats?.zelle.toFixed(2) || '0.00'}</span>
                </div>
                <div className="ticket-row">
                    <span>VENTAS CREDITO $:</span>
                    <span>$ {stats?.credito.toFixed(2) || '0.00'}</span>
                </div>
                <div className="ticket-row">
                    <span>RECAUDACION IGTF $:</span>
                    <span>$ {stats?.igtf?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="ticket-row">
                    <span>COBRANZAS CARTERA $:</span>
                    <span>$ {stats?.cobranzaUsd?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="ticket-row">
                    <span>INGRESOS EXTRA C.C:</span>
                    <span>$ {stats?.ingresosCC?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="ticket-row">
                    <span>EGRESOS GASTOS C.C:</span>
                    <span>$ -{stats?.egresosCC?.toFixed(2) || '0.00'}</span>
                </div>

                <div className="ticket-divider"></div>

                <div className="ticket-row b">
                    <span>TOTAL ESPERADO $:</span>
                    <span>$ {stats?.esperadoUsd.toFixed(2) || '0.00'}</span>
                </div>
                <div className="ticket-row b">
                    <span>TOTAL ESPERADO BS:</span>
                    <span>Bs {stats?.esperadoBs.toFixed(2) || '0.00'}</span>
                </div>

                {isZ && (
                    <>
                        <div className="ticket-divider"></div>
                        <div className="ticket-row">
                            <span>CONTADO FISICO $:</span>
                            <span>$ {session.monto_fisico_usd.toFixed(2)}</span>
                        </div>
                        <div className="ticket-row">
                            <span>CONTADO FISICO BS:</span>
                            <span>Bs {session.monto_fisico_bs.toFixed(2)}</span>
                        </div>
                        <div className="ticket-divider"></div>
                        <div className="ticket-row b" style={{ color: session.diferencia_usd < 0 ? 'red' : 'green' }}>
                            <span>DIFERENCIA $:</span>
                            <span>$ {session.diferencia_usd.toFixed(2)}</span>
                        </div>
                    </>
                )}
            </div>

            <div className="ticket-divider" style={{ marginTop: '20px' }}></div>
            <div className="ticket-footer">
                <div style={{ marginTop: '30px', borderTop: '1px solid black', display: 'inline-block', width: '150px' }}>
                    FIRMA CAJERO
                </div>
                <div style={{ marginTop: '30px', borderTop: '1px solid black', display: 'inline-block', width: '150px' }}>
                    FIRMA SUPERVISOR
                </div>
            </div>
        </div>
    )
})

TicketCierre.displayName = 'TicketCierre'
export default TicketCierre
