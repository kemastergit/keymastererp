import { useState, useEffect } from 'react'
import { useState as useReactState } from 'react' // Avoid collision if needed, but standard useState is fine
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import TecladoPin from '../../components/TecladoPin'
import { hashPin } from '../../utils/security'
import { logAction } from '../../utils/audit'

export default function Login() {
    const [selectedUser, setSelectedUser] = useState(null)
    const login = useStore(s => s.login)
    const toast = useStore(s => s.toast)

    const usuarios = useLiveQuery(() => db.usuarios.toArray())

    const handleComplete = async (pin) => {
        const hashedInput = await hashPin(pin)

        // 1. Intentar comparar con Hash
        if (selectedUser.pin === hashedInput) {
            toast(`✅ Bienvenido, ${selectedUser.nombre}`)
            logAction(selectedUser, 'LOGIN_EXITOSO')
            login(selectedUser)
            window.location.assign('/')
            return
        }

        // 2. Transición: Intentar comparar con texto plano (para usuarios existentes)
        if (selectedUser.pin === pin) {
            toast(`✅ Bienvenido, ${selectedUser.nombre}`)
            logAction(selectedUser, 'LOGIN_EXITOSO_MIGRACION_HASH')
            // Migrar PIN a Hash inmediatamente
            await db.usuarios.update(selectedUser.id, { pin: hashedInput })
            login({ ...selectedUser, pin: hashedInput })
            window.location.assign('/')
            return
        }

        toast('❌ PIN Incorrecto', 'error')
    }

    return (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950" style={{
            backgroundImage: "linear-gradient(rgba(10, 10, 10, 0.85), rgba(10, 10, 10, 0.95)), url('/Gemini_Generated_Image_taflkntaflkntafl.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center'
        }}>
            <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">

                {/* Logo/Hex Decor */}
                <div className="mb-12 flex flex-col items-center text-center">
                    <div className="w-40 h-40 mb-8 relative">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl"></div>
                        <div className="absolute inset-0 bg-white rounded-[40px] flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.2)] overflow-hidden border-2 border-primary/50 p-2">
                            <img src="/logoguaicaipuro.jpeg" alt="Logo" className="w-full h-full object-contain" />
                        </div>
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-widest uppercase leading-tight">AUTOMOTORES GUAICAIPURO</h1>
                    <p className="text-primary font-bold text-[10px] tracking-[0.4em] uppercase mt-4">SISTEMA DE FACTURACION Y GESTIÓN KEMASTER VER 01</p>
                </div>

                {!selectedUser ? (
                    <div className="space-y-6">
                        <h2 className="text-center text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Seleccione su Usuario</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {usuarios?.map(u => (
                                <button key={u.id} onClick={() => setSelectedUser(u)}
                                    className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl text-center group hover:border-primary transition-all duration-300 active:scale-95">
                                    <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/10 transition-colors">
                                        <span className="material-icons-round text-2xl text-zinc-500 group-hover:text-primary transition-colors">person</span>
                                    </div>
                                    <div className="text-zinc-300 font-bold text-sm tracking-tight group-hover:text-white">{u.nombre}</div>
                                    <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">{u.rol}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 py-4 bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-12">
                        <div className="px-8 pt-6 flex items-center justify-between">
                            <button onClick={() => setSelectedUser(null)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600">
                                <span className="material-icons-round">arrow_back</span>
                            </button>
                            <div className="text-right">
                                <div className="text-slate-400 text-[9px] font-black uppercase tracking-widest">Ingresar PIN</div>
                                <div className="text-slate-900 font-black text-lg">{selectedUser.nombre}</div>
                            </div>
                        </div>

                        <div className="pb-10">
                            <TecladoPin onComplete={handleComplete} length={selectedUser.pin.length} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
