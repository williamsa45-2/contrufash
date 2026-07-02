const Project = require('../models/Project');
const KardexEntry = require('../models/KardexEntry');
const Attendance = require('../models/Attendance');
const Novedad = require('../models/Novedad');
const MaterialRequest = require('../models/MaterialRequest');
const asyncHandler = require('../utils/asyncHandler');

/* ------------------------------------------------------------------ */
/* HELPERS                                                              */
/* ------------------------------------------------------------------ */

function avanceRealPonderado(fases) {
  if (!fases.length) return 0;
  const ptf = fases.reduce((s, f) => s + (f.presupuesto_asignado || 0), 0);
  if (!ptf) return Math.round(fases.reduce((s, f) => s + (f.avance_real || 0), 0) / fases.length);
  return Math.round(fases.reduce((s, f) => s + (f.avance_real || 0) * (f.presupuesto_asignado || 0), 0) / ptf);
}

function avancePlanificado(fechaInicio, fechaFin) {
  const hoy = new Date();
  const ini = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  if (hoy <= ini) return 0;
  if (hoy >= fin) return 100;
  return Math.round(((hoy - ini) / (fin - ini)) * 100);
}

/* ------------------------------------------------------------------ */
/* REPORTE GLOBAL DE EMPRESA                                           */
/* ------------------------------------------------------------------ */

/**
 * GET /empresa/reportes
 * Dashboard de reportes: selector de proyecto + metricas globales.
 */
const dashboardReportes = asyncHandler(async (req, res) => {
  const proyectos = await Project.find({ tenant_id: req.tenant_id })
    .select('nombre estado fecha_inicio fecha_fin presupuesto_total fases')
    .lean();

  // Metricas globales del tenant
  const totalPresupuesto = proyectos.reduce((s, p) => s + (p.presupuesto_total || 0), 0);
  const avancesReales = proyectos.map((p) => avanceRealPonderado(p.fases));
  const avanceGlobal = avancesReales.length
    ? Math.round(avancesReales.reduce((a, b) => a + b, 0) / avancesReales.length)
    : 0;

  const novedadesAbiertas = await Novedad.countDocuments({ tenant_id: req.tenant_id, estado: 'abierta' });
  const solicitudesPendientes = await MaterialRequest.countDocuments({
    tenant_id: req.tenant_id, estado: 'pendiente_aprobacion',
  });

  // Datos para Chart.js: avance por proyecto (bar chart)
  const chartProyectos = {
    labels: proyectos.map((p) => p.nombre.length > 18 ? p.nombre.slice(0, 18) + '…' : p.nombre),
    planificado: proyectos.map((p) => avancePlanificado(p.fecha_inicio, p.fecha_fin)),
    real: proyectos.map((p) => avanceRealPonderado(p.fases)),
  };

  res.render('empresa/reportes', {
    title: 'Reportes',
    proyectos,
    metricas: { totalPresupuesto, avanceGlobal, novedadesAbiertas, solicitudesPendientes },
    chartProyectos,
    proyectoSelId: req.query.proyecto || null,
  });
});

/* ------------------------------------------------------------------ */
/* REPORTE DETALLADO POR PROYECTO (JSON — consumido por Chart.js)      */
/* ------------------------------------------------------------------ */

/**
 * GET /api/reportes/proyecto/:id
 * Retorna JSON con todos los datos del reporte de un proyecto:
 *   - avance por fase (planificado vs real)
 *   - consumo de materiales (entradas vs salidas)
 *   - costos acumulados por fase
 *   - asistencia promedio de los ultimos 30 dias
 *   - novedades por tipo
 */
const reporteProyecto = asyncHandler(async (req, res) => {
  const proyecto = await Project.findOne({ _id: req.params.id, tenant_id: req.tenant_id }).lean();
  if (!proyecto) return res.status(404).json({ ok: false, mensaje: 'Proyecto no encontrado' });

  const [saldos, movimientos, novedades, asistencias] = await Promise.all([
    KardexEntry.saldosPorProyecto(req.tenant_id, req.params.id),
    KardexEntry.find({ tenant_id: req.tenant_id, proyecto_id: req.params.id }).lean(),
    Novedad.find({ tenant_id: req.tenant_id, proyecto_id: req.params.id }).lean(),
    Attendance.find({ tenant_id: req.tenant_id, proyecto_id: req.params.id }).lean(),
  ]);

  // Avance por fase
  const fasesSorted = [...proyecto.fases].sort((a, b) => a.orden - b.orden);
  const avancePorFase = fasesSorted.map((f) => ({
    nombre: f.nombre,
    planificado: avancePlanificado(f.fecha_inicio, f.fecha_fin),
    real: f.avance_real || 0,
    estado: f.estado,
    presupuesto: f.presupuesto_asignado || 0,
  }));

  // Consumo de materiales: top 10 por cantidad despachada
  const consumoPorMaterial = saldos
    .sort((a, b) => b.salidas - a.salidas)
    .slice(0, 10)
    .map((s) => ({
      material: s.material,
      entradas: s.entradas,
      salidas: s.salidas,
      saldo: s.saldo,
      costo_total: s.costo_total,
    }));

  // Costos acumulados por mes (ultimos 6 meses)
  const hace6m = new Date();
  hace6m.setMonth(hace6m.getMonth() - 6);
  const costosPorMes = {};
  movimientos
    .filter((m) => m.tipo === 'entrada' && new Date(m.creado_en) >= hace6m)
    .forEach((m) => {
      const mes = new Date(m.creado_en).toLocaleDateString('es-CO', { year: 'numeric', month: 'short' });
      costosPorMes[mes] = (costosPorMes[mes] || 0) + (m.cantidad * (m.costo_unit || 0));
    });

  // Novedades por tipo
  const novedadesPorTipo = novedades.reduce((acc, n) => {
    acc[n.tipo] = (acc[n.tipo] || 0) + 1;
    return acc;
  }, {});

  // Asistencia promedio (ultimos 30 dias)
  let asistenciaPromedio = 0;
  if (asistencias.length) {
    const totales = asistencias.map((a) => {
      const regs = a.registros || [];
      if (!regs.length) return 0;
      return regs.filter((r) => r.presente).length / regs.length * 100;
    });
    asistenciaPromedio = Math.round(totales.reduce((a, b) => a + b, 0) / totales.length);
  }

  res.json({
    ok: true,
    proyecto: {
      nombre: proyecto.nombre,
      estado: proyecto.estado,
      avanceReal: avanceRealPonderado(proyecto.fases),
      avancePlanificado: avancePlanificado(proyecto.fecha_inicio, proyecto.fecha_fin),
      presupuesto: proyecto.presupuesto_total,
      costoMateriales: movimientos
        .filter((m) => m.tipo === 'entrada')
        .reduce((s, m) => s + (m.cantidad * (m.costo_unit || 0)), 0),
    },
    avancePorFase,
    consumoPorMaterial,
    costosPorMes,
    novedadesPorTipo,
    asistenciaPromedio,
  });
});

module.exports = { dashboardReportes, reporteProyecto };
