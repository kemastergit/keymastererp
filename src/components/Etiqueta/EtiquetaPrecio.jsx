import CodigoBarras from '../CodigoBarras'

export default function EtiquetaPrecio({ articulo, config, tasa }) {
    if (!articulo) return null

    const precioBs = articulo.precio * (tasa || 1)

    return (
        <div className="label-price-container">
            <div className="label-price-header">
                <div className="label-company">{config?.nombre || 'GUAICAIPURO'}</div>
            </div>

            <div className="label-price-body">
                <div className="label-code">{articulo.codigo}</div>
                <div className="label-desc">{articulo.descripcion}</div>

                <div className="label-prices">
                    <div className="price-usd">$ {articulo.precio.toFixed(2)}</div>
                    <div className="price-bs">Bs {precioBs.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</div>
                </div>
            </div>

            <div className="label-barcode">
                <CodigoBarras value={articulo.codigo} height={30} width={1} fontSize={10} />
            </div>

            <style jsx>{`
        .label-price-container {
          width: 151px; /* ~40mm */
          height: 75px; /* ~20mm */
          border: 1px solid #ddd;
          padding: 2px;
          background: white;
          color: black;
          font-family: Arial, sans-serif;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
        }
        .label-company {
          font-size: 7px;
          font-weight: bold;
          text-align: center;
          text-transform: uppercase;
        }
        .label-code {
          font-size: 8px;
          font-weight: bold;
        }
        .label-desc {
          font-size: 7px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .label-prices {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 2px;
        }
        .price-usd {
          font-size: 11px;
          font-weight: bold;
        }
        .price-bs {
          font-size: 8px;
        }
        .label-barcode {
          display: flex;
          justify-content: center;
          margin-top: 1px;
        }
        @media print {
          .label-price-container {
            border: none;
            margin: 0;
            page-break-inside: avoid;
          }
        }
      `}</style>
        </div>
    )
}
