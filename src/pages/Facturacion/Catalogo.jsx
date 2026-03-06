import { useState } from 'react'
import { fmtUSD } from '../../utils/format'

export default function Catalogo({
    busq, setBusq, showDrop, setShowDrop, articulos, addToCart, addGeneric, cart = [], removeFromCart, updateQty
}) {
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const isInCart = (id) => cart.some(item => item.id === id)

    return (
        <div className="col-catalogo bg-[var(--surface)] border border-[var(--border-var)] flex flex-col overflow-hidden h-full relative min-h-0 w-full lg:flex-[1.5]">
            <div className="p-4 short:py-2 border-b border-[var(--border-var)] bg-[var(--surface2)] flex flex-col gap-3 short:gap-1.5 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="material-icons-round text-[var(--teal)] short:text-base">inventory_2</span>
                    <div className="font-['IBM_Plex_Mono'] font-bold text-[var(--text-main)] text-[11px] uppercase tracking-wider">Catálogo Sugerido</div>
                </div>

                <div className="relative group">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input className="inp !py-3 short:!py-1.5 !pl-11 short:!pl-8 !bg-[var(--surface)] focus:!bg-[var(--surface2)] shadow-inner w-full border border-[var(--border-var)] transition-none"
                                value={busq}
                                onChange={e => { setBusq(e.target.value); setShowDrop(true); setSelectedIndex(-1); }}
                                onFocus={() => setShowDrop(true)}
                                onBlur={() => setTimeout(() => { setShowDrop(false); setSelectedIndex(-1); }, 200)}
                                onKeyDown={e => {
                                    if (e.key === 'Escape') {
                                        setShowDrop(false);
                                        setSelectedIndex(-1);
                                        return;
                                    }
                                    if (!showDrop || articulos.length === 0) return;

                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        setSelectedIndex(prev => (prev < articulos.length - 1 ? prev + 1 : prev));
                                    } else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
                                    } else if (e.key === 'Enter') {
                                        if (selectedIndex >= 0 && articulos[selectedIndex]) {
                                            e.preventDefault();
                                            addToCart(articulos[selectedIndex]);
                                            setBusq('');
                                            setShowDrop(false);
                                            setSelectedIndex(-1);
                                        }
                                    }
                                }}
                                placeholder="Escriba código o nombre..."
                                autoComplete="off" inputMode="search" />
                            <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text2)]">search</span>
                            {busq.length > 0 && (
                                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text2)] hover:text-[var(--red-var)] transition-none"
                                    onClick={() => { setBusq(''); setShowDrop(false); }}>
                                    <span className="material-icons-round text-sm">close</span>
                                </button>
                            )}
                        </div>
                        <button className="btn !px-4 shrink-0 bg-[var(--orange-var)] text-[var(--surface)] shadow-[var(--win-shadow)] border border-[var(--orange-var)] hover:bg-[var(--orangeDark)]" onClick={addGeneric} title="Agregar Artículo Varios">
                            <span className="material-icons-round text-base">category</span>
                            <span className="text-[10px]">VARIOS</span>
                        </button>
                    </div>

                    {showDrop && articulos.length > 0 && (
                        <div className="absolute z-50 w-full bg-[var(--surface)] border border-[var(--border-var)] mt-2
            max-h-72 overflow-y-auto shadow-[var(--win-shadow)] animate-in fade-in slide-in-from-top-2 duration-200 custom-scroll left-0">
                            {articulos.map((a, index) => (
                                <div key={a.id}
                                    className={`px-4 py-3 cursor-pointer border-b transition-none flex items-center justify-between group/item gap-4 ${selectedIndex === index ? 'bg-[var(--surfaceDark)] border-[var(--teal)] ring-1 ring-[var(--teal)] ring-inset shadow-inner' : 'border-[var(--border-var)] hover:bg-[var(--surface2)]'}`}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    onClick={() => { addToCart(a); setBusq(''); setShowDrop(false); setSelectedIndex(-1); }}>
                                    <div className="min-w-0 flex-1 pr-2">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <div className="font-mono text-[var(--teal)] text-[11px] font-black uppercase">{a.codigo}</div>
                                            {a.marca && (
                                                <span className="text-[9px] text-[var(--text2)] border border-[var(--border-var)] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-[var(--surfaceDark)]">
                                                    {a.marca}
                                                </span>
                                            )}
                                            {a.ubicacion && (
                                                <span className="text-[9px] bg-[var(--surface2)] text-[var(--text2)] px-1.5 py-0.5 rounded font-bold uppercase border border-[var(--border-var)] flex items-center gap-0.5">
                                                    <span className="material-icons-round text-[9px]">place</span>
                                                    {a.ubicacion}
                                                </span>
                                            )}
                                        </div>
                                        <div className="font-bold text-[var(--text-main)] text-sm truncate">{a.descripcion}</div>
                                    </div>

                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className="flex flex-col items-center">
                                            <div className="text-[8px] font-black uppercase text-[var(--text2)] tracking-widest mb-0.5">Stock</div>
                                            <div className={`px-2 py-0.5 rounded font-mono font-black text-sm text-white shadow-sm flex items-center justify-center min-w-[32px] ${a.stock <= 0 ? 'bg-[var(--red-var)]' : 'bg-[var(--green-var)]'}`}>
                                                {a.stock ?? 0}
                                            </div>
                                        </div>

                                        <div className="text-right flex flex-col items-end min-w-[70px]">
                                            <div className="text-[8px] font-black uppercase text-[var(--text2)] tracking-widest mb-0.5">Precio</div>
                                            <div className="text-sm font-black text-[var(--text-main)]">{fmtUSD(a.precio)}</div>
                                        </div>

                                        {isInCart(a.id) && (
                                            <div className="w-6 h-6 rounded-full bg-[var(--green-var)]/20 flex items-center justify-center shrink-0">
                                                <span className="material-icons-round text-[var(--green-var)] text-sm">check</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="catalogo-lista flex-1 overflow-x-auto overflow-y-auto relative min-h-0 overscroll-contain">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-[var(--surface2)] z-10 border-b border-[var(--border-var)] shadow-sm">
                        <tr className="text-[10px] short:text-[9px] uppercase text-[var(--text2)] font-['IBM_Plex_Mono']">
                            <th className="p-3 short:p-1.5 font-semibold text-left">Código</th>
                            <th className="p-3 short:p-1.5 font-semibold text-left">Producto</th>
                            <th className="p-3 short:p-1.5 font-semibold text-center">Stock</th>
                            <th className="p-3 short:p-1.5 font-semibold text-right">Precio</th>
                            <th className="p-3 short:p-1.5 font-semibold text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-var)]">
                        {articulos.map(a => {
                            const q = cart.find(i => i.id === a.id)?.qty || 0
                            return (
                                <tr key={a.id} className="group/tr hover:bg-[var(--surfaceDark)] transition-none short:text-[11px]">
                                    <td className="p-3 short:p-1 short:pl-3 font-mono text-[var(--teal)] font-bold text-[11px] short:text-[10px] whitespace-nowrap">{a.codigo}</td>
                                    <td className="p-3 short:p-1 min-w-[200px]">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <div className="font-bold text-[var(--text-main)] leading-tight text-sm short:text-xs">
                                                {a.descripcion.length > 50 ? a.descripcion.substring(0, 50) + '...' : a.descripcion}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 short:hidden">
                                            <span className="text-[10px] text-[var(--text2)] font-medium uppercase tracking-tighter">{a.marca}</span>
                                            {a.ubicacion && (
                                                <span className="bg-[var(--surface2)] text-[var(--text2)] border border-[var(--border-var)] text-[8px] px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-0.5">
                                                    <span className="material-icons-round text-[9px]">place</span>
                                                    {a.ubicacion}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3 short:p-1 text-center">
                                        <span className={`badge ${(a.stock ?? 0) === 0 ? 'bg-[var(--red-var)]' : (a.stock ?? 0) <= 3 ? 'bg-[var(--orange-var)]' : 'bg-[var(--green-var)]'} text-white shadow-sm !px-2.5 font-mono font-bold inline-block`}>
                                            {a.stock ?? 0}
                                        </span>
                                    </td>
                                    <td className="p-3 short:p-1 font-mono text-right font-black text-[var(--text-main)] whitespace-nowrap">{fmtUSD(a.precio)}</td>
                                    <td className="p-3 short:p-1 text-right whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-2 short:gap-1">
                                            {q > 0 && (
                                                <>
                                                    <button className="w-8 h-8 short:w-6 short:h-6 border border-[var(--border-var)] transition-none inline-flex items-center justify-center shadow-[var(--win-shadow)] bg-[var(--surface2)] text-[var(--red-var)] hover:bg-[var(--red-var)] hover:text-white active:scale-90"
                                                        onClick={() => {
                                                            if (q === 1) removeFromCart(a.id)
                                                            else updateQty(a.id, q - 1)
                                                        }}>
                                                        <span className="material-icons-round text-sm">remove</span>
                                                    </button>
                                                    <div className="flex items-center justify-center gap-1 bg-[var(--green-var)] text-white w-8 h-8 short:w-6 short:h-6 rounded shadow-sm font-['IBM_Plex_Mono'] transition-all">
                                                        <span className="font-black text-[14px] short:text-[11px]">{q}</span>
                                                    </div>
                                                </>
                                            )}
                                            <button className={`w-8 h-8 short:w-6 short:h-6 border border-[var(--border-var)] transition-none inline-flex items-center justify-center shadow-[var(--win-shadow)]
                                                ${(a.stock ?? 0) === 0
                                                    ? 'bg-[var(--surface2)] text-[var(--text2)] cursor-not-allowed shadow-none'
                                                    : 'bg-[var(--teal)] text-white hover:bg-[var(--tealDark)] active:scale-90'}`}
                                                onClick={() => addToCart(a)}
                                                disabled={(a.stock ?? 0) === 0}>
                                                <span className="material-icons-round text-sm short:text-[11px]">add</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
