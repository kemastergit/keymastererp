import { useState } from 'react'
import useStore from '../../store/useStore'

export default function HelpModal() {
    const { showHelp, setShowHelp } = useStore()
    const [activeSection, setActiveSection] = useState('general')

    if (!showHelp) return null

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
        <div className="fixed top-0 left-0 right-0 bottom-[85px] md:bottom-0 z-[5000] flex items-end md:items-center justify-center p-0 md:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={() => setShowHelp(false)}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-4xl max-h-[90vh] md:max-h-[85vh] bg-[var(--surface)] border border-[var(--border-var)] shadow-[var(--win-shadow)] rounded-none flex flex-col md:flex-row overflow-hidden animate-in slide-in-from-bottom duration-500">

                {/* Close Button Top (Mobile) */}
                <div className="md:hidden flex justify-center py-3 shrink-0">
                    <div className="w-12 h-1.5 bg-[var(--border-var)]" />
                </div>

                {/* Sidebar Menu */}
                <div className="w-full md:w-[320px] bg-[var(--surface2)] border-r border-[var(--border-var)] flex flex-col shrink-0">
                    <div className="p-8 pb-4">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-[var(--teal)] flex items-center justify-center shadow-[var(--win-shadow)] border border-[var(--tealDark)]">
                                <span className="material-icons-round text-white">help_center</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tighter">AYUDA</h2>
                                <p className="text-[9px] font-bold text-[var(--text2)] uppercase tracking-widest">Manual KEYMASTER</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto md:overflow-y-auto flex md:flex-col p-4 md:p-6 gap-2 no-scrollbar">
                        {sections.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setActiveSection(s.id)}
                                className={`flex items-center gap-3 p-4 transition-none border text-left whitespace-nowrap md:whitespace-normal shrink-0 md:shrink
                                    ${activeSection === s.id
                                        ? 'bg-[var(--teal)] border-[var(--tealDark)] text-white shadow-[var(--win-shadow)]'
                                        : 'bg-[var(--surface)] border-[var(--border-var)] text-[var(--text-main)] hover:bg-[var(--surfaceDark)]'}`}
                            >
                                <span className="material-icons-round text-xl">{s.icon}</span>
                                <span className="font-black uppercase text-[10px] tracking-tight">{s.title}</span>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setShowHelp(false)}
                        className="hidden md:flex items-center justify-center gap-2 p-6 text-[var(--text2)] hover:text-[var(--red-var)] transition-none font-bold text-xs uppercase tracking-widest border-t border-[var(--border-var)]"
                    >
                        <span className="material-icons-round text-lg">close</span>
                        Cerrar Ayuda
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-[var(--surface)]">
                    <div className="p-6 md:p-10 overflow-y-auto custom-scrollbar flex-1">
                        {/* Sections content (same as Ayuda/index.jsx) */}
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            {activeSection === 'general' && (
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-black text-[var(--text-main)] uppercase tracking-tight border-b-4 border-[var(--teal)] inline-block mb-4">¡Bienvenido a KEYMASTER!</h2>
                                    <p className="text-[var(--text-main)] leading-relaxed text-sm">
                                        Este sistema ha sido diseñado para facilitar el control total de su negocio automotriz. No es solo un punto de venta, es una herramienta de administración financiera que le permite saber exactamente qué tiene en su almacén y cuánto dinero hay en su caja.
                                    </p>
                                    <div className="bg-[var(--surfaceDark)] p-6 border border-[var(--border-var)] flex gap-4">
                                        <span className="material-icons-round text-[var(--teal)]">tips_and_updates</span>
                                        <div className="text-xs text-[var(--text-main)] leading-relaxed">
                                            <strong>Consejo Profesional:</strong> Mantenga siempre actualizada la <strong>Tasa BCV</strong> en el menú lateral. El sistema la utiliza para todos los cálculos automáticos de bolívares.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeSection === 'dashboard' && (
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-black text-[var(--text-main)] uppercase tracking-tight mb-4">Panel Principal</h2>
                                    <div className="grid grid-cols-1 gap-4">
                                        <HelpItem title="Utilidad Estimada" desc="Muestra cuánto dinero REAL está ganando después de restar el costo de los productos vendidos." icon="trending_up" />
                                        <HelpItem title="Gráficos de Rendimiento" desc="Compare visualmente sus Ventas totales contra su Ganancia." icon="show_chart" />
                                        <HelpItem title="Mix de Ingresos" desc="Vea de qué forma le pagan sus clientes: Zelle, Efectivo, Crédito." icon="pie_chart" />
                                    </div>
                                </div>
                            )}

                            {activeSection === 'facturacion' && (
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-black text-[var(--text-main)] uppercase tracking-tight mb-4">Facturación</h2>
                                    <div className="space-y-4">
                                        <HelpItem title="Búsqueda Inteligente" desc="Puede buscar por nombre, código o marca. Bloqueo automático sin stock." icon="search" />
                                        <HelpItem title="Edición de Pagos" desc="¿Se equivocó en un monto? Toque el pago en la lista para recargarlo en el teclado y corregirlo sin borrar nada." icon="edit" />
                                        <HelpItem title="Impuestos (IGTF 3%)" desc="Cálculo automático del 3% de IGTF al pagar en divisas según la ley." icon="receipt_long" />
                                        <HelpItem title="Nota vs Cotización" desc="Las notas descuentan stock y cobran. Las cotizaciones son solo presupuestos." icon="description" />
                                    </div>
                                </div>
                            )}

                            {activeSection === 'inventario' && (
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-black text-[var(--text-main)] uppercase tracking-tight mb-4">Inventario</h2>
                                    <div className="space-y-4">
                                        <HelpItem title="Valor del Inventario" desc="Dólares que tiene 'parado' en mercancía (Stock x Precio)." icon="inventory" />
                                        <HelpItem title="Alertas de Stock" desc="Rojo: Agotado. Ámbar: Stock Bajo (Menos de 3 unidades)." icon="notifications_active" />
                                    </div>
                                </div>
                            )}

                            {activeSection === 'reportes' && (
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-black text-[var(--text-main)] uppercase tracking-tight mb-4">Reportes</h2>
                                    <div className="space-y-4">
                                        <HelpItem title="Estado de Resultados (P&L)" desc="Reporte contable completo: Ventas Netas − CMV = Utilidad Bruta − Gastos = Utilidad Neta." icon="analytics" />
                                        <HelpItem title="Protección de Deuda" desc="El sistema impide borrar clientes o proveedores con deudas pendientes para proteger su contabilidad." icon="security" />
                                        <HelpItem title="Anulación de Ventas" desc="Requiere PIN. Devuelve stock y resta dinero de caja automáticamente." icon="block" />
                                        <HelpItem title="WhatsApp Cobranzas" desc="Envío de recordatorio automático de deuda a clientes." icon="whatsapp" />
                                    </div>
                                </div>
                            )}

                            {activeSection === 'caja' && (
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-black text-[var(--text-main)] uppercase tracking-tight mb-4">Caja Diaria</h2>
                                    <div className="space-y-4">
                                        <HelpItem title="Corte Z (Cierre)" desc="Cierre definitivo. El sistema detecta sobrantes o faltantes de dinero." icon="task_alt" />
                                        <HelpItem title="Caja Chica con Categorías" desc="Registre gastos clasificándolos en: Alquiler, Nómina, Servicios, Transporte, Mantenimiento o Caja Chica General. Estos datos alimentan el reporte P&L automáticamente." icon="outbound" />
                                    </div>
                                </div>
                            )}

                            {activeSection === 'config' && (
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-black text-[var(--text-main)] uppercase tracking-tight mb-4">Configuración</h2>
                                    <div className="space-y-4">
                                        <HelpItem title="Datos del Negocio" desc="Rif, Logotipo y Dirección para el encabezado de sus tickets." icon="business" />
                                        <HelpItem title="Usuarios y Permisos" desc="Gestione quién accede a ver reportes o anular ventas." icon="people" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile Bottom Close */}
                <div className="md:hidden p-4 bg-[var(--surface)] border-t border-[var(--border-var)] flex gap-4 shrink-0">
                    <button
                        onClick={() => setShowHelp(false)}
                        className="flex-1 bg-[var(--teal)] text-white py-4 font-black uppercase text-xs tracking-widest active:scale-95 transition-none shadow-[var(--win-shadow)] border border-[var(--tealDark)]"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    )
}

function HelpItem({ title, desc, icon }) {
    return (
        <div className="flex gap-4 p-5 bg-[var(--surface2)] border border-[var(--border-var)] group transition-none hover:bg-[var(--surfaceDark)] hover:shadow-[var(--win-shadow)]">
            <div className="w-12 h-12 bg-[var(--surface)] grid place-items-center shrink-0 border border-[var(--border-var)] shadow-sm overflow-hidden">
                <span className="material-icons-round text-[var(--teal)] text-2xl leading-none select-none">{icon}</span>
            </div>
            <div>
                <h4 className="text-[11px] font-black text-[var(--text-main)] uppercase tracking-tight mb-1">{title}</h4>
                <p className="text-[10px] text-[var(--text2)] leading-relaxed font-bold uppercase tracking-tight">{desc}</p>
            </div>
        </div>
    )
}
