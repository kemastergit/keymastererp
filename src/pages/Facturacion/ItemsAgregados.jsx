import { fmtUSD } from '../../utils/format'

export default function ItemsAgregados({
    cart, updateQty, openEditItem, removeFromCart
}) {
    return (
        <div className="col-items bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col overflow-hidden h-full min-h-0" style={{ flex: 1, minWidth: '220px' }}>
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <span className="material-icons-round text-primary">shopping_basket</span>
                    <div className="font-bold text-slate-700 text-sm uppercase tracking-widest">
                        Detalle <span className="text-slate-400">({cart.length})</span>
                    </div>
                </div>
            </div>

            <div className="items-lista flex-1 p-3 space-y-2 relative bg-slate-50/30 overflow-y-auto min-h-0 custom-scroll">
                {cart.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
                        <span className="material-icons-round text-5xl mb-3 text-slate-300">remove_shopping_cart</span>
                        <div className="text-center text-slate-500 text-[11px] font-bold tracking-widest uppercase">Sin productos<br />agregados</div>
                    </div>
                ) : (
                    cart.map(item => (
                        <div key={item.id} className="bg-white border border-slate-100 rounded-2xl p-3 flex flex-col group transition-all hover:border-primary/20 hover:shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 min-w-0 pr-2 cursor-pointer" onClick={() => openEditItem(item)}>
                                    <div className="text-[10px] font-mono font-bold text-primary mb-0.5">{item.codigo}</div>
                                    <div className="text-xs font-bold text-slate-700 leading-tight group-hover:text-primary transition-colors">
                                        {item.descripcion}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                                    className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                >
                                    <span className="material-icons-round text-sm">close</span>
                                </button>
                            </div>

                            <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-full h-8">
                                    <button className="px-3 text-[12px] font-black text-slate-500 hover:text-primary" onClick={() => updateQty(item.id, item.qty - 1)}>-</button>
                                    <span className="w-8 text-center text-xs font-bold">{item.qty}</span>
                                    <button className="px-3 text-[12px] font-black text-slate-500 hover:text-primary" onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                                </div>
                                <div className="text-right">
                                    <div className="text-[9px] text-slate-400 font-medium">{fmtUSD(item.precio)} c/u</div>
                                    <div className="font-mono text-xs font-black text-slate-800">{fmtUSD(item.precio * item.qty)}</div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
