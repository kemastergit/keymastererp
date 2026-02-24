import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import Modal from '../../components/UI/Modal'
import Confirm from '../../components/UI/Confirm'

const empty = { rif: '', nombre: '', direccion: '', ciudad: '', telefono: '', email: '', limite_credito: 0, observaciones: '' }

export default function Clientes() {
  const toast = useStore(s => s.toast)
  const [busq, setBusq] = useState('')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [delId, setDelId] = useState(null)

  const clientes = useLiveQuery(
    () => busq.trim()
      ? db.clientes.filter(c =>
        c.rif?.toLowerCase().includes(busq.toLowerCase()) ||
        c.nombre?.toLowerCase().includes(busq.toLowerCase())
      ).toArray()
      : db.clientes.orderBy('nombre').toArray(),
    [busq], []
  )

  const openNew = () => { setForm(empty); setEditing(null); setShowModal(true) }
  const openEdit = (c) => { setForm({ ...c }); setEditing(c.id); setShowModal(true) }
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.nombre.trim()) { toast('El nombre es requerido', 'warn'); return }
    if (editing) {
      await db.clientes.update(editing, { ...form, limite_credito: parseFloat(form.limite_credito) || 0 })
      toast('Cliente actualizado')
    } else {
      await db.clientes.add({ ...form, limite_credito: parseFloat(form.limite_credito) || 0 })
      toast('Cliente agregado')
    }
    setShowModal(false)
  }

  const del = async () => {
    await db.clientes.delete(delId)
    toast('Cliente eliminado', 'warn')
    setDelId(null)
  }

  return (
    <div className="h-full overflow-y-auto custom-scroll pr-2 pb-6 space-y-4">
      <div className="panel">
        <div className="flex items-center gap-2 mb-2">
          <span className="panel-title flex-1" style={{ margin: 0, paddingBottom: 0, border: 'none' }}>FICHA DE CLIENTES</span>
          <button className="btn btn-r btn-sm" onClick={openNew}>+ NUEVO</button>
        </div>
        <input className="inp mb-2" placeholder="🔍 Buscar por RIF o nombre..." value={busq} onChange={e => setBusq(e.target.value)} />
        <div className="tabla-wrap tabla-scroll">
          <table>
            <thead><tr>
              <th>RIF</th><th>NOMBRE</th><th>CIUDAD</th><th>TELÉFONO</th><th>EMAIL</th><th>LÍM. CRÉDITO $</th><th></th>
            </tr></thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.id}>
                  <td className="font-mono2 text-rojo-bright">{c.rif}</td>
                  <td className="font-semibold">{c.nombre}</td>
                  <td className="text-muted">{c.ciudad}</td>
                  <td className="text-muted">{c.telefono}</td>
                  <td className="text-muted">{c.email}</td>
                  <td className="font-mono2">{c.limite_credito ? `$ ${c.limite_credito}` : '—'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-y btn-sm" onClick={() => openEdit(c)}>✏</button>
                      <button className="btn btn-r btn-sm" onClick={() => setDelId(c.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
              {clientes.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted py-6 tracking-widest">SIN CLIENTES</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'EDITAR CLIENTE' : 'NUEVO CLIENTE'}>
        <div className="grid grid-cols-2 gap-2">
          <div className="field">
            <label>RIF</label>
            <input className="inp" value={form.rif} onChange={e => f('rif', e.target.value)} placeholder="J-12345678-9" />
          </div>
          <div className="field">
            <label>Teléfono</label>
            <input className="inp" value={form.telefono} onChange={e => f('telefono', e.target.value)} />
          </div>
          <div className="field col-span-2">
            <label>Nombre / Razón Social *</label>
            <input className="inp" value={form.nombre} onChange={e => f('nombre', e.target.value)} />
          </div>
          <div className="field col-span-2">
            <label>Dirección</label>
            <input className="inp" value={form.direccion} onChange={e => f('direccion', e.target.value)} />
          </div>
          <div className="field">
            <label>Ciudad</label>
            <input className="inp" value={form.ciudad} onChange={e => f('ciudad', e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="inp" type="email" value={form.email} onChange={e => f('email', e.target.value)} />
          </div>
          <div className="field col-span-2">
            <label>Límite de Crédito $</label>
            <input className="inp" type="number" value={form.limite_credito} onChange={e => f('limite_credito', e.target.value)} step="0.01" inputMode="decimal" />
          </div>
          <div className="field col-span-2">
            <label>Observaciones</label>
            <input className="inp" value={form.observaciones} onChange={e => f('observaciones', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button className="btn btn-gr flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
          <button className="btn btn-g flex-1" onClick={save}>💾 GUARDAR</button>
        </div>
      </Modal>

      <Confirm open={!!delId} onClose={() => setDelId(null)} onConfirm={del}
        msg="¿Eliminar este cliente?" danger />
    </div>
  )
}
