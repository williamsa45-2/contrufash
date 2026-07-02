const Project = require('../models/Project');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Sprint 1 entrega login + RBAC + vistas base para los 6 roles (RF-04, RF-05).
 * Los flujos operativos completos de estos cuatro roles (asistencia, Kardex,
 * evidencias, novedades) se construyen en Sprints 2 y 3 segun el SRS
 * (Apendice B). Por ahora cada panel ya filtra datos reales por tenant_id
 * para que la base quede lista, en vez de ser una pantalla 100% vacia.
 */

// GET /jefe_obra/dashboard
const jefeObraDashboard = asyncHandler(async (req, res) => {
  const proyectos = await Project.find({
    tenant_id: req.tenant_id,
    'fases.personal_asignado': req.user.user_id,
  })
    .select('nombre estado fases fecha_inicio fecha_fin')
    .lean();

  const misFases = [];
  for (const p of proyectos) {
    for (const f of p.fases) {
      if ((f.personal_asignado || []).some((id) => id.toString() === req.user.user_id)) {
        misFases.push({ proyecto: p.nombre, proyectoId: p._id, ...f });
      }
    }
  }

  res.render('jefe_obra/dashboard', {
    title: 'Panel Jefe de Obra',
    misFases,
    totalProyectos: proyectos.length,
  });
});

// GET /bodega/dashboard
const almacenistaDashboard = asyncHandler(async (req, res) => {
  res.render('bodega/dashboard', { title: 'Panel de Bodega' });
});

// GET /construccion/dashboard
const constructorDashboard = asyncHandler(async (req, res) => {
  const proyectos = await Project.find({
    tenant_id: req.tenant_id,
    'fases.personal_asignado': req.user.user_id,
  })
    .select('nombre fases')
    .lean();

  const misTareas = [];
  for (const p of proyectos) {
    for (const f of p.fases) {
      if ((f.personal_asignado || []).some((id) => id.toString() === req.user.user_id)) {
        misTareas.push({ proyecto: p.nombre, ...f });
      }
    }
  }

  res.render('construccion/dashboard', { title: 'Panel Constructor', misTareas });
});

// GET /cliente/dashboard
const clienteDashboard = asyncHandler(async (req, res) => {
  const proyectos = await Project.find({
    tenant_id: req.tenant_id,
    cliente: req.user.user_id,
  })
    .select('nombre estado fecha_inicio fecha_fin presupuesto_total fases')
    .lean();

  res.render('cliente/dashboard', { title: 'Mis proyectos', proyectos });
});

module.exports = { jefeObraDashboard, almacenistaDashboard, constructorDashboard, clienteDashboard };
