import { useState } from 'react'

export default function Ayuda() {
    const [activeSection, setActiveSection] = useState('general')

    const sections = [
        { id: 'general', title: 'Conceptos Generales', icon: 'info' },
        { id: 'dashboard', title: 'Panel Principal', icon: 'dashboard' },
        { id: 'facturacion', title: 'Ventas y Facturación', icon: 'point_of_sale' },
        { id: 'inventario', title: 'Inventario y Mercancía', icon: 'inventory_2' },
        { id: 'reportes', title: 'Reportes y Cobranza', icon: 'analytics' },
        { id: 'caja', title: 'Control de Caja', icon: 'payments' },
        { id: 'config', title: 'Configuración', icon: 'settings' },
    ]

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
            <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <span className="material-icons-round text-primary text-3xl">help_center</span>
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Centro de Ayuda</h1>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Manual de usuario KEMASTER POS</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Menú Lateral de Ayuda */}
                <div className="lg:col-span-4 space-y-2 sticky top-4">
                    {sections.map(s => (
                        <button
                            key={s.id}
                            onClick={() => setActiveSection(s.id)}
                            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all border-2 text-left ${activeSection === s.id ? 'bg-primary border-primary text-white shadow-lg shadow-amber-200' : 'bg-white border-transparent text-slate-600 hover:border-slate-100'}`}
                        >
                            <span className="material-icons-round text-xl">{s.icon}</span>
                            <span className="font-black uppercase text-xs tracking-tight">{s.title}</span>
                        </button>
                    ))}
                </div>

                {/* Contenido Dinámico */}
                <div className="lg:col-span-8 panel animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {activeSection === 'general' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight border-b-4 border-primary inline-block mb-4">¡Bienvenido a KEMASTER!</h2>
                            <p className="text-slate-600 leading-relaxed">
                                Este sistema ha sido diseñado para facilitar el control total de su negocio automotriz. No es solo un punto de venta, es una herramienta de administración financiera que le permite saber exactamente qué tiene en su almacén y cuánto dinero hay en su caja.
                            </p>
                            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-4">
                                <span className="material-icons-round text-amber-600">tips_and_updates</span>
                                <div className="text-xs text-amber-900 leading-relaxed">
                                    <strong>Consejo Profesional:</strong> Mantenga siempre actualizada la <strong>Tasa BCV</strong> en el menú lateral. El sistema la utiliza para todos los cálculos automáticos de bolívares.
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'dashboard' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Panel Principal (Dashboard)</h2>
                            <div className="space-y-4">
                                <HelpItem title="Utilidad Estimada" desc="Muestra cuánto dinero REAL está ganando después de restar el costo de los productos vendidos. Es el corazón de su Rentabilidad." icon="trending_up" />
                                <HelpItem title="Gráficos de Rendimiento" desc="Compare visualmente sus Ventas totales contra su Ganancia. Si las líneas están lejos, sus márgenes son excelentes." icon="show_chart" />
                                <HelpItem title="Mix de Ingresos" desc="Vea de qué forma le pagan sus clientes: ¿Más Zelle? ¿Más efectivo? ¿Mucho Crédito? Esto ayuda a planificar sus reposiciones." icon="pie_chart" />
                                <HelpItem title="Críticos / Agotados" desc="Alertas rápidas de productos que ya no tiene o que están por terminarse." icon="warning" />
                            </div>
                        </div>
                    )}

                    {activeSection === 'facturacion' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Ventas y Facturación</h2>
                            <div className="space-y-4">
                                <HelpItem title="Búsqueda Inteligente" desc="Puede buscar por nombre, código o marca. Si un producto no tiene stock, el sistema lo bloqueará automáticamente para evitar errores." icon="search" />
                                <HelpItem title="Impuestos (IGTF 3%)" desc="Al pagar en divisas (Dólares o Zelle), el sistema suma automáticamente el 3% de IGTF según la ley. Esto aparece desglosado en el ticket." icon="receipt_long" />
                                <HelpItem title="Nota vs Cotización" desc="Use 'Procesar Nota' para descontar stock y cobrar. Use 'Cotización' para presupuestos que NO afectan el stock ni la caja." icon="description" />
                                <HelpItem title="Varios / Genérico" desc="El botón 'VARIO' permite vender artículos que no están en inventario escribiendo el nombre y precio al momento." icon="add_circle" />
                            </div>
                        </div>
                    )}

                    {activeSection === 'inventario' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Gestión de Inventario</h2>
                            <div className="space-y-4">
                                <HelpItem title="Valor del Inventario" desc="En la tabla de productos verá el 'Valor Total'. Es el dinero que tiene 'parado' en mercancía (Stock x Precio)." icon="inventory" />
                                <HelpItem title="Alertas de Stock" desc="El color rojo indica que el producto se agotó. El ámbar indica 'Stock Bajo' (menos de 3 unidades)." icon="notifications_active" />
                                <HelpItem title="Impresión de Catálogo" desc="Puede imprimir la lista completa de sus productos con precios actualizados para sus clientes." icon="print" />
                            </div>
                        </div>
                    )}

                    {activeSection === 'reportes' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Reportes e Historial</h2>
                            <div className="space-y-4">
                                <HelpItem title="Anulación de Ventas" desc="Si se equivoca, puede anular una nota. Requiere PIN de Admin/Supervisor. Al anular, los productos regresan automáticamente al stock y el dinero se resta de la caja." icon="block" />
                                <HelpItem title="Libro de Ventas Fiscal" desc="Botón azul en reportes. Genera el consolidado de ventas del mes para su contador, desglosando IVA e IGTF." icon="menu_book" />
                                <HelpItem title="WhatsApp Cobranzas" desc="En la pestaña 'Por Cobrar', el botón de WhatsApp envía un recordatorio automático de deuda a su cliente con el monto exacto." icon="whatsapp" />
                                <HelpItem title="Abonos (Deuda)" desc="Registrar un abono aquí reduce la deuda del cliente e INGRESA ese dinero en la caja de hoy." icon="history" />
                            </div>
                        </div>
                    )}

                    {activeSection === 'caja' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Control Diario de Caja</h2>
                            <div className="space-y-4">
                                <HelpItem title="Apertura de Caja" desc="Es el primer paso del día. Registra con cuánto dinero inicia para dar cambio." icon="lock_open" />
                                <HelpItem title="Corte X (Parcial)" desc="Muestra cuánto dinero debería haber en caja hasta el momento sin cerrar el turno." icon="print" />
                                <HelpItem title="Corte Z (Cierre Final)" desc="Cierra el turno definitivamente. Aquí debe ingresar cuánto dinero físico contó. El sistema le dirá si hay 'Diferencia' (Sobra o Falta)." icon="task_alt" />
                                <HelpItem title="Gastos / Caja Chica" desc="Registre aquí cualquier salida de dinero (pago de delivery, almuerzos, etc.) para que el cierre sea exacto." icon="outbound" />
                            </div>
                        </div>
                    )}

                    {activeSection === 'config' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Configuración del Sistema</h2>
                            <div className="space-y-4">
                                <HelpItem title="Tasa BCV" desc="Actualice este valor diariamente. Afecta todos los precios en bolívares y el cambio." icon="currency_exchange" />
                                <HelpItem title="Datos de la Empresa" desc="Ajuste el RIF, Dirección y Teléfonos que aparecen en el encabezado de sus tickets." icon="business" />
                                <HelpItem title="IVA e IGTF" desc="Puede activar o desactivar los impuestos y ajustar sus porcentajes según la legislación vigente." icon="gavel" />
                                <HelpItem title="Usuarios y PIN" desc="Gestione quién puede entrar al sistema y cambie los códigos de acceso para mayor seguridad." icon="people" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function HelpItem({ title, desc, icon }) {
    return (
        <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-primary/30 transition-colors">
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <span className="material-icons-round text-primary text-xl">{icon}</span>
            </div>
            <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight mb-1">{title}</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{desc}</p>
            </div>
        </div>
    )
}
