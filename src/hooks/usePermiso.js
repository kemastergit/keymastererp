import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'

// Cache en memoria de roles para no pedir a Supabase en cada check
let rolesCache = null
let rolesCacheTs = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

async function fetchRoles() {
    const now = Date.now()
    if (rolesCache && (now - rolesCacheTs) < CACHE_TTL) return rolesCache

    try {
        const { data, error } = await supabase.from('roles').select('codigo, permisos').eq('activo', true)
        if (!error && data) {
            // Convertir array de roles a mapa: { ADMIN: Set([...]), CAJERO: Set([...]) }
            const map = {}
            for (const r of data) {
                map[r.codigo] = new Set(Array.isArray(r.permisos) ? r.permisos : [])
            }
            rolesCache = map
            rolesCacheTs = now
            // Guardar también en localStorage como fallback offline
            localStorage.setItem('km_roles_cache', JSON.stringify({ ts: now, data: Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v]])) }))
            return rolesCache
        }
    } catch (err) {
        console.warn('usePermiso: usando cache offline de roles', err)
    }

    // Fallback: leer de localStorage
    try {
        const raw = localStorage.getItem('km_roles_cache')
        if (raw) {
            const parsed = JSON.parse(raw)
            const map = {}
            for (const [k, v] of Object.entries(parsed.data)) {
                map[k] = new Set(v)
            }
            rolesCache = map
            return rolesCache
        }
    } catch (e) { }

    // Fallback final hardcodeado si no hay red ni cache
    return null
}

// Permisos mínimos de emergencia (si no hay red ni cache)
const FALLBACK_PERMS = {
    ADMIN: new Set(['__ALL__']),
    SUPERVISOR: new Set(['MENU_VENTAS', 'MENU_INVENTARIO', 'MENU_CLIENTES', 'MENU_DIRECTORIO', 'MENU_CATALOGO', 'MENU_COTIZACIONES', 'MENU_CAJA', 'MENU_REPORTES', 'MENU_COBRAR', 'MENU_PAGAR', 'MENU_PROVEEDORES', 'MENU_ORDENES_COMPRA', 'MENU_DASHBOARD', 'FACTURAR_COBRAR', 'EDITAR_INVENTARIO', 'MODIFICAR_PRECIOS', 'BUSCAR_PRODUCTOS', 'ABRIR_TURNO', 'CERRAR_TURNO_PROPIO', 'VER_VENTAS_PROPIAS', 'IMPORTAR_PEDIDO_WEB']),
    CAJERO: new Set(['MENU_VENTAS', 'MENU_CLIENTES', 'MENU_DIRECTORIO', 'MENU_CATALOGO', 'MENU_COTIZACIONES', 'MENU_CAJA', 'MENU_REPORTES', 'MENU_COBRAR', 'MENU_DASHBOARD', 'FACTURAR_COBRAR', 'ABRIR_TURNO', 'CERRAR_TURNO_PROPIO', 'VER_VENTAS_PROPIAS', 'BUSCAR_PRODUCTOS', 'IMPORTAR_PEDIDO_WEB']),
    VENDEDOR: new Set(['MENU_VENTAS', 'MENU_DIRECTORIO', 'MENU_CLIENTES', 'MENU_CATALOGO', 'MENU_COTIZACIONES', 'ENVIAR_A_CAJA', 'ABRIR_TURNO', 'CERRAR_TURNO_PROPIO', 'VER_VENTAS_PROPIAS', 'BUSCAR_PRODUCTOS']),
}

// Hook sincrónico usando el state de roles en memoria
export function usePermiso() {
    const user = useStore(state => state.currentUser)
    const [perms, setPerms] = useState(() => {
        // Intentar leer de localStorage en la primera carga
        try {
            const raw = localStorage.getItem('km_roles_cache')
            if (raw) {
                const parsed = JSON.parse(raw)
                const map = {}
                for (const [k, v] of Object.entries(parsed.data)) {
                    map[k] = new Set(v)
                }
                return map
            }
        } catch (e) { }
        return FALLBACK_PERMS
    })

    useEffect(() => {
        fetchRoles().then(roles => {
            if (roles) setPerms(roles)
        })
    }, [])

    const check = (accion) => {
        if (!user) return false
        const rol = user.rol
        const rolPerms = perms[rol]

        if (!rolPerms) return false
        if (rolPerms.has('__ALL__')) return true   // ADMIN con comodín
        return rolPerms.has(accion)
    }

    return { check, rol: user?.rol, user }
}

// Función utilitaria para invalidar el cache (llamar después de guardar roles desde admin)
export function invalidateRolesCache() {
    rolesCache = null
    rolesCacheTs = 0
}
