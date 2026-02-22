import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export default function CodigoBarras({ value, width = 1, height = 40, fontSize = 12 }) {
    const barcodeRef = useRef(null)

    useEffect(() => {
        if (barcodeRef.current && value) {
            JsBarcode(barcodeRef.current, value, {
                format: "CODE128",
                width,
                height,
                displayValue: true,
                fontSize,
                margin: 0,
                background: "transparent",
                lineColor: "#000"
            })
        }
    }, [value, width, height, fontSize])

    return <svg ref={barcodeRef} style={{ maxWidth: '100%' }}></svg>
}
