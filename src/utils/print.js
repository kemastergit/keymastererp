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
  <div class="r">SUBTOTAL: ${fmtUSD(venta.subtotal)}</div>
  ${venta.iva > 0 ? `<div class="r">IVA (${16}%): ${fmtUSD(venta.iva)}</div>` : ''}
  ${venta.igtf > 0 ? `<div class="r">IGTF (3%): ${fmtUSD(venta.igtf)}</div>` : ''}
  <div class="r big">TOTAL: ${fmtUSD(venta.total)}</div>
  <div class="r">EN Bs: ${fmtBS(venta.total, tasa)}</div>
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
  const ahora = new Date()
  const fechaStr = ahora.toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const horaStr = ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
  const totalRows = data.length

  const rows = data.map((row, idx) => {
    const isEven = idx % 2 === 0
    const isEmpty = row.every(c => !c || c === '')
    const isBold = row[0] && (
      row[0].startsWith('VENTAS NETAS') || row[0].startsWith('UTILIDAD') ||
      row[0].startsWith('TOTAL') || row[0] === 'VENTAS NETAS'
    )
    if (isEmpty) return `<tr><td colspan="${columnas.length}" style="height:6px;border:none;"></td></tr>`
    return `<tr style="background:${isBold ? '#f0fdfa' : isEven ? '#fafbfc' : '#fff'};${isBold ? 'font-weight:800;' : ''}">
      ${row.map((cell, ci) => {
      const cellStr = String(cell || '')
      const isNum = cellStr.startsWith('$') || cellStr.startsWith('-$') || cellStr.startsWith('−') || cellStr.endsWith('%')
      const isNeg = cellStr.startsWith('-') || cellStr.startsWith('−') || cellStr.startsWith('(-')
      return `<td style="
          padding:10px 14px;
          border-bottom:1px solid #eef0f2;
          font-size:11px;
          ${isNum ? 'text-align:right;font-family:\'Courier New\',monospace;font-weight:600;' : ''}
          ${isNeg ? 'color:#dc2626;' : ''}
          ${isBold ? 'color:#0d9488;font-size:12px;border-top:2px solid #0d9488;border-bottom:2px solid #0d9488;' : 'color:#374151;'}
          ${ci === 0 && cellStr.startsWith('  ') ? 'padding-left:32px;color:#6b7280;font-style:italic;' : ''}
        ">${cell || ''}</td>`
    }).join('')}
    </tr>`
  }).join('')

  const totalesHtml = totales ? Object.entries(totales).map(([label, val], idx) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;${idx > 0 ? 'border-top:1px solid #e5e7eb;' : ''}">
      <span style="font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#374151;font-size:12px;">${label}</span>
      <span style="font-family:'Courier New',monospace;font-weight:800;font-size:18px;color:#0d9488;">${val}</span>
    </div>`
  ).join('') : ''

  const html = `<!DOCTYPE html>
  <html><head>
  <style>
    @page { margin: 15mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1f2937; background: #fff; }

    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding-bottom: 16px; margin-bottom: 20px;
      border-bottom: 3px solid #0d9488;
    }

    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-icon {
      width: 48px; height: 48px; background: #0d9488; border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 900; font-size: 20px; letter-spacing: -0.05em;
    }
    .brand-name { font-size: 16px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: -0.02em; }
    .brand-rif { font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }

    .meta { text-align: right; }
    .meta-label { font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; }
    .meta-value { font-size: 11px; font-weight: 600; color: #374151; }

    .report-title {
      background: linear-gradient(135deg, #f0fdfa 0%, #e0f7f3 100%);
      border: 1px solid #99e6d9;
      padding: 14px 20px; margin-bottom: 20px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .report-title h1 {
      font-size: 15px; font-weight: 800; color: #0d9488;
      text-transform: uppercase; letter-spacing: 0.03em;
    }
    .report-title .badge {
      background: #0d9488; color: white; padding: 4px 12px;
      font-size: 10px; font-weight: 700; border-radius: 2px;
      text-transform: uppercase; letter-spacing: 0.1em;
    }

    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead th {
      background: #0f172a; color: white; padding: 10px 14px;
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.12em; text-align: left; border: none;
    }
    thead th:last-child { text-align: right; }

    .totales-box {
      margin-left: auto; width: 320px; max-width: 100%;
      background: #f8fafc; border: 2px solid #0d9488;
      padding: 16px 20px; border-radius: 2px;
    }

    .page-footer {
      margin-top: 30px; padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 8px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.1em;
    }

    @media print {
      .no-print { display: none; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style></head><body>

  <!-- HEADER CORPORATIVO -->
  <div class="page-header">
    <div class="brand">
      <div class="brand-icon">AG</div>
      <div>
        <div class="brand-name">Automotores Guaicaipuro C.A.</div>
        <div class="brand-rif">Sistema Keymaster — Reporte Oficial</div>
      </div>
    </div>
    <div class="meta">
      <div><span class="meta-label">Fecha: </span><span class="meta-value">${fechaStr}</span></div>
      <div><span class="meta-label">Hora: </span><span class="meta-value">${horaStr}</span></div>
      <div><span class="meta-label">Registros: </span><span class="meta-value">${totalRows}</span></div>
    </div>
  </div>

  <!-- TÍTULO DEL REPORTE -->
  <div class="report-title">
    <h1>${titulo}</h1>
    <span class="badge">Documento Oficial</span>
  </div>

  <!-- TABLA DE DATOS -->
  <table>
    <thead><tr>${columnas.map((c, i) =>
    `<th${i === columnas.length - 1 ? ' style="text-align:right"' : ''}>${c}</th>`
  ).join('')}</tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- TOTALES -->
  ${totales ? `
    <div style="display:flex;justify-content:flex-end;">
      <div class="totales-box">${totalesHtml}</div>
    </div>
  ` : ''}

  <!-- PIE DE PÁGINA -->
  <div class="page-footer">
    <span>Generado por Keymaster POS — ${fechaStr}</span>
    <span>Automotores Guaicaipuro C.A. — Todos los derechos reservados</span>
  </div>

  </body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  setTimeout(() => w.print(), 400)
}

export function printNotaTermica(venta, items, tasa) {
  // Papel de 7.6cm = ~280px de ancho
  // 32 caracteres max por línea en monoespaciado
  // NO usar tablas HTML, solo texto monoespaciado pre-formateado

  const linea = '─'.repeat(32)
  const total = items.reduce((s, i) => s + i.precio * i.qty, 0)
  const bs = (total * (tasa || 0)).toFixed(2)

  const itemLines = items.map(i => {
    const desc = i.descripcion.substring(0, 20).padEnd(20)
    const qty = String(i.qty).padStart(3)
    const subtotal = (i.precio * i.qty).toFixed(2).padStart(8)
    return `${desc}x${qty} $${subtotal}`
  }).join('\n')

  const html = `<html><head>
  <style>
    @page { margin: 0; size: 76mm auto; }
    body { font-family: 'Courier New', monospace; font-size: 10px; width: 72mm; margin: 2mm; padding: 0; color: #000; }
    .c { text-align: center; }
    .r { text-align: right; }
    .b { font-weight: bold; }
    .big { font-size: 13px; font-weight: bold; }
    pre { margin: 0; white-space: pre-wrap; font-family: inherit; font-size: inherit; }
  </style></head><body>
  <div class="c b big">AUTOMOTORES GUAICAIPURO C.A.</div>
  <div class="c" style="font-size:8px">RIF: J-00000000-0</div>
  <div class="c" style="font-size:8px">Dir: Tu dirección aquí</div>
  <div class="c" style="font-size:8px">Tel: 0000-0000000</div>
  <pre>${linea}</pre>
  <div class="b">NOTA DE ENTREGA #${venta.nro}</div>
  <div>Fecha: ${new Date(venta.fecha).toLocaleDateString('es-VE')}</div>
  <div>Cliente: ${venta.cliente || 'CONTADO'}</div>
  <div>Pago: ${venta.tipo_pago || 'CONTADO'}</div>
  <pre>${linea}</pre>
  <pre>${itemLines}</pre>
  <pre>${linea}</pre>
  <div class="r">Subtotal: $ ${venta.subtotal?.toFixed(2)}</div>
  ${venta.iva > 0 ? `<div class="r">IVA (16%): $ ${venta.iva.toFixed(2)}</div>` : ''}
  ${venta.igtf > 0 ? `<div class="r">IGTF (3%): $ ${venta.igtf.toFixed(2)}</div>` : ''}
  <div class="r b big">TOTAL: $ ${venta.total?.toFixed(2)}</div>
  <div class="r">Bs: ${(venta.total * (tasa || 0)).toFixed(2)}</div>
  <div class="r" style="font-size:8px">Tasa: ${tasa || 0} Bs/$</div>
  <pre>${linea}</pre>
  <div class="c" style="font-size:8px;margin-top:4px">¡Gracias por su compra!</div>
  <div class="c" style="font-size:7px">KEYMASTER</div>
  </body></html>`

  const w = window.open('', '_blank', 'width=320,height=600')
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}

export function printEtiquetas(productos, tasa, tamano = 'mediana') {
  // tamano: 'pequena' (5x3cm), 'mediana' (7x4cm), 'grande' (10x5cm)
  const sizes = {
    pequena: { w: '50mm', h: '30mm', font: '8px', fontPrecio: '14px' },
    mediana: { w: '70mm', h: '40mm', font: '9px', fontPrecio: '18px' },
    grande: { w: '100mm', h: '50mm', font: '10px', fontPrecio: '22px' }
  }
  const s = sizes[tamano] || sizes.mediana

  const etiquetas = productos.map(p => {
    const bs = ((p.precio || 0) * (tasa || 0)).toFixed(2)
    return `<div class="etq">
      <div class="codigo">${p.codigo || ''}</div>
      <div class="desc">${(p.descripcion || '').substring(0, 40)}</div>
      <div class="marca">${p.marca || ''}</div>
      <div class="precio">$ ${(p.precio || 0).toFixed(2)}</div>
      <div class="bs">Bs ${bs}</div>
      ${p.referencia ? `<div class="ref">Ref: ${p.referencia}</div>` : ''}
    </div>`
  }).join('')

  const html = `<html><head>
  <style>
    @page { margin: 5mm; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 5mm; }
    .etq {
      width: ${s.w}; height: ${s.h};
      border: 1px solid #ccc; border-radius: 3px;
      padding: 2mm; margin: 2mm;
      display: inline-block; vertical-align: top;
      overflow: hidden; box-sizing: border-box;
      page-break-inside: avoid;
    }
    .codigo { font-family: 'Courier New', monospace; font-size: ${s.font}; color: #0078d4; font-weight: bold; }
    .desc { font-size: ${s.font}; font-weight: bold; margin: 1mm 0; line-height: 1.2; color: #201f1e; }
    .marca { font-size: 7px; color: #605e5c; text-transform: uppercase; }
    .precio { font-size: ${s.fontPrecio}; font-weight: bold; color: #201f1e; margin-top: 1mm; }
    .bs { font-size: ${s.font}; color: #605e5c; }
    .ref { font-size: 7px; color: #a19f9d; margin-top: 1mm; }
  </style></head><body>${etiquetas}</body></html>`

  const w = window.open('', '_blank', 'width=800,height=600')
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}

export function printEtiquetaDespacho(venta, items) {
  const fecha = new Date(venta.fecha).toLocaleDateString('es-VE')
  const itemList = items.map(i =>
    `<div class="item">${i.descripcion} <strong>x${i.qty}</strong></div>`
  ).join('')

  const html = `<html><head>
  <style>
    @page { margin: 5mm; size: 100mm 70mm; }
    body { font-family: Arial, sans-serif; font-size: 10px; width: 96mm; margin: 2mm; color: #000; }
    .header { font-size: 14px; font-weight: bold; text-align: center; border-bottom: 2px solid #0078d4; padding-bottom: 2mm; margin-bottom: 2mm; }
    .row { display: flex; justify-content: space-between; margin: 1mm 0; }
    .label { font-weight: bold; color: #605e5c; font-size: 8px; text-transform: uppercase; }
    .value { font-weight: bold; }
    .item { font-size: 9px; border-bottom: 1px dotted #ccc; padding: 1mm 0; }
    .footer { text-align: center; font-size: 7px; color: #a19f9d; margin-top: 3mm; border-top: 1px solid #e1dfdd; padding-top: 2mm; }
  </style></head><body>
  <div class="header">AUTOMOTORES GUAICAIPURO</div>
  <div class="row"><span class="label">Nota:</span> <span class="value">#${venta.nro}</span></div>
  <div class="row"><span class="label">Fecha:</span> <span>${fecha}</span></div>
  <div class="row"><span class="label">Cliente:</span> <span class="value">${venta.cliente || 'CONTADO'}</span></div>
  <div style="margin-top:2mm;margin-bottom:1mm;font-weight:bold;font-size:8px;color:#0078d4">CONTENIDO:</div>
  ${itemList}
  <div class="footer">Verificar contenido al recibir</div>
  </body></html>`

  const w = window.open('', '_blank', 'width=420,height=350')
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}
