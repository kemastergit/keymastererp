import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import TecladoPin from '../TecladoPin'

export default function ModalAutorizacion({ accion, onAutorizado, onCancel }) {
    const [step, setStep] = useState('user')
    const [selectedUser, setSelectedUser] = useState(null)

    const supervisores = useLiveQuery(() =>
        db.usuarios.where('rol').anyOf(['SUPERVISOR', 'ADMIN']).and(u => u.activo).toArray()
    )

    const handlePin = (pin) => {
        if (selectedUser.pin === pin) {
            onAutorizado(selectedUser)
        } else {
            alert('PIN Incorrecto')
        }
    }

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <div className="bg-white rounded-[40px] max-w-sm w-full shadow-2xl overflow-hidden animate-in zoom-in-95">

                <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Autorización</h3>
                        <p className="text-[10px] text-primary font-black uppercase tracking-widest">{accion}</p>
                    </div>
                    <button onClick={onCancel} className="w-10 h-10 rounded-full hover:bg-slate-100 text-slate-400">
                        <span className="material-icons-round">close</span>
                    </button>
                </div>

                <div className="p-8">
                    {step === 'user' ? (
                        <div className="space-y-4">
                            <p className="text-slate-500 text-xs font-bold text-center mb-6">Seleccione un cargo autorizado para continuar</p>
                            <div className="grid grid-cols-1 gap-2">
                                {supervisores?.map(u => (
                                    <button key={u.id} onClick={() => { setSelectedUser(u); setStep('pin') }}
                                        className="flex justify-between items-center p-4 rounded-2xl border border-slate-100 hover:border-primary hover:bg-primary/5 transition-all text-left group">
                                        <div>
                                            <div className="font-bold text-slate-700">{u.nombre}</div>
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{u.rol}</div>
                                        </div>
                                        <span className="material-icons-round text-slate-200 group-hover:text-primary">chevron_right</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Solicitando a</div>
                                <div className="text-slate-900 font-black text-lg">{selectedUser?.nombre}</div>
                            </div>
                            <TecladoPin onComplete={handlePin} length={selectedUser?.pin.length || 4} />
                            <button onClick={() => setStep('user')} className="w-full py-3 text-slate-400 font-bold text-xs uppercase hover:text-slate-600">
                                Cambiar Usuario
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}
