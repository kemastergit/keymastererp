import { useState, useRef, useEffect } from 'react'
import { fmtUSD } from '../../utils/format'

export default function Catalogo({
    busq, setBusq, showDrop, setShowDrop, articulos, addToCart, addGeneric, cart = [], removeFromCart, updateQty
}) {
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const listRef = useRef(null)

    const isInCart = (id) => cart.some(item => item.id === id)

    // Auto-scroll para que la tarjeta seleccionada se vea
    useEffect(() => {
        if (selectedIndex >= 0 && listRef.current) {
            const selectedEl = listRef.current.children[0]?.children[selectedIndex]
            if (selectedEl) {
                selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }
        }
    }, [selectedIndex])

    return (
        <div className="col-catalogo bg-[var(--surface)] border border-[var(--border-var)] flex flex-col overflow-hidden h-full relative min-h-0 w-full lg:flex-[1.5]">
            <div className="p-4 short:py-2 border-b border-[var(--border-var)] bg-[var(--surface2)] flex flex-col gap-3 short:gap-1.5 shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-2">
                    <span className="material-icons-round text-[var(--teal)] short:text-base">inventory_2</span>
                    <div className="font-['IBM_Plex_Mono'] font-bold text-[var(--text-main)] text-[11px] uppercase tracking-wider">Catálogo Sugerido</div>
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input 
                            id="search-products"
                            className="inp !py-3 short:!py-2 !pl-11 short:!pl-8 !bg-[var(--surface)] focus:!bg-[var(--surface2)] shadow-inner w-full border border-[var(--border-var)] transition-all font-bold text-[15px]"
                            value={busq}
                            onChange={e => { setBusq(e.target.value); setSelectedIndex(-1); }}
                            onKeyDown={e => {
                                if (e.key === 'Escape') {
                                    setSelectedIndex(-1);
                                    return;
                                }
                                if (articulos.length === 0) return;

                                // Si está en diseño Grid, izquierda/derecha también ayuda
                                // Pero mantendremos arriba/abajo para simplicidad
                                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                                    e.preventDefault();
                                    setSelectedIndex(prev => (prev < articulos.length - 1 ? prev + 1 : prev));
                                } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                                    e.preventDefault();
                                    setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
                                } else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (selectedIndex >= 0 && articulos[selectedIndex]) {
                                        addToCart(articulos[selectedIndex]);
                                        setBusq('');
                                        setSelectedIndex(-1);
                                    } else if (articulos.length === 1) { // Si hay uno solo en pantalla, Enter directo lo agrega
                                        addToCart(articulos[0]);
                                        setBusq('');
                                        setSelectedIndex(-1);
                                    }
                                }
                            }}
                            placeholder="Buscar producto por código o nombre (Usa las flechas ↓↑)..."
                            autoComplete="off" inputMode="search" />
                        <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-[var(--teal)]">search</span>
                        {busq.length > 0 && (
                            <button className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 bg-[var(--surfaceDark)] hover:bg-[var(--red-var)] hover:text-white rounded flex items-center justify-center text-[var(--text2)] transition-colors"
                                onClick={() => { setBusq(''); setSelectedIndex(-1); }}>
                                <span className="material-icons-round text-sm">close</span>
                            </button>
                        )}
                    </div>
                    <button className="btn px-4 bg-[var(--orange-var)] text-white shadow-[var(--win-shadow)] hover:bg-orange-600 flex flex-col items-center justify-center shrink-0 border border-[var(--orangeDark)]" onClick={addGeneric} title="Agregar Artículo Varios">
                        <span className="material-icons-round text-lg leading-none">category</span>
                        <span className="text-[9px] font-black uppercase mt-0.5 tracking-wider">Varios</span>
                    </button>
                </div>
            </div>

            {/* GRILLA DE TARJETAS (NUEVA VISTA UNIFICADA) */}
            <div className="flex-1 overflow-y-auto custom-scroll bg-[var(--surfaceDark)] p-4 relative" ref={listRef}>
                {articulos.length === 0 ? (
                     <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
                         <span className="material-icons-round text-6xl mb-4 text-[var(--text2)]">inventory</span>
                         <span className="text-xs font-black uppercase tracking-widest text-[var(--text2)]">No hay resultados para "{busq}"</span>
                     </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-24">
                        {articulos.map((a, index) => {
                            const q = cart.find(i => i.id === a.id)?.qty || 0;
                            const isSelected = selectedIndex === index;
                            const hasStock = (a.stock ?? 0) > 0;

                            return (
                                <div 
                                    key={a.id}
                                    onClick={() => {
                                        if (hasStock) addToCart(a);
                                        setSelectedIndex(index);
                                    }}
                                    className={`
                                        relative group flex flex-col bg-[var(--surface)] border-2 rounded-xl overflow-hidden cursor-pointer transition-all duration-150 transform
                                        ${isSelected ? 'border-[var(--teal)] shadow-[0_0_0_4px_rgba(20,184,166,0.2)] scale-[1.02] z-10' : 'border-[var(--border-var)] shadow-sm hover:border-[var(--teal)] hover:shadow-md'}
                                        ${!hasStock ? 'opacity-60 grayscale-[0.5]' : ''}
                                    `}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    {/* CABECERA TARJETA */}
                                    <div className={`p-2 border-b border-[var(--border-var)] flex justify-between items-center ${isSelected ? 'bg-[var(--teal)]/10' : 'bg-[var(--surface2)]'}`}>
                                        <div className="font-mono text-[10px] font-black text-[var(--teal)] uppercase truncate mr-2">
                                            {a.codigo}
                                        </div>
                                        {a.marca && (
                                            <div className="text-[8px] bg-[var(--surface)] border border-[var(--border-var)] px-1.5 py-0.5 rounded text-[var(--text2)] font-black uppercase tracking-wider truncate max-w-[50px]">
                                                {a.marca}
                                            </div>
                                        )}
                                    </div>

                                    {/* CUERPO TEXTO */}
                                    <div className="p-3 flex-1 flex flex-col justify-start">
                                        <div className="font-bold text-[var(--text-main)] text-[11px] h-9 overflow-hidden text-ellipsis leading-tight">
                                            {a.descripcion}
                                        </div>
                                        {a.referencia && (
                                            <div className="text-[8px] font-black text-[var(--text2)] opacity-60 uppercase tracking-widest truncate mt-0.5 mb-1">
                                                {a.referencia}
                                            </div>
                                        )}
                                        
                                        <div className="mt-auto flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="text-[7.5px] text-[var(--text2)] font-black uppercase tracking-widest mb-0.5">Stock</span>
                                                <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-black tracking-tighter text-white inline-block text-center w-fit ${hasStock ? 'bg-[var(--green-var)] shadow-sm' : 'bg-[var(--red-var)]'}`}>
                                                    {a.stock ?? 0}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[7.5px] text-[var(--text2)] font-black uppercase tracking-widest mb-0.5">Precio</span>
                                                <span className="font-mono text-[13px] font-black text-[var(--text-main)]">
                                                    {fmtUSD(a.precio)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* OVERLAY DE AGREGADO */}
                                    {q > 0 && (
                                        <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 items-end z-20">
                                            <div className="bg-[var(--green-var)] text-white w-5 h-5 rounded-full flex items-center justify-center shadow-md font-black text-[9px] border border-[var(--surface)]">
                                                {q}
                                            </div>
                                        </div>
                                    )}

                                    {/* CONTROLES RÁPIDOS (hover) - Solo si ya está en el carrito */}
                                    {q > 0 && (
                                        <div className={`absolute inset-x-0 bottom-0 bg-[var(--surface)]/95 backdrop-blur-sm border-t border-[var(--border-var)] p-2 flex justify-center gap-2 transform transition-transform ${isSelected ? 'translate-y-0 relative border-t-0 bg-transparent py-0 pb-2 mt-[-5px]' : 'translate-y-full group-hover:translate-y-0'}`}>
                                            <button 
                                                className="w-7 h-7 rounded bg-[var(--red-var)] text-white flex items-center justify-center shadow-sm active:scale-95"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (q === 1) removeFromCart(a.id);
                                                    else updateQty(a.id, q - 1);
                                                }}
                                            >
                                                <span className="material-icons-round text-sm">remove</span>
                                            </button>
                                            <button 
                                                className="w-7 h-7 rounded bg-[var(--teal)] text-white flex items-center justify-center shadow-sm active:scale-95"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    addToCart(a);
                                                }}
                                                disabled={!hasStock}
                                            >
                                                <span className="material-icons-round text-sm">add</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
