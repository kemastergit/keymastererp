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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-[var(--surface)] border border-[var(--border-var)] shadow-[var(--win-shadow)] rounded-none max-w-sm w-full overflow-hidden animate-in zoom-in-95">

                <div className="p-8 border-b border-[var(--border-var)] bg-[var(--surface2)] flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tighter">Autorización</h3>
                        <p className="text-[10px] text-[var(--teal)] font-black uppercase tracking-widest">{accion}</p>
                    </div>
                    <button onClick={onCancel} className="w-10 h-10 border border-[var(--border-var)] bg-[var(--surface)] hover:bg-[var(--red-var)] hover:text-white text-[var(--text2)] transition-none cursor-pointer">
                        <span className="material-icons-round">close</span>
                    </button>
                </div>

                <div className="p-8 bg-[var(--surface)]">
                    {step === 'user' ? (
                        <div className="space-y-4">
                            <p className="text-[var(--text2)] text-xs font-bold text-center mb-6">Seleccione un cargo autorizado para continuar</p>
                            <div className="grid grid-cols-1 gap-2">
                                {supervisores?.map(u => (
                                    <button key={u.id} onClick={() => { setSelectedUser(u); setStep('pin') }}
                                        className="flex justify-between items-center p-4 bg-[var(--surface2)] border border-[var(--border-var)] hover:bg-[var(--surfaceDark)] transition-none text-left group shadow-[var(--win-shadow)] cursor-pointer">
                                        <div>
                                            <div className="font-bold text-[var(--text-main)]">{u.nombre}</div>
                                            <div className="text-[9px] font-black text-[var(--text2)] uppercase tracking-widest">{u.rol}</div>
                                        </div>
                                        <span className="material-icons-round text-[var(--text2)] group-hover:text-[var(--teal)]">chevron_right</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="text-[10px] text-[var(--text2)] font-bold uppercase mb-1">Solicitando a</div>
                                <div className="text-[var(--text-main)] font-black text-lg">{selectedUser?.nombre}</div>
                            </div>
                            <TecladoPin onComplete={handlePin} length={selectedUser?.pin.length || 4} />
                            <button onClick={() => setStep('user')} className="w-full py-3 text-[var(--text2)] font-bold text-xs uppercase hover:text-[var(--text-main)] transition-none cursor-pointer">
                                Cambiar Usuario
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}
