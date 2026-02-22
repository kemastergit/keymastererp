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
                    className="inp"
                    value={inputVal}
                    onChange={handleInputChange}
                    onFocus={() => setOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    autoComplete="off"
                />

                {open && (
                    <div className="absolute z-30 w-full bg-white border border-borde border-t-0 rounded-b-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200"
                        style={{ maxHeight: '320px' }}>

                        {/* Client list */}
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {clientes.map(c => (
                                <div key={c.id}
                                    className="px-3 py-2 cursor-pointer border-b border-borde/50 hover:bg-blue-50 transition-colors flex items-center gap-2 group"
                                    onClick={() => selectCliente(c)}>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm truncate group-hover:text-primary" style={{ color: '#201f1e' }}>{c.nombre}</div>
                                        <div className="flex gap-3 text-[10px]" style={{ color: '#605e5c' }}>
                                            {c.rif && <span>RIF: {c.rif}</span>}
                                            {c.telefono && <span>📞 {c.telefono}</span>}
                                            {c.ciudad && <span>📍 {c.ciudad}</span>}
                                        </div>
                                    </div>
                                    <span className="text-[9px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        style={{ background: '#deecf9', color: '#0078d4' }}>
                                        ENTER PARA SELECCIONAR
                                    </span>
                                </div>
                            ))}
                            {!hasResults && searchTerm && (
                                <div className="px-3 py-3 text-center text-sm" style={{ color: '#605e5c' }}>
                                    No se encontraron clientes con "<strong style={{ color: '#201f1e' }}>{searchTerm}</strong>"
                                </div>
                            )}
                        </div>

                        {/* Actions bar */}
                        {searchTerm && !exactMatch && (
                            <div className="border-t border-borde px-3 py-2.5 flex flex-col gap-2"
                                style={{ background: '#fafafa' }}>
                                <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-0.5">Opciones de creación:</div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-sm flex-1 flex flex-col items-center py-2"
                                        style={{ background: '#107c10', color: '#fff', fontSize: '10px' }}
                                        onClick={crearRapido}>
                                        <span className="font-bold">⚡ CREAR RÁPIDO</span>
                                        <span className="opacity-80 text-[8px] uppercase">{searchTerm.length > 15 ? searchTerm.slice(0, 15) + '...' : searchTerm}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm flex-1 flex flex-col items-center py-2"
                                        style={{ background: '#0078d4', color: '#fff', fontSize: '10px' }}
                                        onClick={openFullForm}>
                                        <span className="font-bold">📋 CON DATOS</span>
                                        <span className="opacity-80 text-[8px] uppercase">Formulario completo</span>
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    className="w-full text-[10px] py-1 text-muted hover:text-primary transition-colors border border-transparent hover:border-blue-200 rounded"
                                    onClick={() => setOpen(false)}>
                                    CONTINUAR SIN REGISTRAR (SÓLO NOMBRE)
                                </button>
                            </div>
                        )}

                        {/* Hint: can use without registering */}
                        {!searchTerm && (
                            <div className="border-t border-borde px-3 py-2 text-center text-[10px]"
                                style={{ background: '#fafafa', color: '#a19f9d' }}>
                                Escribe un nombre para buscar o crear un cliente
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Full registration modal */}
            <Modal open={showModal} onClose={() => setShowModal(false)} title="REGISTRAR NUEVO CLIENTE">
                <div className="grid grid-cols-2 gap-2">
                    <div className="field">
                        <label>RIF</label>
                        <input className="inp" value={form.rif} onChange={e => f('rif', e.target.value)} placeholder="J-12345678-9" />
                    </div>
                    <div className="field">
                        <label>Teléfono</label>
                        <input className="inp" value={form.telefono} onChange={e => f('telefono', e.target.value)} placeholder="0414-1234567" />
                    </div>
                    <div className="field col-span-2">
                        <label>Nombre / Razón Social *</label>
                        <input className="inp" value={form.nombre} onChange={e => f('nombre', e.target.value)} />
                    </div>
                    <div className="field col-span-2">
                        <label>Dirección</label>
                        <input className="inp" value={form.direccion} onChange={e => f('direccion', e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Ciudad</label>
                        <input className="inp" value={form.ciudad} onChange={e => f('ciudad', e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Email</label>
                        <input className="inp" type="email" value={form.email} onChange={e => f('email', e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Límite de Crédito $</label>
                        <input className="inp" type="number" value={form.limite_credito}
                            onChange={e => f('limite_credito', e.target.value)} step="0.01" inputMode="decimal" />
                    </div>
                    <div className="field">
                        <label>Observaciones</label>
                        <input className="inp" value={form.observaciones} onChange={e => f('observaciones', e.target.value)} />
                    </div>
                </div>
                <div className="flex gap-2 mt-3">
                    <button className="btn btn-gr flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
                    <button className="btn btn-g flex-1" onClick={saveFullCliente}>💾 GUARDAR Y USAR</button>
                </div>
            </Modal>
        </>
    )
}
