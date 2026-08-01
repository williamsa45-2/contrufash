const Project      = require('../models/Project');
const CompliancePhoto = require('../models/CompliancePhoto');
const { subirImagen }       = require('../config/cloudinary');
const { crearNotificacion } = require('../utils/notificaciones');
const asyncHandler = require('../utils/asyncHandler');

/* ------------------------------------------------------------------ */
/* PANEL PRINCIPAL                                                      */
/* ------------------------------------------------------------------ */

/**
 * GET /construccion/dashboard
 * Vista principal del Constructor: fases asignadas con acciones completas.
 */
const dashboard = asyncHandler(async (req, res) => {
  const proyectos = await Project.find({
    tenant_id: req.tenant_id,
    'fases.personal_asignado': req.user.user_id,
  })
    .select('nombre fases fecha_inicio fecha_fin')
    .lean();

  const misFases = [];
  for (const p of proyectos) {
    for (const f of p.fases) {
      const asignado = (f.personal_asignado || []).some(
        (id) => id.toString() === req.user.user_id
      );
      if (asignado) {
        // Cuantas fotos pendientes de revision tiene esta fase de este constructor
        const fotosPendientes = await CompliancePhoto.countDocuments({
          fase_id: f._id,
          constructor_id: req.user.user_id,
          estado: 'pendiente_revision',
        });
        misFases.push({
          proyectoId: p._id,
          proyectoNombre: p.nombre,
          ...f,
          fotosPendientes,
        });
      }
    }
  }

  res.render('construccion/dashboard', {
    title: 'Mis actividades',
    misFases,
  });
});

/* ------------------------------------------------------------------ */
/* FOTOS DE CUMPLIMIENTO                                               */
/* ------------------------------------------------------------------ */

/**
 * GET /construccion/proyectos/:proyectoId/fase/:faseId/fotos
 * Vista de fotos de cumplimiento de esta fase para el constructor.
 */
const mostrarFotos = asyncHandler(async (req, res) => {
  const { proyectoId, faseId } = req.params;

  const proyecto = await Project.findOne({ _id: proyectoId, tenant_id: req.tenant_id }).lean();
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

  const fotos = await CompliancePhoto.find({
    proyecto_id: proyectoId,
    fase_id: faseId,
    constructor_id: req.user.user_id,
  })
    .sort({ creado_en: -1 })
    .lean();

  res.render('construccion/fotos', {
    title: `Mis fotos — ${fase.nombre}`,
    proyecto,
    fase,
    fotos,
    mensaje: req.query.mensaje || null,
  });
});

/**
 * POST /api/construccion/fotos
 * Constructor sube una foto de cumplimiento (RF-14).
 * Notifica al Jefe de Obra via Socket.io + BD.
 */
const subirFoto = asyncHandler(async (req, res) => {
  const { proyecto_id, fase_id, descripcion } = req.body;

  if (!proyecto_id || !fase_id || !descripcion) {
    return res.status(400).json({ ok: false, mensaje: 'proyecto_id, fase_id y descripcion son obligatorios' });
  }
  if (!req.file) {
    return res.status(400).json({ ok: false, mensaje: 'Debes adjuntar una foto' });
  }

  const proyecto = await Project.findOne({ _id: proyecto_id, tenant_id: req.tenant_id }).lean();
  if (!proyecto) return res.status(404).json({ ok: false, mensaje: 'Proyecto no encontrado' });

  const fase = proyecto.fases.find((f) => f._id.toString() === fase_id);
  if (!fase) return res.status(404).json({ ok: false, mensaje: 'Fase no encontrada' });
  if (!faseAsignadaAUsuario(fase, req.user.user_id)) {
    return res.status(403).json({ ok: false, mensaje: 'No estas asignado a esta fase' });
  }

  // Subir a Cloudinary
  let foto = {};
  try {
    const publicId = `cumplimiento_${req.user.user_id}_${Date.now()}`;
    foto = await subirImagen(req.file.buffer, `proyectos/${proyecto_id}/cumplimiento`, publicId);
  } catch (err) {
    return res.status(500).json({ ok: false, mensaje: 'No se pudo subir la imagen: ' + err.message });
  }

  const doc = await CompliancePhoto.create({
    tenant_id: req.tenant_id,
    proyecto_id,
    fase_id,
    constructor_id: req.user.user_id,
    descripcion: descripcion.trim(),
    foto: { url: foto.url, public_id: foto.public_id },
  });

  // Notificar al Jefe de Obra de esta fase
  await crearNotificacion({
    tenant_id: req.tenant_id,
    destinatarios_roles: ['jefe_obra'],
    tipo: 'foto_cumplimiento',
    titulo: `Nueva foto de cumplimiento — ${fase.nombre}`,
    cuerpo: `${req.user.nombre}: ${descripcion.trim()}`,
    url_accion: `/jefe_obra/proyectos/${proyecto_id}/fase/${fase_id}/fotos-constructor`,
    meta: { proyectoId: proyecto_id, faseId: fase_id, fotoId: doc._id },
    evento_socket: 'foto_cumplimiento',
    payload_socket: {
      fotoId: doc._id,
      proyectoNombre: proyecto.nombre,
      faseNombre: fase.nombre,
      constructor: req.user.nombre,
      url: foto.url,
    },
  });

  res.json({ ok: true, fotoId: doc._id, url: foto.url });
});

/* ------------------------------------------------------------------ */
/* ALERTAS AL JEFE DE OBRA                                             */
/* ------------------------------------------------------------------ */

