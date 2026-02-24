import { fmtUSD } from '../../utils/format'

export default function Catalogo({
    busq, setBusq, showDrop, setShowDrop, articulos, addToCart, addGeneric
}) {
    return (
        <div className="col-catalogo bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col overflow-hidden h-full relative min-h-0" style={{ flex: 1.5 }}>
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="material-icons-round text-primary">inventory_2</span>
                    <div className="font-bold text-slate-700 text-sm">Catálogo Sugerido</div>
                </div>

                <div className="relative group">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input className="inp !py-3 !pl-11 !bg-slate-50 focus:!bg-white transition-all shadow-inner w-full"
                                value={busq}
                                onChange={e => { setBusq(e.target.value); setShowDrop(true) }}
                                onFocus={() => setShowDrop(true)}
                                onBlur={() => setTimeout(() => setShowDrop(false), 200)}
                                placeholder="Escriba código o nombre..."
                                autoComplete="off" inputMode="search" />
                            <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">search</span>
                            {busq.length > 0 && (
                                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500 transition-colors"
                                    onClick={() => { setBusq(''); setShowDrop(false); }}>
                                    <span className="material-icons-round text-sm">close</span>
                                </button>
                            )}
                        </div>
                        <button className="btn btn-y !px-4 shrink-0 rounded-2xl shadow-amber-500/20" onClick={addGeneric} title="Agregar Artículo Varios">
                            <span className="material-icons-round text-base">category</span>
                            <span className="text-[10px]">VARIOS</span>
                        </button>
                    </div>

                    {showDrop && articulos.length > 0 && (
                        <div className="absolute z-50 w-full bg-white border border-slate-200 mt-2
            rounded-2xl max-h-72 overflow-y-auto shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 custom-scroll left-0">
                            {articulos.map(a => (
                                <div key={a.id}
                                    className="px-4 py-3 cursor-pointer border-b border-slate-50 hover:bg-slate-50 transition-colors flex items-center justify-between group/item"
                                    onClick={() => { addToCart(a); setBusq(''); setShowDrop(false) }}>
                                    <div className="min-w-0 pr-4">
                                        <div className="flex items-center gap-2">
                                            <div className="font-mono text-primary text-[10px] font-bold uppercase">{a.codigo}</div>
                                            {a.ubicacion && (
                                                <span className="text-[8px] bg-slate-100 text-slate-400 px-1 rounded font-black uppercase">📍 {a.ubicacion}</span>
                                            )}
                                        </div>
                                        <div className="font-bold text-slate-700 text-sm truncate">{a.descripcion}</div>
                                    </div>
                                    <div className="text-right whitespace-nowrap">
                                        <div className="text-sm font-black text-slate-800">{fmtUSD(a.precio)}</div>
                                        <div className={`text-[9px] font-bold uppercase ${a.stock <= 0 ? 'text-red-500' : 'text-green-600'}`}>
                                            Stock: {a.stock ?? 0}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="catalogo-lista flex-1 overflow-x-auto overflow-y-auto relative min-h-0">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                        <tr className="text-[10px] uppercase text-slate-400">
                            <th className="p-3 font-semibold text-left">Código</th>
                            <th className="p-3 font-semibold text-left">Producto</th>
                            <th className="p-3 font-semibold text-center">Stock</th>
                            <th className="p-3 font-semibold text-right">Precio</th>
                            <th className="p-3 font-semibold text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {articulos.map(a => (
                            <tr key={a.id} className="group/tr hover:bg-slate-50 transition-colors">
                                <td className="p-3 font-mono text-primary font-bold text-[11px] whitespace-nowrap">{a.codigo}</td>
                                <td className="p-3 min-w-[200px]">
                                    <div className="font-bold text-slate-700 leading-tight text-sm">{a.descripcion}</div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">{a.marca}</span>
                                        {a.ubicacion && (
                                            <span className="bg-slate-100 text-slate-500 text-[8px] px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-0.5">
                                                <span className="material-icons-round text-[9px]">place</span>
                                                {a.ubicacion}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-3 text-center">
                                    <span className={`badge ${(a.stock ?? 0) === 0 ? 'badge-r' : (a.stock ?? 0) <= 3 ? 'badge-y' : 'badge-g'} !px-2.5 font-mono font-bold inline-block`}>
                                        {a.stock ?? 0}
                                    </span>
                                </td>
                                <td className="p-3 font-mono text-right font-black text-slate-800 whitespace-nowrap">{fmtUSD(a.precio)}</td>
                                <td className="p-3 text-right whitespace-nowrap">
                                    <button className={`w-8 h-8 rounded-full border-2 transition-all inline-flex items-center justify-center
                    ${(a.stock ?? 0) === 0
                                            ? 'border-slate-100 text-slate-200 cursor-not-allowed'
                                            : 'border-green-100 bg-green-50 text-green-600 hover:bg-green-500 hover:text-white hover:border-green-500'}`}
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
