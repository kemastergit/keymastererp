import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/UI/Modal'
import Confirm from '../../components/UI/Confirm'
import { fmtUSD } from '../../utils/format'
import { addToSyncQueue, processSyncQueue } from '../../utils/syncManager'

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
        limite_credito: payload.limite_credito
      })
      processSyncQueue()

      toast('✅ Cola de sincronización actualizada', 'success')
    } catch (err) {
      console.error('Error guardando cliente:', err)
      toast('⚠️ Error local: ' + err.message, 'error')
    }

    setShowModal(false)
  }

  const del = async () => {
    try {
      const cliente = await db.clientes.get(delId)
      if (cliente?.rif) {
        await supabase.from('clientes').delete().eq('rif', cliente.rif)
      }
      await db.clientes.delete(delId)
      toast('Cliente eliminado en ambos niveles', 'warn')
    } catch (err) {
      await db.clientes.delete(delId)
      toast('Cliente eliminado localmente (Error en nube)', 'warn')
    }
    setDelId(null)
  }

  return (
    <div className="flex flex-col h-full min-h-0 pb-2 md:pb-6 space-y-4">
      <div className="panel flex-1 flex flex-col min-h-0 overflow-hidden transition-none">
        <div className="shrink-0 p-4 border-b border-[var(--border-var)] bg-[var(--surface2)]">
          <div className="flex items-center gap-2 mb-3">
            <span className="panel-title flex-1 !m-0 !p-0 !border-none !text-[var(--text-main)]">FICHA DE CLIENTES</span>
            {useStore.getState().currentUser?.rol !== 'VENDEDOR' && (
              <button className="btn bg-[var(--teal)] text-white btn-sm transition-none shadow-[var(--win-shadow)] cursor-pointer" onClick={openNew}>+ NUEVO</button>
            )}
          </div>
          <input className="inp w-full focus:border-[var(--teal)] transition-none rounded-none" placeholder="🔍 Buscar por RIF o nombre..." value={busq} onChange={e => setBusq(e.target.value)} />
        </div>
        <div className="flex-1 overflow-auto bg-[var(--bg)] md:bg-transparent pb-24">

          {/* VISTA MÓVIL (TARJETAS) */}
          <div className="md:hidden flex flex-col gap-2 p-3">
            {clientes.map(c => (
              <div key={c.id} className="bg-[var(--surface)] border-l-4 border-l-[var(--teal)] border-y border-r border-[var(--border-var)] shadow-sm p-4 relative flex flex-col gap-3">

                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-[var(--text-main)] text-sm leading-tight truncate uppercase">{c.nombre}</h3>
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
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">EMAIL</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">LÍM. CRÉDITO $</th>
                  <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientes.map(c => (
                  <tr key={c.id} className="hover:bg-[var(--surfaceDark)] transition-none">
                    <td className="font-mono text-[var(--red-var)] font-bold">{c.rif}</td>
                    <td className="font-bold text-[var(--text-main)]">{c.nombre}</td>
                    <td className="text-[var(--text2)] text-[11px] font-bold uppercase">{c.ciudad}</td>
                    <td className="text-[var(--text2)] text-[11px] font-bold">{c.telefono}</td>
                    <td className="text-[var(--text2)] text-[11px] font-bold">{c.email}</td>
                    <td className="font-mono text-[var(--text-main)] font-black">{c.limite_credito ? `$ ${fmtUSD(c.limite_credito)}` : '—'}</td>
                    <td className="text-right">
                      {useStore.getState().currentUser?.rol !== 'VENDEDOR' && (
                        <div className="flex gap-1 justify-end">
                          <button className="btn bg-[var(--orange-var)] text-white btn-sm transition-none shadow-[var(--win-shadow)] cursor-pointer !w-8 !h-8 !p-0 flex items-center justify-center font-bold" onClick={() => openEdit(c)}>✏</button>
                          <button className="btn bg-[var(--red-var)] text-white btn-sm transition-none shadow-[var(--win-shadow)] cursor-pointer !w-8 !h-8 !p-0 flex items-center justify-center font-bold" onClick={() => setDelId(c.id)}>🗑</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {clientes.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-[var(--text2)] py-12 tracking-widest font-bold uppercase">SIN CLIENTES</td></tr>
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
            <input className="inp transition-none focus:border-[var(--teal)] rounded-none" value={form.nombre} onChange={e => f('nombre', e.target.value)} />
          </div>
          <div className="field col-span-2">
            <label>Dirección</label>
            <input className="inp transition-none focus:border-[var(--teal)] rounded-none" value={form.direccion} onChange={e => f('direccion', e.target.value)} />
          </div>
          <div className="field">
            <label>Ciudad</label>
            <input className="inp transition-none focus:border-[var(--teal)] rounded-none" value={form.ciudad} onChange={e => f('ciudad', e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="inp transition-none focus:border-[var(--teal)] rounded-none" type="email" value={form.email} onChange={e => f('email', e.target.value)} />
          </div>
          <div className="field col-span-2">
            <label>Límite de Crédito $</label>
            <input className="inp transition-none focus:border-[var(--teal)] rounded-none" type="number" value={form.limite_credito} onChange={e => f('limite_credito', e.target.value)} step="0.01" inputMode="decimal" />
          </div>
          <div className="field col-span-2">
            <label>Observaciones</label>
            <input className="inp transition-none focus:border-[var(--teal)] rounded-none" value={form.observaciones} onChange={e => f('observaciones', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button className="btn btn-gr flex-1 transition-none shadow-[var(--win-shadow)] cursor-pointer font-bold" onClick={() => setShowModal(false)}>CANCELAR</button>
          <button className="btn bg-[var(--green-var)] text-white flex-1 transition-none shadow-[var(--win-shadow)] cursor-pointer font-bold" onClick={save}>💾 GUARDAR FICHA</button>
        </div>
      </Modal>

      <Confirm open={!!delId} onClose={() => setDelId(null)} onConfirm={del}
        msg="¿Eliminar este cliente?" danger />
    </div>
  )
}
