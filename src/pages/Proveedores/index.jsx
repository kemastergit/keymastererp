import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/UI/Modal'
import Confirm from '../../components/UI/Confirm'
import { logAction } from '../../utils/audit'
import { addToSyncQueue, processSyncQueue } from '../../utils/syncManager'

const empty = { rif: '', nombre: '', direccion: '', ciudad: '', telefono: '', email: '', contacto: '', observaciones: '', estado: 'ACTIVO' }

export default function Proveedores() {
  const toast = useStore(s => s.toast)
  const [busq, setBusq] = useState('')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [delId, setDelId] = useState(null)
  const [inactivating, setInactivating] = useState(null)

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

    try {
      const payload = { ...form }
      if (editing) {
        await db.proveedores.update(editing, payload)
        toast('Proveedor actualizado localmente')
      } else {
        await db.proveedores.add(payload)
        toast('Proveedor agregado localmente')
      }

      // ☁️ SYNC A SUPABASE (VIA COLA)
      await addToSyncQueue('proveedores', 'INSERT', {
        rif: payload.rif.trim(),
        nombre: payload.nombre.trim(),
        contacto: payload.contacto,
        telefono: payload.telefono,
        email: payload.email,
        ciudad: payload.ciudad,
        direccion: payload.direccion,
        observaciones: payload.observaciones,
        estado: payload.estado || 'ACTIVO',
        motivo_inactivacion: payload.motivo_inactivacion || '',
        fecha_inactivacion: payload.fecha_inactivacion || null,
        inactivado_por: payload.inactivado_por || ''
      })
      processSyncQueue()

      toast('✅ Cola de sincronización actualizada', 'success')
      logAction(useStore.getState().userSession, editing ? 'PROVEEDOR_EDITADO' : 'PROVEEDOR_CREADO', { table_name: 'proveedores', record_id: form.rif })
    } catch (err) {
      console.error('Error guardando proveedor:', err)
      toast('⚠️ Error local: ' + err.message, 'error')
    }

    setShowModal(false)
  }

  const handleInactivar = async (motivo) => {
    if (!inactivating) return
    try {
      const payload = {
        estado: 'INACTIVO',
        motivo_inactivacion: motivo,
        fecha_inactivacion: new Date().toISOString(),
        inactivado_por: useStore.getState().currentUser?.nombre || 'SISTEMA'
      }
      await db.proveedores.update(inactivating.id, payload)

      const fullProv = { ...inactivating, ...payload }
      await addToSyncQueue('proveedores', 'INSERT', {
        rif: fullProv.rif,
        nombre: fullProv.nombre,
        contacto: fullProv.contacto,
        telefono: fullProv.telefono,
        email: fullProv.email,
        ciudad: fullProv.ciudad,
        direccion: fullProv.direccion,
        estado: 'INACTIVO',
        motivo_inactivacion: motivo,
        fecha_inactivacion: payload.fecha_inactivacion,
        inactivado_por: payload.inactivado_por
      })
      processSyncQueue()
      toast('Proveedor inactivado correctamente', 'success')
    } catch (err) {
      console.error(err)
      toast('Error al inactivar proveedor', 'error')
    }
    setInactivating(null)
  }

  const del = async () => {
    try {
      const p = await db.proveedores.get(delId)
      if (!p) {
        setDelId(null)
        return
      }

      // Validar si tiene deuda pendiente en cuentas por pagar
      const pName = (p.nombre || '').toUpperCase()
      const pIdStr = String(p.id)

      const deudas = await db.ctas_pagar
        .filter(c => {
          if (c.estado !== 'PENDIENTE' && c.estado !== 'PARCIAL') return false;

          const matchId = String(c.proveedor_id) === pIdStr;
          const cName = (c.proveedor || '').toUpperCase();
          const matchName = cName === pName || cName.includes(pName);

          return matchId || matchName;
        })
        .toArray()

      if (deudas.length > 0) {
        toast('Este proveedor tiene deuda pendiente. Solo puede ser inactivado.', 'error')
        setDelId(null)
        setInactivating(p)
        return
      }

      if (p?.rif) {
        await supabase.from('proveedores').delete().eq('rif', p.rif)
      }
      await db.proveedores.delete(delId)
      toast('Proveedor eliminado en ambos niveles', 'warn')
    } catch (err) {
      console.error(err)
      await db.proveedores.delete(delId)
      toast('Eliminado localmente', 'warn')
    }
    setDelId(null)
  }

  return (
    <div className="pr-2 pb-6 space-y-4">
      <div className="panel">
        <div className="flex items-center gap-2 mb-2">
          <span className="panel-title flex-1" style={{ margin: 0, paddingBottom: 0, border: 'none' }}>PROVEEDORES</span>
          <button className="btn btn-r btn-sm" onClick={openNew}>+ NUEVO</button>
        </div>
        <input className="inp mb-2" placeholder="🔍 Buscar..." value={busq} onChange={e => setBusq(e.target.value)} />
        <div className="tabla-wrap tabla-scroll overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">RIF</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">NOMBRE</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">ESTADO</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">TELÉFONO</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">CIUDAD</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {proveedores.map(p => (
                <tr key={p.id} className={`${p.estado === 'INACTIVO' ? 'bg-slate-50 opacity-60' : ''}`}>
                  <td className="font-mono2 text-rojo-bright">{p.rif}</td>
                  <td className="font-semibold uppercase">{p.nombre}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${p.estado === 'INACTIVO' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                      {p.estado || 'ACTIVO'}
                    </span>
                  </td>
                  <td className="text-muted">{p.telefono}</td>
                  <td className="text-muted uppercase">{p.ciudad}</td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button className="btn btn-y btn-sm" onClick={() => openEdit(p)} title="Editar">✏</button>
                      {p.estado !== 'INACTIVO' && (
                        <button className="btn bg-slate-500 text-white btn-sm transition-none shadow-[var(--win-shadow)] cursor-pointer !w-8 !h-8 !p-0 flex items-center justify-center font-bold" onClick={() => setInactivating(p)} title="Inactivar">🔒</button>
                      )}
                      <button className="btn btn-r btn-sm" onClick={() => setDelId(p.id)} title="Eliminar">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
              {proveedores.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted py-6 tracking-widest">SIN PROVEEDORES</td></tr>
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
            <input className="inp uppercase" value={form.nombre} onChange={e => f('nombre', e.target.value)} /></div>
          <div className="field"><label>Persona de Contacto</label>
            <input className="inp uppercase" value={form.contacto} onChange={e => f('contacto', e.target.value)} /></div>
          <div className="field"><label>Email</label>
            <input className="inp" type="email" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          <div className="field"><label>Ciudad</label>
            <input className="inp uppercase" value={form.ciudad} onChange={e => f('ciudad', e.target.value)} /></div>
          <div className="field">
            <label>Estado</label>
            <select className="inp font-bold" value={form.estado} onChange={e => f('estado', e.target.value)}>
              <option value="ACTIVO">ACTIVO</option>
              <option value="INACTIVO">INACTIVO</option>
            </select>
          </div>
          <div className="field col-span-2"><label>Dirección</label>
            <input className="inp uppercase" value={form.direccion} onChange={e => f('direccion', e.target.value)} /></div>
          <div className="field col-span-2"><label>Observaciones</label>
            <input className="inp uppercase" value={form.observaciones} onChange={e => f('observaciones', e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-3">
          <button className="btn btn-gr flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
          <button className="btn btn-g flex-1" onClick={save}>💾 GUARDAR</button>
        </div>
      </Modal>

      <Modal open={!!inactivating} onClose={() => setInactivating(null)} title="INACTIVAR PROVEEDOR">
        <div className="space-y-4">
          <p className="text-xs font-bold text-slate-600 uppercase">¿Por qué desea inactivar a <span className="text-[var(--red-var)]">{inactivating?.nombre}</span>?</p>
          <textarea
            className="inp w-full h-24 resize-none uppercase"
            placeholder="Indique el motivo de la inactivación..."
            id="motivo-inact-p"
          ></textarea>
          <div className="flex gap-2">
            <button className="btn btn-gr flex-1 uppercase font-black text-[10px]" onClick={() => setInactivating(null)}>Cancelar</button>
            <button className="btn bg-slate-800 text-white flex-1 uppercase font-black text-[10px]" onClick={() => {
              const m = document.getElementById('motivo-inact-p').value;
              if (!m?.trim()) { toast('Debe indicar un motivo', 'warn'); return; }
              handleInactivar(m);
            }}>Confirmar Inactivación</button>
          </div>
        </div>
      </Modal>

      <Confirm open={!!delId} onClose={() => setDelId(null)} onConfirm={del}
        msg="¿Eliminar este proveedor?" danger />
    </div>
  )
}
