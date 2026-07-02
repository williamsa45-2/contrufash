const Attendance = require('../models/Attendance');
const Project = require('../models/Project');
const User = require('../models/User');
const { ROLES } = require('../utils/roles');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /jefe_obra/proyectos/:proyectoId/fase/:faseId/asistencia
 * Vista del pase de lista diario (RF-04).
 */
const mostrarAsistencia = asyncHandler(async (req, res) => {
  const { proyectoId, faseId } = req.params;
  const fechaStr = req.query.fecha || new Date().toISOString().split('T')[0];
  const fecha = new Date(fechaStr);

  const proyecto = await Project.findOne({ _id: proyectoId, tenant_id: req.tenant_id })
    .populate('fases.personal_asignado', 'nombre')
    .lean();
  if (!proyecto) return res.status(404).render('errors/404', { title: 'No encontrado', mensaje: 'Proyecto no encontrado.', layout: false });

  const fase = proyecto.fases.find((f) => f._id.toString() === faseId);
  if (!fase) return res.status(404).render('errors/404', { title: 'No encontrado', mensaje: 'Fase no encontrada.', layout: false });
  if (!faseAsignadaAUsuario(fase, req.user.user_id)) {
    return res.status(403).render('errors/403', {
      title: 'Acceso denegado',
      mensaje: 'No estas asignado a esta fase.',
      layout: false,
    });
  }

  // Buscar si ya hay asistencia registrada ese dia
  const inicio = new Date(fechaStr);
  const fin = new Date(fechaStr);
  fin.setDate(fin.getDate() + 1);

  const asistenciaExistente = await Attendance.findOne({
    proyecto_id: proyectoId,
    fase_id: faseId,
    fecha: { $gte: inicio, $lt: fin },
  }).lean();

  // Constructores asignados a esta fase
  const constructores = (fase.personal_asignado || []).filter(
    (p) => p && p._id
  );

  res.render('jefe_obra/asistencia', {
    title: `Asistencia — ${fase.nombre}`,
    proyecto,
    fase,
    fechaStr,
    constructores,
    asistenciaExistente,
  });
});

/**
 * POST /api/asistencia/guardar  (llamada online normal desde el formulario)
 */
