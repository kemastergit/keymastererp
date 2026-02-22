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
        <div className="p-4 md:p-8 max-w-4xl mx-auto animate-fade-in pb-24">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                    <span className="text-primary">⚙️</span> CONFIGURACIÓN DE EMPRESA
                </h1>
                <p className="text-slate-500 mt-2 font-medium">Gestiona la información que aparece en tus tickets y reportes.</p>
            </header>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
                {/* Datos Básicos */}
                <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm">
                    <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                        🏢 Datos Fiscales
                    </h2>

                    <div>
                        <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Nombre de Empresa</label>
                        <input
                            type="text"
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleChange}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:ring-2 focus:ring-primary outline-none transition-all"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs uppercase font-bold text-gray-500 mb-1">RIF</label>
                        <input
                            type="text"
                            name="rif"
                            value={formData.rif}
                            onChange={handleChange}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:ring-2 focus:ring-primary outline-none transition-all"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Dirección Línea 1</label>
                        <input
                            type="text"
                            name="direccion1"
                            value={formData.direccion1}
                            onChange={handleChange}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:ring-2 focus:ring-primary outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Dirección Línea 2</label>
                        <input
                            type="text"
                            name="direccion2"
                            value={formData.direccion2}
                            onChange={handleChange}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:ring-2 focus:ring-primary outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Contacto y Mensajes */}
                <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm">
                    <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                        📞 Contacto y Mensajes
                    </h2>

                    <div>
                        <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Teléfonos</label>
                        <input
                            type="text"
                            name="telefonos"
                            value={formData.telefonos}
                            onChange={handleChange}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:ring-2 focus:ring-primary outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:ring-2 focus:ring-primary outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Mensaje Bienvenida (Ticket)</label>
                        <input
                            type="text"
                            name="mensaje_bienvenida"
                            value={formData.mensaje_bienvenida}
                            onChange={handleChange}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:ring-2 focus:ring-primary outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Mensaje Pie (Ticket)</label>
                        <input
                            type="text"
                            name="mensaje_pie"
                            value={formData.mensaje_pie}
                            onChange={handleChange}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:ring-2 focus:ring-primary outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Impresión y Otros */}
                <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm col-span-1 md:col-span-2">
                    <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                        🖨️ Configuración de Impresión
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-black border border-gray-900 rounded-lg">
                                <div>
                                    <div className="text-white font-bold">Aplicar IVA</div>
                                    <div className="text-xs text-gray-500">Desglosar IVA en tickets y reportes</div>
                                </div>
                                <input
                                    type="checkbox"
                                    name="aplicar_iva"
                                    checked={formData.aplicar_iva}
                                    onChange={handleChange}
                                    className="w-6 h-6 accent-red-600 cursor-pointer"
                                />
                            </div>

                            {formData.aplicar_iva && (
                                <div className="p-3 bg-black border border-gray-900 rounded-lg">
                                    <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Porcentaje IVA (%)</label>
                                    <input
                                        type="number"
                                        name="porcentaje_iva"
                                        value={formData.porcentaje_iva}
                                        onChange={handleChange}
                                        className="w-full bg-black border border-gray-800 rounded p-2 text-white focus:border-red-600 outline-none"
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                            )}

                            <div className="flex items-center justify-between p-3 bg-black border border-gray-900 rounded-lg">
                                <div>
                                    <div className="text-white font-bold">Mostrar Tasa BCV</div>
                                    <div className="text-xs text-gray-500">Incluir tasa y total en Bs en el ticket</div>
                                </div>
                                <input
                                    type="checkbox"
                                    name="mostrar_tasa"
                                    checked={formData.mostrar_tasa}
                                    onChange={handleChange}
                                    className="w-6 h-6 accent-red-600 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-black border border-gray-900 rounded-lg">
                                <div>
                                    <div className="text-white font-bold">Auto-imprimir</div>
                                    <div className="text-xs text-gray-500">Imprimir ticket automáticamente al facturar</div>
                                </div>
                                <input
                                    type="checkbox"
                                    name="auto_imprimir"
                                    checked={formData.auto_imprimir}
                                    onChange={handleChange}
                                    className="w-6 h-6 accent-red-600 cursor-pointer"
                                />
                            </div>

                            <div className="p-3 bg-black border border-gray-900 rounded-lg text-white">
                                <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Copias de Ticket</label>
                                <select
                                    name="copias_ticket"
                                    value={formData.copias_ticket}
                                    onChange={handleChange}
                                    className="w-full bg-black border border-gray-800 rounded p-2 text-white focus:border-red-600 outline-none"
                                >
                                    <option value="1">1 Copia</option>
                                    <option value="2">2 Copias</option>
                                    <option value="3">3 Copias</option>
                                </select>
                            </div>

                            <div className="p-3 bg-black border border-gray-900 rounded-lg">
                                <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Moneda Principal</label>
                                <div className="flex gap-4 mt-2">
                                    <label className="flex items-center gap-2 cursor-pointer text-white">
                                        <input
                                            type="radio"
                                            name="moneda_principal"
                                            value="USD"
                                            checked={formData.moneda_principal === 'USD'}
                                            onChange={handleChange}
                                            className="accent-red-600"
                                        /> USD
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-white">
                                        <input
                                            type="radio"
                                            name="moneda_principal"
                                            value="BS"
                                            checked={formData.moneda_principal === 'BS'}
                                            onChange={handleChange}
                                            className="accent-red-600"
                                        /> Bs
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Impresora Inalámbrica (Bluetooth) */}
                <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm col-span-1 md:col-span-2">
                    <h2 className="text-xl font-bold text-blue-600 mb-4 flex items-center gap-2 text-[15px] tracking-tight">
                        <span className="material-icons-round">bluetooth</span> Probador de Impresora Inalámbrica
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <div>
                            <p className="text-slate-500 text-sm mb-4 font-medium">
                                Conecta tu impresora térmica Bluetooth (58mm o 80mm) directamente desde el navegador para imprimir sin cables.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <div className="p-4 bg-white border border-slate-200 rounded-2xl flex-1 min-w-[200px]">
                                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">Tamaño de Papel</label>
                                    <select
                                        name="papel_bt"
                                        value={formData.papel_bt || '58mm'}
                                        onChange={handleChange}
                                        className="w-full bg-transparent p-1 text-slate-800 font-bold outline-none"
                                    >
                                        <option value="58mm">58mm (Portátil/Pequeña)</option>
                                        <option value="80mm">80mm (Escritorio/Grande)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-4">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl
                                ${btStatus === 'CONNECTED' ? 'bg-blue-500 text-white shadow-blue-500/20 animate-pulse' :
                                    btStatus === 'CONNECTING' ? 'bg-amber-500 text-white animate-spin-slow' : 'bg-slate-200 text-slate-400'}`}>
                                <span className="material-icons-round text-4xl">
                                    {btStatus === 'CONNECTED' ? 'print' : btStatus === 'CONNECTING' ? 'sync' : 'bluetooth_searching'}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={testBT}
                                disabled={btStatus === 'CONNECTING'}
                                className={`btn !py-3 !px-8 font-black uppercase text-[11px] tracking-widest flex items-center gap-3 transition-all
                                ${btStatus === 'CONNECTED' ? 'btn-b' : 'btn-b shadow-blue-600/20'}`}>
                                <span className="material-icons-round text-sm">settings_bluetooth</span>
                                {btStatus === 'CONNECTING' ? 'Buscando...' : 'Vincular y Probar Conexión'}
                            </button>

                            <p className={`text-[10px] font-bold uppercase tracking-widest
                                ${btStatus === 'CONNECTED' ? 'text-green-600' : 'text-slate-400'}`}>
                                Status: {btStatus === 'CONNECTED' ? 'Impresora Vinculada' : btStatus === 'CONNECTING' ? 'Sincronizando...' : 'No Conectada'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="col-span-1 md:col-span-2 flex justify-end">
                    <button
                        type="submit"
                        className="btn btn-r !py-4 !px-12 shadow-xl shadow-amber-500/20"
                    >
                        💾 GUARDAR CAMBIOS
                    </button>
                </div>
            </form>
        </div>
    )
}
