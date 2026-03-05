import { forwardRef } from 'react'
import './TicketStyles.css'

const TicketTermico = forwardRef(({ nota, config, isCopia = false }, ref) => {
    if (!nota || !config) return null

    const items = nota.items || []
    const fecha = new Date(nota.fecha).toLocaleDateString()
    const hora = new Date(nota.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const subtotal = nota.subtotal || 0
    const iva = nota.iva || 0
    const totalUsd = nota.total || (subtotal + iva)
    const tasa = nota.tasa || config.tasa_bcv || 1
    const totalBs = totalUsd * tasa

    return (
        <div ref={ref} className="ticket-container">
            {isCopia && <div className="watermark-copia">COPIA</div>}

            <div className="ticket-header">
                <img src="/logoguaicaipuro.jpeg" alt="Logo" style={{ width: '80px', height: 'auto', marginBottom: '10px' }} />
                <div className="ticket-title">{config.nombre}</div>
                <div>{config.rif}</div>
                <div>{config.direccion1}</div>
                <div>{config.direccion2}</div>
                <div>Tlf: {config.telefonos}</div>
            </div>

            <div className="ticket-divider"></div>

            <div className="ticket-info">
                <div className="ticket-row">
                    <span>NOTA DE ENTREGA</span>
                    <span>N° {String(nota.nro).padStart(6, '0')}</span>
                </div>
                <div className="ticket-row">
                    <span>Fecha: {fecha}</span>
                    <span>Hora: {hora}</span>
                </div>
                <div>Cajero: {nota.cajero_nombre || 'SISTEMA'}</div>
                <div>Cliente: {nota.cliente_nombre || 'CLIENTE EVENTUAL'}</div>
            </div>

            <div className="ticket-divider"></div>

            <div className="ticket-items-header ticket-row">
                <span style={{ flex: 2 }}>DESC</span>
                <span style={{ flex: 1, textAlign: 'center' }}>CANT</span>
                <span style={{ flex: 1, textAlign: 'right' }}>TOTAL</span>
            </div>

            <div className="ticket-items">
                {items.map((item, idx) => {
                    const precio = Number(item.precio ?? item.precio_unitario ?? 0)
                    const qty = Number(item.qty ?? item.cantidad ?? 1)
                    const totalItem = Number(item.total ?? (precio * qty))
                    return (
                        <div key={idx} className="ticket-item">
                            <div className="ticket-item-main">
                                <span style={{ flex: 2 }}>{item.descripcion}</span>
                                <span style={{ flex: 1, textAlign: 'center' }}>x{qty}</span>
                                <span style={{ flex: 1, textAlign: 'right' }}>${totalItem.toFixed(2)}</span>
                            </div>
                            <div className="ticket-item-sub">
                                <span>{item.codigo} @ ${precio.toFixed(2)}</span>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="ticket-divider"></div>

            <div className="ticket-totals">
                <div className="ticket-row">
                    <span>SUBTOTAL:</span>
                    <span>$ {subtotal.toFixed(2)}</span>
                </div>

                {config.aplicar_iva && (
                    <div className="ticket-row">
                        <span>IVA ({config.porcentaje_iva}%):</span>
                        <span>$ {iva.toFixed(2)}</span>
                    </div>
                )}

                {nota.igtf > 0 && (
                    <div className="ticket-row">
                        <span>IGTF (3%):</span>
                        <span>$ {nota.igtf.toFixed(2)}</span>
                    </div>
                )}

                <div className="ticket-row" style={{ fontWeight: 'bold' }}>
                    <span>TOTAL $:</span>
                    <span>$ {totalUsd.toFixed(2)}</span>
                </div>

                {config.mostrar_tasa && (
                    <>
                        <div className="ticket-row">
                            <span>TASA BCV:</span>
                            <span>{tasa.toFixed(2)} Bs/$</span>
                        </div>
                        <div className="ticket-total-bs ticket-row">
                            <span>TOTAL Bs:</span>
                            <span>Bs {totalBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </>
                )}
            </div>

            {nota.pagos && nota.pagos.length > 0 && (
                <>
                    <div className="ticket-divider"></div>
                    <div className="ticket-info">
                        <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>PAGOS:</div>
                        {nota.pagos.map((p, idx) => (
                            <div key={idx} className="ticket-row">
                                <span>{p.metodo}:</span>
                                <span>{p.moneda === 'BS' ? `Bs ${p.monto.toLocaleString()}` : `$ ${p.monto.toFixed(2)}`}</span>
                            </div>
                        ))}
                        {nota.cambio > 0 && (
                            <div className="ticket-row" style={{ marginTop: '3px' }}>
                                <span>SU CAMBIO $:</span>
                                <span>$ {nota.cambio.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                </>
            )}

            <div className="ticket-divider"></div>

            <div className="ticket-footer">
                <div>{config.mensaje_bienvenida}</div>
                <div style={{ fontWeight: 'bold', marginTop: '5px' }}>{config.mensaje_pie}</div>
            </div>
        </div>
    )
})

TicketTermico.displayName = 'TicketTermico'

export default TicketTermico
