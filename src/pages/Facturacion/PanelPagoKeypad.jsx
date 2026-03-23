import { fmtUSD, fmtBS } from '../../utils/format'

const METODOS = [
  { id: 'EFECTIVO_USD', label: 'Efectivo $',  icon: 'payments',             currency: 'USD' },
  { id: 'EFECTIVO_BS',  label: 'Efectivo Bs', icon: 'money',                currency: 'BS'  },
  { id: 'PUNTO_VENTA',  label: 'Tarjeta',     icon: 'credit_card',          currency: 'BS'  },
  { id: 'ZELLE',        label: 'Zelle',       icon: 'bolt',                 currency: 'USD' },
  { id: 'PAGO_MOVIL',   label: 'Pago Móvil',  icon: 'smartphone',           currency: 'BS'  },
  { id: 'TRANSFERENCIA_BS', label: 'Transf.', icon: 'account_balance',      currency: 'BS'  },
  { id: 'CUPON',        label: 'Cupón',       icon: 'confirmation_number',  currency: 'ANY' },
  { id: 'OTRO',         label: 'Otro',        icon: 'more_horiz',           currency: 'ANY' },
]

const KEYPAD = [1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, 'DEL']

export default function PanelPagoKeypad({
  payForm, setPayForm,
  keypadBuffer, setKeypadBuffer,
  activeCurrency, setActiveCurrency,
  handleAddPay, handleKeypad,
  cartTotal, paymentsTotal,
  payments, handleEditPay, removePayment,
  tasa,
  onConfirm,   // llama a setShowPaymentModal(false) en mobile, no se usa en desktop
}) {
  const totalVenta = cartTotal()
  const yaPagado  = paymentsTotal()
  const saldo     = Math.max(0, totalVenta - yaPagado)

  const handleMethod = (m) => {
    setPayForm(prev => ({ ...prev, metodo: m.id }))
    if (m.currency !== 'ANY' && m.currency !== activeCurrency) {
      if (keypadBuffer) {
        const n = parseFloat(keypadBuffer) || 0
        const converted = m.currency === 'BS'
          ? (n * tasa).toFixed(2)
          : (n / tasa).toFixed(2)
        setKeypadBuffer(converted === '0.00' ? '' : converted)
      }
      setActiveCurrency(m.currency)
    }
  }

  const switchCurrency = (to) => {
    if (to === activeCurrency) return
    if (keypadBuffer) {
      const n = parseFloat(keypadBuffer) || 0
      const converted = to === 'BS'
        ? (n * tasa).toFixed(2)
        : (n / tasa).toFixed(2)
      setKeypadBuffer(converted === '0.00' ? '' : converted)
    }
    setActiveCurrency(to)
  }

  const metodosFiltrados = METODOS.filter(m => m.currency === 'ANY' || m.currency === activeCurrency)

  return (
    <div className="flex flex-col h-full bg-[#F4F6F8] border-l border-slate-200 overflow-hidden">

      {/* ── HEADER ── */}
      <div className="flex items-center gap-3 p-3 bg-white border-b border-slate-100 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
          <span className="material-icons-round text-[#F36E25] text-[18px]">payments</span>
        </div>
        <div>
          <p className="text-xs font-black text-[#131E2E] uppercase tracking-tighter leading-none">Registro de Pagos</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Múltiples métodos</p>
        </div>
      </div>

      {/* ── RESUMEN 3 CARDS ── */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-orange-50/30 shrink-0">
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex flex-col">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1 leading-none">TOTAL</p>
          <p className="text-xs font-black text-[#131E2E] font-mono">
            {activeCurrency === 'USD' ? fmtUSD(totalVenta) : fmtBS(totalVenta * tasa)}
          </p>
        </div>
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex flex-col relative">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1 leading-none">ABONADO</p>
          <p className="text-xs font-black text-[var(--green-var)] font-mono">
            {activeCurrency === 'USD' ? fmtUSD(yaPagado) : fmtBS(yaPagado * tasa)}
          </p>
          {payments.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-[var(--green-var)] text-white text-[7px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-white">
              {payments.length}
            </span>
          )}
        </div>
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex flex-col">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1 leading-none">FALTA</p>
          <p className="text-xs font-black text-[#F36E25] font-mono">
            {activeCurrency === 'USD' ? fmtUSD(saldo) : fmtBS(saldo * tasa)}
          </p>
        </div>
      </div>

      {/* ── SCROLLER PRINCIPAL ── */}
      <div className="flex-1 overflow-y-auto custom-scroll min-h-0 flex flex-col">

        {/* SWITCHER MONEDA */}
        <div className="px-3 pt-3 shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => switchCurrency('USD')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${activeCurrency === 'USD' ? 'bg-white text-[#F36E25] shadow-sm' : 'text-slate-400'}`}
            >USD</button>
            <button
              onClick={() => switchCurrency('BS')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${activeCurrency === 'BS' ? 'bg-white text-[#F36E25] shadow-sm' : 'text-slate-400'}`}
            >BS</button>
          </div>
        </div>

        {/* MÉTODOS DE PAGO */}
        <div className="px-3 pt-3 shrink-0">
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">Método</p>
          <div className="grid grid-cols-4 gap-1.5">
            {metodosFiltrados.map(m => (
              <button
                key={m.id}
                onClick={() => handleMethod(m)}
                className={`flex flex-col items-center justify-center p-1.5 rounded-xl border-2 transition-all aspect-square
                  ${payForm.metodo === m.id
                    ? 'border-[#F36E25] bg-white shadow-md scale-105'
                    : 'border-transparent bg-white/50 opacity-60 hover:opacity-90'}`}
              >
                <span className={`material-icons-round text-base ${payForm.metodo === m.id ? 'text-[#F36E25]' : 'text-slate-400'}`}>
                  {m.icon}
                </span>
                <span className={`text-[8px] font-black mt-0.5 leading-tight text-center ${payForm.metodo === m.id ? 'text-[#131E2E]' : 'text-slate-400'}`}>
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* PAGOS APLICADOS */}
        {payments.length > 0 && (
          <div className="px-3 pt-3 shrink-0">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Pagos aplicados</p>
            <div className="space-y-1">
              {payments.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleEditPay(p)}
                  className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100 shadow-sm hover:border-[#F36E25] cursor-pointer group transition-all"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="material-icons-round text-[var(--green-var)] text-sm group-hover:text-[#F36E25]">check_circle</span>
                    <span className="text-[9px] font-black text-[#131E2E] uppercase tracking-tight">{p.metodo.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-[#131E2E] font-mono">{fmtUSD(p.monto)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removePayment(p.id) }}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <span className="material-icons-round text-sm">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DISPLAY MONTO */}
        <div className="px-3 pt-3 shrink-0">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Monto a ingresar</p>
          <div className={`p-2.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center bg-white shadow-sm
            ${keypadBuffer ? 'border-[#F36E25]' : 'border-slate-100'}`}
          >
            <div className="flex items-baseline">
              <span className="text-sm font-black text-slate-400 mr-1">{activeCurrency === 'USD' ? '$' : 'Bs'}</span>
              <span className="text-2xl font-mono font-black text-[#131E2E] tracking-tighter">{keypadBuffer || '0.00'}</span>
            </div>
            {keypadBuffer && parseFloat(keypadBuffer) > 0 && (
              <div className="text-[9px] font-mono font-bold text-slate-400 leading-none mt-1">
                {activeCurrency === 'USD'
                  ? `Bs ${(parseFloat(keypadBuffer) * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : `$ ${(parseFloat(keypadBuffer) / tasa).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
              </div>
            )}
          </div>
        </div>

        {/* TECLADO NUMÉRICO */}
        <div className="px-3 pt-3 shrink-0">
          <div className="grid grid-cols-3 gap-2">
            {KEYPAD.map(val => (
              <button
                key={val}
                onClick={() => handleKeypad(val)}
                className={`w-full aspect-square rounded-2xl font-black text-lg transition-all flex items-center justify-center
                  ${val === 'DEL'
                    ? 'bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-500'
                    : 'bg-white text-[#131E2E] shadow-sm hover:scale-110 active:scale-95 border border-slate-100'}`}
              >
                {val === 'DEL' ? <span className="material-icons-round text-[18px]">backspace</span> : val}
              </button>
            ))}
          </div>
        </div>

        {/* BOTÓN AÑADIR PAGO */}
        <div className="px-3 pt-3 pb-3 shrink-0 space-y-2">
          <button
            onClick={() => handleAddPay(true)}
            disabled={!keypadBuffer || parseFloat(keypadBuffer) <= 0}
            className="w-full py-3 bg-[#F36E25] hover:bg-[#e05d1a] disabled:opacity-30 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2 active:scale-[0.97]"
          >
            <span className="material-icons-round text-base">add_circle</span>
            Añadir Pago
          </button>

          {onConfirm && (
            <button
              onClick={onConfirm}
              className="w-full py-3 bg-[#131E2E] text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl shadow-slate-200 active:scale-[0.97]"
            >
              Confirmar Pagos
              <span className="material-icons-round text-base">verified_user</span>
            </button>
          )}
        </div>

      </div>{/* fin scroller */}

    </div>
  )
}
