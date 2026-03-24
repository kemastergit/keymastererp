import { useState, useRef, useEffect } from 'react'
import { fmtUSD } from '../../utils/format'

export default function Catalogo({
    busq, setBusq, showDrop, setShowDrop, articulos, addToCart, addGeneric, cart = [], removeFromCart, updateQty,
    viewMode, setViewMode, itemsAgregadosComponent
}) {
    const [searchTerm, setSearchTerm] = useState(busq) // Estado local para fluidez
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const listRef = useRef(null)

    // ✅ DEBOUNCE: Solo actualiza la búsqueda global tras 300ms de inactividad
    useEffect(() => {
        const timer = setTimeout(() => {
            setBusq(searchTerm)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchTerm, setBusq])

    // Sincronizar hacia abajo si el padre limpia la búsqueda (ej. al agregar un producto)
    useEffect(() => {
        setSearchTerm(busq)
    }, [busq])

    const toggleView = (mode) => {
        setViewMode(mode)
        localStorage.setItem('catalogo_view_mode', mode)
    }

    // Auto-scroll para que la tarjeta seleccionada se vea
    useEffect(() => {
        if (selectedIndex >= 0 && listRef.current) {
            const selectedEl = listRef.current.children[0]?.children[selectedIndex]
            if (selectedEl) {
                selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }
        }
    }, [selectedIndex, viewMode])

    // Clases de cada botón de vista: naranja si activo, gris si no
    const btnClass = (mode) =>
        `w-7 h-7 flex items-center justify-center rounded-md transition-all ${
            viewMode === mode
                ? 'bg-[var(--orange-var)] text-white shadow-sm ring-2 ring-orange-400/40'
                : 'text-[var(--text2)] hover:bg-[var(--surface)]'
        }`

    return (
        <div className="col-catalogo bg-[var(--surface)] border border-[var(--border-var)] flex flex-col overflow-hidden h-full relative min-h-0 w-full lg:flex-[1.5]">
            <div className="p-4 short:py-2 border-b border-[var(--border-var)] bg-[var(--surface2)] flex flex-col gap-3 short:gap-1.5 shrink-0 shadow-sm z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="material-icons-round text-[var(--teal)] short:text-base">search</span>
                        <div className="font-['IBM_Plex_Mono'] font-bold text-[var(--text-main)] text-[11px] uppercase tracking-[0.15em]">BÚSQUEDA DE ARTÍCULOS</div>
                    </div>
                    
                    {/* TOGGLE VISTA — 3 modelos */}
                    <div className="flex bg-[var(--surfaceDark)] p-1 rounded-lg border border-[var(--border-var)] gap-1">
                        <button 
                            onClick={() => toggleView('grid')}
                            className={btnClass('grid')}
                            title="Vista Cuadrícula"
                        >
                            <span className="material-icons-round text-sm">grid_view</span>
                        </button>
                        <button 
                            onClick={() => toggleView('list')}
                            className={btnClass('list')}
                            title="Vista Lista"
                        >
                            <span className="material-icons-round text-sm">view_list</span>
                        </button>
                        <button 
                            onClick={() => toggleView('pos')}
                            className={btnClass('pos')}
                            title="Modo POS / Caja"
                        >
                            <span className="material-icons-round text-sm">point_of_sale</span>
                        </button>
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input 
                            id="search-products"
                            className="inp !py-3 short:!py-2 !pl-11 short:!pl-8 !bg-[var(--surface)] focus:!bg-[var(--surface2)] shadow-inner w-full border border-[var(--border-var)] transition-all font-bold text-[15px]"
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setSelectedIndex(-1); }}
                            onKeyDown={e => {
                                if (e.key === 'Escape') {
                                    setSelectedIndex(-1);
                                    return;
                                }
                                if (articulos.length === 0) return;

                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setSelectedIndex(prev => (prev < articulos.length - 1 ? prev + 1 : prev));
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
                                } else if (viewMode === 'grid' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
                                    if (e.key === 'ArrowRight') setSelectedIndex(prev => (prev < articulos.length - 1 ? prev + 1 : prev));
                                    if (e.key === 'ArrowLeft') setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
                                } else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (selectedIndex >= 0 && articulos[selectedIndex]) {
                                        addToCart(articulos[selectedIndex]);
                                        setBusq('');
                                        setSelectedIndex(-1);
                                    } else if (articulos.length === 1) { 
                                        addToCart(articulos[0]);
                                        setBusq('');
                                        setSelectedIndex(-1);
                                    }
                                }
                            }}
                            placeholder="Buscar producto..."
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

            {/* CONTENEDOR: MODO POS muestra el pedido cuando no hay búsqueda */}
            <div className="flex-1 overflow-y-auto custom-scroll bg-[var(--surfaceDark)] relative" ref={listRef}>
                {viewMode === 'pos' && busq.length === 0 ? (
                    <div className="p-0 h-full overflow-hidden">
                        {itemsAgregadosComponent}
                    </div>
                ) : articulos.length === 0 ? (
                     <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
                         <span className="material-icons-round text-6xl mb-4 text-[var(--text2)]">inventory</span>
                         <span className="text-xs font-black uppercase tracking-widest text-[var(--text2)]">No hay resultados</span>
                     </div>
                ) : (
                    <div className={`p-4 ${viewMode === 'grid' 
                        ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-24"
                        : "flex flex-col gap-1 pb-24"
                    }`}>
                        {articulos.map((a, index) => {
                            const q = cart.find(i => i.id === a.id)?.qty || 0;
                            const isSelected = selectedIndex === index;
                            const hasStock = (a.stock ?? 0) > 0;

                            if (viewMode === 'grid') {
                                return (
                                    <div 
                                        key={a.id}
                                        onClick={() => { if (hasStock) { addToCart(a); setBusq(''); setSelectedIndex(-1); } }}
                                        className={`
                                            relative group flex flex-col bg-[var(--surface)] border-2 rounded-xl overflow-hidden cursor-pointer transition-all duration-150 transform
                                            ${isSelected ? 'border-[var(--orange-var)] shadow-[0_0_0_4px_rgba(249,115,22,0.2)] scale-[1.02] z-10' : 'border-[var(--border-var)] shadow-sm hover:border-[var(--orange-var)] hover:shadow-md'}
                                            ${!hasStock ? 'opacity-60 grayscale-[0.5]' : ''}
                                        `}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        <div className={`p-2 border-b border-[var(--border-var)] flex justify-between items-center ${isSelected ? 'bg-orange-50' : 'bg-[var(--surface2)]'}`}>
                                            <div className="font-mono text-[10px] font-black text-[var(--teal)] uppercase truncate mr-2">{a.codigo}</div>
                                            {a.marca && <div className="text-[8px] bg-[var(--surface)] border border-[var(--border-var)] px-1.5 py-0.5 rounded text-[var(--text2)] font-black uppercase tracking-wider truncate max-w-[50px]">{a.marca}</div>}
                                        </div>
                                        <div className="p-3 flex-1 flex flex-col justify-start">
                                            <div className="font-bold text-[var(--text-main)] text-[14px] h-10 overflow-hidden text-ellipsis leading-tight">{a.descripcion}</div>
                                            <div className="mt-auto flex justify-between items-end">
                                                <div className="flex flex-col">
                                                    <span className="text-[7.5px] text-[var(--text2)] font-black uppercase tracking-widest mb-0.5">Stock</span>
                                                    <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-black text-white inline-block text-center w-fit ${hasStock ? 'bg-[var(--green-var)] shadow-sm' : 'bg-[var(--red-var)]'}`}>{a.stock ?? 0}</span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest mb-0.5">Precio</span>
                                                    <span className="font-mono text-[18px] font-black text-[var(--text-main)]">{fmtUSD(a.precio)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {q > 0 && <div className="absolute top-1.5 right-1.5 bg-[var(--orange-var)] text-white w-5 h-5 rounded-full flex items-center justify-center shadow-md font-black text-[9px] border border-[var(--surface)]">{q}</div>}
                                    </div>
                                )
                            }

                            // VISTA LISTA (LÍNEAS) — con botones +/- inline
                            return (
                                <div 
                                    key={a.id}
                                    onClick={() => { if (hasStock) { addToCart(a); setBusq(''); setSelectedIndex(-1); } }}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`
                                        flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all duration-200 border-2 select-none relative group
                                        ${isSelected 
                                            ? 'bg-white border-[var(--orange-var)] shadow-[0_10px_15px_-3px_rgba(249,115,22,0.1)] scale-[1.01] z-10' 
                                            : index % 2 === 0 ? 'bg-white border-transparent' : 'bg-slate-50 border-transparent'}
                                        ${!hasStock ? 'opacity-60 grayscale-[0.8]' : 'hover:bg-white hover:border-[var(--orange-var)]/30 hover:shadow-sm'}
                                    `}
                                >
                                    {isSelected && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-3/5 bg-[var(--orange-var)] rounded-r-full"></div>}

                                    <div className="w-20 shrink-0">
                                        <div className="font-mono text-[10px] font-black text-[var(--teal)] bg-[var(--teal)]/5 px-2 py-1 rounded text-center border border-[var(--teal)]/10 truncate">
                                            {a.codigo}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="font-black text-[var(--text-main)] text-[14px] uppercase leading-tight truncate">
                                            {a.descripcion}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {a.marca && <span className="text-[8px] bg-slate-200 text-slate-600 font-black px-1.5 py-0.5 rounded uppercase tracking-widest">{a.marca}</span>}
                                            {a.referencia && <span className="text-[8px] text-slate-400 font-bold truncate">REF: {a.referencia}</span>}
                                        </div>
                                    </div>

                                    <div className="w-24 flex flex-col items-center shrink-0 border-x border-slate-100 px-2">
                                        <span className="text-[7px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Existencia</span>
                                        <div className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-black text-white min-w-[40px] text-center shadow-sm ${hasStock ? 'bg-[var(--green-var)]' : 'bg-[var(--red-var)]'}`}>
                                            {a.stock ?? 0}
                                        </div>
                                    </div>

                                    <div className="w-24 text-right shrink-0">
                                        <span className="text-[7px] text-slate-400 font-black uppercase tracking-[0.2em] block mb-0.5">Precio Unit.</span>
                                        <div className="font-mono text-[14px] font-black text-[var(--text-main)]">
                                            {fmtUSD(a.precio)}
                                        </div>
                                    </div>

                                    {/* BOTONES +/- inline en lista */}
                                    <div className="w-32 flex items-center justify-end gap-1.5 pl-2">
                                        {q > 0 ? (
                                            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm ring-1 ring-black/5 animate-in fade-in zoom-in duration-200">
                                                <button 
                                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-[var(--red-var)] hover:text-white flex items-center justify-center transition-colors active:scale-90"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (q === 1) removeFromCart(a.id);
                                                        else updateQty(a.id, q - 1);
                                                    }}
                                                >
                                                    <span className="material-icons-round text-lg">remove</span>
                                                </button>
                                                <div className="w-8 text-center font-black text-[12px] text-[var(--orange-var)]">
                                                    {q}
                                                </div>
                                                <button 
                                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-[var(--orange-var)] hover:text-white flex items-center justify-center transition-colors active:scale-90"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        addToCart(a);
                                                    }}
                                                    disabled={!hasStock}
                                                >
                                                    <span className="material-icons-round text-lg">add</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-90
                                                    ${hasStock ? 'bg-orange-50 text-[var(--orange-var)] hover:bg-[var(--orange-var)] hover:text-white' : 'bg-slate-100 text-slate-300'}`}
                                                disabled={!hasStock}
                                            >
                                                <span className="material-icons-round">add_shopping_cart</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
