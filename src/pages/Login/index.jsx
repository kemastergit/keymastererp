import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import TecladoPin from '../../components/TecladoPin'
import { hashPin } from '../../utils/security'
import { logAction } from '../../utils/audit'
import Header from '../../components/Layout/Header'

export default function Login() {
    const [selectedUser, setSelectedUser] = useState(null)
    const login = useStore(s => s.login)
    const toast = useStore(s => s.toast)

    const usuarios = useLiveQuery(() => db.usuarios.toArray())

    const handleComplete = async (pin) => {
        const hashedInput = await hashPin(pin)

        if (selectedUser.pin === hashedInput) {
            toast(`✅ Bienvenido, ${selectedUser.nombre}`)
            logAction(selectedUser, 'LOGIN_EXITOSO', { table_name: 'usuarios', record_id: selectedUser.id })
            login(selectedUser)
            window.location.assign('/')
            return
        }

        if (selectedUser.pin === pin) {
            toast(`✅ Bienvenido, ${selectedUser.nombre}`)
            logAction(selectedUser, 'LOGIN_EXITOSO_MIGRACION_HASH', { table_name: 'usuarios', record_id: selectedUser.id })
            await db.usuarios.update(selectedUser.id, { pin: hashedInput })
            login({ ...selectedUser, pin: hashedInput })
            window.location.assign('/')
            return
        }

        toast('❌ PIN Incorrecto', 'error')
        logAction(selectedUser, 'LOGIN_FAIL', { table_name: 'usuarios', record_id: selectedUser.id, attempt: 'WRONG_PIN' })
    }

    return (
        <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans">
            <Header hideTasa hideUser />

            <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
                <div className="max-w-4xl w-full animate-in fade-in slide-in-from-bottom-4 duration-700">

                    {/* Simplified Client Branding */}
                    <div className="mb-12 flex flex-col items-center text-center">
                        <div className="w-24 h-24 mb-4 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-slate-200 overflow-hidden p-1">
                            <img src="/logoguaicaipuro.jpeg" alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase leading-tight">AUTOMOTORES GUAICAIPURO</h1>
                        <div className="w-12 h-1 bg-primary mt-2"></div>
                    </div>

                    {!selectedUser ? (
                        <div className="space-y-8">
                            <h2 className="text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Seleccione su Usuario para continuar</h2>
                            <div className="flex flex-wrap justify-center gap-6">
                                {usuarios?.map(u => (
                                    <button key={u.id} onClick={() => setSelectedUser(u)}
                                        className="w-48 bg-white border-2 border-transparent p-6 rounded-3xl text-center shadow-xl hover:shadow-2xl hover:border-primary transition-all duration-300 active:scale-95 group">
                                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/10 transition-colors">
                                            <span className="material-icons-round text-3xl text-slate-400 group-hover:text-primary transition-colors">person</span>
                                        </div>
                                        <div className="text-slate-800 font-bold text-lg tracking-tight group-hover:text-primary transition-colors truncate">{u.nombre}</div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{u.rol}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-md mx-auto bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-500">
                            <div className="p-8 pb-4 flex items-center justify-between border-b border-slate-50">
                                <button onClick={() => setSelectedUser(null)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/5 transition-all">
                                    <span className="material-icons-round text-lg">arrow_back</span>
                                </button>
                                <div className="text-right">
                                    <div className="text-slate-400 text-[9px] font-black uppercase tracking-widest">Cajero Activo</div>
                                    <div className="text-slate-800 font-black text-xl tracking-tighter">{selectedUser.nombre}</div>
                                </div>
                            </div>

                            <div className="p-10">
                                <TecladoPin onComplete={handleComplete} length={4} />
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
