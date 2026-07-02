const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const Project = require('../models/Project');
const KardexEntry = require('../models/KardexEntry');
const Attendance = require('../models/Attendance');
const Novedad = require('../models/Novedad');
const MaterialRequest = require('../models/MaterialRequest');
const asyncHandler = require('../utils/asyncHandler');

/* ------------------------------------------------------------------ */
/* HELPERS                                                              */
/* ------------------------------------------------------------------ */

function avanceReal(fases) {
  if (!fases.length) return 0;
  const ptf = fases.reduce((s, f) => s + (f.presupuesto_asignado || 0), 0);
  if (!ptf) return Math.round(fases.reduce((s, f) => s + (f.avance_real || 0), 0) / fases.length);
  return Math.round(fases.reduce((s, f) => s + (f.avance_real || 0) * (f.presupuesto_asignado || 0), 0) / ptf);
}

function avancePlan(i, f) {
  const hoy = new Date();
  const ini = new Date(i); const fin = new Date(f);
  if (hoy <= ini) return 0;
  if (hoy >= fin) return 100;
  return Math.round(((hoy - ini) / (fin - ini)) * 100);
}

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO') : '—';

/* ------------------------------------------------------------------ */
/* PDF REPORT                                                           */
/* ------------------------------------------------------------------ */

/**
 * GET /empresa/reportes/:id/pdf
 * Genera un PDF del reporte de avance y materiales del proyecto.
 */
