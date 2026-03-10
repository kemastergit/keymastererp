import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { hashPin } from '../../utils/security'
import { logAction } from '../../utils/audit'
import { supabase } from '../../lib/supabase'
import { invalidateRolesCache } from '../../hooks/usePermiso'

const getPermissionsList = (rol) => {
    const allPermissions = [
        { id: 'ventas', label: 'Cotizar y Enviar Pre-Factura', access: ['ADMIN', 'SUPERVISOR', 'CAJERO', 'VENDEDOR'] },
        { id: 'catalogo', label: 'Consultar Catálogo', access: ['ADMIN', 'SUPERVISOR', 'CAJERO', 'VENDEDOR'] },
        { id: 'turnos', label: 'Aperturar/Cerrar Cajas', access: ['ADMIN', 'SUPERVISOR', 'CAJERO'] },
        { id: 'cobrar', label: 'Facturar y Recibir Pagos', access: ['ADMIN', 'SUPERVISOR', 'CAJERO'] },
        { id: 'caja', label: 'Cierre Definitivo / Cierres Z', access: ['ADMIN', 'SUPERVISOR', 'CAJERO'] },
        { id: 'clientes', label: 'Deudas y Directorio Clientes', access: ['ADMIN', 'SUPERVISOR', 'CAJERO'] },
        { id: 'reportes', label: 'Ver Reportes y Ventas', access: ['ADMIN', 'SUPERVISOR', 'CAJERO'] },
        { id: 'inventario', label: 'Modificar Datos Inventario', access: ['ADMIN', 'SUPERVISOR'] },
        { id: 'compras', label: 'Registrar Facturas Compras', access: ['ADMIN', 'SUPERVISOR'] },
        { id: 'proveedores', label: 'Directorio y Pagos a Proveedores', access: ['ADMIN', 'SUPERVISOR'] },
        { id: 'ajustes', label: 'Supervisión de Precios', access: ['ADMIN', 'SUPERVISOR'] },
        { id: 'usuarios', label: 'Crear / Editar Operadores', access: ['ADMIN'] },
        { id: 'auditoria', label: 'Historial Inalterable (Logs)', access: ['ADMIN'] },
        { id: 'config', label: 'Configuración Avanzada', access: ['ADMIN'] }
    ]
    return allPermissions.map(p => ({ ...p, hasAccess: p.access.includes(rol) }))
}
import Modal from '../../components/UI/Modal'

