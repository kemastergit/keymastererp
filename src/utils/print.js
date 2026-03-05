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

export function printNotaTermica(venta, items, tasa, options = {}) {
  const t = tasa || 1
  const subtotal = venta.subtotal || items.reduce((s, i) => s + i.precio * i.qty, 0)
  const iva = venta.iva || 0
  const igtf = venta.igtf || 0
  const total = venta.total || (subtotal + iva + igtf)

  const toBs = (val) => (val * t).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const toUsd = (val) => (val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const esFactura = options.fiscal || false
  const tituloDoc = esFactura ? 'FACTURA' : 'NOTA DE ENTREGA'
  const fechaStr = new Date(venta.fecha || Date.now()).toLocaleDateString('es-VE')
  const horaStr = new Date(venta.fecha || Date.now()).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })

  // Filas del Detalle
  const itemRows = items.map(i => {
    return `
      <tr>
        <td colspan="4" class="desc">${i.descripcion}</td>
      </tr>
      <tr>
        <td class="cod">${(i.codigo || '').substring(0, 10)}</td>
        <td class="num">${i.qty}</td>
        <td class="num">${toUsd(i.precio)}</td>
        <td class="num b">${toUsd(i.precio * i.qty)}</td>
      </tr>
    `
  }).join('')

  const html = `<html><head>
  <style>
    @page { margin: 0; size: 80mm auto; }
    body { 
      font-family: 'Arial', sans-serif; 
      font-size: 11px; 
      width: 76mm; 
      margin: 0 auto; 
      padding: 4mm; 
      color: #000; 
      background: #fff;
    }
    .c { text-align: center; }
    .r { text-align: right; }
    .l { text-align: left; }
    .b { font-weight: bold; }
    .big { font-size: 14px; font-weight: bold; }
    .title { font-size: 12px; font-weight: bold; margin: 2mm 0; }
    
    .divider { border-bottom: 1px dashed #000; margin: 3mm 0; }
    .divider-solid { border-bottom: 1px solid #000; margin: 2mm 0; }
    
    .info-grid { display: grid; grid-template-columns: auto 1fr; gap: 2px 6px; font-size: 11px; margin-bottom: 2mm;}
    
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 2mm; }
    th { border-bottom: 1px solid #000; border-top: 1px solid #000; padding: 2px 0; text-align: right; font-weight: bold; }
    th.l { text-align: left; }
    td { padding: 2px 0; vertical-align: top; }
    td.desc { font-weight: bold; padding-top: 4px; }
    td.cod { font-family: monospace; font-size: 10px; }
    td.num { text-align: right; font-family: monospace; font-size: 11px; }
    
    .totals-grid { display: grid; grid-template-columns: 1fr auto; gap: 2px; font-size: 11px; font-family: monospace; }
    .total-row.big-total { font-size: 14px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin-top: 2px; }
    .total-row.big-total-bs { font-size: 12px; font-weight: bold; background: #f0f0f0; padding: 4px; margin-top: 4px; text-align: right;}
    
  </style></head><body>
  
  ${esFactura ? '<div class="c b title">SENIAT</div>' : ''}
  <div class="c b">AUTOMOTORES GUAICAIPURO C.A.</div>
  <div class="c b">RIF: J-00000000-0</div>
  <div class="c" style="font-size:10px; margin-top:2px;">
    Av. Principal, Edificio Central, Nivel 1<br/>
    Local 10, Caracas, Venezuela
  </div>
  <div class="c b" style="margin-top:2px;">CAJA 01</div>

  <div class="title" style="margin-top:4mm;">Información del Cliente</div>
  <div class="info-grid">
    <div class="b">Cliente:</div><div>${venta.cliente || 'CONTADO'}</div>
    <div class="b">RIF/C.I.:</div><div>${venta.rif || 'V-00000000'}</div>
    <div class="b">Vendedor:</div><div>${venta.vendedor || '1 CAJA'}</div>
  </div>

  <div class="c big" style="margin: 4mm 0;">${tituloDoc}</div>
  
  <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:11px;">
    <div>NUM: ${String(venta.nro).padStart(8, '0')}</div>
    <div>FECHA: ${fechaStr}</div>
  </div>
  <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom: 2mm;">
    <div></div>
    <div>HORA: ${horaStr}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="l" style="width:25%">CÓDIGO</th>
        <th style="width:15%">CANT.</th>
        <th style="width:30%">PRECIO REF</th>
        <th style="width:30%">TOTAL $</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="divider"></div>

  <div class="totals-grid">
    <div>EXENTO (E)</div><div class="r">${toUsd(subtotal)}</div>
    ${iva > 0 ? `<div>BASE IMP. (16%)</div><div class="r">${toUsd(subtotal)}</div>
                 <div>IVA (16%)</div><div class="r">${toUsd(iva)}</div>` : ''}
    ${igtf > 0 ? `<div>IGTF (3%)</div><div class="r">${toUsd(igtf)}</div>` : ''}
  </div>

  <div class="totals-grid total-row big-total">
    <div>TOTAL ${tituloDoc} $</div><div class="r">${toUsd(total)}</div>
  </div>
  
  <div class="total-row big-total-bs">
    TOTAL Bs: ${toBs(total)}
  </div>

  <div class="title" style="margin-top:4mm; text-align:center;">FORMA DE PAGO</div>
  <div class="info-grid" style="font-family:monospace;">
    <div>${(venta.tipo_pago || 'CONTADO').toUpperCase()}</div>
    <div class="r">${toUsd(total)}</div>
  </div>

  <div class="divider"></div>
  <div class="c" style="font-size:10px;">
    Tasa BCV: ${t.toFixed(4)} Bs/$<br/>
    ¡Gracias por su compra!<br/>
    <span style="font-size:8px; color:#666;">Sistema Keymaster</span>
  </div>

  </body></html>`

  const w = window.open('', '_blank', 'width=350,height=600')
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
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
    return `< div class="etq" >
      <div class="codigo">${p.codigo || ''}</div>
      <div class="desc">${(p.descripcion || '').substring(0, 40)}</div>
      <div class="marca">${p.marca || ''}</div>
      <div class="precio">$ ${(p.precio || 0).toFixed(2)}</div>
      <div class="bs">Bs ${bs}</div>
      ${p.referencia ? `<div class="ref">Ref: ${p.referencia}</div>` : ''}
    </div > `
  }).join('')

  const html = `< html ><head>
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
  </style></head><body>${etiquetas}</body></html > `

  const w = window.open('', '_blank', 'width=800,height=600')
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}

