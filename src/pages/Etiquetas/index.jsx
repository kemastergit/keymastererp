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
        const data = await query.limit(50).toArray()
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
        <div className="p-4 md:p-8 animate-fade-in pb-20">
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="text-red-600">🏷️</span> MÓDULO DE ETIQUETAS
                    </h1>
                    <p className="text-gray-400 mt-2">Generación de etiquetas de precio y despacho.</p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handlePrint}
                        disabled={selected.length === 0}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-gray-800 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center gap-2 transition"
                    >
                        🖨️ IMPRIMIR ETIQUETAS ({labelsToPrint.length})
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Selector de Productos */}
                <div className="bg-[#0f0f0f] border border-gray-800 p-6 rounded-xl shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">1. Seleccionar Productos</h2>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setLabelType('PRECIO')}
                                className={`px-3 py-1 rounded text-xs font-bold transition ${labelType === 'PRECIO' ? 'bg-red-600 text-white' : 'bg-gray-900 text-gray-500'}`}
                            >
                                PRECIO
                            </button>
                            <button
                                onClick={() => setLabelType('DESPACHO')}
                                className={`px-3 py-1 rounded text-xs font-bold transition ${labelType === 'DESPACHO' ? 'bg-red-600 text-white' : 'bg-gray-900 text-gray-500'}`}
                            >
                                DESPACHO
                            </button>
                        </div>
                    </div>

                    <input
                        type="text"
                        placeholder="Buscar por descripción o código..."
                        className="w-full bg-black border border-gray-800 rounded-lg p-3 text-white mb-4 focus:border-red-600 outline-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {articulos.map(art => {
                            const isSelected = selected.find(s => s.item.id === art.id)
                            return (
                                <div
                                    key={art.id}
                                    onClick={() => handleSelect(art)}
                                    className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between ${isSelected ? 'bg-red-900/20 border-red-600' : 'bg-black border-gray-900 hover:border-gray-700'
                                        }`}
                                >
                                    <div className="flex flex-col">
                                        <span className="text-white font-bold">{art.descripcion}</span>
                                        <span className="text-gray-500 text-xs">{art.codigo} | Stock: {art.stock}</span>
                                    </div>
                                    <div className="text-red-500 font-bold">${art.precio.toFixed(2)}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Lista de Selección & Preview */}
                <div className="bg-[#0f0f0f] border border-gray-800 p-6 rounded-xl shadow-xl flex flex-col">
                    <h2 className="text-xl font-bold text-white mb-6">2. Cantidades y Vista Previa</h2>

                    <div className="flex-grow space-y-4 overflow-y-auto max-h-[400px] mb-6 pr-2 custom-scrollbar">
                        {selected.length === 0 ? (
                            <div className="text-center py-20 text-gray-600 italic">No hay productos seleccionados</div>
                        ) : (
                            selected.map(s => (
                                <div key={s.item.id} className="bg-black p-3 border border-gray-900 rounded-lg flex items-center justify-between">
                                    <div className="flex flex-col max-w-[60%]">
                                        <span className="text-white text-sm font-bold truncate">{s.item.descripcion}</span>
                                        <span className="text-gray-500 text-xs">{s.item.codigo}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-500">Copias:</span>
                                        <div className="flex items-center bg-gray-900 rounded overflow-hidden">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); updateQty(s.item.id, s.qty - 1) }}
                                                className="px-3 py-1 hover:bg-red-600 text-white transition font-bold"
                                            >-</button>
                                            <input
                                                type="number"
                                                value={s.qty}
                                                onChange={(e) => updateQty(s.item.id, parseInt(e.target.value) || 1)}
                                                className="w-12 bg-transparent text-center text-white text-sm outline-none"
                                            />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); updateQty(s.item.id, s.qty + 1) }}
                                                className="px-3 py-1 hover:bg-red-600 text-white transition font-bold"
                                            >+</button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="border-t border-gray-800 pt-6 mt-auto">
                        <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Vista Previa Impression</h3>
                        <div className="bg-white p-4 rounded overflow-auto max-h-[300px] flex flex-wrap gap-4 justify-center">
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
