import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import Modal from '../../components/UI/Modal'
import Confirm from '../../components/UI/Confirm'

const empty = { rif:'', nombre:'', direccion:'', ciudad:'', telefono:'', email:'', contacto:'', observaciones:'' }

export default function Proveedores() {
  const toast = useStore(s => s.toast)
  const [busq, setBusq] = useState('')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [delId, setDelId] = useState(null)

  const proveedores = useLiveQuery(
    () => busq.trim()
      ? db.proveedores.filter(p =>
          p.rif?.toLowerCase().includes(busq.toLowerCase()) ||
          p.nombre?.toLowerCase().includes(busq.toLowerCase())
        ).toArray()
      : db.proveedores.orderBy('nombre').toArray(),
    [busq], []
  )

  const openNew = () => { setForm(empty); setEditing(null); setShowModal(true) }
  const openEdit = (p) => { setForm({ ...p }); setEditing(p.id); setShowModal(true) }
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.nombre.trim()) { toast('El nombre es requerido', 'warn'); return }
    if (editing) {
      await db.proveedores.update(editing, { ...form })
      toast('Proveedor actualizado')
    } else {
      await db.proveedores.add({ ...form })
      toast('Proveedor agregado')
    }
    setShowModal(false)
  }

  const del = async () => {
    await db.proveedores.delete(delId)
    toast('Proveedor eliminado', 'warn')
    setDelId(null)
  }

  return (
    <div>
      <div className="panel">
        <div className="flex items-center gap-2 mb-2">
          <span className="panel-title flex-1" style={{margin:0,paddingBottom:0,border:'none'}}>PROVEEDORES</span>
          <button className="btn btn-r btn-sm" onClick={openNew}>+ NUEVO</button>
        </div>
        <input className="inp mb-2" placeholder="🔍 Buscar..." value={busq} onChange={e => setBusq(e.target.value)} />
        <div className="tabla-wrap tabla-scroll" style={{maxHeight:'60vh'}}>
          <table>
            <thead><tr>
              <th>RIF</th><th>NOMBRE</th><th>CONTACTO</th><th>TELÉFONO</th><th>EMAIL</th><th>CIUDAD</th><th></th>
            </tr></thead>
            <tbody>
              {proveedores.map(p => (
                <tr key={p.id}>
                  <td className="font-mono2 text-rojo-bright">{p.rif}</td>
                  <td className="font-semibold">{p.nombre}</td>
                  <td className="text-muted">{p.contacto}</td>
                  <td className="text-muted">{p.telefono}</td>
                  <td className="text-muted">{p.email}</td>
                  <td className="text-muted">{p.ciudad}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-y btn-sm" onClick={() => openEdit(p)}>✏</button>
                      <button className="btn btn-r btn-sm" onClick={() => setDelId(p.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
              {proveedores.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted py-6 tracking-widest">SIN PROVEEDORES</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'EDITAR PROVEEDOR' : 'NUEVO PROVEEDOR'}>
        <div className="grid grid-cols-2 gap-2">
          <div className="field"><label>RIF</label>
            <input className="inp" value={form.rif} onChange={e => f('rif', e.target.value)} /></div>
          <div className="field"><label>Teléfono</label>
            <input className="inp" value={form.telefono} onChange={e => f('telefono', e.target.value)} /></div>
          <div className="field col-span-2"><label>Nombre / Razón Social *</label>
            <input className="inp" value={form.nombre} onChange={e => f('nombre', e.target.value)} /></div>
          <div className="field"><label>Persona de Contacto</label>
            <input className="inp" value={form.contacto} onChange={e => f('contacto', e.target.value)} /></div>
          <div className="field"><label>Email</label>
            <input className="inp" type="email" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div className="field"><label>Ciudad</label>
            <input className="inp" value={form.ciudad} onChange={e => f('ciudad', e.target.value)} /></div>
          <div className="field col-span-2"><label>Dirección</label>
            <input className="inp" value={form.direccion} onChange={e => f('direccion', e.target.value)} /></div>
          <div className="field col-span-2"><label>Observaciones</label>
            <input className="inp" value={form.observaciones} onChange={e => f('observaciones', e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-3">
          <button className="btn btn-gr flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
          <button className="btn btn-g flex-1" onClick={save}>💾 GUARDAR</button>
        </div>
      </Modal>

      <Confirm open={!!delId} onClose={() => setDelId(null)} onConfirm={del}
        msg="¿Eliminar este proveedor?" danger />
    </div>
  )
}
