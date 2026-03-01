import { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import Modal from './Modal'

const emptyCliente = {
    rif: '', nombre: '', direccion: '', ciudad: '',
    telefono: '', email: '', limite_credito: 0, observaciones: ''
}

export default function ClienteSelector({ value, onChange, placeholder = 'Nombre del cliente...' }) {
    const [busq, setBusq] = useState('')
    const [open, setOpen] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState(emptyCliente)
    const wrapRef = useRef(null)

    // Search clients matching the input
    const clientes = useLiveQuery(
        () => {
            const term = busq.trim()
            if (!term) return db.clientes.orderBy('nombre').limit(8).toArray()
            return db.clientes.filter(c =>
                c.nombre?.toLowerCase().includes(term.toLowerCase()) ||
                c.rif?.toLowerCase().includes(term.toLowerCase()) ||
                c.telefono?.includes(term)
            ).limit(8).toArray()
        },
        [busq], []
    )

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleInputChange = (e) => {
        const val = e.target.value
        setBusq(val)
        onChange(val) // also update the parent value as they type
        setOpen(true)
    }

    const selectCliente = (c) => {
        onChange(c.nombre)
        setBusq('')
        setOpen(false)
    }

    const crearRapido = async () => {
        const nombre = busq.trim() || value?.trim()
        if (!nombre) return
        await db.clientes.add({ ...emptyCliente, nombre })
        onChange(nombre)
        setBusq('')
        setOpen(false)
    }

    const openFullForm = () => {
        setForm({ ...emptyCliente, nombre: busq.trim() || value?.trim() || '' })
        setShowModal(true)
        setOpen(false)
    }

    const saveFullCliente = async () => {
        if (!form.nombre.trim()) return
        await db.clientes.add({ ...form, limite_credito: parseFloat(form.limite_credito) || 0 })
        onChange(form.nombre)
        setBusq('')
        setShowModal(false)
    }

    const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (clientes.length === 1) {
                selectCliente(clientes[0])
            } else if (searchTerm && !exactMatch) {
                crearRapido()
            } else {
                setOpen(false)
            }
        }
    }

    const inputVal = open ? (busq || value || '') : (value || '')
    const hasResults = clientes.length > 0
    const searchTerm = (busq || value || '').trim().toLowerCase()
    const exactMatch = clientes.some(c => c.nombre?.toLowerCase() === searchTerm)

    return (
        <>
            <div ref={wrapRef} className="relative">
                <input
                    className="inp rounded-none focus:border-[var(--teal)] transition-none shadow-inner !py-3 font-black uppercase text-xs"
                    value={inputVal}
                    onChange={handleInputChange}
                    onFocus={() => setOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    autoComplete="off"
                />

                {open && (
                    <div className="absolute z-30 w-full bg-[var(--surface)] border-2 border-[var(--border-var)] border-t-0 shadow-[var(--win-shadow)] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200 rounded-none mt-0"
                        style={{ maxHeight: '350px' }}>

                        {/* Listado de Clientes */}
                        <div style={{ maxHeight: '220px', overflowY: 'auto' }} className="custom-scroll">
                            {clientes.map(c => (
                                <div key={c.id}
                                    className="px-4 py-3 cursor-pointer border-b border-[var(--border-var)] hover:bg-[var(--surfaceDark)] transition-none flex items-center justify-between group"
                                    onClick={() => selectCliente(c)}>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-black text-[11px] truncate text-[var(--text-main)] uppercase tracking-tight">{c.nombre}</div>
                                        <div className="flex gap-4 text-[9px] text-[var(--text2)] font-black uppercase mt-0.5 opacity-60">
                                            {c.rif && <span>RIF: {c.rif}</span>}
                                            {c.telefono && <span>📞 {c.telefono}</span>}
                                            {c.ciudad && <span>📍 {c.ciudad}</span>}
                                        </div>
                                    </div>
                                    <span className="text-[8px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-none bg-[var(--teal)] text-white font-black uppercase tracking-widest shadow-sm">
                                        SELECCIONAR
                                    </span>
                                </div>
                            ))}
                            {!hasResults && searchTerm && (
                                <div className="px-3 py-3 text-center text-sm text-[var(--text2)]">
                                    No se encontraron clientes con "<strong className="text-[var(--text-main)]">{searchTerm}</strong>"
                                </div>
                            )}
                        </div>

                        {/* Actions bar */}
                        {searchTerm && !exactMatch && (
                            <div className="border-t-2 border-[var(--border-var)] px-4 py-4 flex flex-col gap-3 bg-[var(--surface2)] shadow-inner">
                                <div className="text-[9px] text-[var(--text2)] font-black uppercase tracking-widest mb-1 text-center opacity-60">¿ALTA DE NUEVO CLIENTE?</div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        className="flex-1 flex flex-col items-center py-3 bg-[var(--green-var)] text-white transition-none shadow-[var(--win-shadow)] cursor-pointer rounded-none border-b-4 border-black/20 active:border-b-0 active:translate-y-1"
                                        onClick={crearRapido}>
                                        <span className="font-black text-[10px] tracking-tight">RÁPIDO</span>
                                        <span className="opacity-90 text-[8px] font-black uppercase mt-0.5 truncate max-w-full italic px-1">"{searchTerm}"</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="flex-1 flex flex-col items-center py-3 bg-[var(--teal)] text-white transition-none shadow-[var(--win-shadow)] cursor-pointer rounded-none border-b-4 border-black/20 active:border-b-0 active:translate-y-1"
                                        onClick={openFullForm}>
                                        <span className="font-black text-[10px] tracking-tight">FORMULARIO</span>
                                        <span className="opacity-90 text-[8px] font-black uppercase mt-0.5">AVANZADO</span>
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    className="w-full text-[9px] font-black uppercase tracking-widest py-2 text-[var(--text2)] hover:text-[var(--teal)] transition-none border border-black/5 bg-[var(--surfaceDark)] mt-1"
                                    onClick={() => setOpen(false)}>
                                    OMITIR REGISTRO (SOLO NOMBRE)
                                </button>
                            </div>
                        )}

                        {/* Hint: can use without registering */}
                        {!searchTerm && (
                            <div className="border-t border-[var(--border-var)] px-3 py-2 text-center text-[10px] bg-[var(--surface2)] text-[var(--text2)]">
                                Escribe un nombre para buscar o crear un cliente
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Full registration modal */}
            <Modal open={showModal} onClose={() => setShowModal(false)} title="ALTA DE CLIENTE EN BASE DE DATOS">
                <div className="grid grid-cols-2 gap-4">
                    <div className="field">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">C.I. / R.I.F.</label>
                        <input className="inp rounded-none focus:border-[var(--teal)] shadow-inner uppercase font-black text-xs" value={form.rif} onChange={e => f('rif', e.target.value.toUpperCase())} placeholder="V-12345678-9" />
                    </div>
                    <div className="field">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">TELÉFONO CONTACTO</label>
                        <input className="inp rounded-none focus:border-[var(--teal)] shadow-inner font-black text-xs" value={form.telefono} onChange={e => f('telefono', e.target.value)} placeholder="0424-1234567" />
                    </div>
                    <div className="field col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">NOMBRE / RAZÓN SOCIAL *</label>
                        <input className="inp rounded-none focus:border-[var(--teal)] shadow-inner font-black uppercase" value={form.nombre} onChange={e => f('nombre', e.target.value.toUpperCase())} />
                    </div>
                    <div className="field col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">DOMICILIO FISCAL / DIRECCIÓN</label>
                        <input className="inp rounded-none focus:border-[var(--teal)] shadow-inner uppercase text-[10px]" value={form.direccion} onChange={e => f('direccion', e.target.value.toUpperCase())} />
                    </div>
                    <div className="field">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">CIUDAD</label>
                        <input className="inp rounded-none focus:border-[var(--teal)] shadow-inner uppercase font-black" value={form.ciudad} onChange={e => f('ciudad', e.target.value.toUpperCase())} />
                    </div>
                    <div className="field">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">CORREO ELECTRÓNICO</label>
                        <input className="inp rounded-none focus:border-[var(--teal)] shadow-inner font-black" type="email" value={form.email} onChange={e => f('email', e.target.value.toLowerCase())} />
                    </div>
                    <div className="field">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">LÍMITE DE CRÉDITO USD ($)</label>
                        <input className="inp rounded-none focus:border-[var(--teal)] shadow-inner font-mono font-black" type="number" value={form.limite_credito}
                            onChange={e => f('limite_credito', e.target.value)} step="0.01" inputMode="decimal" />
                    </div>
                    <div className="field">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">NOTAS / OBSERVACIONES</label>
                        <input className="inp rounded-none focus:border-[var(--teal)] shadow-inner uppercase" value={form.observaciones} onChange={e => f('observaciones', e.target.value.toUpperCase())} />
                    </div>
                </div>
                <div className="flex gap-4 mt-6 pt-6 border-t border-[var(--border-var)]">
                    <button className="btn bg-[var(--surfaceDark)] text-[var(--text-main)] flex-1 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer" onClick={() => setShowModal(false)}>DESCARTAR</button>
                    <button className="btn bg-[var(--teal)] text-white flex-2 justify-center py-4 font-black uppercase text-xs transition-none shadow-[var(--win-shadow)] cursor-pointer tracking-widest" onClick={saveFullCliente}>
                        <span className="material-icons-round text-base">verified</span>
                        <span>REGISTRAR CLIENTE</span>
                    </button>
                </div>
            </Modal>
        </>
    )
}