const exportarPDF = asyncHandler(async (req, res) => {
  const proyecto = await Project.findOne({ _id: req.params.id, tenant_id: req.tenant_id }).lean();
  if (!proyecto) return res.status(404).send('Proyecto no encontrado');

  const [saldos, novedades] = await Promise.all([
    KardexEntry.saldosPorProyecto(req.tenant_id, req.params.id),
    Novedad.find({ tenant_id: req.tenant_id, proyecto_id: req.params.id }).lean(),
  ]);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="reporte_${proyecto._id}.pdf"`);

  const doc = new PDFDocument({ margin: 45, size: 'A4' });
  doc.pipe(res);

  const NARANJA = '#E8590C';
  const ASFALTO = '#1C1F23';
  const GRIS    = '#6B7280';
  const LINEA   = '#E4E0D6';

  // --- Encabezado ---
  doc.rect(0, 0, doc.page.width, 56).fill(ASFALTO);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text('CONSTRUFASH', 45, 18);
  doc.fillColor(NARANJA).font('Helvetica').fontSize(9)
     .text('Reporte de Avance y Materiales', 45, 40);
  doc.fillColor('#FFFFFF').fontSize(9)
     .text(new Date().toLocaleDateString('es-CO', { dateStyle: 'long' }), 45, 40, { align: 'right' });

  // Franja naranja
  doc.rect(0, 56, doc.page.width, 5).fill(NARANJA);

  let y = 75;

  // --- Info del proyecto ---
  doc.fillColor(ASFALTO).font('Helvetica-Bold').fontSize(14)
     .text(proyecto.nombre.toUpperCase(), 45, y);
  y += 18;
  doc.fillColor(GRIS).font('Helvetica').fontSize(9)
     .text(`Fecha inicio: ${fmtDate(proyecto.fecha_inicio)}   |   Fecha fin: ${fmtDate(proyecto.fecha_fin)}   |   Presupuesto: ${fmt.format(proyecto.presupuesto_total)}`, 45, y);
  y += 14;

  const ar = avanceReal(proyecto.fases);
  const ap = avancePlan(proyecto.fecha_inicio, proyecto.fecha_fin);
  doc.fillColor(ASFALTO).font('Helvetica-Bold').fontSize(10)
     .text(`Avance real: ${ar}%   |   Avance planificado: ${ap}%`, 45, y);
  y += 20;
  doc.moveTo(45, y).lineTo(doc.page.width - 45, y).strokeColor(LINEA).lineWidth(1).stroke();
  y += 12;

  // --- Fases ---
  doc.fillColor(NARANJA).font('Helvetica-Bold').fontSize(11).text('CRONOGRAMA DE FASES', 45, y);
  y += 14;

  const colW = [170, 75, 75, 65, 65, 70];
  const cols = [45, 215, 290, 365, 430, 495];
  const headers = ['Fase', 'Inicio', 'Fin', 'Plan %', 'Real %', 'Estado'];

  doc.rect(45, y, doc.page.width - 90, 16).fill('#F6F4EF');
  headers.forEach((h, i) => {
    doc.fillColor(GRIS).font('Helvetica-Bold').fontSize(8).text(h, cols[i], y + 4, { width: colW[i] });
  });
  y += 16;

  [...proyecto.fases].sort((a, b) => a.orden - b.orden).forEach((f) => {
    if (y > 730) { doc.addPage(); y = 45; }
    doc.moveTo(45, y).lineTo(doc.page.width - 45, y).strokeColor(LINEA).lineWidth(0.5).stroke();
    const fp = avancePlan(f.fecha_inicio, f.fecha_fin);
    const fr = f.avance_real || 0;
    const datos = [f.nombre, fmtDate(f.fecha_inicio), fmtDate(f.fecha_fin), `${fp}%`, `${fr}%`, f.estado.replace('_',' ')];
    datos.forEach((d, i) => {
      doc.fillColor(i === 4 && fr < fp ? '#C53030' : ASFALTO)
         .font('Helvetica').fontSize(8)
         .text(d, cols[i], y + 4, { width: colW[i] });
    });
    y += 16;
  });

  y += 16;

  // --- Kardex / Saldos ---
  if (saldos.length) {
    if (y > 650) { doc.addPage(); y = 45; }
    doc.moveTo(45, y).lineTo(doc.page.width - 45, y).strokeColor(LINEA).lineWidth(1).stroke();
    y += 12;
    doc.fillColor(NARANJA).font('Helvetica-Bold').fontSize(11).text('KARDEX DE MATERIALES (SALDOS)', 45, y);
    y += 14;

    const kCols = [45, 215, 280, 345, 415];
    const kW    = [165, 60, 60, 65, 130];
    const kHead = ['Material', 'Unidad', 'Entradas', 'Salidas', 'Saldo actual'];
    doc.rect(45, y, doc.page.width - 90, 16).fill('#F6F4EF');
    kHead.forEach((h, i) => {
      doc.fillColor(GRIS).font('Helvetica-Bold').fontSize(8).text(h, kCols[i], y + 4, { width: kW[i] });
    });
    y += 16;

    saldos.forEach((s) => {
      if (y > 730) { doc.addPage(); y = 45; }
      doc.moveTo(45, y).lineTo(doc.page.width - 45, y).strokeColor(LINEA).lineWidth(0.5).stroke();
      const row = [s.material, s.unidad, s.entradas.toString(), s.salidas.toString(), `${s.saldo} ${s.unidad}`];
      row.forEach((d, i) => {
        doc.fillColor(s.saldo < 0 ? '#C53030' : ASFALTO)
           .font('Helvetica').fontSize(8)
           .text(d, kCols[i], y + 4, { width: kW[i] });
      });
      y += 16;
    });
    y += 10;
  }

  // --- Novedades resumen ---
  if (novedades.length) {
    if (y > 650) { doc.addPage(); y = 45; }
    doc.moveTo(45, y).lineTo(doc.page.width - 45, y).strokeColor(LINEA).lineWidth(1).stroke();
    y += 12;
    doc.fillColor(NARANJA).font('Helvetica-Bold').fontSize(11).text('NOVEDADES DE CAMPO', 45, y);
    y += 14;
    const abiertas = novedades.filter((n) => n.estado === 'abierta').length;
    doc.fillColor(GRIS).font('Helvetica').fontSize(9)
       .text(`Total: ${novedades.length}   |   Abiertas: ${abiertas}   |   Gestionadas: ${novedades.length - abiertas}`, 45, y);
    y += 12;
  }

  // --- Pie de pagina ---
  doc.fontSize(7).fillColor(GRIS)
     .text(`ConstruFash v2.3 · ADSO 3142784 · SENA · Generado el ${new Date().toLocaleString('es-CO')}`,
       45, doc.page.height - 30, { align: 'center' });

  doc.end();
});

/* ------------------------------------------------------------------ */
/* EXCEL REPORT                                                         */
/* ------------------------------------------------------------------ */

/**
 * GET /empresa/reportes/:id/excel
 * Genera un Excel con hojas: Resumen, Fases, Kardex, Asistencia, Novedades, Materiales.
 */
const exportarExcel = asyncHandler(async (req, res) => {
  const proyecto = await Project.findOne({ _id: req.params.id, tenant_id: req.tenant_id }).lean();
  if (!proyecto) return res.status(404).send('Proyecto no encontrado');

  const [saldos, movimientos, asistencias, novedades, solicitudes] = await Promise.all([
    KardexEntry.saldosPorProyecto(req.tenant_id, req.params.id),
    KardexEntry.find({ tenant_id: req.tenant_id, proyecto_id: req.params.id })
      .populate('registrado_por', 'nombre').sort({ creado_en: 1 }).lean(),
    Attendance.find({ tenant_id: req.tenant_id, proyecto_id: req.params.id }).sort({ fecha: -1 }).lean(),
    Novedad.find({ tenant_id: req.tenant_id, proyecto_id: req.params.id })
      .populate('reportado_por', 'nombre').sort({ creado_en: -1 }).lean(),
    MaterialRequest.find({ tenant_id: req.tenant_id, proyecto_id: req.params.id })
      .populate('solicitante_id', 'nombre').populate('despachado_por', 'nombre').sort({ creado_en: -1 }).lean(),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'ConstruFash';
  wb.created = new Date();

  // Estilos reutilizables
  const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C1F23' } };
  const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  const ORANGE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8590C' } };
  const ORANGE_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  const ALT_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F4EF' } };

  function addHeaderRow(ws, headers) {
    const row = ws.addRow(headers);
    row.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE8590C' } } };
    });
    row.height = 20;
    return row;
  }

  function stripAlt(ws) {
    ws.eachRow((row, rn) => {
      if (rn < 3) return;
      if (rn % 2 === 0) row.eachCell((c) => { c.fill = ALT_FILL; });
    });
  }

  // ---- Hoja 1: Resumen ----
  const wsRes = wb.addWorksheet('Resumen');
  wsRes.columns = [{ width: 30 }, { width: 30 }];
  wsRes.addRow(['ConstruFash — Reporte de Proyecto']).font = { bold: true, size: 14 };
  wsRes.addRow([]);
  const infoRows = [
    ['Nombre del proyecto', proyecto.nombre],
    ['Estado', proyecto.estado],
    ['Fecha de inicio', fmtDate(proyecto.fecha_inicio)],
    ['Fecha de fin planificada', fmtDate(proyecto.fecha_fin)],
    ['Presupuesto total', fmt.format(proyecto.presupuesto_total)],
    ['Avance real', `${avanceReal(proyecto.fases)}%`],
    ['Avance planificado', `${avancePlan(proyecto.fecha_inicio, proyecto.fecha_fin)}%`],
    ['Total de fases', proyecto.fases.length],
    ['Novedades abiertas', novedades.filter((n) => n.estado === 'abierta').length],
    ['Materiales despachados', solicitudes.filter((s) => s.estado === 'despachada').length],
    ['Generado el', new Date().toLocaleString('es-CO')],
  ];
  infoRows.forEach(([k, v]) => {
    const row = wsRes.addRow([k, v]);
    row.getCell(1).font = { bold: true };
  });

  // ---- Hoja 2: Fases ----
  const wsFases = wb.addWorksheet('Fases');
  wsFases.columns = [
    { header: '#', width: 5 }, { header: 'Fase', width: 28 },
    { header: 'Inicio', width: 14 }, { header: 'Fin', width: 14 },
    { header: 'Presupuesto', width: 18 }, { header: 'Personal', width: 8 },
    { header: 'Estado', width: 14 }, { header: 'Plan %', width: 10 }, { header: 'Real %', width: 10 },
  ];
  addHeaderRow(wsFases, wsFases.columns.map((c) => c.header));
  [...proyecto.fases].sort((a, b) => a.orden - b.orden).forEach((f, i) => {
    wsFases.addRow([
      i + 1, f.nombre, fmtDate(f.fecha_inicio), fmtDate(f.fecha_fin),
      f.presupuesto_asignado || 0, (f.personal_asignado || []).length,
      f.estado, avancePlan(f.fecha_inicio, f.fecha_fin), f.avance_real || 0,
    ]);
  });
  stripAlt(wsFases);

  // ---- Hoja 3: Kardex Saldos ----
  const wsKardex = wb.addWorksheet('Kardex - Saldos');
  wsKardex.columns = [
    { header: 'Material', width: 30 }, { header: 'Unidad', width: 10 },
    { header: 'Entradas', width: 12 }, { header: 'Salidas', width: 12 },
    { header: 'Saldo', width: 12 }, { header: 'Costo Total (COP)', width: 20 },
  ];
  addHeaderRow(wsKardex, wsKardex.columns.map((c) => c.header));
  saldos.forEach((s) => {
    const row = wsKardex.addRow([s.material, s.unidad, s.entradas, s.salidas, s.saldo, s.costo_total]);
    if (s.saldo < 0) row.getCell(5).font = { color: { argb: 'FFC53030' }, bold: true };
  });
  stripAlt(wsKardex);

  // ---- Hoja 4: Kardex Movimientos ----
  const wsMovs = wb.addWorksheet('Kardex - Movimientos');
  wsMovs.columns = [
    { header: 'Fecha', width: 14 }, { header: 'Tipo', width: 18 },
    { header: 'Material', width: 28 }, { header: 'Unidad', width: 10 },
    { header: 'Cantidad', width: 12 }, { header: 'Costo unit. COP', width: 18 },
    { header: 'Referencia', width: 22 }, { header: 'Registrado por', width: 18 }, { header: 'Observacion', width: 28 },
  ];
  addHeaderRow(wsMovs, wsMovs.columns.map((c) => c.header));
  movimientos.forEach((m) => {
    wsMovs.addRow([
      fmtDate(m.creado_en), m.tipo, m.material, m.unidad, m.cantidad, m.costo_unit || 0,
      m.referencia || '', m.registrado_por ? m.registrado_por.nombre : '—', m.observacion || '',
    ]);
  });
  stripAlt(wsMovs);

  // ---- Hoja 5: Asistencia ----
  const wsAsist = wb.addWorksheet('Asistencia');
  wsAsist.columns = [
    { header: 'Fecha', width: 14 }, { header: 'Fase ID', width: 28 },
    { header: 'Total registros', width: 16 }, { header: 'Presentes', width: 14 },
    { header: '% asistencia', width: 14 }, { header: 'Offline', width: 10 },
  ];
  addHeaderRow(wsAsist, wsAsist.columns.map((c) => c.header));
  asistencias.forEach((a) => {
    const regs = a.registros || [];
    const presentes = regs.filter((r) => r.presente).length;
    const pct = regs.length ? Math.round((presentes / regs.length) * 100) : 0;
    wsAsist.addRow([
      fmtDate(a.fecha), a.fase_id.toString(), regs.length, presentes, `${pct}%`,
      a.sincronizado_desde_offline ? 'Si' : 'No',
    ]);
  });
  stripAlt(wsAsist);

  // ---- Hoja 6: Novedades ----
  const wsNov = wb.addWorksheet('Novedades');
  wsNov.columns = [
    { header: 'Fecha', width: 14 }, { header: 'Tipo', width: 14 },
    { header: 'Descripcion', width: 40 }, { header: 'Estado', width: 14 },
    { header: 'Reportado por', width: 18 }, { header: 'Respuesta Admin', width: 35 },
  ];
  addHeaderRow(wsNov, wsNov.columns.map((c) => c.header));
  novedades.forEach((n) => {
    wsNov.addRow([
      fmtDate(n.creado_en), n.tipo, n.descripcion, n.estado,
      n.reportado_por ? n.reportado_por.nombre : '—', n.respuesta_admin || '',
    ]);
  });
  stripAlt(wsNov);

  // ---- Hoja 7: Solicitudes de materiales ----
  const wsSol = wb.addWorksheet('Solicitudes Materiales');
  wsSol.columns = [
    { header: 'Fecha', width: 14 }, { header: 'Estado', width: 20 },
    { header: 'Solicitante', width: 18 }, { header: 'Items', width: 40 },
    { header: 'Fecha despacho', width: 16 }, { header: 'Razon rechazo', width: 30 },
  ];
  addHeaderRow(wsSol, wsSol.columns.map((c) => c.header));
  solicitudes.forEach((s) => {
    const items = (s.items || []).map((i) => `${i.nombre} x${i.cantidad} ${i.unidad}`).join(' | ');
    wsSol.addRow([
      fmtDate(s.creado_en), s.estado, s.solicitante_id ? s.solicitante_id.nombre : '—',
      items, fmtDate(s.fecha_despacho), s.razon_rechazo || '',
    ]);
  });
  stripAlt(wsSol);

  // Enviar el archivo
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="reporte_${proyecto._id}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

module.exports = { exportarPDF, exportarExcel };
