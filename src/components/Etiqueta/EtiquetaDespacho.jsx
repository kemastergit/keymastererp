import QRCodeComponent from '../QRCode'

export default function EtiquetaDespacho({ nota, config }) {
    if (!nota) return null

    const items = nota.items || []
    const fecha = new Date(nota.fecha).toLocaleDateString()

    // Simplified data for QR
    const qrData = {
        id: nota.id,
        nro: nota.nro,
        cliente: nota.cliente_nombre,
        fecha: fecha,
        total: nota.total
    }

    return (
        <div className="label-dispatch-container">
            <div className="dispatch-header">
                <div className="dispatch-title">DESPACHO — {config?.nombre || 'GUAICAIPURO'}</div>
            </div>

            <div className="dispatch-info">
                <div className="info-row">
                    <strong>NOTA N°:</strong> {String(nota.nro).padStart(6, '0')}
                </div>
                <div className="info-row">
                    <strong>FECHA:</strong> {fecha}
                </div>
                <div className="info-row">
                    <strong>CLIENTE:</strong> {nota.cliente_nombre || 'CLIENTE EVENTUAL'}
                </div>
            </div>

            <div className="dispatch-items">
                <div className="items-title">ITEMS:</div>
                <div className="items-list">
                    {items.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="dispatch-item">
                            • {item.codigo} - {item.descripcion.substring(0, 20)} x{item.qty}
                        </div>
                    ))}
                    {items.length > 5 && <div className="dispatch-item">... y {items.length - 5} más</div>}
                </div>
            </div>

            <div className="dispatch-footer">
                <QRCodeComponent value={qrData} size={60} />
            </div>

            <style jsx>{`
        .label-dispatch-container {
          width: 378px; /* ~100mm */
          height: 226px; /* ~60mm */
          border: 2px solid black;
          padding: 10px;
          background: white;
          color: black;
          font-family: Arial, sans-serif;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .dispatch-header {
          border-bottom: 2px solid black;
          padding-bottom: 5px;
          margin-bottom: 5px;
          text-align: center;
        }
        .dispatch-title {
          font-weight: bold;
          font-size: 14px;
        }
        .dispatch-info {
          font-size: 12px;
          border-bottom: 1px solid #ccc;
          padding-bottom: 5px;
          margin-bottom: 5px;
        }
        .info-row {
          margin-bottom: 2px;
        }
        .dispatch-items {
          flex-grow: 1;
        }
        .items-title {
          font-weight: bold;
          font-size: 11px;
          margin-bottom: 3px;
        }
        .items-list {
          font-size: 10px;
        }
        .dispatch-item {
          margin-bottom: 1px;
        }
        .dispatch-footer {
          position: absolute;
          bottom: 10px;
          right: 10px;
        }
        @media print {
          .label-dispatch-container {
            margin: 0;
            page-break-inside: avoid;
          }
        }
      `}</style>
        </div>
    )
}
