import useStore from '../store/useStore'

export function usePermiso() {
    const user = useStore(state => state.currentUser)

    const check = (accion) => {
        if (!user) return false
        const rol = user.rol

        // ADMIN puede todo
        if (rol === 'ADMIN') return true

        // Permisos por Acción
        switch (accion) {
            case 'FACTURAR':
            case 'ABRIR_TURNO':
            case 'CERRAR_TURNO_PROPIO':
            case 'VER_VENTAS_PROPIAS':
            case 'BUSCAR_PRODUCTOS':
                return true

            case 'VER_TOTALES_GLOBALES':
            case 'FORZAR_CIERRE_AJENO':
            case 'EDITAR_INVENTARIO':
            case 'AJUSTES_CIERRE':
            case 'MODIFICAR_PRECIOS':
            case 'DESCUENTOS_ALTOS':
                return rol === 'SUPERVISOR'

            case 'CREAR_USUARIOS':
            case 'CONFIGURACION':
            case 'CIERRE_Z':
            case 'VER_LOGS':
                return false // Solo Admin, ya capturado arriba

            default:
                return false
        }
    }

    return { check, rol: user?.rol, user }
}