export default function Usuarios() {
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({ nombre: '', rol: 'CAJERO', pin: '', activo: true })
    const [commissionForm, setCommissionForm] = useState({ commission_type: 'SALES_PCT', percentage: 0, active: true })
    const [rolesDB, setRolesDB] = useState([])
    const toast = useStore(s => s.toast)

    const usuarios = useLiveQuery(() => db.usuarios.toArray(), [], [])

    useEffect(() => {
        supabase.from('roles').select('codigo, nombre_display, color, orden').eq('activo', true).order('orden')
            .then(({ data }) => { if (data) setRolesDB(data) })
    }, [])

    const handleSave = async (e) => {
        e.preventDefault()
        if (form.pin.length < 4) return toast('PIN debe ser de al menos 4 dígitos', 'warn')

        try {
            const hashedPin = await hashPin(form.pin)
            const userData = { ...form, pin: hashedPin }
            const currentUser = useStore.getState().currentUser

            let userId = editing?.id;

            if (editing) {
                const oldUser = await db.usuarios.get(editing.id)
                await db.usuarios.update(editing.id, userData)

                // Actualizar/Crear configuración de comisión
                const existingComm = await db.comisiones_config.where('user_id').equals(editing.id).first()
                if (existingComm) {
                    await db.comisiones_config.update(existingComm.id, commissionForm)
                } else {
                    await db.comisiones_config.add({ ...commissionForm, user_id: editing.id })
                }

                let action = 'USUARIO_ACTUALIZADO'
                if (oldUser?.rol !== form.rol) action = 'CAMBIO_ROL'

                logAction(currentUser, action, {
                    table_name: 'usuarios', record_id: editing.id, old_value: oldUser, new_value: { ...userData, id: editing.id }
                })
                toast('✅ Usuario actualizado localmente')
            } else {
                userId = await db.usuarios.add({ ...userData, fecha_creacion: new Date() })

                // Crear configuración de comisión para el nuevo usuario
                await db.comisiones_config.add({ ...commissionForm, user_id: userId })

                logAction(currentUser, 'USUARIO_CREADO', {
                    table_name: 'usuarios', record_id: userId, new_value: { ...userData, id: userId, fecha_creacion: new Date() }
                })
                toast('✅ Usuario creado localmente')
            }

            // SINCRONIZACIÓN EN TIEMPO REAL CON SUPABASE
            const { error: syncError } = await supabase
                .from('usuarios')
                .upsert({
                    nombre: userData.nombre.trim(),
                    pin: userData.pin,
                    rol: userData.rol,
                    activo: userData.activo
                }, { onConflict: 'nombre' })

            if (syncError) throw syncError

            invalidateRolesCache() // Limpiar cache de permisos

            // SINCRONIZACIÓN DE COMISIÓN
            try {
                const commData = {
                    user_id: userData.nombre.trim(), // Nombre como ID de enlace
                    tipo: commissionForm.commission_type,
                    porcentaje: commissionForm.percentage,
                    active: commissionForm.active
                }
                const { error: commError } = await supabase.from('comisiones_config').upsert(commData, { onConflict: 'user_id' })
                if (commError) throw commError
            } catch (commErr) {
                console.warn("⚠️ Falló sincronización de comisión, encolando...", commErr)
                const { addToSyncQueue } = await import('../../utils/syncManager')
                await addToSyncQueue('comisiones_config', 'UPSERT', {
                    user_id: userData.nombre.trim(),
                    tipo: commissionForm.commission_type,
                    porcentaje: commissionForm.percentage,
                    active: commissionForm.active
                })
            }

            toast('🛰️ Credenciales y Comisiones sincronizadas', 'success')

            setShowModal(false)
            setEditing(null)
            setForm({ nombre: '', rol: 'CAJERO', pin: '', activo: true })
            setCommissionForm({ commission_type: 'SALES_PCT', percentage: 0, active: true })
        } catch (err) {
            console.error("Error al guardar usuario:", err)
            toast('Error: ' + (err.message || 'No se pudo guardar el usuario'), 'error')
        }
    }

    const toggleActivo = async (u) => {
        const admins = usuarios.filter(x => x.rol === 'ADMIN' && x.activo)
        if (u.rol === 'ADMIN' && u.activo && admins.length <= 1) {
            return toast('Debe existir al menos un ADMIN activo', 'error')
        }

        const nuevoEstado = !u.activo
        await db.usuarios.update(u.id, { activo: nuevoEstado })

        // Sincronizar cambio de estado en la nube
        try {
            await supabase.from('usuarios').update({ activo: nuevoEstado }).eq('nombre', u.nombre)
            toast(`Operador ${nuevoEstado ? 'Activado' : 'Desactivado'} en Nube`)
        } catch (err) {
            console.error('Error sync estado:', err)
        }
    }

    return (
        <div className="space-y-6 pr-2 pb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-[var(--surface2)] p-6 border-b-4 border-[var(--teal)] shadow-[var(--win-shadow)]">
                <div>
                    <h1 className="text-3xl font-black text-[var(--text-main)] uppercase tracking-tighter">GESTIÓN DE PERSONAL Y ACCESOS</h1>
                    <p className="text-[var(--text2)] font-black text-xs uppercase tracking-widest mt-1 opacity-60">ADMINISTRACIÓN DE ROLES, PERMISOS Y SEGURIDAD OPERATIVA</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="btn bg-[var(--teal)] text-white px-8 py-4 font-black text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer rounded-none uppercase tracking-widest" onClick={() => setShowModal(true)}>
                        <span className="material-icons-round text-base">person_add</span>
                        <span>ALTA DE USUARIO</span>
                    </button>
                </div>
            </div>

            <div className="panel p-0 overflow-hidden transition-none shadow-[var(--win-shadow)]">
                <table className="w-full border-separate border-spacing-0">
                    <thead>
                        <tr className="bg-slate-800 text-white">
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Nombre</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Rol / Cargo</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Estado</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Último Acceso</th>
                            <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {usuarios?.map(u => (
                            <tr key={u.id} className={`${!u.activo ? 'opacity-50 italic grayscale bg-[var(--surfaceDark)]' : 'hover:bg-[var(--surfaceDark)]'} transition-none`}>
                                <td className="font-bold text-[var(--text-main)] py-3 px-4">{u.nombre}</td>
                                <td className="py-3 px-4">
                                    <span className={`badge shadow-[var(--win-shadow)] ${u.rol === 'ADMIN' ? 'bg-[var(--red-var)] text-white' : u.rol === 'SUPERVISOR' ? 'bg-[var(--orange-var)] text-white' : 'badge-g'}`}>
                                        {u.rol}
                                    </span>
                                </td>
                                <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-none border border-black/10 ${u.activo ? 'bg-[var(--teal)]' : 'bg-slate-300'}`}></div>
                                        <span className="text-[10px] font-black uppercase text-[var(--text2)]">{u.activo ? 'Activo' : 'Inactivo'}</span>
                                    </div>
                                </td>
                                <td className="text-[var(--text2)] text-[10px] font-mono py-3 px-4">{u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString() : 'Nunca'}</td>
                                <td className="text-right py-3 px-4">
                                    <div className="flex justify-end gap-1">
                                        <button className="btn bg-[var(--surface2)] text-[var(--text-main)] !p-2 transition-none shadow-[var(--win-shadow)] cursor-pointer" title="Editar"
                                            onClick={async () => {
                                                setEditing(u);
                                                setForm(u);
                                                const comm = await db.comisiones_config.where('user_id').equals(u.id).first()
                                                if (comm) setCommissionForm({ commission_type: comm.commission_type, percentage: comm.percentage, active: comm.active })
                                                else setCommissionForm({ commission_type: 'SALES_PCT', percentage: 0, active: true })
                                                setShowModal(true)
                                            }}>
                                            <span className="material-icons-round text-base">edit</span>
                                        </button>
                                        <button className={`btn !p-2 transition-none shadow-[var(--win-shadow)] cursor-pointer ${u.activo ? 'bg-[var(--red-var)] text-white' : 'btn-gr'}`} title={u.activo ? 'Desactivar' : 'Activar'}
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

            <Modal open={showModal} onClose={() => { setShowModal(false); setEditing(null) }}
                title={editing ? 'ACTUALIZAR CREDENCIALES DE USUARIO' : 'REGISTRO DE NUEVO OPERADOR'} wide={true}>
                <form className="flex flex-col lg:flex-row gap-6 items-start" onSubmit={handleSave}>

                    {/* COLUMNA IZQUIERDA: DATOS Y CREDENCIALES */}
                    <div className="flex-1 w-full space-y-6">
                        <div className="field">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">NOMBRE COMPLETO DEL OPERADOR *</label>
                            <input type="text" required className="inp !py-4 rounded-none focus:border-[var(--teal)] transition-none shadow-inner font-black uppercase text-sm" placeholder="EJ: MARIA DELGADO"
                                value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value.toUpperCase() })} />
                        </div>

                        <div className="field">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">ROL / CARGO EN EL SISTEMA</label>
                            <select className="inp !py-4 rounded-none focus:border-[var(--teal)] transition-none uppercase text-xs font-black shadow-inner" value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
                                {rolesDB.length > 0
                                    ? rolesDB.map(r => (
                                        <option key={r.codigo} value={r.codigo}>{r.nombre_display}</option>
                                    ))
                                    : (
                                        // Fallback si no hay conexión
                                        <>
                                            <option value="CAJERO">VENDEDOR DE MOSTRADOR / CAJERO</option>
                                            <option value="VENDEDOR">VENDEDOR DE CALLE (SOLO PRE-FACTURA)</option>
                                            <option value="SUPERVISOR">SUPERVISOR DE PISO / GERENTE</option>
                                            <option value="ADMIN">ADMINISTRADOR TOTAL</option>
                                        </>
                                    )
                                }
                            </select>
                            {rolesDB.length > 0 && (
                                <p className="text-[9px] font-bold text-[var(--teal)] mt-1 opacity-70">✓ {rolesDB.length} roles cargados desde la base de datos</p>
                            )}
                        </div>

                        <div className="field">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">PIN DE SEGURIDAD (4-6 DÍGITOS)</label>
                            <input type="password" required className="inp !py-4 font-mono tracking-widest rounded-none focus:border-[var(--teal)] transition-none shadow-inner font-black text-center text-xl" maxLength={6}
                                value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} />
                            <p className="text-[10px] font-black text-[var(--text2)] mt-2 uppercase opacity-40 text-center italic">Este PIN será requerido para iniciar sesión</p>
                        </div>

                        <div className="bg-[var(--surfaceDark)] p-6 border-t-2 border-[var(--orange-var)] space-y-4">
                            <h3 className="text-xs font-black text-[var(--orange-var)] uppercase tracking-widest flex items-center gap-2">
                                <span className="material-icons-round text-sm">payments</span>
                                Incentivos y Comisiones
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="field">
                                    <label className="text-[9px] font-black uppercase text-[var(--text2)]">Tipo de Comisión</label>
                                    <select className="inp bg-[var(--surface2)] !py-3 text-[10px] font-black"
                                        value={commissionForm.commission_type}
                                        onChange={e => setCommissionForm({ ...commissionForm, commission_type: e.target.value })}>
                                        <option value="SALES_PCT">% SOBRE VENTA</option>
                                        <option value="PROFIT_PCT">% SOBRE UTILIDAD</option>
                                    </select>
                                </div>
                                <div className="field">
                                    <label className="text-[9px] font-black uppercase text-[var(--text2)]">Porcentaje (%)</label>
                                    <input type="number" step="0.01" className="inp bg-[var(--surface2)] !py-3 text-center font-black"
                                        value={commissionForm.percentage}
                                        onChange={e => setCommissionForm({ ...commissionForm, percentage: parseFloat(e.target.value) || 0 })} />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={commissionForm.active}
                                    onChange={e => setCommissionForm({ ...commissionForm, active: e.target.checked })}
                                    className="w-4 h-4 accent-[var(--teal)]" />
                                <label className="text-[9px] font-black uppercase text-[var(--text2)] pt-0.5">Generar Comisiones activas</label>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-[var(--border-var)]">
                            <button type="button" className="btn bg-[var(--surfaceDark)] text-[var(--text-main)] flex-1 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer tracking-widest" onClick={() => { setShowModal(false); setEditing(null) }}>ABORTAR</button>
                            <button type="submit" className="btn bg-[var(--teal)] text-white flex-2 justify-center py-4 font-black uppercase text-[10px] sm:text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer tracking-widest">
                                <span className="material-icons-round text-base">verified_user</span>
                                <span className="hidden sm:inline">{editing ? 'ACTUALIZAR' : 'REGISTRAR'} OPERADOR</span>
                                <span className="sm:hidden">{editing ? 'ACTUALIZAR' : 'REGISTRAR'}</span>
                            </button>
                        </div>
                    </div>

                    {/* COLUMNA DERECHA: REVISIÓN DE PERMISOS */}
                    <div className="w-full lg:w-80 bg-[var(--surface2)] border border-[var(--border-var)] p-4 flex flex-col rounded-sm shrink-0 self-stretch">
                        <h3 className="text-[10px] font-black uppercase text-[var(--teal)] mb-3 tracking-widest border-b border-[var(--border-var)] pb-2 flex justify-between items-center">
                            <span>Permisos (Vista Previa)</span>
                            <span className="material-icons-round text-[14px]">visibility</span>
                        </h3>

                        <div className="flex-1 space-y-1.5 overflow-y-auto custom-scroll pr-1 max-h-[50vh] lg:max-h-[60vh]">
                            {getPermissionsList(form.rol || 'CAJERO').map(p => (
                                <div key={p.id} className={`flex items-center gap-2.5 p-2 border transition-all ${p.hasAccess ? 'border-[var(--teal)] bg-[var(--teal)]/10 text-[var(--teal)]' : 'border-dashed border-[var(--border-var)] bg-[var(--surfaceDark)] text-[var(--text2)] opacity-40'}`}>
                                    <span className="material-icons-round text-sm shrink-0">{p.hasAccess ? 'check_circle' : 'block'}</span>
                                    <span className="text-[9px] font-bold uppercase tracking-wider leading-tight pt-px">{p.label}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t border-[var(--border-var)] text-center pb-2">
                            <span className="material-icons-round text-2xl text-[var(--orange-var)] mb-1 opacity-50">warning_amber</span>
                            <p className="text-[8px] uppercase tracking-widest font-black text-[var(--text2)] leading-relaxed">
                                Seleccione el ROL en la izquierda para<br />evaluar lo que este usuario verá.
                            </p>
                        </div>
                    </div>

                </form>
            </Modal>
        </div>
    )
}
