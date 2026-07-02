const MaterialRequest = require('../models/MaterialRequest');
const Project = require('../models/Project');
const { subirImagen } = require('../config/cloudinary');
const { emitirATenant } = require('../config/socket');
const { registrarSalidaPorDespacho } = require('./kardexController');
const asyncHandler = require('../utils/asyncHandler');

/* ------------------------------------------------------------------ */
/* JEFE DE OBRA                                                         */
/* ------------------------------------------------------------------ */

/**
 * GET /jefe_obra/proyectos/:proyectoId/fase/:faseId/materiales/nuevo
 */
const mostrarFormSolicitud = asyncHandler(async (req, res) => {
  const proyecto = await Project.findOne({ _id: req.params.proyectoId, tenant_id: req.tenant_id }).lean();
  if (!proyecto) return res.status(404).render('errors/404', { title: 'No encontrado', mensaje: 'Proyecto no encontrado', layout: false });
  const fase = proyecto.fases.find((f) => f._id.toString() === req.params.faseId);
  if (!fase) return res.status(404).render('errors/404', { title: 'No encontrado', mensaje: 'Fase no encontrada', layout: false });
  if (!faseAsignadaAUsuario(fase, req.user.user_id)) {
    return res.status(403).render('errors/403', {
      title: 'Acceso denegado',
      mensaje: 'No estas asignado a esta fase.',
      layout: false,
    });
  }

  const solicitudes = await MaterialRequest.find({
    proyecto_id: req.params.proyectoId,
    fase_id: req.params.faseId,
    tenant_id: req.tenant_id,
  })
    .sort({ creado_en: -1 })
    .limit(10)
    .lean();

  res.render('jefe_obra/materiales', {
    title: `Materiales — ${fase.nombre}`,
    proyecto,
    fase,
    solicitudes,
    error: req.query.error || null,
    mensaje: req.query.mensaje || null,
  });
});

/**
 * POST /api/materiales/solicitar
 * Crea la solicitud y notifica al Admin por Socket.io (RF-09).
 */
const crearSolicitud = asyncHandler(async (req, res) => {
  const { proyecto_id, fase_id, items_json, observacion } = req.body;

  let items;
  try {
    items = JSON.parse(items_json || '[]');
  } catch {
    return res.status(400).json({ ok: false, mensaje: 'Lista de items invalida' });
  }

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ ok: false, mensaje: 'Agrega al menos un material a la solicitud' });
  }

  for (const it of items) {
    if (!it.nombre || !it.cantidad || it.cantidad < 1) {
      return res.status(400).json({ ok: false, mensaje: 'Cada material necesita nombre y cantidad mayor a 0' });
    }
  }

  const proyecto = await Project.findOne({ _id: proyecto_id, tenant_id: req.tenant_id }).lean();
  if (!proyecto) return res.status(404).json({ ok: false, mensaje: 'Proyecto no encontrado' });
  const fase = proyecto.fases.find((f) => f._id.toString() === fase_id);
  if (!fase) return res.status(404).json({ ok: false, mensaje: 'Fase no encontrada' });
  if (!faseAsignadaAUsuario(fase, req.user.user_id)) {
    return res.status(403).json({ ok: false, mensaje: 'No estas asignado a esta fase' });
  }

  const solicitud = await MaterialRequest.create({
    tenant_id: req.tenant_id,
    proyecto_id,
    fase_id,
    solicitante_id: req.user.user_id,
    items,
    observacion_solicitud: observacion || '',
  });

  // Notificar al Admin (y a cualquier usuario del tenant que tenga el panel abierto)
  emitirATenant(req.tenant_id, 'material:solicitado', {
    solicitudId: solicitud._id,
    proyectoNombre: proyecto.nombre,
    solicitante: req.user.nombre,
    cantidadItems: items.length,
  });

  res.json({ ok: true, solicitudId: solicitud._id });
});

/* ------------------------------------------------------------------ */
/* ADMIN EMPRESA — Aprobar / Rechazar                                   */
/* ------------------------------------------------------------------ */

/**
 * GET /empresa/materiales
 * Lista todas las solicitudes del tenant (con filtro por estado).
 */
const listarParaAdmin = asyncHandler(async (req, res) => {
  const { estado } = req.query;
  const filtro = { tenant_id: req.tenant_id };
  if (estado) filtro.estado = estado;

  const solicitudes = await MaterialRequest.find(filtro)
    .populate('solicitante_id', 'nombre')
    .populate('proyecto_id', 'nombre')
    .sort({ creado_en: -1 })
    .lean();

  res.render('empresa/materiales', {
    title: 'Solicitudes de materiales',
    solicitudes,
    estadoFiltro: estado || 'todos',
    mensaje: req.query.mensaje || null,
    error: req.query.error || null,
  });
});

/**
 * POST /api/materiales/:id/aprobar
 */
