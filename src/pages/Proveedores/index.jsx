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
        // 1. Borrar en la nube primero con await para asegurar que no se sincronice de vuelta
        const { error: syncError } = await supabase.from('proveedores').delete().eq('rif', p.rif)

        if (syncError) {
          console.error("Error borrando en Supabase:", syncError)
          toast('⚠️ No se pudo borrar en la nube, se borrará solo localmente', 'warn')
        }
      }

      // 2. Borrar localmente
      await db.proveedores.delete(delId)
      toast('Proveedor eliminado correctamente', 'success')
    } catch (err) {
      console.error("Error al eliminar proveedor:", err)
      toast('❌ Error al eliminar: ' + err.message, 'error')
    }
    setDelId(null)
  }

  return (
    <div className="flex flex-col h-full min-h-0 pb-2 md:pb-6 space-y-4">
      <div className="panel flex-1 flex flex-col min-h-0 overflow-hidden transition-all shadow-xl">
        <div className="shrink-0 p-4 border-b border-[var(--border-var)] bg-[var(--surface2)]">
          <div className="flex items-center gap-2 mb-3">
            <span className="panel-title flex-1 !m-0 !p-0 !border-none !text-[var(--text-main)]">DIRECTORIO DE PROVEEDORES</span>
            <button className="btn bg-[var(--teal)] text-white btn-sm transition-all shadow-md cursor-pointer hover:scale-105" onClick={openNew}>+ NUEVO PROVEEDOR</button>
          </div>
          <input className="inp w-full focus:border-[var(--teal)] transition-all shadow-inner" placeholder="🔍 Buscar por RIF o nombre..." value={busq} onChange={e => setBusq(e.target.value)} />
        </div>

        <div className="flex-1 overflow-auto bg-[var(--bg)] md:bg-transparent pb-24">
          {/* VISTA MÓVIL (TARJETAS) */}
          <div className="md:hidden flex flex-col gap-2 p-3">
            {proveedores.map(p => (
              <div key={p.id} className={`bg-[var(--surface)] border-l-8 ${p.estado === 'INACTIVO' ? 'border-l-slate-400 opacity-60' : 'border-l-[var(--teal)]'} border-y border-r border-[var(--border-var)] shadow-sm p-4 relative flex flex-col gap-3 rounded-2xl hover:scale-[1.02] transition-all mb-2`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[var(--text-main)] text-sm leading-tight truncate uppercase">{p.nombre}</h3>
                      {p.estado === 'INACTIVO' && <span className="bg-slate-200 text-slate-600 text-[8px] px-1 font-black rounded">INACTIVO</span>}
                    </div>
                    <p className="font-mono text-[var(--red-var)] font-black text-[11px] uppercase tracking-wider">{p.rif}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button className="text-[var(--orange-var)] hover:opacity-70 p-1" onClick={() => openEdit(p)}>
                      <span className="material-icons-round text-sm">edit</span>
                    </button>
                    <button className="text-[var(--red-var)] hover:opacity-70 p-1" onClick={() => setDelId(p.id)}>
                      <span className="material-icons-round text-sm">delete</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-3 bg-[var(--surfaceDark)] p-2 -mx-2 opacity-90">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="material-icons-round text-[12px] text-[var(--text2)] shrink-0">phone</span>
                    <span className="text-[10px] font-bold text-[var(--text-main)] truncate">{p.telefono || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="material-icons-round text-[12px] text-[var(--text2)] shrink-0">location_on</span>
                    <span className="text-[10px] font-bold text-[var(--text-main)] truncate uppercase">{p.ciudad || 'N/A'}</span>
                  </div>
                </div>
              </div>
            ))}
            {proveedores.length === 0 && (
              <div className="text-center text-[var(--text2)] py-12 tracking-widest font-bold uppercase text-xs">SIN PROVEEDORES</div>
            )}
          </div>

          {/* VISTA ESCRITORIO (TABLA) */}
          <div className="hidden md:block tabla-wrap tabla-scroll">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">RIF</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">NOMBRE</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">ESTADO</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">TELÉFONO</th>
                  <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proveedores.map(p => (
                  <tr key={p.id} className={`${p.estado === 'INACTIVO' ? 'bg-slate-50 opacity-60' : ''} hover:bg-[var(--teal)]/5 transition-all cursor-pointer group hover:scale-[1.005]`}>
                    <td className="font-mono text-[var(--red-var)] font-bold">{p.rif}</td>
                    <td className="font-bold text-[var(--text-main)] uppercase">{p.nombre}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${p.estado === 'INACTIVO' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                        {p.estado || 'ACTIVO'}
                      </span>
                    </td>
                    <td className="text-[var(--text2)] text-[11px] font-bold">{p.telefono}</td>
                    <td className="text-right">
                      <div className="flex gap-1 justify-end">
                        <button className="btn bg-[var(--orange-var)] text-white btn-sm transition-all shadow-md cursor-pointer !w-8 !h-8 !p-0 flex items-center justify-center font-bold hover:scale-110" onClick={() => openEdit(p)} title="Editar">✏</button>
                        {p.estado !== 'INACTIVO' && (
                          <button className="btn bg-slate-500 text-white btn-sm transition-all shadow-md cursor-pointer !w-8 !h-8 !p-0 flex items-center justify-center font-bold hover:scale-110" onClick={() => setInactivating(p)} title="Inactivar">🔒</button>
                        )}
                        <button className="btn bg-[var(--red-var)] text-white btn-sm transition-all shadow-md cursor-pointer !w-8 !h-8 !p-0 flex items-center justify-center font-bold hover:scale-110" onClick={() => setDelId(p.id)} title="Eliminar">🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
