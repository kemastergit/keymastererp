import { useState } from 'react'

export default function Ayuda() {
    const [activeSection, setActiveSection] = useState('general')

    const sections = [
        { id: 'general', title: 'Conceptos Generales', icon: 'info' },
        { id: 'tecnologia', title: 'PWA e Instalación', icon: 'install_mobile' },
        { id: 'facturacion', title: 'Ventas y Smart App', icon: 'point_of_sale' },
        { id: 'compras', title: 'Compras y Proveedores', icon: 'shopping_cart' },
        { id: 'inventario', title: 'Inventario y Mercancía', icon: 'inventory_2' },
        { id: 'reportes', title: 'Reportes y Deudas', icon: 'analytics' },
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
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Manual de usuario KEYMASTER POS - V2.5.0 PWA</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Menú Lateral de Ayuda */}
                <div className="lg:col-span-4 space-y-2 lg:sticky lg:top-4">
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
                <div className="lg:col-span-8 panel animate-in fade-in slide-in-from-bottom-2 duration-300 min-h-[500px]">
                    {activeSection === 'general' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight border-b-4 border-primary inline-block mb-4">¡Bienvenido a KEYMASTER!</h2>
                            <p className="text-slate-600 leading-relaxed">
                                Este sistema ha sido diseñado para facilitar el control total de su negocio automotriz. No es solo un punto de venta, es una herramienta de administración financiera que le permite saber exactamente qué tiene en su almacén y cuánto dinero hay en su caja.
                            </p>
                            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-4">
                                <span className="material-icons-round text-amber-600">tips_and_updates</span>
                                <div className="text-xs text-amber-900 leading-relaxed">
                                    <strong>Consejo Profesional:</strong> Use la nueva <strong>Smart Sidebar</strong> en facturación para cálculos rápidos de divisas y costos.
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'tecnologia' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">PWA (Progressive Web App)</h2>
                            <p className="text-sm text-slate-600">Su sistema ahora es una Aplicación Web Progresiva, lo que ofrece ventajas de software nativo.</p>
                            <div className="space-y-4">
                                <HelpItem title="Instalación en PC/Celu" desc="Busque el icono de 'Instalar' en la barra del navegador. Esto pondrá un icono en su escritorio y permitirá que la app abra sin bordes de navegador." icon="get_app" />
                                <HelpItem title="Modo Offline" desc="El sistema guarda los archivos necesarios internamente. Si pierde internet, el programa cargará igual y podrá seguir facturando usando la base de datos local." icon="wifi_off" />
                                <HelpItem title="Carga Ultra-Rápida" desc="Al estar los recursos cacheados, la aplicación abre instantáneamente a partir de la segunda visita." icon="bolt" />
                            </div>
                        </div>
                    )}

                    {activeSection === 'facturacion' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Ventas y Smart App</h2>
                            <div className="space-y-4">
                                <HelpItem title="Smart Sidebar" desc="Panel derecho con herramientas: Reloj sincronizado, Tasa BCV, Convertidor USD/BS y Alerta de Stock Crítico." icon="widgets" />
                                <HelpItem title="Calculadora de Divisas" desc="Permite convertir montos instantáneamente usando la tasa del día para dar precios rápidos a los clientes." icon="currency_exchange" />
                                <HelpItem title="Calculadora de Costos" desc="Herramienta para calcular el 'Costo Ponderado' cuando registra mercancía con variaciones de precio." icon="calculate" />
                                <HelpItem title="Búsqueda con Teclas" desc="F2 para buscar, F8 para pagar, F9 para vaciar carrito. Optimice su tiempo en caja." icon="keyboard" />
                            </div>
                        </div>
                    )}

                    {activeSection === 'compras' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Compras y Proveedores</h2>
                            <div className="space-y-4">
                                <HelpItem title="Entrada de Mercancía" desc="Registre sus facturas de compra para cargar stock automáticamente y generar la deuda en Cuentas por Pagar." icon="add_shopping_cart" />
                                <HelpItem title="Monitor de Facturas" desc="En el historial, use el icono del 'Ojo' para abrir el detalle completo de ítems y costos de cualquier factura vieja." icon="visibility" />
                                <HelpItem title="Historial de Abonos" desc="Vea una lista detallada de todos los pagos realizados a sus proveedores en la sección de Cuentas por Pagar." icon="payments" />
                            </div>
                        </div>
                    )}

                    {activeSection === 'inventario' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Gestión de Inventario</h2>
                            <div className="space-y-4">
                                <HelpItem title="Valor del Inventario" desc="Calculado en tiempo real según el costo de reposición y stock actual." icon="inventory" />
                                <HelpItem title="Stock Minino" desc="Configure alertas para que la Smart App le avise cuando un producto esté por agotarse." icon="notifications_active" />
                                <HelpItem title="Control de Costos" desc="Mantenga sus márgenes protegidos verificando que sus precios de venta superen siempre los costos ponderados." icon="monitoring" />
                            </div>
                        </div>
                    )}

                    {activeSection === 'reportes' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Reportes y Deudas</h2>
                            <div className="space-y-4">
                                <HelpItem title="Monitor de Deudas" desc="Diferencie entre lo que debe (Cuentas por Pagar) y lo que le deben (Cuentas por Cobrar) con un solo vistazo." icon="account_balance" />
                                <HelpItem title="Vínculo de Pago" desc="En Cuentas por Pagar, ahora puede abrir la factura original de compra para saber exactamente qué ítems está pagando." icon="receipt" />
                                <HelpItem title="Estado de Resultados (P&L)" desc="Nuevo reporte que muestra Ventas Netas − Costo de Mercancía Vendida = Utilidad Bruta − Gastos Operativos = Utilidad Neta, con márgenes porcentuales. Acceda desde Reportes → tab P&L." icon="analytics" />
                                <HelpItem title="Anulación con Auditoría" desc="Toda anulación queda grabada con el nombre del responsable para evitar fugas de dinero." icon="security" />
                            </div>
                        </div>
                    )}

                    {activeSection === 'caja' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Control Diario de Caja</h2>
                            <div className="space-y-4">
                                <HelpItem title="Arqueo de Caja (Z)" desc="Comparación entre el sistema y el dinero físico. Indispensable para mantener la transparencia." icon="task_alt" />
                                <HelpItem title="Caja Chica con Categorías" desc="Registre gastos operativos clasificándolos por categoría: Alquiler, Nómina, Servicios (agua/luz/internet), Transporte, Mantenimiento o Caja Chica General. Los egresos categorizados alimentan automáticamente el reporte P&L." icon="account_balance_wallet" />
                            </div>
                        </div>
                    )}

                    {activeSection === 'config' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Configuración del Sistema</h2>
                            <div className="space-y-4">
                                <HelpItem title="Seguridad (PIN)" desc="Cambie sus códigos regularmente desde la gestión de usuarios." icon="lock" />
                                <HelpItem title="Datos del Ticket" desc="Personalice el mensaje de despedida y los datos fiscales de Automotores Guaicaipuro." icon="print" />
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
        <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-[var(--teal)]/30 transition-colors">
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm grid place-items-center shrink-0 group-hover:scale-110 transition-transform border border-slate-100/50">
                <span className="material-icons-round text-[var(--teal)] text-x0.4 leading-none">{icon}</span>
            </div>
            <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight mb-1">{title}</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{desc}</p>
            </div>
        </div>
    )
}

