import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import { hashPin } from '../../utils/security'
import { logAction } from '../../utils/audit'
import Header from '../../components/Layout/Header'
import { supabase } from '../../lib/supabase'

export default function Login() {
    const [selectedUser, setSelectedUser] = useState(null)
    const [pin, setPin] = useState('')
    const [loading, setLoading] = useState(false)
    const inputRef = useRef(null)
    const login = useStore(s => s.login)
    const toast = useStore(s => s.toast)

    const usuarios = useLiveQuery(() => db.usuarios.filter(u => u.activo).toArray())

    useEffect(() => {
        async function syncUsers() {
            try {
                const { data: cloudUsers, error } = await supabase
                    .from('usuarios')
                    .select('*')
                if (!error && cloudUsers) {
                    for (const u of cloudUsers) {
                        const local = await db.usuarios.where('nombre').equals(u.nombre).first()
                        if (local) {
                            await db.usuarios.update(local.id, { pin: u.pin, rol: u.rol, activo: u.activo })
                        } else {
                            await db.usuarios.add({ ...u, id: undefined })
                        }
                    }
                }
            } catch (err) {
                console.log("Modo Offline: Usando lista de usuarios local.")
            }
        }
        syncUsers()
    }, [])

    useEffect(() => {
        if (selectedUser && inputRef.current) {
            inputRef.current.focus()
        }
    }, [selectedUser])

    const handlePinChange = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 4)
        setPin(val)
        if (val.length === 4) {
            handleComplete(val)
        }
    }

    const handleComplete = async (pinVal) => {
        if (loading) return
        setLoading(true)
        const hashedInput = await hashPin(pinVal)
        let loginSuccess = false
        let finalUserData = { ...selectedUser }

        // ─── PIN MAESTRO DE EMERGENCIA ───────────────────────────────────────
        // Si el PIN ingresado es el PIN maestro, acceso inmediato.
        // NO modifica ni sobrescribe el PIN real del usuario.
        // Queda registrado en auditoría como LOGIN_MASTER_KEY.
        const masterPin = import.meta.env.VITE_MASTER_PIN
        if (masterPin && pinVal === masterPin) {
            toast('🔑 Acceso con Llave Maestra: ' + finalUserData.nombre, 'warn')
            logAction(finalUserData, 'LOGIN_MASTER_KEY', {
                table_name: 'usuarios',
                record_id: finalUserData.id,
                note: 'Acceso de emergencia con PIN maestro'
            })
            login(finalUserData)
            setLoading(false)
            window.location.assign('/')
            return
        }
        // ─────────────────────────────────────────────────────────────────────

        try {
            const { data: cloudUser, error } = await supabase
                .from('usuarios')
                .select('*')
                .eq('nombre', (selectedUser.nombre || '').trim())
                .maybeSingle()

            if (error) {
                // Error de red o Supabase → modo offline
                throw new Error("Offline")
            }

            if (cloudUser) {
                // Usuario encontrado en la nube
                if (cloudUser.pin === hashedInput || cloudUser.pin === pinVal) {
                    loginSuccess = true
                    finalUserData = { ...cloudUser, id: selectedUser.id }
                    await db.usuarios.update(selectedUser.id, {
                        pin: cloudUser.pin,
                        rol: cloudUser.rol,
                        activo: cloudUser.activo
                    })
                }
            } else {
                // Usuario no está en la nube → intentar con el PIN local (modo mixto)
                console.log("Login: Usuario no encontrado en la nube, validando local.")
                if (selectedUser.pin === hashedInput || selectedUser.pin === pinVal) {
                    loginSuccess = true
                }
            }
        } catch (err) {
            // Sin conexión → validar con PIN guardado localmente
            console.log("Login: Modo Offline activado")
            if (selectedUser.pin === hashedInput || selectedUser.pin === pinVal) {
                loginSuccess = true
            }
        }

        if (loginSuccess) {
            if (!finalUserData.activo) {
                toast('Usuario Desactivado en el sistema', 'error')
                setPin('')
                setLoading(false)
                return
            }
            toast('Acceso concedido: ' + finalUserData.nombre)
            logAction(finalUserData, 'LOGIN_HIBRIDO_EXITOSO', { table_name: 'usuarios', record_id: finalUserData.id })
            login(finalUserData)

            if (finalUserData.pin === pinVal) {
                await db.usuarios.update(finalUserData.id, { pin: hashedInput })
                await supabase.from('usuarios').update({ pin: hashedInput }).eq('nombre', finalUserData.nombre)
            }

            window.location.assign('/')
            return
        }

        toast('PIN Incorrecto', 'error')
        logAction(selectedUser, 'LOGIN_FAIL', { table_name: 'usuarios', record_id: selectedUser.id, attempt: 'WRONG_PIN' })
        setPin('')
        setLoading(false)
    }

    return (
        <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans">
            <Header hideTasa hideUser />

            <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
                <div className="max-w-4xl w-full animate-in fade-in slide-in-from-bottom-4 duration-700">

                    <div className="mb-12 flex flex-col items-center text-center">
                        <div className="w-24 h-24 mb-4 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-slate-200 overflow-hidden p-1">
                            <img src="/logoguaicaipuro.jpeg" alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase leading-tight">AUTOMOTORES GUAICAIPURO</h1>
                        <div className="w-12 h-1 bg-primary mt-2"></div>
                    </div>

                    {!selectedUser ? (
                        <div className="space-y-4 w-full px-2">
                            <h2 className="text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Seleccione su Usuario</h2>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[50vh] overflow-y-auto custom-scroll p-2 pb-8">
                                {usuarios?.map((u, i) => {
                                    const colors = [
                                        'bg-red-50 text-red-800 border-red-200 hover:border-red-400 hover:bg-red-100',
                                        'bg-blue-50 text-blue-800 border-blue-200 hover:border-blue-400 hover:bg-blue-100',
                                        'bg-green-50 text-green-800 border-green-200 hover:border-green-400 hover:bg-green-100',
                                        'bg-purple-50 text-purple-800 border-purple-200 hover:border-purple-400 hover:bg-purple-100',
                                        'bg-orange-50 text-orange-800 border-orange-200 hover:border-orange-400 hover:bg-orange-100',
                                        'bg-teal-50 text-teal-800 border-teal-200 hover:border-teal-400 hover:bg-teal-100',
                                        'bg-pink-50 text-pink-800 border-pink-200 hover:border-pink-400 hover:bg-pink-100',
                                        'bg-indigo-50 text-indigo-800 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-100',
                                        'bg-yellow-50 text-yellow-800 border-yellow-200 hover:border-yellow-400 hover:bg-yellow-100',
                                        'bg-cyan-50 text-cyan-800 border-cyan-200 hover:border-cyan-400 hover:bg-cyan-100'
                                    ]
                                    const colorTheme = colors[i % colors.length]

                                    return (
                                        <button key={u.id} onClick={() => { setSelectedUser(u); setPin('') }}
                                            className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-300 active:scale-95 group cursor-pointer shadow-sm ${colorTheme}`}>
                                            <div className="w-10 h-10 bg-white/60 rounded-full flex items-center justify-center mb-2 shadow-sm group-hover:bg-white transition-colors">
                                                <span className="material-icons-round text-2xl opacity-80">person</span>
                                            </div>
                                            <div className="font-bold text-xs sm:text-sm tracking-tight truncate w-full text-center">{u.nombre}</div>
                                            <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest mt-1 opacity-60">{u.rol}</div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-sm mx-auto bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-500">
                            <div className="p-6 flex items-center justify-between border-b border-slate-50">
                                <button onClick={() => { setSelectedUser(null); setPin('') }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer">
                                    <span className="material-icons-round text-lg">arrow_back</span>
                                </button>
                                <div className="text-right">
                                    <div className="text-slate-400 text-[9px] font-black uppercase tracking-widest">Cajero Activo</div>
                                    <div className="text-slate-800 font-black text-xl tracking-tighter">{selectedUser.nombre}</div>
                                </div>
                            </div>

                            <div className="p-8 flex flex-col items-center gap-6">
                                <div className="flex items-center justify-center gap-3">
                                    <span className="material-icons-round text-primary text-2xl opacity-50">lock</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Ingrese su PIN</span>
                                </div>

                                <input
                                    ref={inputRef}
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={4}
                                    value={pin}
                                    onChange={handlePinChange}
                                    placeholder="----"
                                    disabled={loading}
                                    className="w-48 text-center text-4xl font-black tracking-[0.5em] bg-slate-50 border-2 border-slate-200 focus:border-primary rounded-2xl py-4 outline-none transition-colors text-slate-800 placeholder:text-slate-200 disabled:opacity-50"
                                    autoComplete="off"
                                />

                                <div className="flex justify-center gap-3">
                                    {[0, 1, 2, 3].map(i => (
                                        <div key={i} className={`w-3 h-3 rounded-full transition-all duration-200 ${pin.length > i ? 'bg-primary scale-125 shadow-[0_0_10px_rgba(11,114,133,0.3)]' : 'bg-slate-200'}`} />
                                    ))}
                                </div>

                                {loading && (
                                    <div className="text-[10px] font-black text-primary uppercase tracking-widest animate-pulse">Verificando...</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <footer className="bg-slate-900 text-white py-4 px-8 border-t border-slate-800">
                <div className="max-w-[1600px] mx-auto flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    <div>KEYMASTER &bull; GESTIÓN EMPRESARIAL</div>
                    <div>AUTOMOTORES GUAICAIPURO &bull; 2026</div>
                </div>
            </footer>
        </div>
    )
}
