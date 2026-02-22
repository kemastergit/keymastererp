import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'

export default function Usuarios() {
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({ nombre: '', rol: 'CAJERO', pin: '', activo: true })
    const toast = useStore(s => s.toast)

    const usuarios = useLiveQuery(() => db.usuarios.toArray(), [], [])

    const handleSave = async (e) => {
        e.preventDefault()
        if (form.pin.length < 4) return toast('PIN debe ser de al menos 4 dígitos', 'warn')

        try {
            if (editing) {
                await db.usuarios.update(editing.id, form)
                toast('✅ Usuario actualizado')
            } else {
                await db.usuarios.add({ ...form, fecha_creacion: new Date() })
                toast('✅ Usuario creado')
            }
            setShowModal(false)
            setEditing(null)
            setForm({ nombre: '', rol: 'CAJERO', pin: '', activo: true })
        } catch (err) {
            toast('Error: El nombre de usuario ya existe', 'error')
        }
    }

    const toggleActivo = async (u) => {
        const admins = usuarios.filter(x => x.rol === 'ADMIN' && x.activo)
        if (u.rol === 'ADMIN' && u.activo && admins.length <= 1) {
            return toast('Debe existir al menos un ADMIN activo', 'error')
        }
        await db.usuarios.update(u.id, { activo: !u.activo })
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Gestión de Usuarios</h1>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Administración de acceso y roles (RBAC)</p>
                </div>
                <button className="btn btn-primary !py-3 !px-6" onClick={() => setShowModal(true)}>
                    <span className="material-icons-round">person_add</span>
                    <span>NUEVO USUARIO</span>
                </button>
            </div>

            <div className="panel p-0 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Rol / Cargo</th>
                            <th>Estado</th>
                            <th>Último Acceso</th>
                            <th className="text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usuarios?.map(u => (
                            <tr key={u.id} className={!u.activo ? 'opacity-50 italic grayscale' : ''}>
                                <td className="font-bold text-slate-700">{u.nombre}</td>
                                <td>
                                    <span className={`badge ${u.rol === 'ADMIN' ? 'badge-r' : u.rol === 'SUPERVISOR' ? 'badge-y' : 'badge-g'}`}>
                                        {u.rol}
                                    </span>
                                </td>
                                <td>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${u.activo ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                                        <span className="text-[10px] font-bold uppercase">{u.activo ? 'Activo' : 'Inactivo'}</span>
                                    </div>
                                </td>
                                <td className="text-slate-400 text-[10px] font-mono">{u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString() : 'Nunca'}</td>
                                <td className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <button className="btn btn-gr !p-2" title="Editar" onClick={() => { setEditing(u); setForm(u); setShowModal(true) }}>
                                            <span className="material-icons-round text-base">edit</span>
                                        </button>
                                        <button className={`btn !p-2 ${u.activo ? 'btn-r' : 'btn-gr'}`} title={u.activo ? 'Desactivar' : 'Activar'}
                                            onClick={() => toggleActivo(u)}>
                                            <span className="material-icons-round text-base">{u.activo ? 'block' : 'check_circle'}</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <form className="bg-white p-6 rounded-[32px] max-w-sm w-full shadow-2xl animate-in zoom-in-95" onSubmit={handleSave}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{editing ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
                            <button type="button" onClick={() => { setShowModal(false); setEditing(null) }} className="text-slate-400 hover:text-slate-600">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="field">
                                <label>Nombre Completo</label>
                                <input type="text" required className="inp !py-3" placeholder="Ej: Maria Delgado"
                                    value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value.toUpperCase() })} />
                            </div>

                            <div className="field">
                                <label>Rol del Sistema</label>
                                <select className="inp !py-3" value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
                                    <option value="CAJERO">CAJERO (Facturación)</option>
                                    <option value="SUPERVISOR">SUPERVISOR (Control)</option>
                                    <option value="ADMIN">ADMINISTRADOR (Todo)</option>
                                </select>
                            </div>

                            <div className="field">
                                <label>PIN de Acceso (4-6 dígitos)</label>
                                <input type="password" required className="inp !py-3 font-mono tracking-widest" maxLength={6}
                                    value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="submit" className="btn btn-primary flex-1 !py-3 font-black">GUARDAR CAMBIOS</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}
