import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/UI/Modal'
import Confirm from '../../components/UI/Confirm'
import { fmtUSD } from '../../utils/format'
import { addToSyncQueue, processSyncQueue } from '../../utils/syncManager'

const empty = { rif: '', nombre: '', direccion: '', ciudad: '', telefono: '', email: '', limite_credito: 0, observaciones: '', estado: 'ACTIVO' }

export default function Clientes() {
  const toast = useStore(s => s.toast)
  const [busq, setBusq] = useState('')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [delId, setDelId] = useState(null)
  const [inactivating, setInactivating] = useState(null)

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
    const payload = { ...form, limite_credito: parseFloat(form.limite_credito) || 0 }

    try {
      if (editing) {
        await db.clientes.update(editing, payload)
        toast('Cliente actualizado localmente')
      } else {
        await db.clientes.add(payload)
        toast('Cliente agregado localmente')
      }

      // ☁️ SYNC AUTOMÁTICA CON SUPABASE (VIA COLA)
      await addToSyncQueue('clientes', 'INSERT', {
        rif: payload.rif.trim(),
        nombre: payload.nombre.trim(),
        telefono: payload.telefono,
        direccion: payload.direccion,
        email: payload.email,
        limite_credito: payload.limite_credito,
        estado: payload.estado || 'ACTIVO',
        motivo_inactivacion: payload.motivo_inactivacion || '',
        fecha_inactivacion: payload.fecha_inactivacion || null,
        inactivado_por: payload.inactivado_por || ''
      })
      processSyncQueue()

      toast('✅ Cola de sincronización actualizada', 'success')
    } catch (err) {
      console.error('Error guardando cliente:', err)
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
      await db.clientes.update(inactivating.id, payload)

      const fullClient = { ...inactivating, ...payload }
      await addToSyncQueue('clientes', 'INSERT', {
        rif: fullClient.rif,
        nombre: fullClient.nombre,
        telefono: fullClient.telefono,
        direccion: fullClient.direccion,
        email: fullClient.email,
        limite_credito: fullClient.limite_credito,
        estado: 'INACTIVO',
        motivo_inactivacion: motivo,
        fecha_inactivacion: payload.fecha_inactivacion,
        inactivado_por: payload.inactivado_por
      })
      processSyncQueue()
      toast('Cliente inactivado correctamente', 'success')
    } catch (err) {
      console.error(err)
      toast('Error al inactivar cliente', 'error')
    }
    setInactivating(null)
  }

  const del = async () => {
    try {
      const cliente = await db.clientes.get(delId)
      if (!cliente) {
        setDelId(null)
        return
      }

      // Validar si tiene deuda en cuentas por cobrar
      const pName = (cliente.nombre || '').toUpperCase()
      const deudas = await db.ctas_cobrar
        .filter(c => {
          if (c.estado === 'COBRADA') return false;
          const cName = (c.cliente || '').toUpperCase();
          return cName === pName || cName.includes(pName);
        })
        .toArray()

      if (deudas.length > 0) {
        toast('Este cliente tiene deuda pendiente. Solo puede ser inactivado.', 'error')
        setDelId(null)
        setInactivating(cliente)
        return
      }

      if (cliente?.rif) {
        await supabase.from('clientes').delete().eq('rif', cliente.rif)
      }
      await db.clientes.delete(delId)
      toast('Cliente eliminado en ambos niveles', 'warn')
    } catch (err) {
      console.error(err)
      await db.clientes.delete(delId)
      toast('Cliente eliminado localmente (Error en nube)', 'warn')
    }
    setDelId(null)
  }

  return (
    <div className="flex flex-col h-full min-h-0 pb-2 md:pb-6 space-y-4">
      <div className="panel flex-1 flex flex-col min-h-0 overflow-hidden transition-all shadow-xl">
        <div className="shrink-0 p-4 border-b border-[var(--border-var)] bg-[var(--surface2)]">
          <div className="flex items-center gap-2 mb-3">
            <span className="panel-title flex-1 !m-0 !p-0 !border-none !text-[var(--text-main)]">FICHA DE CLIENTES</span>
            {useStore.getState().currentUser?.rol !== 'VENDEDOR' && (
              <button className="btn bg-[var(--teal)] text-white btn-sm transition-all shadow-md cursor-pointer hover:scale-105" onClick={openNew}>+ NUEVO CLIENTE</button>
            )}
          </div>
          <input className="inp w-full focus:border-[var(--teal)] transition-all shadow-inner" placeholder="🔍 Buscar por RIF o nombre..." value={busq} onChange={e => setBusq(e.target.value)} />
        </div>
        <div className="flex-1 overflow-auto bg-[var(--bg)] md:bg-transparent pb-24">

          {/* VISTA MÓVIL (TARJETAS) */}
          <div className="md:hidden flex flex-col gap-2 p-3">
            {clientes.map(c => (
              <div key={c.id} className={`bg-[var(--surface)] border-l-8 ${c.estado === 'INACTIVO' ? 'border-l-slate-400 opacity-60' : 'border-l-[var(--teal)]'} border-y border-r border-[var(--border-var)] shadow-sm p-4 relative flex flex-col gap-3 rounded-2xl hover:scale-[1.02] transition-all mb-2`}>

                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[var(--text-main)] text-sm leading-tight truncate uppercase">{c.nombre}</h3>
                      {c.estado === 'INACTIVO' && <span className="bg-slate-200 text-slate-600 text-[8px] px-1 font-black rounded">INACTIVO</span>}
                    </div>
                    <p className="font-mono text-[var(--red-var)] font-black text-[11px] uppercase tracking-wider">{c.rif}</p>
                  </div>
                  {useStore.getState().currentUser?.rol !== 'VENDEDOR' && (
                    <div className="flex gap-2 shrink-0">
                      <button className="text-[var(--orange-var)] hover:opacity-70 p-1" onClick={() => openEdit(c)}>
                        <span className="material-icons-round text-sm">edit</span>
                      </button>
                      <button className="text-[var(--red-var)] hover:opacity-70 p-1" onClick={() => setDelId(c.id)}>
                        <span className="material-icons-round text-sm">delete</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-3 bg-[var(--surfaceDark)] p-2 -mx-2 opacity-90">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="material-icons-round text-[12px] text-[var(--text2)] shrink-0">phone</span>
                    <span className="text-[10px] font-bold text-[var(--text-main)] truncate">{c.telefono || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="material-icons-round text-[12px] text-[var(--text2)] shrink-0">location_on</span>
                    <span className="text-[10px] font-bold text-[var(--text-main)] truncate uppercase">{c.ciudad || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2 min-w-0">
                    <span className="material-icons-round text-[12px] text-[var(--text2)] shrink-0">email</span>
                    <span className="text-[10px] font-bold text-[var(--text-main)] truncate">{c.email || 'N/A'}</span>
                  </div>
                </div>

                {c.limite_credito > 0 && (
                  <div className="flex items-center justify-between p-2 bg-[var(--green-var)]/10 border border-[var(--green-var)]/20 rounded-sm">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--green-var)]">Límite Aprobado</span>
                    <span className="text-[12px] font-black font-mono text-[var(--green-var)]">${fmtUSD(c.limite_credito)}</span>
                  </div>
                )}
                {c.estado === 'INACTIVO' && c.motivo_inactivacion && (
                  <p className="text-[9px] text-slate-500 italic bg-slate-50 p-1 border-t border-slate-100">Motivo: {c.motivo_inactivacion}</p>
                )}
              </div>
            ))}
            {clientes.length === 0 && (
              <div className="text-center text-[var(--text2)] py-12 tracking-widest font-bold uppercase text-xs">SIN CLIENTES</div>
            )}
          </div>

          {/* VISTA ESCRITORIO (TABLA TRADICIONAL) */}
          <div className="hidden md:block tabla-wrap tabla-scroll">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">RIF</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">NOMBRE</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">CIUDAD</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">TELÉFONO</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">ESTADO</th>
                  <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientes.map(c => (
                  <tr key={c.id} className={`${c.estado === 'INACTIVO' ? 'bg-slate-50 opacity-60' : ''} hover:bg-[var(--teal)]/5 transition-all cursor-pointer group hover:scale-[1.005]`}>
                    <td className="font-mono text-[var(--red-var)] font-bold">{c.rif}</td>
                    <td className="font-bold text-[var(--text-main)] uppercase">{c.nombre}</td>
                    <td className="text-[var(--text2)] text-[11px] font-bold uppercase">{c.ciudad}</td>
                    <td className="text-[var(--text2)] text-[11px] font-bold">{c.telefono}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${c.estado === 'INACTIVO' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                        {c.estado}
                      </span>
                    </td>
                    <td className="text-right">
                      {useStore.getState().currentUser?.rol !== 'VENDEDOR' && (
                        <div className="flex gap-1 justify-end">
                          <button className="btn bg-[var(--orange-var)] text-white btn-sm transition-all shadow-md cursor-pointer !w-8 !h-8 !p-0 flex items-center justify-center font-bold hover:scale-110" onClick={() => openEdit(c)} title="Editar">✏</button>
                          {c.estado !== 'INACTIVO' && (
                            <button className="btn bg-slate-500 text-white btn-sm transition-all shadow-md cursor-pointer !w-8 !h-8 !p-0 flex items-center justify-center font-bold hover:scale-110" onClick={() => setInactivating(c)} title="Inactivar">🔒</button>
                          )}
                          <button className="btn bg-[var(--red-var)] text-white btn-sm transition-all shadow-md cursor-pointer !w-8 !h-8 !p-0 flex items-center justify-center font-bold hover:scale-110" onClick={() => setDelId(c.id)} title="Eliminar">🗑</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {clientes.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-[var(--text2)] py-12 tracking-widest font-bold uppercase">SIN CLIENTES</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'EDITAR CLIENTE' : 'NUEVO CLIENTE'}>
        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label>RIF</label>
            <input className="inp transition-none focus:border-[var(--teal)] rounded-none" value={form.rif} onChange={e => f('rif', e.target.value)} placeholder="J-12345678-9" />
          </div>
          <div className="field">
            <label>Teléfono</label>
            <input className="inp transition-none focus:border-[var(--teal)] rounded-none" value={form.telefono} onChange={e => f('telefono', e.target.value)} />
          </div>
          <div className="field col-span-2">
            <label>Nombre / Razón Social *</label>
            <input className="inp transition-none focus:border-[var(--teal)] rounded-none uppercase" value={form.nombre} onChange={e => f('nombre', e.target.value)} />
          </div>
          <div className="field col-span-2">
            <label>Dirección</label>
            <input className="inp transition-none focus:border-[var(--teal)] rounded-none uppercase" value={form.direccion} onChange={e => f('direccion', e.target.value)} />
          </div>
          <div className="field">
            <label>Ciudad</label>
            <input className="inp transition-none focus:border-[var(--teal)] rounded-none uppercase" value={form.ciudad} onChange={e => f('ciudad', e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="inp transition-none focus:border-[var(--teal)] rounded-none" type="email" value={form.email} onChange={e => f('email', e.target.value)} />
          </div>
          <div className="field">
            <label>Límite de Crédito $</label>
            <input className="inp transition-none focus:border-[var(--teal)] rounded-none" type="number" value={form.limite_credito} onChange={e => f('limite_credito', e.target.value)} step="0.01" inputMode="decimal" />
          </div>
          <div className="field">
            <label>Estado</label>
            <select className="inp transition-none focus:border-[var(--teal)] rounded-none font-bold" value={form.estado} onChange={e => f('estado', e.target.value)}>
              <option value="ACTIVO">ACTIVO</option>
              <option value="INACTIVO">INACTIVO</option>
            </select>
          </div>
          <div className="field col-span-2">
            <label>Observaciones</label>
            <input className="inp transition-none focus:border-[var(--teal)] rounded-none uppercase" value={form.observaciones} onChange={e => f('observaciones', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button className="btn btn-gr flex-1 transition-none shadow-[var(--win-shadow)] cursor-pointer font-bold" onClick={() => setShowModal(false)}>CANCELAR</button>
          <button className="btn bg-[var(--green-var)] text-white flex-1 transition-none shadow-[var(--win-shadow)] cursor-pointer font-bold" onClick={save}>💾 GUARDAR FICHA</button>
        </div>
      </Modal>

      <Modal open={!!inactivating} onClose={() => setInactivating(null)} title="INACTIVAR CLIENTE">
        <div className="space-y-4">
          <p className="text-xs font-bold text-slate-600 uppercase">¿Por qué desea inactivar a <span className="text-[var(--red-var)]">{inactivating?.nombre}</span>?</p>
          <textarea
            className="inp w-full h-24 resize-none uppercase"
            placeholder="Indique el motivo de la inactivación..."
            id="motivo-inact"
          ></textarea>
          <div className="flex gap-2">
            <button className="btn btn-gr flex-1 uppercase font-black text-[10px]" onClick={() => setInactivating(null)}>Cancelar</button>
            <button className="btn bg-slate-800 text-white flex-1 uppercase font-black text-[10px]" onClick={() => {
              const m = document.getElementById('motivo-inact').value;
              if (!m?.trim()) { toast('Debe indicar un motivo', 'warn'); return; }
              handleInactivar(m);
            }}>Confirmar Inactivación</button>
          </div>
        </div>
      </Modal>

      <Confirm open={!!delId} onClose={() => setDelId(null)} onConfirm={del}
        msg="¿Eliminar este cliente?" danger />
    </div>
  )
}
