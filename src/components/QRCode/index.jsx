import { QRCodeSVG } from 'qrcode.react'

export default function QRCodeComponent({ value, size = 80 }) {
    if (!value) return null

    // Convert object to string if necessary
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : value

    return (
        <div className="bg-white p-1 inline-block">
            <QRCodeSVG value={stringValue} size={size} level="L" marginSize={0} />
        </div>
    )
}