export function printEtiquetaDespacho(venta, items) {
  const fecha = new Date(venta.fecha).toLocaleDateString('es-VE')
  const itemList = items.map(i =>
    `< div class="item" > ${i.descripcion} <strong>x${i.qty}</strong></div > `
  ).join('')

  const html = `< html ><head>
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
  </body></html > `

  const w = window.open('', '_blank', 'width=420,height=350')
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}

// ─────────────────────────────────────────────────────────
//  UTILIDADES PARA LIBROS SENIAT
// ─────────────────────────────────────────────────────────

const SENIAT_STYLES = `
  @page { margin: 12mm 10mm; }
  * { box- sizing: border - box; margin: 0; padding: 0;
}
  body { font - family: 'Segoe UI', Arial, sans - serif; color: #1f2937; background: #fff; font - size: 11px; }

  .page - header { display: flex; justify - content: space - between; align - items: flex - start; padding - bottom: 14px; margin - bottom: 16px; border - bottom: 3px solid #0d9488; }
  .brand - icon { width: 44px; height: 44px; background:#0f172a; border - radius: 4px; display: flex; align - items: center; justify - content: center; color: white; font - weight: 900; font - size: 18px; margin - right: 12px; flex - shrink: 0; }
  .brand - name { font - size: 15px; font - weight: 900; color:#0f172a; text - transform: uppercase; letter - spacing: -0.02em; }
  .brand - sub { font - size: 9px; color:#6b7280; font - weight: 600; text - transform: uppercase; letter - spacing: 0.08em; margin - top: 2px; }
  .meta { text - align: right; font - size: 10px; color:#374151; }
  .meta - label { font - size: 8px; color:#9ca3af; font - weight: 700; text - transform: uppercase; letter - spacing: 0.12em; }

  .libro - header { background: linear - gradient(135deg,#0f172a 0 %,#1e293b 100 %); color: white; padding: 14px 20px; margin - bottom: 20px; display: flex; justify - content: space - between; align - items: center; }
  .libro - title { font - size: 14px; font - weight: 900; text - transform: uppercase; letter - spacing: 0.03em; }
  .libro - sub { font - size: 9px; color:#94a3b8; margin - top: 4px; font - weight: 600; text - transform: uppercase; letter - spacing: 0.1em; }
  .libro - badge { background:#0d9488; color: white; padding: 5px 14px; font - size: 9px; font - weight: 900; letter - spacing: 0.15em; text - transform: uppercase; border - radius: 2px; }

  table { width: 100 %; border - collapse: collapse; margin - bottom: 20px; }
  thead th { background:#0f172a; color: white; padding: 9px 10px; font - size: 8.5px; font - weight: 700; text - transform: uppercase; letter - spacing: 0.1em; border - right: 1px solid #1e293b; }
  thead th: last - child { border - right: none; }
  tbody tr: nth - child(even) { background: #f8fafc; }
  tbody tr:hover { background: #f0fdfa; }
  tbody td { padding: 8px 10px; font - size: 10px; border - bottom: 1px solid #f1f5f9; color:#374151; }

  .num { text - align: right; font - family: 'Courier New', monospace; font - weight: 600; }
  .rif { font - family: 'Courier New', monospace; font - size: 9px; color:#6b7280; }
  .nota { font - family: 'Courier New', monospace; color:#0d9488; font - weight: 700; }

  .totales - grid { display: grid; grid - template - columns: 1fr 1fr 1fr; gap: 12px; margin - bottom: 20px; }
  .total - card { background: #f8fafc; border: 2px solid #e2e8f0; padding: 12px 16px; }
  .total - card.teal { border - color:#0d9488; background: #f0fdfa; }
  .total - card.red { border - color: #dc2626; background: #fef2f2; }
  .total - card.dark { border - color:#0f172a; background: #f8fafc; }
  .tc - label { font - size: 8px; font - weight: 800; text - transform: uppercase; letter - spacing: 0.12em; color:#6b7280; margin - bottom: 4px; }
  .tc - value { font - size: 16px; font - weight: 900; font - family: 'Courier New', monospace; color:#0f172a; }
  .tc - value.teal { color:#0d9488; }
  .tc - value.red { color: #dc2626; }

  .legal - note { background: #fefce8; border: 1px solid #fbbf24; padding: 10px 14px; font - size: 9px; color:#78350f; margin - bottom: 16px; display: flex; gap: 10px; align - items: flex - start; }
  .page - footer { margin - top: 24px; padding - top: 10px; border - top: 1px solid #e5e7eb; display: flex; justify - content: space - between; font - size: 8px; color:#9ca3af; text - transform: uppercase; letter - spacing: 0.08em; }

@media print { body { -webkit - print - color - adjust: exact; print - color - adjust: exact; } }
`

