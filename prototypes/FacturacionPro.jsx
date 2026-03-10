import React, { useState, useMemo } from 'react';
import {
    ShoppingCart,
    CreditCard,
    History,
    User,
    Search,
    Plus,
    Minus,
    Trash2,
    DollarSign,
    ChevronRight,
    Calendar,
    Wallet,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    Package,
    Hash,
    Activity
} from 'lucide-react';

// Mock Data Actualizada (Repuestos de Autos)
const INITIAL_PRODUCTS = [
    { id: 1, codigo: 'FR-001', name: 'Pastillas Frenos Delanteras Corolla 2012', brand: 'WAGNER', price: 18.5, stock: 45, ref: '7892-A' },
    { id: 2, codigo: 'FI-102', name: 'Filtro Aceite PH-4967', brand: 'FRAM', price: 6.5, stock: 120, ref: 'PH4967' },
    { id: 3, codigo: 'BA-950', name: 'Batería 800 AMP 24MR', brand: 'TITAN', price: 85.0, stock: 8, ref: 'BT-800' },
    { id: 4, codigo: 'BO-223', name: 'Bomba Gasolina Completa Hilux KAVAK', brand: 'DENSO', price: 125.0, stock: 15, ref: '23221-50100' },
    { id: 5, codigo: 'BU-044', name: 'Bujía Punta Iridium CR9EH', brand: 'NGK', price: 12.0, stock: 4, ref: '9452' },
    { id: 6, codigo: 'AM-772', name: 'Amortiguador Delantero Explorar 4x4', brand: 'MONROE', price: 45.0, stock: 22, ref: '56021' },
    { id: 7, codigo: 'CO-110', name: 'Correa Única 6PK-2135', brand: 'GATES', price: 21.0, stock: 35, ref: 'K060841' },
];

const CLIENTS = [
    { id: 'V-12345678', name: 'Juan Luis Pérez', creditLimit: 500, currentDebt: 120 },
    { id: 'V-87654321', name: 'María Rodríguez', creditLimit: 200, currentDebt: 0 },
];

const TASA_BCV = 52.40;

