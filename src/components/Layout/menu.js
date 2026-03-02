export const menu = [
    { to: '/', ico: 'dashboard', label: 'Dashboard' },
    {
        label: 'Ventas',
        ico: 'receipt_long',
        sub: [
            { label: 'Facturación', to: '/facturacion', ico: 'bolt' },
            { label: 'Catálogo en Línea', to: '/catalogo', ico: 'language' },
            { label: '📦 Pedidos en Línea', to: '/pedidos-web', ico: 'shopping_cart_checkout' },
            { label: 'Cotizaciones', to: '/cotizaciones', ico: 'assignment' },
            { label: 'Devoluciones', to: '/devoluciones', ico: 'history' },
            { label: 'Caja Chica', to: '/caja-chica', ico: 'payments' },
        ]
    },
    {
        label: 'Compras',
        ico: 'shopping_bag',
        sub: [
            { label: 'Entrada de Factura', to: '/compras', ico: 'add_shopping_cart' },
            { label: 'Historial Compras', to: '/compras-historial', ico: 'history' },
        ]
    },
    { label: '🏧 CIERRE TURNOS', to: '/caja', ico: 'point_of_sale' },
    {
        label: 'Créditos',
        ico: 'account_balance_wallet',
        sub: [
            { label: 'Cuentas por Cobrar', to: '/cobrar', ico: 'call_received' },
            { label: 'Cuentas por Pagar', to: '/pagar', ico: 'call_made' },
        ]
    },
    {
        label: 'Stock',
        ico: 'inventory_2',
        sub: [
            { label: 'Maestro de Inventario', to: '/inventario', ico: 'inventory_2' },
            { label: 'Etiquetas y Códigos', to: '/etiquetas', ico: 'qr_code_2' },
        ]
    },
    {
        label: 'Entidades',
        ico: 'groups',
        sub: [
            { label: 'Directorio Clientes', to: '/clientes', ico: 'person' },
            { label: 'Directorio Proveedores', to: '/proveedores', ico: 'factory' },
        ]
    },
    {
        label: 'Reportes',
        ico: 'insert_chart',
        sub: [
            { label: 'Consolidado Diario', to: '/reportes?tab=ventas', ico: 'summarize' },
            { label: 'Estado de Resultados', to: '/reportes?tab=pyl', ico: 'analytics' },
            { label: 'Historial de Cierres Z', to: '/reportes?tab=cierres', ico: 'history' },
            { label: 'Comisiones Ventas', to: '/comisiones', ico: 'payments', feature: 'comisiones_habilitadas' },
        ]
    },
    {
        label: 'Sistema',
        ico: 'settings',
        sub: [
            { label: 'Gestión de Usuarios', to: '/usuarios', ico: 'manage_accounts', perm: 'CREAR_USUARIOS' },
            { label: 'Auditoría de Acciones', to: '/auditoria', ico: 'history_edu', perm: 'CONFIGURACION' },
            { label: 'Radar de Salud', to: '/radar', ico: 'radar', perm: 'CONFIGURACION' },
            { label: 'Configuración Empresa', to: '/config', ico: 'business', perm: 'CONFIGURACION' },
            { label: 'Seguridad Sistema', to: '/admin', ico: 'admin_panel_settings', perm: 'CONFIGURACION' },
            { label: 'Planes y Soporte', to: '/planes', ico: 'help_outline' },
            { label: 'Centro de Ayuda', to: '/ayuda', ico: 'quiz' },
        ]
    }
]