function seniatHeader(empresa = {}) {
  const ahora = new Date()
  const fechaStr = ahora.toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const horaStr = ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
  return `
  < div class="page-header" >
      <div style="display:flex;align-items:center">
        <div class="brand-icon">AG</div>
        <div>
          <div class="brand-name">${empresa.nombre || 'Automotores Guaicaipuro C.A.'}</div>
          <div class="brand-sub">RIF: ${empresa.rif || 'J-XXXXXXXXX-X'} | ${empresa.direccion || 'Dirección del Contribuyente'}</div>
        </div>
      </div>
      <div class="meta">
        <div><span class="meta-label">Fecha impresión: </span>${fechaStr}</div>
        <div><span class="meta-label">Hora: </span>${horaStr}</div>
        <div style="margin-top:4px;font-weight:700;color:#0d9488">⚖️ DOCUMENTO DE USO TRIBUTARIO</div>
      </div>
    </div >
  `
}

// ─── 1. LIBRO DE VENTAS SENIAT ───────────────────────────
export function printLibroVentas(ventas, periodo, empresa = {}) {
  const rows = ventas.map((v, idx) => {
    const base = v.subtotal || (v.total / 1.16)
    const iva = v.iva || (v.total - base)
    const igtf = v.igtf || 0
    const isEven = idx % 2 === 0
    return `< tr style = "background:${isEven ? '#fafbfc' : '#fff'}" >
      <td class="rif">${new Date(v.fecha).toLocaleDateString('es-VE')}</td>
      <td class="nota">#${v.nro}</td>
      <td>${(v.cliente || 'CONTADO').toUpperCase()}</td>
      <td class="rif">${v.rif || 'V/J-00000000-0'}</td>
      <td class="num">$${base.toFixed(2)}</td>
      <td class="num" style="color:#0d9488">$${iva.toFixed(2)}</td>
      <td class="num" style="color:#7c3aed">$${igtf.toFixed(2)}</td>
      <td class="num" style="font-weight:900;color:#0f172a">$${v.total.toFixed(2)}</td>
    </tr > `
  }).join('')

  const totalBase = ventas.reduce((s, v) => s + (v.subtotal || v.total / 1.16), 0)
  const totalIVA = ventas.reduce((s, v) => s + (v.iva || v.total - (v.subtotal || v.total / 1.16)), 0)
  const totalIGTF = ventas.reduce((s, v) => s + (v.igtf || 0), 0)
  const totalFinal = ventas.reduce((s, v) => s + v.total, 0)

  const html = `< !DOCTYPE html > <html><head><style>${SENIAT_STYLES}</style></head><body>
  ${seniatHeader(empresa)}

  <div class="libro-header">
    <div>
      <div class="libro-title">📒 Libro de Ventas — Período ${periodo}</div>
      <div class="libro-sub">Art. 70 Ley IVA — Registro de operaciones gravadas y exentas</div>
    </div>
    <div class="libro-badge">${ventas.length} REGISTROS</div>
  </div>

  <div class="legal-note">
    ⚠️  <span>Este libro es de carácter obligatorio conforme al Artículo 70 de la <strong>Ley del IVA</strong> y el Artículo 72 de su Reglamento. Debe mantenerse actualizado y disponible para revisión fiscal.</span>
  </div>

  <table>
    <thead><tr>
      <th>FECHA</th><th>NOTA / FACT.</th><th>CLIENTE / COMPRADOR</th><th>RIF</th>
      <th style="text-align:right">BASE IMP. ($)</th>
      <th style="text-align:right">IVA 16% ($)</th>
      <th style="text-align:right">IGTF 3% ($)</th>
      <th style="text-align:right">TOTAL ($)</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totales-grid">
    <div class="total-card dark">
      <div class="tc-label">Total Base Imponible</div>
      <div class="tc-value">$${totalBase.toFixed(2)}</div>
    </div>
    <div class="total-card teal">
      <div class="tc-label">Total IVA Débito Fiscal (16%)</div>
      <div class="tc-value teal">$${totalIVA.toFixed(2)}</div>
    </div>
    <div class="total-card dark">
      <div class="tc-label">Total IGTF (3%)</div>
      <div class="tc-value">$${totalIGTF.toFixed(2)}</div>
    </div>
  </div>
  <div style="text-align:right;padding:14px 20px;background:#0f172a;color:white;margin-bottom:20px">
    <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8">TOTAL GENERAL VENTAS (USD) </span>
    <span style="font-size:22px;font-weight:900;font-family:'Courier New',monospace;margin-left:16px">$${totalFinal.toFixed(2)}</span>
  </div>

  <div class="page-footer">
    <span>Keymaster ERP — ${empresa.nombre || 'Automotores Guaicaipuro C.A.'}</span>
    <span>Libro de Ventas — ${periodo}</span>
    <span>RIF: ${empresa.rif || 'J-XXXXXXXXX-X'}</span>
  </div>
</body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  setTimeout(() => w.print(), 400)
}

// ─── 2. LIBRO DE COMPRAS SENIAT ──────────────────────────
export function printLibroCompras(compras, periodo, empresa = {}) {
  const rows = compras.map((c, idx) => {
    const base = c.base_imponible || (c.total_usd / 1.16)
    const iva = c.iva || (c.total_usd - base)
    const isEven = idx % 2 === 0
    return `< tr style = "background:${isEven ? '#fafbfc' : '#fff'}" >
      <td class="rif">${new Date(c.fecha).toLocaleDateString('es-VE')}</td>
      <td class="nota">${c.nro_factura || '—'}</td>
      <td>${(c.proveedor_nombre || c.proveedor || 'PROVEEDOR').toUpperCase()}</td>
      <td class="rif">${c.proveedor_rif || 'J-XXXXXXXXX-X'}</td>
      <td class="num">$${base.toFixed(2)}</td>
      <td class="num" style="color:#0d9488">$${iva.toFixed(2)}</td>
      <td class="num" style="font-weight:900;color:#0f172a">$${c.total_usd.toFixed(2)}</td>
    </tr > `
  }).join('')

  const totalBase = compras.reduce((s, c) => s + (c.base_imponible || c.total_usd / 1.16), 0)
  const totalIVA = compras.reduce((s, c) => s + (c.iva || c.total_usd - (c.base_imponible || c.total_usd / 1.16)), 0)
  const totalFinal = compras.reduce((s, c) => s + c.total_usd, 0)

  const html = `< !DOCTYPE html > <html><head><style>${SENIAT_STYLES}</style></head><body>
  ${seniatHeader(empresa)}

  <div class="libro-header">
    <div>
      <div class="libro-title">📗 Libro de Compras — Período ${periodo}</div>
      <div class="libro-sub">Art. 70 Ley IVA — Créditos fiscales y facturas de proveedores</div>
    </div>
    <div class="libro-badge">${compras.length} REGISTROS</div>
  </div>

  <div class="legal-note">
    ⚠️  <span>Registro de créditos fiscales soportados. Conforme al Artículo 70 de la <strong>Ley del IVA</strong>. Solo son deducibles las facturas que cumplan los requisitos formales exigidos por el SENIAT.</span>
  </div>

  <table>
    <thead><tr>
      <th>FECHA</th><th>Nº FACTURA</th><th>PROVEEDOR</th><th>RIF PROVEEDOR</th>
      <th style="text-align:right">BASE IMP. ($)</th>
      <th style="text-align:right">IVA SOPORT. 16% ($)</th>
      <th style="text-align:right">TOTAL ($)</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totales-grid">
    <div class="total-card dark">
      <div class="tc-label">Total Base Imponible</div>
      <div class="tc-value">$${totalBase.toFixed(2)}</div>
    </div>
    <div class="total-card teal">
      <div class="tc-label">Total IVA Crédito Fiscal (16%)</div>
      <div class="tc-value teal">$${totalIVA.toFixed(2)}</div>
    </div>
    <div class="total-card dark">
      <div class="tc-label">Total Compras Período</div>
      <div class="tc-value">$${totalFinal.toFixed(2)}</div>
    </div>
  </div>

  <div class="page-footer">
    <span>Keymaster ERP — ${empresa.nombre || 'Automotores Guaicaipuro C.A.'}</span>
    <span>Libro de Compras — ${periodo}</span>
    <span>RIF: ${empresa.rif || 'J-XXXXXXXXX-X'}</span>
  </div>
</body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  setTimeout(() => w.print(), 400)
}

