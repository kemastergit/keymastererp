import { fmtUSD } from '../../utils/format'

export default function ItemsAgregados({
    cart, updateQty, openEditItem, removeFromCart
}) {
    return (
        <div className="col-items bg-[var(--surface)] border border-[var(--border-var)] flex flex-col overflow-hidden h-full min-h-0 w-full lg:flex-1 lg:min-w-[200px]">
            {/* HEADER */}
            <div className="px-3 py-2.5 border-b border-[var(--border-var)] bg-[var(--surface2)] flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <span className="material-icons-round text-[var(--teal)] text-base">shopping_basket</span>
                    <span className="font-['IBM_Plex_Mono'] font-bold text-[var(--text-main)] text-[10px] uppercase tracking-wider">
                        Detalle <span className="text-[var(--text2)]">({cart.length})</span>
                    </span>
                </div>
            </div>

            {/* LISTA COMPACTA */}
            <div className="flex-1 overflow-y-auto custom-scroll min-h-0 bg-[var(--surfaceDark)]">
                {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-30">
                        <span className="material-icons-round text-4xl mb-2 text-[var(--text2)]">remove_shopping_cart</span>
                        <div className="text-center text-[var(--text2)] text-[9px] font-bold tracking-widest uppercase">Sin productos</div>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--border-var)]">
                        {cart.map(item => (
                            <div key={item.id}
                                className="flex items-center gap-2 px-2 py-2 hover:bg-[var(--surface)] transition-colors group"
                            >
                                {/* CONTROLES QTY */}
                                <div className="flex items-center bg-[var(--surface2)] border border-[var(--border-var)] h-6 shrink-0">
                                    <button
                                        className="px-1.5 text-[11px] font-black text-[var(--text2)] hover:text-white hover:bg-[var(--teal)] transition-colors h-full flex items-center"
                                        onClick={() => updateQty(item.id, item.qty - 1)}
                                    >−</button>
                                    <span className="w-6 text-center text-[10px] font-black border-l border-r border-[var(--border-var)] bg-[var(--surface)] h-full flex items-center justify-center">
                                        {item.qty}
                                    </span>
                                    <button
                                        className="px-1.5 text-[11px] font-black text-[var(--text2)] hover:text-white hover:bg-[var(--teal)] transition-colors h-full flex items-center"
                                        onClick={() => updateQty(item.id, item.qty + 1)}
                                    >+</button>
                                </div>

                                {/* DESCRIPCIÓN */}
                                <div
                                    className="flex-1 min-w-0 cursor-pointer"
                                    onClick={() => openEditItem(item)}
                                >
                                    <div className="text-[9px] font-mono font-bold text-[var(--teal)] truncate leading-none">{item.codigo}</div>
                                    <div className="text-[14px] font-bold text-[var(--text-main)] truncate leading-tight group-hover:text-[var(--teal)] transition-colors">
                                        {item.descripcion}
                                    </div>
                                </div>

                                {/* PRECIO + BORRAR */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="text-right">
                                        <div className="text-[11px] text-[var(--text2)] font-medium leading-none">{fmtUSD(item.precio)}/u</div>
                                        <div className="font-mono text-[15px] font-black text-[var(--text-main)] leading-tight">{fmtUSD(item.precio * item.qty)}</div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeFromCart(item.id) }}
                                        className="text-[var(--text2)] hover:text-white hover:bg-[var(--red-var)] transition-colors w-5 h-5 flex justify-center items-center border border-transparent hover:border-[var(--red-var)] shrink-0"
                                    >
                                        <span className="material-icons-round text-[13px]">close</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