const guardarAsistencia = asyncHandler(async (req, res) => {
  const { proyecto_id, fase_id, fecha, registros } = req.body;

  if (!proyecto_id || !fase_id || !fecha) {
    return res.status(400).json({ ok: false, mensaje: 'proyecto_id, fase_id y fecha son obligatorios' });
  }

  // Verificar que el proyecto pertenece al tenant del jefe
  const proyecto = await Project.findOne({ _id: proyecto_id, tenant_id: req.tenant_id }).lean();
  if (!proyecto) return res.status(404).json({ ok: false, mensaje: 'Proyecto no encontrado' });
  const fase = proyecto.fases.find((f) => f._id.toString() === fase_id);
  if (!fase) return res.status(404).json({ ok: false, mensaje: 'Fase no encontrada' });
  if (!faseAsignadaAUsuario(fase, req.user.user_id)) {
    return res.status(403).json({ ok: false, mensaje: 'No estas asignado a esta fase' });
  }

  const inicio = new Date(fecha);
  const fin = new Date(fecha);
  fin.setDate(fin.getDate() + 1);

  const update = {
    tenant_id: req.tenant_id,
    proyecto_id,
    fase_id,
    jefe_id: req.user.user_id,
    fecha: inicio,
    registros: Array.isArray(registros) ? registros : [],
    sincronizado_desde_offline: false,
  };

  await Attendance.findOneAndUpdate(
    { proyecto_id, fase_id, fecha: { $gte: inicio, $lt: fin } },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({ ok: true, mensaje: 'Asistencia guardada' });
});

/**
 * POST /api/asistencia/sync  (Offline-First: recibe array de registros desde Dexie.js)
 *
 * El cliente PWA llama este endpoint al recuperar la conexion y envía en el
 * body: { registros: [ { proyecto_id, fase_id, fecha, registros: [...] }, ... ] }
 * La logica usa upsert para evitar duplicados si ya llego una version online.
 * Si hay conflicto (timestamp_cliente anterior al documento existente), gana
 * el registro mas reciente. Retorna un resumen de lo sincronizado.
 */
const syncOffline = asyncHandler(async (req, res) => {
  const lote = req.body.registros;
  if (!Array.isArray(lote) || !lote.length) {
    return res.status(400).json({ ok: false, mensaje: 'Se esperaba un array de registros en body.registros' });
  }

  const resultados = [];
  for (const item of lote) {
    try {
      const { proyecto_id, fase_id, fecha, registros, timestamp_cliente } = item;
      const proyecto = await Project.findOne({ _id: proyecto_id, tenant_id: req.tenant_id }).lean();
      if (!proyecto) {
        resultados.push({ fecha, fase_id, estado: 'error', detalle: 'Proyecto no encontrado' });
        continue;
      }
      const fase = proyecto.fases.find((f) => f._id.toString() === fase_id);
      if (!fase || !faseAsignadaAUsuario(fase, req.user.user_id)) {
        resultados.push({ fecha, fase_id, estado: 'error', detalle: 'No estas asignado a esta fase' });
        continue;
      }
      const inicio = new Date(fecha);
      const fin = new Date(fecha);
      fin.setDate(fin.getDate() + 1);

      const existente = await Attendance.findOne({
        proyecto_id,
        fase_id,
        fecha: { $gte: inicio, $lt: fin },
      });

      // Si ya existe un registro online posterior al offline, no sobreescribir
      if (existente && !existente.sincronizado_desde_offline &&
          timestamp_cliente && new Date(timestamp_cliente) < existente.creado_en) {
        resultados.push({ fecha, fase_id, estado: 'ignorado_conflicto' });
        continue;
      }

      await Attendance.findOneAndUpdate(
        { proyecto_id, fase_id, fecha: { $gte: inicio, $lt: fin } },
        {
          tenant_id: req.tenant_id,
          proyecto_id,
          fase_id,
          jefe_id: req.user.user_id,
          fecha: inicio,
          registros: Array.isArray(registros) ? registros : [],
          sincronizado_desde_offline: true,
          timestamp_cliente: timestamp_cliente ? new Date(timestamp_cliente) : null,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      resultados.push({ fecha, fase_id, estado: 'sincronizado' });
    } catch (err) {
      resultados.push({ fecha: item.fecha, fase_id: item.fase_id, estado: 'error', detalle: err.message });
    }
  }

  res.json({ ok: true, resultados });
});

/**
 * GET /api/asistencia/historial/:proyectoId/:faseId
 * Devuelve el historial de asistencia de una fase (ultimos 30 dias).
 */
const historial = asyncHandler(async (req, res) => {
  const { proyectoId, faseId } = req.params;
  const hace30 = new Date();
  hace30.setDate(hace30.getDate() - 30);

  const proyecto = await Project.findOne({ _id: proyectoId, tenant_id: req.tenant_id }).lean();
  if (!proyecto) return res.status(404).json({ ok: false, mensaje: 'Proyecto no encontrado' });
  const fase = proyecto.fases.find((f) => f._id.toString() === faseId);
  if (!fase) return res.status(404).json({ ok: false, mensaje: 'Fase no encontrada' });
  if (!faseAsignadaAUsuario(fase, req.user.user_id)) {
    return res.status(403).json({ ok: false, mensaje: 'No estas asignado a esta fase' });
  }

  const registros = await Attendance.find({
    tenant_id: req.tenant_id,
    proyecto_id: proyectoId,
    fase_id: faseId,
    fecha: { $gte: hace30 },
  })
    .sort({ fecha: -1 })
    .lean();

  res.json({ ok: true, registros });
});

module.exports = { mostrarAsistencia, guardarAsistencia, syncOffline, historial };

function faseAsignadaAUsuario(fase, userId) {
  return (fase.personal_asignado || []).some((id) => id.toString() === userId);
}