// ─── 3. LIBRO DE INVENTARIO VALORADO ─────────────────────
export function printLibroInventarioValorado(articulos, periodo, empresa = {}) {
  const rows = articulos.map((a, idx) => {
    const valorCosto = (a.stock || 0) * (a.costo || 0)
    const valorPrecio = (a.stock || 0) * (a.precio || 0)
    const margen = a.precio > 0 ? (((a.precio - a.costo) / a.precio) * 100).toFixed(1) : '0.0'
    const isEven = idx % 2 === 0
    return `< tr style = "background:${isEven ? '#fafbfc' : '#fff'}" >
      <td class="nota">${a.codigo || '—'}</td>
      <td style="font-weight:600">${(a.descripcion || '').toUpperCase()}</td>
      <td style="color:#6b7280;font-size:9px">${a.marca || '—'}</td>
      <td class="num">${a.stock || 0}</td>
      <td class="num">$${(a.costo || 0).toFixed(2)}</td>
      <td class="num">$${(a.precio || 0).toFixed(2)}</td>
      <td class="num" style="color:#0d9488;font-weight:900">$${valorCosto.toFixed(2)}</td>
      <td class="num" style="color:#374151">$${valorPrecio.toFixed(2)}</td>
      <td class="num" style="color:${parseFloat(margen) >= 30 ? '#059669' : parseFloat(margen) >= 15 ? '#d97706' : '#dc2626'}">${margen}%</td>
    </tr > `
  }).join('')

  const totalCosto = articulos.reduce((s, a) => s + (a.stock || 0) * (a.costo || 0), 0)
  const totalPrecio = articulos.reduce((s, a) => s + (a.stock || 0) * (a.precio || 0), 0)
  const totalUnidades = articulos.reduce((s, a) => s + (a.stock || 0), 0)
  const utilidadPotencial = totalPrecio - totalCosto

  const html = `< !DOCTYPE html > <html><head><style>${SENIAT_STYLES}</style></head><body>
  ${seniatHeader(empresa)}

  <div class="libro-header">
    <div>
      <div class="libro-title">📦 Libro de Inventario Valorado — ${periodo}</div>
      <div class="libro-sub">Valoración a costo de adquisición — Control de existencias</div>
    </div>
    <div class="libro-badge">${articulos.length} SKUs</div>
  </div>

  <table>
    <thead><tr>
      <th>CÓDIGO</th><th>DESCRIPCIÓN</th><th>MARCA</th>
      <th style="text-align:right">EXIST.</th>
      <th style="text-align:right">COSTO UNIT.</th>
      <th style="text-align:right">PRECIO VENTA</th>
      <th style="text-align:right">VALOR COSTO</th>
      <th style="text-align:right">VALOR VENTA</th>
      <th style="text-align:right">MARGEN</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totales-grid">
    <div class="total-card dark">
      <div class="tc-label">Total Unidades en Almacén</div>
      <div class="tc-value">${totalUnidades.toLocaleString('es-VE')}</div>
    </div>
    <div class="total-card teal">
      <div class="tc-label">Valor Total a Costo (Activo)</div>
      <div class="tc-value teal">$${totalCosto.toFixed(2)}</div>
    </div>
    <div class="total-card" style="border-color:#7c3aed;background:#faf5ff">
      <div class="tc-label">Utilidad Potencial Estimada</div>
      <div class="tc-value" style="color:#7c3aed">$${utilidadPotencial.toFixed(2)}</div>
    </div>
  </div>

  <div style="text-align:right;padding:14px 20px;background:#0f172a;color:white;margin-bottom:20px">
    <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8">VALOR TOTAL INVENTARIO A PRECIO DE VENTA </span>
    <span style="font-size:22px;font-weight:900;font-family:'Courier New',monospace;margin-left:16px">$${totalPrecio.toFixed(2)}</span>
  </div>

  <div class="page-footer">
    <span>Keymaster ERP — ${empresa.nombre || 'Automotores Guaicaipuro C.A.'}</span>
    <span>Inventario Valorado — ${periodo}</span>
    <span>RIF: ${empresa.rif || 'J-XXXXXXXXX-X'}</span>
  </div>
</body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  setTimeout(() => w.print(), 400)
}

