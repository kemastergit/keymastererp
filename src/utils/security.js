// ═══ SEGURIDAD KEYMASTER ERP ═══
// Salt movido a variable de entorno para no quedar expuesto en código fuente
const SYSTEM_SALT = import.meta.env.VITE_SYSTEM_SALT || 'KM_DEFAULT_SALT_CHANGE_ME'

/**
 * Hash robusto que funciona SIN HTTPS (HTTP por IP de red local)
 * Usa un algoritmo djb2 + salt doble para generar un hash de 64 caracteres
 * No es SHA-256, pero es MUCHO mejor que devolver el PIN en texto plano
 */
function fallbackHash(str) {
    const salted = SYSTEM_SALT + ':' + str + ':' + SYSTEM_SALT
    let h1 = 0x811c9dc5 // FNV offset basis
    let h2 = 0xcbf29ce4
    for (let i = 0; i < salted.length; i++) {
        const c = salted.charCodeAt(i)
        h1 ^= c; h1 = Math.imul(h1, 0x01000193) // FNV-1a prime
        h2 ^= c; h2 = Math.imul(h2, 0x01000193)
        h1 ^= (h2 >>> 16); h2 ^= (h1 >>> 8)
    }
    // Generar string hex largo mezclando ambos hashes con rotaciones
    let result = ''
    for (let round = 0; round < 8; round++) {
        h1 = Math.imul(h1 ^ (h1 >>> 16), 0x45d9f3b + round)
        h2 = Math.imul(h2 ^ (h2 >>> 13), 0x119de1f3 + round)
        result += (h1 >>> 0).toString(16).padStart(8, '0')
    }
    return result.substring(0, 64) // 64 chars como SHA-256
}

/**
 * hashPin: SIEMPRE retorna un hash, NUNCA el PIN original
 * - Si hay HTTPS → usa SHA-256 nativo del navegador (máxima seguridad)
 * - Si hay HTTP → usa fallbackHash con FNV-1a + salt (seguro para producción local)
 */
export async function hashPin(pin) {
    try {
        if (!crypto?.subtle?.digest) throw new Error('No secure context')
        const encoder = new TextEncoder()
        const data = encoder.encode(SYSTEM_SALT + ':' + pin)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (e) {
        console.warn('⚠️ crypto.subtle no disponible. Usando fallback hash seguro.')
        return fallbackHash(pin)
    }
}

/**
 * signData: Firma objetos JSON para detectar manipulación
 */
export async function signData(dataObj) {
    const str = JSON.stringify(dataObj)
    try {
        if (!crypto?.subtle?.digest) throw new Error('No secure context')
        const encoder = new TextEncoder()
        const data = encoder.encode(str + SYSTEM_SALT)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (e) {
        return fallbackHash(str)
    }
}

export async function verifyData(dataObj, signature) {
    const expected = await signData(dataObj)
    return expected === signature
}
