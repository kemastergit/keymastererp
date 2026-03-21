import { fmtUSD } from '../../utils/format'

export default function ItemsAgregados({
    cart, updateQty, openEditItem, removeFromCart
}) {
    return (
        <div className="col-items bg-[var(--surface)] border border-[var(--border-var)] flex flex-col overflow-hidden h-full min-h-0 w-full lg:flex-1 lg:min-w-[220px]">
            <div className="p-4 short:p-2 border-b border-[var(--border-var)] bg-[var(--surface2)] flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <span className="material-icons-round text-[var(--teal)] short:text-base">shopping_basket</span>
                    <div className="font-['IBM_Plex_Mono'] font-bold text-[var(--text-main)] text-[11px] short:text-[9px] uppercase tracking-wider">
                        Detalle <span className="text-[var(--text2)]">({cart.length})</span>
                    </div>
                </div>
            </div>

            <div className="items-lista flex-1 p-3 space-y-2 relative bg-[var(--surfaceDark)] overflow-y-auto custom-scroll min-h-0">
                {cart.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
                        <span className="material-icons-round text-5xl mb-3 text-[var(--text2)]">remove_shopping_cart</span>
                        <div className="text-center text-[var(--text2)] text-[11px] font-bold tracking-widest uppercase">Sin productos<br />agregados</div>
                    </div>
                ) : (
                    cart.map(item => (
                        <div key={item.id} className="bg-[var(--surface)] border border-[var(--border-var)] p-3 short:p-1.5 flex flex-col group transition-none shadow-[var(--win-shadow)]">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 min-w-0 pr-2 cursor-pointer" onClick={() => openEditItem(item)}>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <div className="text-[10px] short:text-[8px] font-mono font-bold text-[var(--teal)]">{item.codigo}</div>
                                        {item.marca && (
                                            <div className="text-[9px] bg-slate-100 text-slate-500 font-black px-1.5 py-0.5 rounded uppercase tracking-wider border border-slate-200">
                                                {item.marca}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xs short:text-[10px] short:leading-none font-bold text-[var(--text-main)] leading-tight group-hover:text-[var(--teal)] transition-colors">
                                        {item.descripcion}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                                    className="text-[var(--text2)] hover:text-white hover:bg-[var(--red-var)] transition-colors w-5 h-5 flex justify-center items-center shrink-0 border border-transparent hover:border-[var(--red-var)]"
                                >
                                    <span className="material-icons-round text-sm">close</span>
                                </button>
                            </div>

                            <div className="flex items-center justify-between mt-auto pt-2 short:pt-1 short:mt-1 border-t border-[var(--border-var)]">
                                <div className="flex items-center bg-[var(--surface2)] border border-[var(--border-var)] h-7 short:h-5">
                                    <button className="px-2 text-[12px] font-black text-[var(--text2)] hover:text-white hover:bg-[var(--teal)] transition-colors h-full flex items-center justify-center min-w-[24px]" onClick={() => updateQty(item.id, item.qty - 1)}>-</button>
                                    <span className="w-8 text-center text-xs font-bold border-l border-r border-[var(--border-var)] bg-[var(--surface)] h-full flex items-center justify-center">{item.qty}</span>
                                    <button className="px-2 text-[12px] font-black text-[var(--text2)] hover:text-white hover:bg-[var(--teal)] transition-colors h-full flex items-center justify-center min-w-[24px]" onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                                </div>
                                <div className="text-right">
                                    <div className="text-[9px] text-[var(--text2)] font-medium">{fmtUSD(item.precio)} c/u</div>
                                    <div className="font-mono text-xs font-black text-[var(--text-main)]">{fmtUSD(item.precio * item.qty)}</div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
