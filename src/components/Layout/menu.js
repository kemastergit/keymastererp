export const menu = [
    { to: '/', ico: 'dashboard', label: 'Dashboard', perm: 'MENU_DASHBOARD' },
    {
        label: 'Ventas',
        ico: 'receipt_long',
        perm: 'MENU_VENTAS',
        sub: [
            { label: 'Facturación', to: '/facturacion', ico: 'bolt' },
            { label: 'Catálogo en Línea', to: '/catalogo', ico: 'language', perm: 'MENU_CATALOGO' },
            { label: '📦 Pedidos en Línea', to: '/pedidos-web', ico: 'shopping_cart_checkout', perm: 'MENU_CAJA' },
            { label: 'Cotizaciones', to: '/cotizaciones', ico: 'assignment', perm: 'MENU_COTIZACIONES' },
            { label: 'Devoluciones', to: '/devoluciones', ico: 'history', perm: 'MENU_CAJA' },
            { label: 'Caja Chica', to: '/caja-chica', ico: 'payments', perm: 'MENU_CAJA' },
        ]
    },
    {
        label: 'Compras',
        ico: 'shopping_bag',
        perm: 'MENU_PROVEEDORES',
        sub: [
            { label: 'Órdenes de Compra', to: '/ordenes-compra', ico: 'assignment_turned_in', perm: 'MENU_ORDENES_COMPRA' },
            { label: 'Entrada de Factura', to: '/compras', ico: 'add_shopping_cart' },
            { label: 'Historial Compras', to: '/compras-historial', ico: 'history' },
        ]
    },
    { label: '🏧 CIERRE TURNOS', to: '/caja', ico: 'point_of_sale', perm: 'MENU_CAJA' },
    {
        label: 'Créditos',
        ico: 'account_balance_wallet',
        perm: 'MENU_COBRAR',
        sub: [
            { label: 'Cuentas por Cobrar', to: '/cobrar', ico: 'call_received', perm: 'MENU_COBRAR' },
            { label: 'Cuentas por Pagar', to: '/pagar', ico: 'call_made', perm: 'MENU_PAGAR' },
        ]
    },
    {
        label: 'Stock',
        ico: 'inventory_2',
        perm: 'MENU_INVENTARIO',
        sub: [
            { label: 'Maestro de Inventario', to: '/inventario', ico: 'inventory_2', perm: 'MENU_INVENTARIO' },
            { label: 'Etiquetas y Códigos', to: '/etiquetas', ico: 'qr_code_2', perm: 'MENU_INVENTARIO' },
        ]
    },
    {
        label: 'Entidades',
        ico: 'groups',
        perm: 'MENU_DIRECTORIO',
        sub: [
            { label: 'Directorio Clientes', to: '/clientes', ico: 'person', perm: 'MENU_DIRECTORIO' },
            { label: 'Directorio Proveedores', to: '/proveedores', ico: 'factory', perm: 'MENU_PROVEEDORES' },
        ]
    },
    {
        label: 'Reportes',
        ico: 'insert_chart',
        perm: 'MENU_REPORTES',
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
        perm: 'MENU_SISTEMA',
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
