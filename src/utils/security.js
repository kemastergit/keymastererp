const SYSTEM_SALT = 'KEMASTER_SECRET_2026_PRO_SECURE'

export async function hashPin(pin) {
    const encoder = new TextEncoder()
    const data = encoder.encode(pin)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function signData(dataObj) {
    const str = JSON.stringify(dataObj)
    const encoder = new TextEncoder()
    const data = encoder.encode(str + SYSTEM_SALT)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyData(dataObj, signature) {
    const expected = await signData(dataObj)
    return expected === signature
}
