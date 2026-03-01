import { useState, useEffect } from 'react'
import useStore from '../../store/useStore'
import { db } from '../../db/db'
import { btPrinter } from '../../utils/bluetoothPrinter'

export default function ConfigPage() {
    const { configEmpresa, loadConfigEmpresa, updateConfigEmpresa, toast, btStatus, setBtStatus } = useStore()
    const [formData, setFormData] = useState(null)

    useEffect(() => {
        loadConfigEmpresa()
        // Verificar si ya está conectado al entrar
        if (btPrinter.isConnected()) {
            setBtStatus('CONNECTED')
        } else {
            setBtStatus('DISCONNECTED')
        }
    }, [])

    useEffect(() => {
        if (configEmpresa) {
            setFormData(configEmpresa)
        }
    }, [configEmpresa])

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await updateConfigEmpresa(formData)
        } catch (error) {
            toast('❌ Error al guardar configuración', 'error')
        }
    }

    const testBT = async () => {
        try {
            setBtStatus('CONNECTING')
            await btPrinter.testPrint()
            setBtStatus('CONNECTED')
            toast('✅ Prueba de impresión enviada!', 'success')
        } catch (error) {
            setBtStatus('DISCONNECTED')
            toast('❌ Error Bluetooth: ' + (error.message || 'No se pudo conectar'), 'error')
        }
    }

    if (!formData) return <div className="p-8 text-white">Cargando...</div>

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto animate-fade-in pr-2 relative min-h-0">
            <header className="mb-8 p-4">
                <h1 className="text-3xl font-black text-[var(--text-main)] flex items-center gap-3 uppercase tracking-tighter">
                    <span className="text-[var(--teal)]">⚙️</span> CONFIGURACIÓN DE EMPRESA
                </h1>
                <p className="text-[var(--text2)] mt-1 font-bold text-xs uppercase tracking-widest">Gestiona la información que aparece en tus tickets y reportes.</p>
            </header>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
                {/* Datos Básicos */}
                <div className="panel p-6 rounded-none space-y-4 shadow-[var(--win-shadow)] transition-none h-full">
                    <h2 className="text-xl font-black text-[var(--teal)] mb-4 flex items-center gap-2 uppercase tracking-tight">
                        🏢 Datos Fiscales
                    </h2>

                    <div>
                        <label className="block text-[10px] uppercase font-black text-[var(--text2)] mb-1">Nombre de Empresa</label>
                        <input
                            type="text"
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleChange}
                            className="inp w-full bg-[var(--surfaceDark)] border border-[var(--border-var)] rounded-none p-3 text-[var(--text-main)] focus:border-[var(--teal)] outline-none transition-none shadow-inner"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] uppercase font-black text-[var(--text2)] mb-1">RIF</label>
                        <input
                            type="text"
                            name="rif"
                            value={formData.rif}
                            onChange={handleChange}
                            className="inp w-full bg-[var(--surfaceDark)] border border-[var(--border-var)] rounded-none p-3 text-[var(--text-main)] focus:border-[var(--teal)] outline-none transition-none shadow-inner"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] uppercase font-black text-[var(--text2)] mb-1">Dirección Línea 1</label>
                        <input
                            type="text"
                            name="direccion1"
                            value={formData.direccion1}
                            onChange={handleChange}
                            className="inp w-full bg-[var(--surfaceDark)] border border-[var(--border-var)] rounded-none p-3 text-[var(--text-main)] focus:border-[var(--teal)] outline-none transition-none shadow-inner"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] uppercase font-black text-[var(--text2)] mb-1">Dirección Línea 2</label>
                        <input
                            type="text"
                            name="direccion2"
                            value={formData.direccion2}
                            onChange={handleChange}
                            className="inp w-full bg-[var(--surfaceDark)] border border-[var(--border-var)] rounded-none p-3 text-[var(--text-main)] focus:border-[var(--teal)] outline-none transition-none shadow-inner"
                        />
                    </div>
                </div>

                {/* Contacto y Mensajes */}
                <div className="panel p-6 rounded-none space-y-4 shadow-[var(--win-shadow)] transition-none h-full">
                    <h2 className="text-xl font-black text-[var(--teal)] mb-4 flex items-center gap-2 uppercase tracking-tight">
                        📞 Contacto y Mensajes
                    </h2>

                    <div>
                        <label className="block text-[10px] uppercase font-black text-[var(--text2)] mb-1">Teléfonos</label>
                        <input
                            type="text"
                            name="telefonos"
                            value={formData.telefonos}
                            onChange={handleChange}
                            className="inp w-full bg-[var(--surfaceDark)] border border-[var(--border-var)] rounded-none p-3 text-[var(--text-main)] focus:border-[var(--teal)] outline-none transition-none shadow-inner"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] uppercase font-black text-[var(--text2)] mb-1">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="inp w-full bg-[var(--surfaceDark)] border border-[var(--border-var)] rounded-none p-3 text-[var(--text-main)] focus:border-[var(--teal)] outline-none transition-none shadow-inner"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] uppercase font-black text-[var(--text2)] mb-1">Mensaje Bienvenida (Ticket)</label>
                        <input
                            type="text"
                            name="mensaje_bienvenida"
                            value={formData.mensaje_bienvenida}
                            onChange={handleChange}
                            className="inp w-full bg-[var(--surfaceDark)] border border-[var(--border-var)] rounded-none p-3 text-[var(--text-main)] focus:border-[var(--teal)] outline-none transition-none shadow-inner"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] uppercase font-black text-[var(--text2)] mb-1">Mensaje Pie (Ticket)</label>
                        <input
                            type="text"
                            name="mensaje_pie"
                            value={formData.mensaje_pie}
                            onChange={handleChange}
                            className="inp w-full bg-[var(--surfaceDark)] border border-[var(--border-var)] rounded-none p-3 text-[var(--text-main)] focus:border-[var(--teal)] outline-none transition-none shadow-inner"
                        />
                    </div>
                </div>

                {/* Impresión y Otros */}
                <div className="panel p-6 rounded-none space-y-4 shadow-[var(--win-shadow)] transition-none col-span-1 md:col-span-2">
                    <h2 className="text-xl font-black text-[var(--teal)] mb-4 flex items-center gap-2 uppercase tracking-tight">
                        🖨️ Configuración de Impresión
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-[var(--surface2)] border border-[var(--border-var)] rounded-none shadow-sm">
                                <div>
                                    <div className="text-[var(--text-main)] font-black uppercase text-xs">Aplicar IVA</div>
                                    <div className="text-[10px] text-[var(--text2)] font-bold uppercase">Desglosar IVA en tickets y reportes</div>
                                </div>
                                <input
                                    type="checkbox"
                                    name="aplicar_iva"
                                    checked={formData.aplicar_iva}
                                    onChange={handleChange}
                                    className="w-6 h-6 accent-[var(--teal)] cursor-pointer"
                                />
                            </div>

                            {formData.aplicar_iva && (
                                <div className="p-4 bg-[var(--surfaceDark)] border border-[var(--border-var)] rounded-none">
                                    <label className="block text-[10px] uppercase font-black text-[var(--text2)] mb-1">Porcentaje IVA (%)</label>
                                    <input
                                        type="number"
                                        name="porcentaje_iva"
                                        value={formData.porcentaje_iva}
                                        onChange={handleChange}
                                        className="w-full bg-[var(--surface)] border border-[var(--border-var)] rounded-none p-2 text-[var(--text-main)] focus:border-[var(--teal)] outline-none font-mono font-bold"
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                            )}

                            <div className="flex items-center justify-between p-4 bg-[var(--surface2)] border border-[var(--border-var)] rounded-none shadow-sm">
                                <div>
                                    <div className="text-[var(--teal)] font-black uppercase text-xs flex items-center gap-2">
                                        <span className="material-icons-round text-sm">payments</span>
                                        Aplicar IGTF (3%)
                                    </div>
                                    <div className="text-[10px] text-[var(--text2)] font-bold uppercase">Impuesto a pagos en divisas / efectivo USD</div>
                                </div>
                                <input
                                    type="checkbox"
                                    name="aplicar_igtf"
                                    checked={formData.aplicar_igtf}
                                    onChange={handleChange}
                                    className="w-6 h-6 accent-[var(--teal)] cursor-pointer"
                                />
                            </div>

                            {formData.aplicar_igtf && (
                                <div className="p-4 bg-[var(--surfaceDark)] border border-[var(--border-var)] rounded-none">
                                    <label className="block text-[10px] uppercase font-black text-[var(--text2)] mb-1">Porcentaje IGTF (%)</label>
                                    <input
                                        type="number"
                                        name="porcentaje_igtf"
                                        value={formData.porcentaje_igtf}
                                        onChange={handleChange}
                                        className="w-full bg-[var(--surface)] border border-[var(--border-var)] rounded-none p-2 text-[var(--text-main)] focus:border-[var(--teal)] outline-none font-mono font-bold"
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                            )}

                            <div className="flex items-center justify-between p-4 bg-[var(--surface2)] border border-[var(--border-var)] rounded-none shadow-sm">
                                <div>
                                    <div className="text-[var(--text-main)] font-black uppercase text-xs">Mostrar Tasa BCV</div>
                                    <div className="text-[10px] text-[var(--text2)] font-bold uppercase">Incluir tasa y total en Bs en el ticket</div>
                                </div>
                                <input
                                    type="checkbox"
                                    name="mostrar_tasa"
                                    checked={formData.mostrar_tasa}
                                    onChange={handleChange}
                                    className="w-6 h-6 accent-[var(--teal)] cursor-pointer"
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-[var(--surface2)] border border-[var(--border-var)] rounded-none shadow-sm">
                                <div>
                                    <div className="text-[var(--orange-var)] font-black uppercase text-xs">Módulo de Comisiones</div>
                                    <div className="text-[10px] text-[var(--text2)] font-bold uppercase">Activar cálculo de incentivos por ventas</div>
                                </div>
                                <input
                                    type="checkbox"
                                    name="comisiones_habilitadas"
                                    checked={formData.comisiones_habilitadas}
                                    onChange={handleChange}
                                    className="w-6 h-6 accent-[var(--teal)] cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-[var(--surface2)] border border-[var(--border-var)] rounded-none shadow-sm">
                                <div>
                                    <div className="text-[var(--text-main)] font-black uppercase text-xs">Auto-imprimir</div>
                                    <div className="text-[10px] text-[var(--text2)] font-bold uppercase">Imprimir ticket automáticamente al facturar</div>
                                </div>
                                <input
                                    type="checkbox"
                                    name="auto_imprimir"
                                    checked={formData.auto_imprimir}
                                    onChange={handleChange}
                                    className="w-6 h-6 accent-[var(--teal)] cursor-pointer"
                                />
                            </div>

                            <div className="p-4 bg-[var(--surface2)] border border-[var(--border-var)] rounded-none text-[var(--text-main)]">
                                <label className="block text-[10px] uppercase font-black text-[var(--text2)] mb-1">Copias de Ticket</label>
                                <select
                                    name="copias_ticket"
                                    value={formData.copias_ticket}
                                    onChange={handleChange}
                                    className="w-full bg-[var(--surface)] border border-[var(--border-var)] rounded-none p-2 text-[var(--text-main)] focus:border-[var(--teal)] outline-none font-bold"
                                >
                                    <option value="1">1 Copia</option>
                                    <option value="2">2 Copias</option>
                                    <option value="3">3 Copias</option>
                                </select>
                            </div>

                            <div className="p-4 bg-[var(--surface2)] border border-[var(--border-var)] rounded-none">
                                <label className="block text-[10px] uppercase font-black text-[var(--text2)] mb-1">Moneda Principal</label>
                                <div className="flex gap-4 mt-2">
                                    <label className="flex items-center gap-2 cursor-pointer text-[var(--text-main)] font-black text-xs uppercase">
                                        <input
                                            type="radio"
                                            name="moneda_principal"
                                            value="USD"
                                            checked={formData.moneda_principal === 'USD'}
                                            onChange={handleChange}
                                            className="accent-[var(--teal)]"
                                        /> USD
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-[var(--text-main)] font-black text-xs uppercase">
                                        <input
                                            type="radio"
                                            name="moneda_principal"
                                            value="BS"
                                            checked={formData.moneda_principal === 'BS'}
                                            onChange={handleChange}
                                            className="accent-[var(--teal)]"
                                        /> Bs
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Configuración de Marquesina (SmartTicker) */}
                <div className="panel p-6 rounded-none space-y-4 shadow-[var(--win-shadow)] transition-none col-span-1 md:col-span-2">
                    <h2 className="text-xl font-black text-[var(--teal)] mb-4 flex items-center gap-2 uppercase tracking-tight">
                        📢 Marquesina de Avisos (SmartTicker)
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-[var(--surface2)] border border-[var(--border-var)]">
                                <div>
                                    <div className="text-[var(--text-main)] font-black uppercase text-xs">Avisos de Inventario</div>
                                    <div className="text-[10px] text-[var(--text2)] font-bold uppercase">Mostrar productos con bajo stock</div>
                                </div>
                                <input
                                    type="checkbox"
                                    name="ticker_mostrar_stock"
                                    checked={formData.ticker_mostrar_stock}
                                    onChange={handleChange}
                                    className="w-6 h-6 accent-[var(--teal)] cursor-pointer"
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-[var(--surface2)] border border-[var(--border-var)]">
                                <div>
                                    <div className="text-[var(--text-main)] font-black uppercase text-xs">Avisos de Deudas</div>
                                    <div className="text-[10px] text-[var(--text2)] font-bold uppercase">Mostrar cuentas por pagar pendientes</div>
                                </div>
                                <input
                                    type="checkbox"
                                    name="ticker_mostrar_deudas"
                                    checked={formData.ticker_mostrar_deudas}
                                    onChange={handleChange}
                                    className="w-6 h-6 accent-[var(--teal)] cursor-pointer"
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-[var(--surface2)] border border-[var(--border-var)]">
                                <div>
                                    <div className="text-[var(--text-main)] font-black uppercase text-xs">Avisos de Cobranza</div>
                                    <div className="text-[10px] text-[var(--text2)] font-bold uppercase">Mostrar cuentas por cobrar pendientes</div>
                                </div>
                                <input
                                    type="checkbox"
                                    name="ticker_mostrar_cobranzas"
                                    checked={formData.ticker_mostrar_cobranzas}
                                    onChange={handleChange}
                                    className="w-6 h-6 accent-[var(--teal)] cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] uppercase font-black text-[var(--text2)] mb-1">Mensaje Personalizado (Opcional)</label>
                                <textarea
                                    name="ticker_mensaje_personalizado"
                                    value={formData.ticker_mensaje_personalizado || ''}
                                    onChange={handleChange}
                                    className="w-full bg-[var(--surfaceDark)] border border-[var(--border-var)] rounded-none p-3 text-[var(--text-main)] focus:border-[var(--teal)] outline-none min-h-[80px] text-xs font-bold uppercase"
                                    placeholder="EJ: HORA DE ALMUERZO 1:00 PM A 2:00 PM..."
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase font-black text-[var(--text2)] mb-1">Velocidad de Movimiento (Segundos)</label>
                                <input
                                    type="number"
                                    name="ticker_velocidad"
                                    value={formData.ticker_velocidad || 40}
                                    onChange={handleChange}
                                    className="w-full bg-[var(--surfaceDark)] border border-[var(--border-var)] rounded-none p-2 text-[var(--text-main)] focus:border-[var(--teal)] outline-none font-mono font-bold"
                                    min="10"
                                    max="120"
                                />
                                <p className="text-[8px] text-[var(--text2)] mt-1 uppercase font-bold text-right italic">MENOR NÚMERO = MÁS RÁPIDO</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Impresora Inalámbrica (Bluetooth) */}
                <div className="panel p-6 rounded-none space-y-4 shadow-[var(--win-shadow)] transition-none col-span-1 md:col-span-2">
                    <h2 className="text-xl font-black text-[var(--teal)] mb-4 flex items-center gap-2 uppercase tracking-tight">
                        <span className="material-icons-round">bluetooth</span> Probador de Impresora Inalámbrica
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-[var(--surface2)] p-6 rounded-none border border-[var(--border-var)] shadow-inner">
                        <div>
                            <p className="text-[var(--text2)] text-[11px] mb-4 font-bold uppercase tracking-wide leading-relaxed">
                                Conecta tu impresora térmica Bluetooth (58mm o 80mm) directamente desde el navegador para imprimir sin cables.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <div className="p-4 bg-[var(--surfaceDark)] border border-[var(--border-var)] rounded-none flex-1 min-w-[200px]">
                                    <label className="block text-[10px] uppercase font-black text-[var(--text2)] mb-1">Tamaño de Papel</label>
                                    <select
                                        name="papel_bt"
                                        value={formData.papel_bt || '58mm'}
                                        onChange={handleChange}
                                        className="w-full bg-transparent p-1 text-[var(--text-main)] font-black outline-none uppercase text-xs"
                                    >
                                        <option value="58mm">58mm (Portátil/Pequeña)</option>
                                        <option value="80mm">80mm (Escritorio/Grande)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-4">
                            <div className={`w-20 h-20 rounded-none border-2 flex items-center justify-center transition-all duration-300 shadow-[var(--win-shadow)]
                                ${btStatus === 'CONNECTED' ? 'bg-[var(--teal)] text-white border-white/30 animate-pulse' :
                                    btStatus === 'CONNECTING' ? 'bg-[var(--orange-var)] text-white animate-spin-slow' : 'bg-[var(--surfaceDark)] text-[var(--text2)] border-[var(--border-var)]'}`}>
                                <span className="material-icons-round text-4xl">
                                    {btStatus === 'CONNECTED' ? 'print' : btStatus === 'CONNECTING' ? 'sync' : 'bluetooth_searching'}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={testBT}
                                disabled={btStatus === 'CONNECTING'}
                                className={`btn !py-3 !px-8 font-black uppercase text-[11px] tracking-widest flex items-center gap-3 transition-none shadow-[var(--win-shadow)] cursor-pointer
                                ${btStatus === 'CONNECTED' ? 'bg-[var(--teal)] text-white' : 'bg-[var(--teal)] text-white'}`}>
                                <span className="material-icons-round text-sm">settings_bluetooth</span>
                                {btStatus === 'CONNECTING' ? 'Buscando...' : 'Vincular y Probar Conexión'}
                            </button>

                            <p className={`text-[10px] font-black uppercase tracking-widest
                                ${btStatus === 'CONNECTED' ? 'text-[var(--teal)]' : 'text-[var(--text2)]'}`}>
                                Status: {btStatus === 'CONNECTED' ? 'Impresora Vinculada' : btStatus === 'CONNECTING' ? 'Sincronizando...' : 'No Conectada'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="col-span-1 md:col-span-2 flex justify-end">
                    <button
                        type="submit"
                        className="btn bg-[var(--red-var)] text-white !py-4 !px-12 shadow-[var(--win-shadow)] cursor-pointer transition-none font-black uppercase tracking-widest"
                    >
                        💾 GUARDAR CAMBIOS
                    </button>
                </div>
            </form>
        </div>
    )
}
