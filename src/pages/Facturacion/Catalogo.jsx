import { fmtUSD } from '../../utils/format'

export default function Catalogo({
    busq, setBusq, showDrop, setShowDrop, articulos, addToCart, addGeneric
}) {
    return (
        <div className="col-catalogo bg-[var(--surface)] border border-[var(--border-var)] flex flex-col overflow-hidden h-full relative min-h-0 w-full lg:flex-[1.5]">
            <div className="p-4 border-b border-[var(--border-var)] bg-[var(--surface2)] flex flex-col gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="material-icons-round text-[var(--teal)]">inventory_2</span>
                    <div className="font-['IBM_Plex_Mono'] font-bold text-[var(--text-main)] text-[11px] uppercase tracking-wider">Catálogo Sugerido</div>
                </div>

                <div className="relative group">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input className="inp !py-3 !pl-11 !bg-[var(--surface)] focus:!bg-[var(--surface2)] shadow-inner w-full border border-[var(--border-var)] transition-none"
                                value={busq}
                                onChange={e => { setBusq(e.target.value); setShowDrop(true) }}
                                onFocus={() => setShowDrop(true)}
                                onBlur={() => setTimeout(() => setShowDrop(false), 200)}
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
                            {articulos.map(a => (
                                <div key={a.id}
                                    className="px-4 py-3 cursor-pointer border-b border-[var(--border-var)] hover:bg-[var(--surface2)] transition-none flex items-center justify-between group/item"
                                    onClick={() => { addToCart(a); setBusq(''); setShowDrop(false) }}>
                                    <div className="min-w-0 pr-4">
                                        <div className="flex items-center gap-2">
                                            <div className="font-mono text-[var(--teal)] text-[10px] font-bold uppercase">{a.codigo}</div>
                                            {a.ubicacion && (
                                                <span className="text-[8px] bg-[var(--surfaceDark)] text-[var(--text2)] px-1 rounded font-black uppercase border border-[var(--border-var)]">📍 {a.ubicacion}</span>
                                            )}
                                        </div>
                                        <div className="font-bold text-[var(--text-main)] text-sm truncate">{a.descripcion}</div>
                                    </div>
                                    <div className="text-right whitespace-nowrap">
                                        <div className="text-sm font-black text-[var(--text-main)]">{fmtUSD(a.precio)}</div>
                                        <div className={`text-[9px] font-bold uppercase ${a.stock <= 0 ? 'text-[var(--red-var)]' : 'text-[var(--green-var)]'}`}>
                                            Stock: {a.stock ?? 0}
                                        </div>
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
                        <tr className="text-[10px] uppercase text-[var(--text2)] font-['IBM_Plex_Mono']">
                            <th className="p-3 font-semibold text-left">Código</th>
                            <th className="p-3 font-semibold text-left">Producto</th>
                            <th className="p-3 font-semibold text-center">Stock</th>
                            <th className="p-3 font-semibold text-right">Precio</th>
                            <th className="p-3 font-semibold text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-var)]">
                        {articulos.map(a => (
                            <tr key={a.id} className="group/tr hover:bg-[var(--surfaceDark)] transition-none">
                                <td className="p-3 font-mono text-[var(--teal)] font-bold text-[11px] whitespace-nowrap">{a.codigo}</td>
                                <td className="p-3 min-w-[200px]">
                                    <div className="font-bold text-[var(--text-main)] leading-tight text-sm">{a.descripcion}</div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-[var(--text2)] font-medium uppercase tracking-tighter">{a.marca}</span>
                                        {a.ubicacion && (
                                            <span className="bg-[var(--surface2)] text-[var(--text2)] border border-[var(--border-var)] text-[8px] px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-0.5">
                                                <span className="material-icons-round text-[9px]">place</span>
                                                {a.ubicacion}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-3 text-center">
                                    <span className={`badge ${(a.stock ?? 0) === 0 ? 'bg-[var(--red-var)]' : (a.stock ?? 0) <= 3 ? 'bg-[var(--orange-var)]' : 'bg-[var(--green-var)]'} text-white shadow-sm !px-2.5 font-mono font-bold inline-block`}>
                                        {a.stock ?? 0}
                                    </span>
                                </td>
                                <td className="p-3 font-mono text-right font-black text-[var(--text-main)] whitespace-nowrap">{fmtUSD(a.precio)}</td>
                                <td className="p-3 text-right whitespace-nowrap">
                                    <button className={`w-8 h-8 border border-[var(--border-var)] transition-none inline-flex items-center justify-center shadow-[var(--win-shadow)]
                    ${(a.stock ?? 0) === 0
                                            ? 'bg-[var(--surface2)] text-[var(--text2)] cursor-not-allowed shadow-none'
                                            : 'bg-[var(--teal)] text-white hover:bg-[var(--tealDark)]'}`}
                                        onClick={() => addToCart(a)}
                                        disabled={(a.stock ?? 0) === 0}>
                                        <span className="material-icons-round text-sm">add</span>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
