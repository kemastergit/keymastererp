import { fmtUSD, fmtBS, fmtDate } from './format'

export function printNota(venta, items, tasa) {
  const linea = '─'.repeat(40)
  const rows = items.map(i =>
    `${i.codigo.padEnd(10)} ${i.descripcion.substring(0, 18).padEnd(18)} x${String(i.qty).padStart(3)} ${fmtUSD(i.precio * i.qty).padStart(10)}`
  ).join('\n')

  const total = items.reduce((s, i) => s + i.precio * i.qty, 0)

  const html = `
  <html><head>
  <style>
    body { font-family: 'Courier New', monospace; font-size: 11px; padding: 10px; color:#000; max-width:400px; margin:0 auto; }
    .c { text-align:center; }
    .r { text-align:right; }
    .big { font-size:14px; font-weight:bold; }
    pre { margin:0; white-space:pre-wrap; }
  </style>
  </head><body>
  <div class="c big">AUTOMOTORES GUAICAIPURO C.A.</div>
  <div class="c">RIF: J-XXXXXXXXX-X</div>
  <div class="c">${linea}</div>
  <div>NOTA DE ENTREGA N° ${venta.nro}</div>
  <div>FECHA: ${fmtDate(venta.fecha)}</div>
  <div>CLIENTE: ${venta.cliente}</div>
  <div>TIPO PAGO: ${venta.tipo_pago}</div>
  <div>${linea}</div>
  <pre>${rows}</pre>
  <div>${linea}</div>
  <div class="r big">TOTAL: ${fmtUSD(total)}</div>
  <div class="r">EN Bs: ${fmtBS(total, tasa)}</div>
  <div class="r">TASA BCV: ${tasa}</div>
  <div>${linea}</div>
  <div class="c">¡Gracias por su compra!</div>
  </body></html>`

  const w = window.open('', '_blank', 'width=420,height=600')
  w.document.write(html)
  w.document.close()
  w.print()
}

export function printCotizacion(cot, items, tasa) {
  const total = items.reduce((s, i) => s + i.precio * i.qty, 0)
  const html = `
  <html><head>
  <style>
    body { font-family: 'Courier New', monospace; font-size: 11px; padding: 10px; color:#000; max-width:400px; margin:0 auto; }
    .c { text-align:center; } .r { text-align:right; } .big { font-size:14px; font-weight:bold; }
    table { width:100%; border-collapse:collapse; } td,th { padding:3px; border-bottom:1px solid #ccc; font-size:10px; }
  </style></head><body>
  <div class="c big">AUTOMOTORES GUAICAIPURO C.A.</div>
  <div class="c">COTIZACIÓN N° ${cot.nro} — ${new Date(cot.fecha).toLocaleDateString('es-VE')}</div>
  <div>CLIENTE: ${cot.cliente}</div>
  <table>
    <tr><th>CÓD</th><th>DESC</th><th>CANT</th><th>P.UNIT</th><th>TOTAL</th></tr>
    ${items.map(i => `<tr><td>${i.codigo}</td><td>${i.descripcion}</td><td>${i.qty}</td><td>${fmtUSD(i.precio)}</td><td>${fmtUSD(i.precio * i.qty)}</td></tr>`).join('')}
  </table>
  <div class="r big">TOTAL: ${fmtUSD(total)}</div>
  <div class="r">EN Bs: ${fmtBS(total, tasa)}</div>
  <div class="c" style="margin-top:10px">Válido por 3 días hábiles</div>
  </body></html>`
  const w = window.open('', '_blank', 'width=420,height=600')
  w.document.write(html)
  w.document.close()
  w.print()
}

export function printReporte(titulo, columnas, data, totales = null) {
  const html = `
  <html><head>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; padding: 20px; color:#333; }
    .header { text-align:center; margin-bottom: 20px; border-bottom: 2px solid #dc2626; padding-bottom:10px; }
    .title { font-size: 18px; font-weight: bold; color: #dc2626; text-transform: uppercase; }
    table { width:100%; border-collapse:collapse; margin-top: 10px; }
    th { background: #f4f4f4; text-align: left; padding: 8px; border: 1px solid #ddd; }
    td { padding: 8px; border: 1px solid #ddd; }
    .footer { margin-top: 20px; text-align: right; font-size: 14px; font-weight: bold; }
    .totales-box { background: #f9f9f9; padding: 10px; border: 1px solid #ddd; display: inline-block; min-width: 200px; }
    @media print { .no-print { display: none; } }
  </style></head><body>
  <div class="header">
    <div class="title">AUTOMOTORES GUAICAIPURO C.A.</div>
    <div>REPORTE: ${titulo}</div>
    <div>Fecha de impresión: ${new Date().toLocaleString()}</div>
  </div>
  <table>
    <thead><tr>${columnas.map(c => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>
      ${data.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>
  ${totales ? `
    <div class="footer">
      <div class="totales-box">
        ${Object.entries(totales).map(([label, val]) => `<div>${label}: ${val}</div>`).join('')}
      </div>
    </div>
  ` : ''}
  </body></html>`
  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  // Esperar a que cargue para imprimir (especialmente si tuviera imágenes)
  setTimeout(() => w.print(), 500)
}