const FacturacionProText = () => {
    const [cart, setCart] = useState([]);
    const [step, setStep] = useState('cart'); // cart, payment, credit
    const [selectedClient, setSelectedClient] = useState(CLIENTS[0]);
    const [payments, setPayments] = useState([]);
    const [paymentForm, setPaymentForm] = useState({ method: '', amount: '' });

    // Installment config
    const [installments, setInstallments] = useState(3);
    const [downPayment, setDownPayment] = useState(0);
    const [frequency, setFrequency] = useState('mensual');

    const addToCart = (product) => {
        setCart(prev => {
            const exists = prev.find(item => item.id === product.id);
            if (exists) {
                return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
            }
            return [...prev, { ...product, qty: 1 }];
        });
    };

    const updateQty = (id, delta) => {
        setCart(prev => prev.map(item =>
            item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item
        ));
    };

    const removeFromCart = (id) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const remainingToPay = Math.max(0, cartTotal - payments.reduce((acc, p) => acc + p.amount, 0));

    const addPayment = () => {
        const amount = parseFloat(paymentForm.amount);
        if (!amount || amount <= 0 || !paymentForm.method) return;
        setPayments([...payments, { id: Date.now(), method: paymentForm.method, amount: amount }]);
        setPaymentForm({ method: '', amount: '' });
    };

    const removePayment = (id) => setPayments(prev => prev.filter(p => p.id !== id));

    const getInstallmentPlan = () => {
        const remaining = Math.max(0, cartTotal - downPayment);
        const perInstallment = remaining / installments;
        const plan = [];
        for (let i = 1; i <= installments; i++) {
            const date = new Date();
            if (frequency === 'mensual') date.setMonth(date.getMonth() + i);
            if (frequency === 'quincenal') date.setDate(date.getDate() + (i * 15));
            if (frequency === 'semanal') date.setDate(date.getDate() + (i * 7));
            plan.push({ num: i, amount: perInstallment, date: date.toLocaleDateString() });
        }
        return plan;
    };

    return (
        <div className="min-h-screen bg-[#070b0f] text-slate-100 font-sans selection:bg-emerald-500/30">
            {/* Navbar Minimalista Pro */}
            <nav className="border-b border-slate-800/30 bg-[#070b0f]/90 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <h1 className="font-black text-sm tracking-[0.2em] uppercase text-emerald-500">Keymaster<span className="text-white">ERP</span></h1>
                        <div className="h-4 w-[1px] bg-slate-800"></div>
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                            <span className="flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">
                                <Activity size={12} className="text-emerald-500" /> Sistema POS : Online
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Referencia BCV</span>
                            <span className="text-sm font-black text-white">Bs. {TASA_BCV.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-3 pl-6 border-l border-slate-800">
                            <div className="text-right">
                                <p className="text-xs font-black">Caja Principal 01</p>
                                <p className="text-[10px] text-emerald-500 uppercase tracking-tighter">Administrador</p>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <User size={16} className="text-emerald-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-[1600px] mx-auto p-4 lg:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">

                    {/* COLUMNA CATALOGO (IZQUIERDA) */}
                    <div className="lg:col-span-8 flex flex-col min-h-0 bg-[#0d1217] rounded-2xl border border-slate-800/50 shadow-2xl">

                        {/* Buscador de Alta Densidad */}
                        <div className="p-4 border-b border-slate-800/50 flex items-center gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="text"
                                    placeholder="Escribe código, nombre o marca del repuesto..."
                                    className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-600"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button className="bg-slate-900 border border-slate-800 p-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-400">
                                    <Hash size={18} />
                                </button>
                                <button className="bg-slate-900 border border-slate-800 p-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-400">
                                    <Package size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Lista Catalogo: Vista de Tabla de Alta Densidad */}
                        <div className="flex-1 overflow-y-auto custom-scroll">
                            <table className="w-full text-left border-separate border-spacing-0">
                                <thead className="sticky top-0 bg-[#0d1217] z-10">
                                    <tr className="border-b border-slate-800">
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">SKU/Código</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">Producto / Marca</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 text-right">Existencia</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 text-right">Precio USD</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 w-20"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {INITIAL_PRODUCTS.map(product => (
                                        <tr
                                            key={product.id}
                                            onClick={() => addToCart(product)}
                                            className="group hover:bg-emerald-500/[0.03] transition-colors cursor-pointer border-b border-slate-800/10"
                                        >
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-mono text-emerald-500/80 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 font-bold uppercase">{product.codigo}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">{product.name}</span>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] font-black text-slate-500 uppercase">{product.brand}</span>
                                                        <span className="text-[10px] text-slate-700">•</span>
                                                        <span className="text-[10px] text-slate-600 font-medium">Ref: {product.ref}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-xs font-bold ${product.stock > 10 ? 'text-emerald-500' : product.stock > 0 ? 'text-amber-500' : 'text-red-500'}`}>{product.stock} UNI</span>
                                                    <div className={`w-12 h-1 rounded-full mt-1 bg-slate-800 overflow-hidden`}>
                                                        <div className={`h-full ${product.stock > 10 ? 'bg-emerald-500' : product.stock > 0 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, (product.stock / 50) * 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-base font-black text-white">${product.price.toFixed(2)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-slate-700">
                                                    <Plus size={16} className="text-emerald-500" />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* SELECCION DE MODO (CONTADO VS CREDITO) */}
                        <div className="p-4 border-t border-slate-800/50 bg-slate-900/20 flex items-center justify-between">
                            <div className="flex gap-1 p-1 bg-[#070b0f] rounded-xl border border-slate-800">
                                <button
                                    onClick={() => setStep('payment')}
                                    className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${step === 'payment' || step === 'cart' ? 'bg-emerald-500 text-[#070b0f]' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    VENTA AL CONTADO
                                </button>
                                <button
                                    onClick={() => setStep('credit')}
                                    className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${step === 'credit' ? 'bg-amber-500 text-[#070b0f]' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    VENTA A CRÉDITO
                                </button>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Base Imponible</p>
                                    <p className="text-sm font-bold text-slate-300">${cartTotal.toFixed(2)}</p>
                                </div>
                                <div className="h-8 w-[1px] bg-slate-800"></div>
                                <div className="text-right">
                                    <p className="text-[10px] text-emerald-500 font-bold uppercase">Total Factura</p>
                                    <p className="text-xl font-black text-emerald-400">${cartTotal.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* COLUMNA DERECHA (CARRITO + PAGOS + CREDITOS) */}
                    <div className="lg:col-span-4 flex flex-col gap-6 h-full min-h-0">

                        {/* Tarjeta de Cliente (Sticky Top) */}
                        <div className="bg-[#0d1217] border border-slate-800/50 rounded-2xl p-5 flex items-center gap-4">
                            <div className="w-11 h-11 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                                <User size={20} className="text-slate-500" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-sm font-black text-white">{selectedClient.name}</h3>
                                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-bold">{selectedClient.id}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500" style={{ width: '40%' }}></div>
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-500">Cred: $380 disp.</span>
                                </div>
                            </div>
                        </div>

                        {/* Area de Trabajo Dinamica */}
                        <div className="flex-1 bg-[#0d1217] border border-slate-800/50 rounded-2xl flex flex-col min-h-0 overflow-hidden">

                            {/* Cabecera Carrito Rapido */}
                            <div className="p-4 border-b border-slate-800/50 bg-slate-900/20 flex items-center justify-between">
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <ShoppingCart size={14} className="text-emerald-500" /> Detalle de Venta
                                </h2>
                                <span className="text-[10px] font-black bg-emerald-500 text-[#070b0f] px-2 py-0.5 rounded-full">{cart.length} ITEMS</span>
                            </div>

                            {/* Lista de Items en el Carrito */}
                            <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-3">
                                {cart.map(item => (
                                    <div key={item.id} className="flex gap-3 bg-[#070b0f] p-3 rounded-xl border border-slate-800/50 group animate-in slide-in-from-right-4 duration-300">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-100 truncate">{item.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-black text-emerald-500">${item.price.toFixed(2)}</span>
                                                <span className="text-[10px] text-slate-600">x</span>
                                                <span className="text-[10px] font-bold text-slate-400">{item.qty} UNI</span>
                                                <span className="text-[10px] font-black text-white ml-auto">${(item.qty * item.price).toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => updateQty(item.id, 1)} className="p-1 rounded bg-slate-900 text-slate-500 hover:text-emerald-500"><Plus size={12} /></button>
                                            <button onClick={() => removeFromCart(item.id)} className="p-1 rounded bg-slate-900 text-slate-500 hover:text-red-500"><Trash2 size={12} /></button>
                                        </div>
                                    </div>
                                ))}
                                {cart.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-40 space-y-4 pt-20">
                                        <ShoppingCart size={48} />
                                        <p className="text-xs font-bold uppercase tracking-widest">Escanee un repuesto</p>
                                    </div>
                                )}
                            </div>

                            {/* CONTROLES DE PAGO / CREDITO (CONDICIONAL) */}
                            <div className="p-5 border-t border-slate-800 bg-[#070b0f]">
                                {step === 'credit' ? (
                                    <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5 focus-within:text-amber-500">
                                                <label className="text-[10px] font-black uppercase block transition-colors">Inicial ($)</label>
                                                <input type="number" value={downPayment} onChange={(e) => setDownPayment(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm font-black focus:outline-none focus:border-amber-500" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase block">Cuotas ({installments})</label>
                                                <select value={installments} onChange={(e) => setInstallments(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm font-bold focus:outline-none">
                                                    <option value="1">1 Cuota</option>
                                                    <option value="2">2 Cuotas</option>
                                                    <option value="3">3 Cuotas</option>
                                                    <option value="4">4 Cuotas</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button className="w-full bg-amber-500 hover:bg-amber-400 text-[#070b0f] py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10">
                                            PROCESAR CRÉDITO <ArrowRight size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10 mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-[#070b0f]">
                                                    <CheckCircle2 size={16} />
                                                </div>
                                                <p className="text-[10px] font-black text-slate-300">TOTAL A COBRAR</p>
                                            </div>
                                            <span className="text-xl font-black text-white">${cartTotal.toFixed(2)}</span>
                                        </div>
                                        <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#070b0f] py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                                            FACTURAR <ChevronRight size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>

                </div>
            </main>

            {/* SUTILES GRADIENTES DE FONDO */}
            <div className="fixed top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.05)_0%,transparent_50%)] pointer-events-none -z-10"></div>
        </div>
    );
};

export default FacturacionProText;
