import Modal from './Modal'
import { fmtUSD } from '../../utils/format'

export default function FichaTecnica({ articulo, open, onClose }) {
    if (!articulo) return null

    const Field = ({ label, value }) => (
        <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', color: '#605e5c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#201f1e' }}>{value?.toString().trim() || '—'}</div>
        </div>
    )

    return (
        <Modal open={open} onClose={onClose} title="FICHA TÉCNICA">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="Código" value={articulo.codigo} />
                <Field label="Referencia" value={articulo.referencia} />
                <div style={{ gridColumn: 'span 2' }}>
                    <Field label="Descripción" value={articulo.descripcion} />
                </div>
                <Field label="Marca" value={articulo.marca} />
                <Field label="Unidad" value={articulo.unidad} />
                <Field label="Departamento" value={articulo.departamento} />
                <Field label="Sub-Departamento" value={articulo.sub_depto} />
                <Field label="Proveedor" value={articulo.proveedor} />
                <Field label="Ubicación" value={articulo.ubicacion} />
                <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e1dfdd', paddingTop: '8px', marginTop: '4px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={{ fontSize: '10px', color: '#605e5c', textTransform: 'uppercase' }}>Stock</div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: (articulo.stock ?? 0) === 0 ? '#d13438' : (articulo.stock ?? 0) <= 3 ? '#d97706' : '#107c10' }}>
                                {articulo.stock ?? 0}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '10px', color: '#605e5c', textTransform: 'uppercase' }}>Costo</div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#605e5c' }}>{fmtUSD(articulo.costo)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '10px', color: '#605e5c', textTransform: 'uppercase' }}>Precio Venta</div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0078d4' }}>{fmtUSD(articulo.precio)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    )
}
