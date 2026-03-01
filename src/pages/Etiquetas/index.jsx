import { useState, useEffect, useRef } from 'react'
import { db } from '../../db/db'
import useStore from '../../store/useStore'
import EtiquetaPrecio from '../../components/Etiqueta/EtiquetaPrecio'
import EtiquetaDespacho from '../../components/Etiqueta/EtiquetaDespacho'
import { useReactToPrint } from 'react-to-print'

export default function EtiquetasPage() {
    const { configEmpresa, tasa, toast } = useStore()
    const [articulos, setArticulos] = useState([])
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState([]) // { item, qty, type }
    const [labelType, setLabelType] = useState('PRECIO')

    const componentRef = useRef()

    useEffect(() => {
        loadArticulos()
    }, [search])

    const loadArticulos = async () => {
        let query = db.articulos
        if (search) {
            query = query.filter(a =>
                a.descripcion.toLowerCase().includes(search.toLowerCase()) ||
                a.codigo.toLowerCase().includes(search.toLowerCase()) ||
                a.referencia.toLowerCase().includes(search.toLowerCase())
            )
        }
        const data = await query.toArray() // Removed limit to show full inventory
        setArticulos(data)
    }

    const handleSelect = (art) => {
        const exists = selected.find(s => s.item.id === art.id)
        if (exists) {
            setSelected(selected.filter(s => s.item.id !== art.id))
        } else {
            setSelected([...selected, { item: art, qty: 1 }])
        }
    }

    const updateQty = (id, newQty) => {
        if (newQty < 1) return
        setSelected(selected.map(s => s.item.id === id ? { ...s, qty: newQty } : s))
    }

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Etiquetas_${labelType}`,
    })

    // Generating flat array for printing (item * qty)
    const labelsToPrint = []
    selected.forEach(s => {
        for (let i = 0; i < s.qty; i++) {
            labelsToPrint.push(s.item)
        }
    })

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] md:h-full p-3 md:p-8 animate-fade-in overflow-hidden lg:overflow-hidden">
            <header className="mb-4 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3 tracking-tighter uppercase leading-none">
                        <span className="text-red-600">🏷️</span> MÓDULO DE <span className="text-red-600">ETIQUETAS</span>
                    </h1>
                    <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Generación de etiquetas de precio y despacho.</p>
                </div>

                <div className="flex gap-2 shrink-0">
                    <button
                        onClick={handlePrint}
                        disabled={selected.length === 0}
                        className="flex-1 md:flex-none bg-red-600 hover:bg-red-700 disabled:bg-gray-800 text-white text-[11px] md:text-sm font-black uppercase tracking-widest py-3 px-6 rounded-xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <span className="material-icons-round text-base">print</span>
                        IMPRIMIR ({labelsToPrint.length})
                    </button>
                </div>
            </header>

            <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-2 gap-4 md:gap-8 pb-4 overflow-hidden">
                {/* Selector de Productos */}
                <div className="bg-[#0f0f0f] border border-gray-800 p-4 md:p-6 rounded-2xl shadow-2xl flex flex-col h-[400px] lg:h-full min-h-0">
                    <div className="flex items-center justify-between mb-4 shrink-0">
                        <h2 className="text-xs md:text-sm font-black text-white uppercase tracking-widest">1. Seleccionar Productos</h2>
                        <div className="flex gap-1">
                            {['PRECIO', 'DESPACHO'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setLabelType(type)}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-tight transition-all ${labelType === type ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="relative mb-4 shrink-0">
                        <input
                            type="text"
                            placeholder="Buscar por descripción o código..."
                            className="w-full bg-black border border-gray-800 rounded-xl p-3 pl-10 text-[11px] font-bold text-white focus:border-red-600 outline-none transition-all placeholder:text-gray-600"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-lg">search</span>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {articulos.length === 0 ? (
                            <div className="text-center py-10">
                                <span className="material-icons-round text-gray-800 text-4xl block mb-2">inventory_2</span>
                                <p className="text-[10px] font-bold text-gray-600 uppercase">No se encontraron artículos</p>
                            </div>
                        ) : (
                            articulos.map(art => {
                                const isSelected = selected.find(s => s.item.id === art.id)
                                return (
                                    <div
                                        key={art.id}
                                        onClick={() => handleSelect(art)}
                                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between group active:scale-[0.98] ${isSelected ? 'bg-red-900/20 border-red-600 shadow-lg shadow-red-900/10' : 'bg-black border-transparent hover:border-gray-800'
                                            }`}
                                    >
                                        <div className="flex flex-col min-w-0 pr-2">
                                            <span className="text-[11px] font-black text-white uppercase truncate">{art.descripcion}</span>
                                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">{art.codigo} <span className="text-gray-700 mx-1">|</span> Stock: {art.stock}</span>
                                        </div>
                                        <div className="text-red-500 font-black text-xs shrink-0">${art.precio.toFixed(2)}</div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Lista de Selección & Preview */}
                <div className="bg-[#0f0f0f] border border-gray-800 p-4 md:p-6 rounded-2xl shadow-2xl flex flex-col h-[500px] lg:h-full min-h-0">
                    <h2 className="text-xs md:text-sm font-black text-white uppercase tracking-widest mb-4 shrink-0">2. Cantidades y Vista Previa</h2>

                    <div className="flex-1 min-h-0 space-y-2 overflow-y-auto mb-4 pr-1 custom-scrollbar">
                        {selected.length === 0 ? (
                            <div className="text-center py-20 bg-black/50 rounded-2xl border-2 border-dashed border-gray-900">
                                <span className="material-icons-round text-gray-800 text-5xl block mb-2">add_task</span>
                                <p className="text-[10px] font-bold text-gray-600 uppercase">Sin productos seleccionados</p>
                            </div>
                        ) : (
                            selected.map(s => (
                                <div key={s.item.id} className="bg-black p-3 border border-gray-900 rounded-xl flex items-center justify-between animate-in slide-in-from-right-4 duration-300">
                                    <div className="flex flex-col max-w-[50%] min-w-0">
                                        <span className="text-[10px] font-black text-white uppercase truncate">{s.item.descripcion}</span>
                                        <div className="flex gap-2">
                                            <span className="text-[8px] font-bold text-gray-600 uppercase truncate">{s.item.codigo}</span>
                                            <button onClick={(e) => { e.stopPropagation(); handleSelect(s.item) }} className="text-[8px] font-bold text-red-500 uppercase underline">Quitar</button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); updateQty(s.item.id, s.qty - 1) }}
                                                className="w-8 h-8 flex items-center justify-center hover:bg-red-600 text-white transition-all font-black text-lg"
                                            >-</button>
                                            <input
                                                type="number"
                                                value={s.qty}
                                                onChange={(e) => updateQty(s.item.id, parseInt(e.target.value) || 1)}
                                                className="w-8 bg-transparent text-center text-white text-[11px] font-black outline-none"
                                            />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); updateQty(s.item.id, s.qty + 1) }}
                                                className="w-8 h-8 flex items-center justify-center hover:bg-red-600 text-white transition-all font-black text-lg"
                                            >+</button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="border-t border-gray-800 pt-4 mt-auto shrink-0 flex flex-col min-h-0 overflow-hidden">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 shrink-0">Vista Previa Impression</h3>
                        <div className="bg-white p-4 rounded-xl overflow-auto h-[180px] md:h-[250px] flex flex-wrap gap-1 justify-center shrink-0 border border-gray-800 shadow-inner">
                            <div ref={componentRef} className="print-area flex flex-wrap gap-4 justify-center p-4 bg-white">
                                {labelType === 'PRECIO' ? (
                                    labelsToPrint.map((art, idx) => (
                                        <EtiquetaPrecio key={idx} articulo={art} config={configEmpresa} tasa={tasa} />
                                    ))
                                ) : (
                                    selected.map(s => (
                                        <EtiquetaDespacho key={s.item.id} nota={{
                                            nro: 1,
                                            fecha: new Date(),
                                            cliente_nombre: 'CLIENTE EJEMPLO C.A.',
                                            items: selected.map(sel => ({ ...sel.item, qty: sel.qty })),
                                            total: selected.reduce((acc, sel) => acc + (sel.item.precio * sel.qty), 0)
                                        }} config={configEmpresa} />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