/**
 * POST /api/construccion/alerta
 * Constructor reporta un problema que impide su trabajo (RF-15).
 */
const reportarAlerta = asyncHandler(async (req, res) => {
  const { proyecto_id, fase_id, mensaje } = req.body;

  if (!proyecto_id || !fase_id || !mensaje) {
    return res.status(400).json({ ok: false, mensaje: 'proyecto_id, fase_id y mensaje son obligatorios' });
  }

  const proyecto = await Project.findOne({ _id: proyecto_id, tenant_id: req.tenant_id }).lean();
  if (!proyecto) return res.status(404).json({ ok: false, mensaje: 'Proyecto no encontrado' });
  const fase = proyecto.fases.find((f) => f._id.toString() === fase_id);
  if (!fase) return res.status(404).json({ ok: false, mensaje: 'Fase no encontrada' });
  if (!faseAsignadaAUsuario(fase, req.user.user_id)) {
    return res.status(403).json({ ok: false, mensaje: 'No estas asignado a esta fase' });
  }

  await crearNotificacion({
    tenant_id: req.tenant_id,
    destinatarios_roles: ['jefe_obra'],
    tipo: 'alerta_constructor',
    titulo: `⚠ Alerta de campo — ${proyecto.nombre}`,
    cuerpo: `${req.user.nombre}: ${mensaje.trim()}`,
    url_accion: `/jefe_obra/dashboard`,
    meta: { proyectoId: proyecto_id, faseId: fase_id },
    evento_socket: 'alerta_constructor',
    payload_socket: {
      proyectoNombre: proyecto.nombre,
      constructor: req.user.nombre,
      mensaje: mensaje.trim(),
    },
  });

  res.json({ ok: true, mensaje: 'Alerta enviada al Jefe de Obra' });
});

/* ------------------------------------------------------------------ */
/* JEFE DE OBRA — Revisar fotos del constructor                        */
/* ------------------------------------------------------------------ */

/**
 * GET /jefe_obra/proyectos/:proyectoId/fase/:faseId/fotos-constructor
 * Jefe de Obra ve y aprueba / rechaza fotos de cumplimiento.
 */
const revisarFotos = asyncHandler(async (req, res) => {
  const { proyectoId, faseId } = req.params;

  const proyecto = await Project.findOne({ _id: proyectoId, tenant_id: req.tenant_id }).lean();
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

  const fotos = await CompliancePhoto.find({ proyecto_id: proyectoId, fase_id: faseId })
    .populate('constructor_id', 'nombre')
    .sort({ creado_en: -1 })
    .lean();

  res.render('jefe_obra/fotos-constructor', {
    title: `Fotos de cumplimiento — ${fase.nombre}`,
    proyecto,
    fase,
    fotos,
  });
});

/**
 * POST /api/jefe_obra/fotos/:id/revisar
 * Jefe aprueba o rechaza una foto de cumplimiento.
 */
const revisarFotoAccion = asyncHandler(async (req, res) => {
  const { accion, comentario } = req.body; // accion: 'aprobar' | 'rechazar'

  if (!['aprobar', 'rechazar'].includes(accion)) {
    return res.status(400).json({ ok: false, mensaje: 'accion debe ser aprobar o rechazar' });
  }

  const foto = await CompliancePhoto.findOne({ _id: req.params.id, tenant_id: req.tenant_id });
  if (!foto) return res.status(404).json({ ok: false, mensaje: 'Foto no encontrada' });

  const proyecto = await Project.findOne({ _id: foto.proyecto_id, tenant_id: req.tenant_id }).lean();
  if (!proyecto) return res.status(404).json({ ok: false, mensaje: 'Proyecto no encontrado' });
  const fase = proyecto.fases.find((f) => f._id.toString() === foto.fase_id.toString());
  if (!fase) return res.status(404).json({ ok: false, mensaje: 'Fase no encontrada' });
  if (!faseAsignadaAUsuario(fase, req.user.user_id)) {
    return res.status(403).json({ ok: false, mensaje: 'No estas asignado a esta fase' });
  }

  foto.estado = accion === 'aprobar' ? 'aprobada' : 'rechazada';
  foto.revisado_por = req.user.user_id;
  foto.comentario = (comentario || '').trim();
  foto.fecha_revision = new Date();
  await foto.save();

  // Notificar al constructor
  await crearNotificacion({
    tenant_id: req.tenant_id,
    destinatario_id: foto.constructor_id,
    tipo: accion === 'aprobar' ? 'foto_cumplimiento' : 'alerta_constructor',
    titulo: accion === 'aprobar' ? '✅ Foto aprobada' : '❌ Foto rechazada — requiere corrección',
    cuerpo: comentario ? `Comentario del Jefe: ${comentario}` : '',
    url_accion: `/construccion/proyectos/${foto.proyecto_id}/fase/${foto.fase_id}/fotos`,
    evento_socket: 'foto_revisada',
    payload_socket: { accion, comentario, fotoId: foto._id },
  });

  res.json({ ok: true, estado: foto.estado });
});

module.exports = {
  dashboard,
  mostrarFotos,
  subirFoto,
  reportarAlerta,
  revisarFotos,
  revisarFotoAccion,
};

function faseAsignadaAUsuario(fase, userId) {
  return (fase.personal_asignado || []).some((item) => {
    if (!item) return false;
    const id = item._id ? item._id : item;
    return id.toString() === userId;
  });
}
