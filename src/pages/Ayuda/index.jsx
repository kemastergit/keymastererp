import { useState } from 'react'

export default function Ayuda() {
    const [activeSection, setActiveSection] = useState('general')

    const sections = [
        { id: 'general', title: 'Conceptos Generales', icon: 'info' },
        { id: 'seguridad', title: 'Seguridad y Radar', icon: 'security' },
        { id: 'tecnologia', title: 'PWA e Instalación', icon: 'install_mobile' },
        { id: 'facturacion', title: 'Ventas y Smart App', icon: 'point_of_sale' },
        { id: 'compras', title: 'Compras y Proveedores', icon: 'shopping_cart' },
        { id: 'catalogo', title: 'Catálogo Web', icon: 'language' },
        { id: 'inventario', title: 'Inventario y Mercancía', icon: 'inventory_2' },
        { id: 'reportes', title: 'Reportes y Deudas', icon: 'analytics' },
        { id: 'caja', title: 'Control de Caja', icon: 'payments' },
        { id: 'hibrido', title: 'Radar e Híbrido', icon: 'sync_problem' },
        { id: 'config', title: 'Configuración', icon: 'settings' },
        { id: 'bitacora', title: 'Bitácora y Cambios', icon: 'history_edu' },
    ]

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
            <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <span className="material-icons-round text-primary text-3xl">help_center</span>
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Centro de Ayuda</h1>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Manual de usuario KEYMASTER ERP - V3.5.0 MASTER CONTROL</p>
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

                    {activeSection === 'seguridad' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight border-b-4 border-cyan-500 inline-block mb-4">Escudos y Radar de Datos</h2>
                            <p className="text-slate-600 leading-relaxed text-sm">
                                Su sistema cuenta con protecciones avanzadas de nivel Master para garantizar que su negocio nunca se detenga, pase lo que pase con el internet o el navegador.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <HelpItem title="Radar Cloud 🛰️" desc="Sincronización en tiempo real. Si un vendedor factura en otro terminal, la venta aparece al instante en el reporte con un brillo verde." icon="radar" />
                                <HelpItem title="Escudo de Error 🛡️" desc="Si ocurre un fallo crítico de código, el sistema no se vuelve blanco. Aparece un botón de recuperación para resetear la pantalla sin perder datos." icon="gpp_good" />
                                <HelpItem title="Dual Storage 📂" desc="Los datos se guardan PRIMERO en la PC y LUEGO en la nube. Máxima seguridad ante robos de PC o caídas de servidor." icon="storage" />
                                <HelpItem title="Exportación Local 💾" desc="Botón para descargar CSV. Permite llevarse el reporte de ventas en un archivo compatible con Excel en cualquier momento." icon="file_download" />
                            </div>

                            <div className="mt-8 bg-slate-100 p-6 rounded-3xl border-2 border-slate-200">
                                <h3 className="font-black uppercase text-xs tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                    <span className="material-icons-round text-sm">quiz</span>
                                    Preguntas Frecuentes y Situaciones de Riesgo
                                </h3>

                                <div className="space-y-6">
                                    <FaqItem q="¿Qué pasa si mi computadora se apaga de golpe?" r="KEYMASTER usa transacciones atómicas. O se guarda la venta completa o no se guarda nada. Al encender de nuevo, sus datos estarán intactos." />
                                    <FaqItem q="¿Cómo sé si estoy conectado al Radar?" r="Busque el ícono de radar cian pulsante en la barra superior. Si parpadea, significa que su conexión con la nube está activa y patrullando." />
                                    <FaqItem q="¿Puedo ver las ventas de mis otros vendedores?" r="Sí. Gracias al Radar en Tiempo Real, el Administrador ve las ventas caer al instante desde cualquier terminal sin necesidad de refrescar la página." />
                                    <FaqItem q="¿Qué hago si sale la pantalla de error crítica?" r="No entre en pánico. Dele al botón grande de 'RECARGAR SISTEMA'. El escudo restaurará la pantalla y sus ventas locales seguirán en su sitio." />
                                    <FaqItem q="¿Es peligroso limpiar el historial del navegador?" r="¡Sí! Si borra 'Cookies y otros datos de sitios', borrará la base de datos local. Hágalo solo después de confirmar que sus datos están en la nube (Radar)." />
                                    <FaqItem q="¿Cómo aseguro mi reporte para llevar?" r="Use el botón 'Exportar CSV' en Reportes. Eso crea un archivo físico en su carpeta de descargas que funciona fuera de internet." />
                                    <FaqItem q="¿Qué pasa si no tengo internet?" r="Keymaster es 'Offline-First'... El sistema funciona 100% solo. Al volver el internet, el radar se encargará de subir las ventas que se hicieron offline." />
                                    <FaqItem q="¿Puede un vendedor ver los reportes de P&L o utilidades del negocio?" r="No. El módulo de Reportes financieros y el Panel del Dueño requieren rol Admin. El vendedor solo puede ver sus propias ventas del día." />
                                    <FaqItem q="¿Qué pasa si el admin bloquea a un cajero mientras está vendiendo?" r="El cajero puede terminar la venta actual. Al intentar abrir una nueva sesión el sistema le niega el acceso porque el login valida activo=true contra Supabase al iniciar. Sus ventas quedan registradas correctamente." />
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

                            <div className="mt-8 bg-slate-100 p-6 rounded-3xl border-2 border-slate-200">
                                <h3 className="font-black uppercase text-xs tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                    <span className="material-icons-round text-sm">quiz</span>
                                    Preguntas Frecuentes - Facturación
                                </h3>
                                <div className="space-y-6">
                                    <FaqItem q="¿Puede un vendedor vender más unidades de las que hay en stock?" r="No. El sistema valida el stock local antes de procesar. Si hay 3 y pide 5 muestra error de stock insuficiente. La RPC en Supabase hace una segunda validación antes de confirmar." />
                                    <FaqItem q="¿Puede facturarse con la caja cerrada?" r="Depende del rol. El cajero necesita abrir sesión de caja primero. Sin sesión activa no puede cerrar ventas. El vendedor solo hace pre-facturas que no tocan el inventario ni la caja." />
                                    <FaqItem q="¿Puede un vendedor cambiar el precio de un producto al facturar?" r="No. Los precios vienen de la BD. Solo el Admin puede modificarlos en el módulo de Inventario. El vendedor no tiene acceso a ese módulo." />
                                    <FaqItem q="¿Qué pasa si el precio cambia mientras el vendedor tiene el carrito abierto?" r="El sistema detecta la diferencia al momento de cerrar la venta y exige actualización: 'PRECIO ACTUALIZADO: $10 → $12'. El vendedor debe aceptar continuar con los nuevos precios o el sistema anula el cobro." />
                                </div>
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

                            <div className="mt-8 bg-slate-100 p-6 rounded-3xl border-2 border-slate-200">
                                <h3 className="font-black uppercase text-xs tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                    <span className="material-icons-round text-sm">quiz</span>
                                    Preguntas Frecuentes - Compras
                                </h3>
                                <div className="space-y-6">
                                    <FaqItem q="¿Puede un cajero recibir y cargar facturas de proveedores?" r="No. El módulo de Compras y Proveedores solo es visible para Admin o Supervisor. Al registrar una compra el sistema actualiza el stock y recalcula el costo promedio AVCO automáticamente." />
                                    <FaqItem q="¿Qué pasa si se registra una compra con el precio de costo incorrecto?" r="El AVCO se recalcula automáticamente. Si el costo fue incorrecto afecta el P&L. Solo Admin puede corregirlo con un ajuste de inventario auditado." />
                                    <FaqItem q="¿Puede un proveedor tener múltiples facturas pendientes?" r="Sí. Cuentas por Pagar registra cada factura de proveedor por separado con fecha de vencimiento. El Admin ve el total de deuda por proveedor en el módulo financiero." />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'catalogo' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Catálogo Web y Pedidos</h2>
                            <div className="mt-4 bg-slate-100 p-6 rounded-3xl border-2 border-slate-200">
                                <h3 className="font-black uppercase text-xs tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                    <span className="material-icons-round text-sm">quiz</span>
                                    Preguntas Frecuentes - Catálogo Web
                                </h3>
                                <div className="space-y-6">
                                    <FaqItem q="¿Puede un cliente ver los costos o las utilidades del negocio en el catálogo web?" r="No. El catálogo solo muestra descripcion, precio y stock. El campo costo nunca sale en ninguna consulta pública. Las políticas RLS de Supabase bloquean esos campos al público." />
                                    <FaqItem q="¿Puede un cliente hacer un pedido si el producto está agotado?" r="Depende de la configuración. Si stock=0 el producto muestra badge AGOTADO pero sigue visible. El cliente puede pedirlo igual y el vendedor decide si puede conseguirlo o no. Si mostrar_en_web=false el producto no aparece en el catálogo." />
                                    <FaqItem q="¿Qué pasa si dos clientes piden el mismo producto en el catálogo al mismo tiempo?" r="Los pedidos web son pre-reservas. No descuentan stock hasta que el vendedor los convierte en factura. El primero que el vendedor facture descuenta el stock. El segundo recibirá error de stock insuficiente al facturar." />
                                </div>
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

                            <div className="mt-8 bg-slate-100 p-6 rounded-3xl border-2 border-slate-200">
                                <h3 className="font-black uppercase text-xs tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                    <span className="material-icons-round text-sm">quiz</span>
                                    Preguntas Frecuentes - Inventario
                                </h3>
                                <div className="space-y-6">
                                    <FaqItem q="¿Puede un cajero agregar o modificar productos en el inventario?" r="No. El módulo de Inventario solo es visible para Admin. El cajero y vendedor no ven ese menú." />
                                    <FaqItem q="¿Puede el stock quedar en negativo?" r="No. El sistema impide stock menor a cero localmente. En Supabase la RPC valida antes de descontar. Si dos vendedores intentan vender el último artículo simultáneamente el segundo recibe error." />
                                    <FaqItem q="¿Qué pasa si se desactiva un producto que está en un carrito abierto?" r="La venta puede completarse porque el carrito ya tiene el producto cargado. El bloqueo de activo=false solo aplica para búsquedas nuevas. Las ventas en proceso no se interrumpen." />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'reportes' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Reportes, Deudas y Libros Fiscales</h2>
                            <div className="space-y-4">
                                <HelpItem title="Monitor de Deudas" desc="Diferencie entre lo que debe (Cuentas por Pagar) y lo que le deben (Cuentas por Cobrar) con un solo vistazo." icon="account_balance" />
                                <HelpItem title="Estado de Resultados (P&L)" desc="Ventas Netas − CMV = Utilidad Bruta − Gastos Operativos = Utilidad Neta. Con márgenes porcentuales y gráfico de barra. Acceda desde Reportes → tab P&L." icon="analytics" />
                                <HelpItem title="Anulación con Auditoría" desc="Toda anulación queda grabada con el nombre del responsable. Requiere PIN de Admin o Supervisor." icon="security" />
                                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
                                    <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest mb-3">⚖️ Libros Fiscales SENIAT — Nuevo</p>
                                    <div className="space-y-3">
                                        <HelpItem title="Libro de Ventas" desc="Se genera desde Reportes → tab Ventas → botón 'Libro Ventas'. Incluye Base Imponible, IVA Débito Fiscal (16%) e IGTF (3%) por factura, con totalizadores fiscales. Referencia: Art. 70 Ley IVA." icon="menu_book" />
                                        <HelpItem title="Libro de Compras" desc="Se genera desde Reportes → tab P&L → botón 'Libro Compras'. Incluye RIF del proveedor, IVA Crédito Fiscal soportado y deducible. Referencia: Art. 70 Ley IVA." icon="receipt_long" />
                                        <HelpItem title="Libro de Inventario Valorado" desc="Se genera desde Reportes → tab Inventario → botón 'Exportar Valorado'. Incluye costo unitario, precio de venta, stock, valor total del activo y margen por producto." icon="inventory" />
                                    </div>
                                </div>
                                <HelpItem title="Historial de Cierres Z (Command Center)" desc="Cada cierre muestra un panel de 3 columnas: USD (con todos los ingresos del turno), BS (efectivo bolívares y punto de venta) y Arqueo Final (físico vs sistema). El badge automático indica CAJA CUADRADA o DESCUADRE DETECTADO." icon="point_of_sale" />
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

                            <div className="mt-8 bg-slate-100 p-6 rounded-3xl border-2 border-slate-200">
                                <h3 className="font-black uppercase text-xs tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                    <span className="material-icons-round text-sm">quiz</span>
                                    Preguntas Frecuentes - Caja y Cierres
                                </h3>
                                <div className="space-y-6">
                                    <FaqItem q="¿Puede un cajero ver los costos de los productos?" r="No. El campo costo está oculto para el rol cajero y vendedor. Solo Admin ve el costo y la utilidad en el Panel del Dueño y en P&L." />
                                    <FaqItem q="¿Puede reimprimirse una factura de otro turno o caja cerrada?" r="Sí. La reimpresión lee de Dexie local y no requiere caja abierta. Cualquier factura histórica puede reimprimirse en cualquier momento. Solo el Admin puede anular facturas." />
                                    <FaqItem q="¿Qué pasa si dos cajeros cierran caja al mismo tiempo?" r="No hay conflicto. Cada sesión tiene un id_sesion_local único. Supabase los recibe como dos cierres separados. El consolidado del dueño suma ambos automáticamente." />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'reportes' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Reportes, Deudas y Libros Fiscales</h2>
                            <div className="space-y-4">
                                <HelpItem title="Monitor de Deudas" desc="Diferencie entre lo que debe (Cuentas por Pagar) y lo que le deben (Cuentas por Cobrar) con un solo vistazo." icon="account_balance" />
                                <HelpItem title="Estado de Resultados (P&L)" desc="Ventas Netas − CMV = Utilidad Bruta − Gastos Operativos = Utilidad Neta. Con márgenes porcentuales y gráfico de barra. Acceda desde Reportes → tab P&L." icon="analytics" />
                                <HelpItem title="Anulación con Auditoría" desc="Toda anulación queda grabada con el nombre del responsable. Requiere PIN de Admin o Supervisor." icon="security" />
                                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
                                    <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest mb-3">⚖️ Libros Fiscales SENIAT</p>
                                    <div className="space-y-3">
                                        <HelpItem title="Libro de Ventas" desc="Se genera desde Reportes → tab Ventas → botón 'Libro Ventas'. Incluye Base Imponible, IVA Débito Fiscal (16%) e IGTF (3%) por factura, con totalizadores fiscales." icon="menu_book" />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 bg-slate-100 p-6 rounded-3xl border-2 border-slate-200">
                                <h3 className="font-black uppercase text-xs tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                    <span className="material-icons-round text-sm">quiz</span>
                                    Preguntas Frecuentes - Reportes, Deudas y Auditoría
                                </h3>
                                <div className="space-y-6">
                                    <FaqItem q="¿Puede un vendedor dar crédito a un cliente sin autorización?" r="Depende de la configuración. El sistema muestra la deuda actual del cliente con un parpadeo naranja al seleccionarlo. El vendedor decide pero queda registrado." />
                                    <FaqItem q="¿Puede un cliente tener crédito ilimitado?" r="No. Cada cliente tiene un campo límite de crédito en su ficha. Si la deuda supera ese límite el sistema bloquea al vendedor con una alerta roja LÍMITE DE CRÉDITO EXCEDIDO al intentar usar el botón CRÉDITO." />
                                    <FaqItem q="¿Qué pasa si un cliente abona en una terminal y la otra no se entera?" r="El abono se guarda local y sube a Supabase automáticamente. La otra terminal actualiza el saldo al consultar. Nunca hay choque." />
                                    <FaqItem q="¿Puede un cajero anular una cuenta por cobrar o deuda?" r="No. Solo Admin puede anular cuentas por cobrar. El cajero solo puede registrar abonos. Queda registrado en auditoría." />
                                    <FaqItem q="¿Puede un cajero pagar facturas a proveedores?" r="No. El módulo de Cuentas por Pagar solo es visible para Admin o Supervisor. El cajero solo ve su módulo de ventas y cierre de caja." />
                                    <FaqItem q="¿Puede un vendedor borrar o modificar una venta ya procesada?" r="No. Las ventas son inmutables. Solo Admin puede anular con PIN y motivo. La anulación no borra el registro, lo marca ANULADA." />
                                    <FaqItem q="¿Los reportes de ventas incluyen las ventas anuladas?" r="Sí pero separadas. Muestra Ventas válidas / Anulaciones / Reversos para ver impacto real." />
                                    <FaqItem q="¿Puede alguien modificar un registro de auditoría?" r="No. La auditoría está en Supabase con RLS activado. Ningún usuario puede escribir ni borrar, y la app solo puede insertar eventos." />
                                    <FaqItem q="¿Los libros fiscales para el SENIAT se generan automáticamente?" r="Sí. Libro Ventas (16% IVA e IGTF 3%), Libro Compras y Libro de Inventario Valorado." />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'hibrido' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight border-b-4 border-indigo-500 inline-block mb-4">Radar e Inteligencia Híbrida</h2>
                            <p className="text-slate-600 leading-relaxed text-sm">
                                Protocolos automáticos ante situaciones complejas de red, stock y seguridad entre múltiples terminales.
                            </p>

                            <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-200">
                                <div className="space-y-8">
                                    <FaqItem q="1. Dos vendedores intentan vender el último artículo al mismo tiempo" r="El sistema realiza un 'Doble Check' en la nube. El que presione primero 'Cerrar Venta' gana el stock; el segundo recibirá un aviso de 'Stock Insuficiente' y su inventario local se actualizará solo." />
                                    <FaqItem q="2. El precio de un artículo cambia mientras alguien lo tiene en el carrito" r="Al facturar, el sistema detecta la diferencia con la Nube. Avisará al vendedor: 'El precio cambió'. El vendedor podrá elegir entre aplicar el precio nuevo o mantener el anterior si ya existe una oferta pactada." />
                                    <FaqItem q="3. Se pierde el internet y se realizan ventas offline" r="Las ventas se guardan en una 'Bandeja de Salida'. Apenas vuelve la conexión, el Radar las sube solas a la nube y actualiza el stock global automáticamente sin que el cajero haga nada." />
                                    <FaqItem q="4. ¿Es posible que el stock quede en negativo (-1)?" r="No. El sistema bloquea ventas por debajo de cero localmente y valida contra el saldo maestro en la nube antes de confirmar cualquier pago." />
                                    <FaqItem q="5. ¿Puedo saber si un cliente debe dinero en otra caja?" r="Sí. Al seleccionar al cliente, aparecerá una alerta parpadeante indicando: '⚠️ DEUDA PENDIENTE: $X.XX' consultada directamente de la base de datos global." />
                                    <FaqItem q="6. ¿Pueden dos cajeros cerrar caja al mismo tiempo?" r="Sin problemas. Cada terminal genera su propio reporte de Cierre Z independiente con un ID único. El dueño verá ambos reportes por separado en la nube." />
                                    <FaqItem q="7. ¿Qué pasa si el Admin desactiva un articulo en plena venta?" r="Nuevas búsquedas no encontrarán el artículo. Si ya estaba en el carrito, solo podrá facturarse si aún queda stock físico real disponible." />
                                    <FaqItem q="8. ¿Qué ocurre si la Tasa BCV cambia durante una factura?" r="El sistema reacciona en segundos. El monto en bolívares de la pantalla de pago se recalculará automáticamente con la nueva tasa antes de que el cajero valide el recibo." />
                                    <FaqItem q="9. Pedido Web vs Venta Presencial: ¿Quién tiene prioridad?" r="La venta física que se procese primero. Si la tienda vende el stock antes de que el vendedor procese el pedido web, el sistema dará error de stock al intentar despachar el pedido." />
                                    <FaqItem q="10. ¿Se puede bloquear a un cajero mientras está trabajando?" r="Sí. El cajero podrá terminar su factura actual, pero el sistema le impedirá abrir nuevas ventas o re-ingresar al sistema apenas intente usar su PIN nuevamente." />
                                    <FaqItem q="11. ¿Se descuenta de verdad el inventario para evitar vender la misma unidad dos veces?" r="SÍ. Ocurre a 2 niveles: 1) Localmente el sistema valida el stock antes de guardar; si no hay, cancela la venta al instante. 2) En la nube (Supabase) se aplica un bloqueo de seguridad (FOR UPDATE). Si tu PC y tu teléfono intentan vender la última pieza al mismo segundo exacto, la nube solo dejará pasar al primero. El segundo dispositivo será rechazado automáticamente." />
                                    <FaqItem q="12. ¿Qué pasa si se va el internet mientras el cajero está facturando?" r="La venta se guarda en Dexie local. El sistema continúa funcionando offline. Cuando vuelve internet el SyncManager sube automáticamente las ventas pendientes. El stock global se actualiza al reconectar." />
                                    <FaqItem q="13. ¿Si un vendedor en el teléfono vende el último producto puede la PC venderlo también?" r="Con el Radar de Stock activo no. Cuando el teléfono vende Supabase notifica a la PC que actualice su Dexie. La PC recibe el cambio en segundos y muestra stock 0 antes de que otro vendedor intente venderlo." />
                                </div>
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

                            <div className="mt-8 bg-slate-100 p-6 rounded-3xl border-2 border-slate-200">
                                <h3 className="font-black uppercase text-xs tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                    <span className="material-icons-round text-sm">quiz</span>
                                    Preguntas Frecuentes - Multimoneda y Config
                                </h3>
                                <div className="space-y-6">
                                    <FaqItem q="¿Qué pasa si la tasa BCV cambia mientras un vendedor está facturando?" r="El sistema detecta el cambio via Supabase Realtime y actualiza el monto en Bolívares en la pantalla del vendedor antes de cobrar." />
                                    <FaqItem q="¿Puede un vendedor cambiar la tasa BCV manualmente?" r="No. Solo Admin puede actualizar la tasa desde el panel de Configuración. El cambio se propaga a todos los terminales." />
                                    <FaqItem q="¿El IGTF se aplica siempre?" r="No. Solo se aplica al seleccionar método Divisas Extranjeras (Zelle o Efectivo USD). Pagos en Bs o Pago Móvil no generan IGTF." />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'bitacora' && (
                        <div className="space-y-8">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight border-b-4 border-primary inline-block mb-4">Bitácora de Desarrollo 🪶</h2>
                            <p className="text-slate-600 leading-relaxed text-sm">Registro histórico de las últimas implementaciones críticas y actualizaciones del sistema "Keymaster ERP".</p>

                            <div className="relative border-l-4 border-slate-100 pl-8 space-y-12 py-4">
                                <div className="relative">
                                    <div className="absolute -left-[42px] top-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg shadow-amber-200">04</div>
                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full border border-amber-100">MARZO 2026 — Key Implementation: "Cacique Connect"</span>
                                    <div className="mt-4 space-y-4">
                                        <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm transition-all hover:border-primary/20">
                                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-3">
                                                <span className="material-icons-round text-primary">cloud_done</span>
                                                Sincronización Total 360°
                                            </h4>
                                            <ul className="text-xs text-slate-500 space-y-2 font-medium">
                                                <li className="flex items-start gap-2"><span className="text-primary">•</span> <strong>Compras y Cotizaciones:</strong> Ahora todos los presupuestos y entradas de mercancía suben a la nube. El dueño puede ver el historial de costos desde cualquier lugar.</li>
                                                <li className="flex items-start gap-2"><span className="text-primary">•</span> <strong>Cuentas por Pagar (Manual):</strong> Corrección del flujo de sync. Las deudas registradas manualmente ahora se encolan y sincronizan correctamente.</li>
                                                <li className="flex items-start gap-2"><span className="text-primary">•</span> <strong>Stock Web Integrado:</strong> El catálogo web ahora consulta el stock real de la tienda para cada pedido entrante.</li>
                                            </ul>
                                        </div>
                                        <div className="bg-white p-5 rounded-3xl border-2 border-indigo-100 shadow-sm transition-all hover:border-indigo-200">
                                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-3">
                                                <span className="material-icons-round text-indigo-500">security</span>
                                                Health Check & Fortificación
                                            </h4>
                                            <ul className="text-xs text-slate-500 space-y-2 font-medium">
                                                <li className="flex items-start gap-2"><span className="text-indigo-500">•</span> <strong>Auditoría Técnica ISO 25010:</strong> Aplicación evaluada con un puntaje de <strong>8.3/10</strong> (Apta para Producción).</li>
                                                <li className="flex items-start gap-2"><span className="text-indigo-500">•</span> <strong>Seguridad RLS:</strong> Activado el Row Level Security en todas las tablas de Supabase. Remoción de 16 políticas redundantes.</li>
                                                <li className="flex items-start gap-2"><span className="text-indigo-500">•</span> <strong>Optimización SQL:</strong> Creación de índices en <code>venta_items</code>, <code>cierres_caja</code> y <code>cuentas_por_cobrar</code> para búsquedas instantáneas.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative">
                                    <div className="absolute -left-[42px] top-0 w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 text-xs font-black">01</div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">MARZO 2026 — Production Cleanup</span>
                                    <div className="mt-4 space-y-4 opacity-70">
                                        <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm">
                                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-3">Limpieza de Entorno</h4>
                                            <p className="text-xs text-slate-500">Remoción de datos de prueba, usuarios demo y módulos experimentales. Preparación del bundle para despliegue final en Netlify.</p>
                                        </div>
                                    </div>
                                </div>
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

function FaqItem({ q, r }) {
    return (
        <div className="space-y-1.5 px-4 border-l-2 border-slate-200">
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{q}</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed italic">{r}</p>
        </div>
    )
}

