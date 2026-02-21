import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { fmtUSD } from '../../utils/format'
import Modal from '../../components/UI/Modal'
import Confirm from '../../components/UI/Confirm'

const empty = { codigo: '', referencia: '', descripcion: '', marca: '', departamento: '', sub_depto: '', proveedor: '', unidad: 'UNI', ubicacion: '', stock: 0, precio: 0, costo: 0 }

export default function Inventario() {
  const toast = useStore(s => s.toast)
  const [busq, setBusq] = useState('')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [delId, setDelId] = useState(null)
  const [ajuste, setAjuste] = useState(null) // { art, qty, motivo }

  const articulos = useLiveQuery(
    () => busq.trim()
      ? db.articulos.filter(a =>
        a.codigo?.toLowerCase().includes(busq.toLowerCase()) ||
        a.descripcion?.toLowerCase().includes(busq.toLowerCase()) ||
        a.marca?.toLowerCase().includes(busq.toLowerCase())
      ).toArray()
      : db.articulos.orderBy('descripcion').toArray(),
    [busq], []
  )

  const openNew = () => { setForm(empty); setEditing(null); setShowModal(true) }
  const openEdit = (a) => { setForm({ ...a }); setEditing(a.id); setShowModal(true) }

  const save = async () => {
    if (!form.codigo.trim() || !form.descripcion.trim()) {
      toast('Código y descripción son requeridos', 'warn'); return
    }
    if (editing) {
      await db.articulos.update(editing, { ...form, precio: parseFloat(form.precio) || 0, stock: parseInt(form.stock) || 0 })
      toast('Producto actualizado')
    } else {
      await db.articulos.add({ ...form, precio: parseFloat(form.precio) || 0, stock: parseInt(form.stock) || 0 })
      toast('Producto agregado')
    }
    setShowModal(false)
  }

  const del = async () => {
    await db.articulos.delete(delId)
    toast('Producto eliminado', 'warn')
    setDelId(null)
  }

  const saveAjuste = async () => {
    if (!ajuste) return
    const qty = parseInt(ajuste.qty) || 0
    if (qty === 0) { toast('Cantidad no puede ser 0', 'warn'); return }
    const art = await db.articulos.get(ajuste.id)
    const newStock = Math.max(0, (art.stock || 0) + qty)
    await db.articulos.update(ajuste.id, { stock: newStock })
    toast(`Stock ajustado: ${art.stock} → ${newStock}`)
    setAjuste(null)
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div>
      <div className="panel">
        <div className="flex items-center gap-2 mb-2">
          <div className="panel-title flex-1" style={{ margin: 0, paddingBottom: 0, border: 'none' }}>
            INVENTARIO DE PRODUCTOS
          </div>
          <button className="btn btn-r btn-sm" onClick={openNew}>+ NUEVO</button>
        </div>
        <input className="inp mb-2" placeholder="🔍 Buscar..." value={busq} onChange={e => setBusq(e.target.value)} />
        <div className="tabla-wrap tabla-scroll" style={{ maxHeight: '60vh' }}>
          <table>
            <thead><tr>
              <th className="sticky-col">CÓD.</th>
              <th className="sticky-col-2">DESCRIPCIÓN</th>
              <th>REF.</th>
              <th>MARCA</th>
              <th>DEPTO.</th>
              <th>SUB-DEPTO.</th>
              <th>PROVEEDOR</th>
              <th>UNIDAD</th>
              <th>STOCK</th>
              <th>COSTO $</th>
              <th>PRECIO $</th>
              <th>ACCIONES</th>
            </tr></thead>
            <tbody>
              {articulos.map(a => (
                <tr key={a.id}>
                  <td className="font-mono2 text-rojo-bright sticky-col">{a.codigo}</td>
                  <td className="font-semibold sticky-col-2">{a.descripcion}</td>
                  <td className="text-[10px] text-muted">{a.referencia}</td>
                  <td className="text-muted">{a.marca}</td>
                  <td className="text-muted text-xs">{a.departamento}</td>
                  <td className="text-muted text-xs">{a.sub_depto}</td>
                  <td className="text-muted text-[10px]">{a.proveedor}</td>
                  <td className="text-center">{a.unidad}</td>
                  <td>
                    <span className={`badge ${(a.stock ?? 0) === 0 ? 'badge-r' : (a.stock ?? 0) <= 3 ? 'badge-y' : 'badge-g'}`}>
                      {a.stock ?? 0}
                    </span>
                  </td>
                  <td className="font-mono2 text-muted">{fmtUSD(a.costo)}</td>
                  <td className="font-mono2 text-white font-bold">{fmtUSD(a.precio)}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-b btn-sm" onClick={() => setAjuste({ ...a, qty: 0, motivo: '' })}>±</button>
                      <button className="btn btn-y btn-sm" onClick={() => openEdit(a)}>✏</button>
                      <button className="btn btn-r btn-sm" onClick={() => setDelId(a.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
              {articulos.length === 0 && (
                <tr><td colSpan={8} className="text-center text-muted py-6 tracking-widest">SIN RESULTADOS</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal CRUD */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'EDITAR PRODUCTO' : 'NUEVO PRODUCTO'}>
        <div className="grid grid-cols-2 gap-2">
          <div className="field col-span-2 sm:col-span-1">
            <label>Código *</label>
            <input className="inp" value={form.codigo} onChange={e => f('codigo', e.target.value)} />
          </div>
          <div className="field col-span-2 sm:col-span-1">
            <label>Marca</label>
            <input className="inp" value={form.marca} onChange={e => f('marca', e.target.value)} />
          </div>
          <div className="field col-span-2">
            <label>Descripción *</label>
            <input className="inp" value={form.descripcion} onChange={e => f('descripcion', e.target.value)} />
          </div>
          <div className="field">
            <label>Departamento</label>
            <input className="inp" value={form.departamento} onChange={e => f('departamento', e.target.value)} />
          </div>
          <div className="field">
            <label>Ubicación</label>
            <input className="inp" value={form.ubicacion} onChange={e => f('ubicacion', e.target.value)} />
          </div>
          <div className="field">
            <label>Referencia</label>
            <input className="inp" value={form.referencia} onChange={e => f('referencia', e.target.value)} />
          </div>
          <div className="field">
            <label>Sub-Departamento</label>
            <input className="inp" value={form.sub_depto} onChange={e => f('sub_depto', e.target.value)} />
          </div>
          <div className="field">
            <label>Proveedor</label>
            <input className="inp" value={form.proveedor} onChange={e => f('proveedor', e.target.value)} />
          </div>
          <div className="field">
            <label>Unidad</label>
            <input className="inp" value={form.unidad} onChange={e => f('unidad', e.target.value)} />
          </div>
          <div className="field">
            <label>Stock</label>
            <input className="inp" type="number" value={form.stock} onChange={e => f('stock', e.target.value)} inputMode="numeric" />
          </div>
          <div className="field">
            <label>Costo $</label>
            <input className="inp" type="number" value={form.costo} onChange={e => f('costo', e.target.value)} step="0.01" inputMode="decimal" />
          </div>
          <div className="field">
            <label>Precio de Venta $</label>
            <input className="inp" type="number" value={form.precio} onChange={e => f('precio', e.target.value)} step="0.01" inputMode="decimal" />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button className="btn btn-gr flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
          <button className="btn btn-g flex-1" onClick={save}>💾 GUARDAR</button>
        </div>
      </Modal>

      {/* Modal ajuste stock */}
      <Modal open={!!ajuste} onClose={() => setAjuste(null)} title="AJUSTE DE STOCK">
        {ajuste && (
          <>
            <p className="text-sm text-white mb-1 font-semibold">{ajuste.descripcion}</p>
            <p className="text-muted text-xs mb-3">Stock actual: <span className="text-white font-bold">{ajuste.stock}</span></p>
            <div className="field">
              <label>Cantidad (+ para sumar, - para restar)</label>
              <input className="inp" type="number" value={ajuste.qty}
                onChange={e => setAjuste(p => ({ ...p, qty: e.target.value }))}
                placeholder="ej: 5 o -2" inputMode="numeric" />
            </div>
            <div className="field">
              <label>Motivo</label>
              <input className="inp" value={ajuste.motivo || ''}
                onChange={e => setAjuste(p => ({ ...p, motivo: e.target.value }))}
                placeholder="Compra, ajuste, merma..." />
            </div>
            <div className="flex gap-2 mt-2">
              <button className="btn btn-gr flex-1" onClick={() => setAjuste(null)}>Cancelar</button>
              <button className="btn btn-y flex-1" onClick={saveAjuste}>APLICAR AJUSTE</button>
            </div>
          </>
        )}
      </Modal>

      <Confirm open={!!delId} onClose={() => setDelId(null)} onConfirm={del}
        msg="¿Eliminar este producto del inventario?" danger />
    </div>
  )
}