const aprobar = asyncHandler(async (req, res) => {
  const solicitud = await MaterialRequest.findOne({ _id: req.params.id, tenant_id: req.tenant_id })
    .populate('proyecto_id', 'nombre');
  if (!solicitud) return res.status(404).json({ ok: false, mensaje: 'Solicitud no encontrada' });

  if (solicitud.estado !== 'pendiente_aprobacion') {
    return res.status(400).json({ ok: false, mensaje: `La solicitud ya esta en estado "${solicitud.estado}"` });
  }

  solicitud.estado = 'aprobada';
  solicitud.aprobado_por = req.user.user_id;
  solicitud.fecha_aprobacion = new Date();
  await solicitud.save();

  emitirATenant(req.tenant_id, 'material:aprobado', {
    solicitudId: solicitud._id,
    proyectoNombre: solicitud.proyecto_id?.nombre,
    aprobadoPor: req.user.nombre,
  });

  res.json({ ok: true, mensaje: 'Solicitud aprobada. El almacenista fue notificado.' });
});

/**
 * POST /api/materiales/:id/rechazar
 */
const rechazar = asyncHandler(async (req, res) => {
  const { razon } = req.body;
  if (!razon || !razon.trim()) {
    return res.status(400).json({ ok: false, mensaje: 'La razon del rechazo es obligatoria' });
  }

  const solicitud = await MaterialRequest.findOne({ _id: req.params.id, tenant_id: req.tenant_id });
  if (!solicitud) return res.status(404).json({ ok: false, mensaje: 'Solicitud no encontrada' });

  solicitud.estado = 'rechazada';
  solicitud.aprobado_por = req.user.user_id;
  solicitud.fecha_aprobacion = new Date();
  solicitud.razon_rechazo = razon.trim();
  await solicitud.save();

  emitirATenant(req.tenant_id, 'material:rechazado', {
    solicitudId: solicitud._id,
    razon: razon.trim(),
    rechazadoPor: req.user.nombre,
  });

  res.json({ ok: true, mensaje: 'Solicitud rechazada.' });
});

/* ------------------------------------------------------------------ */
/* ALMACENISTA — Despacho con foto obligatoria (RF-12)                 */
/* ------------------------------------------------------------------ */

/**
 * GET /bodega/materiales
 */
const listarParaAlmacenista = asyncHandler(async (req, res) => {
  const pendientes = await MaterialRequest.find({
    tenant_id: req.tenant_id,
    estado: 'aprobada',
  })
    .populate('solicitante_id', 'nombre')
    .populate('proyecto_id', 'nombre')
    .sort({ fecha_aprobacion: 1 })
    .lean();

  const historial = await MaterialRequest.find({
    tenant_id: req.tenant_id,
    estado: { $in: ['despachada', 'rechazada'] },
  })
    .populate('solicitante_id', 'nombre')
    .populate('proyecto_id', 'nombre')
    .sort({ creado_en: -1 })
    .limit(20)
    .lean();

  res.render('bodega/materiales', {
    title: 'Panel de materiales',
    pendientes,
    historial,
    mensaje: req.query.mensaje || null,
    error: req.query.error || null,
  });
});

/**
 * POST /api/materiales/:id/despachar
 * Requiere foto de evidencia de entrega (RF-12).
 * Encadenado con upload.single('foto') + comprimirImagen en la ruta.
 */
const despachar = asyncHandler(async (req, res) => {
  const solicitud = await MaterialRequest.findOne({ _id: req.params.id, tenant_id: req.tenant_id })
    .populate('proyecto_id', 'nombre');
  if (!solicitud) return res.status(404).json({ ok: false, mensaje: 'Solicitud no encontrada' });

  if (solicitud.estado !== 'aprobada') {
    return res.status(400).json({ ok: false, mensaje: 'Solo se pueden despachar solicitudes aprobadas' });
  }

  if (!req.file) {
    return res.status(400).json({ ok: false, mensaje: 'La foto de evidencia de entrega es obligatoria (RF-12)' });
  }

  // Subir foto a Cloudinary
  let evidencia = {};
  try {
    const publicId = `despacho_${solicitud._id}_${Date.now()}`;
    evidencia = await subirImagen(req.file.buffer, `materiales/${solicitud.proyecto_id?._id}`, publicId);
  } catch (err) {
    return res.status(500).json({ ok: false, mensaje: 'No se pudo subir la evidencia: ' + err.message });
  }

  solicitud.estado = 'despachada';
  solicitud.despachado_por = req.user.user_id;
  solicitud.fecha_despacho = new Date();
  solicitud.evidencia_entrega = { url: evidencia.url, public_id: evidencia.public_id };
  solicitud.observacion_despacho = (req.body.observacion || '').trim();
  await solicitud.save();

  // Registrar salida automatica en el kardex (RF-13, Sprint 3)
  await registrarSalidaPorDespacho(req.tenant_id, solicitud, req.user.user_id);

  emitirATenant(req.tenant_id, 'material:despachado', {
    solicitudId: solicitud._id,
    proyectoNombre: solicitud.proyecto_id?.nombre,
    despachador: req.user.nombre,
    evidenciaUrl: evidencia.url,
  });

  res.json({ ok: true, mensaje: 'Materiales despachados con evidencia registrada.' });
});

module.exports = {
  mostrarFormSolicitud,
  crearSolicitud,
  listarParaAdmin,
  aprobar,
  rechazar,
  listarParaAlmacenista,
  despachar,
};

function faseAsignadaAUsuario(fase, userId) {
  return (fase.personal_asignado || []).some((id) => id.toString() === userId);
}
