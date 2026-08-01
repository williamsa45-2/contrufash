const Novedad = require('../models/Novedad');
const Project = require('../models/Project');
const { subirImagen } = require('../config/cloudinary');
const { emitirATenant } = require('../config/socket');
const asyncHandler = require('../utils/asyncHandler');

const TIPOS_NOVEDAD = ['retraso', 'bloqueo', 'material', 'seguridad', 'otro'];

/**
 * GET /jefe_obra/proyectos/:proyectoId/fase/:faseId/novedades
 */
const listarNovedades = asyncHandler(async (req, res) => {
  const { proyectoId, faseId } = req.params;
  const proyecto = await Project.findOne({ _id: proyectoId, tenant_id: req.tenant_id }).lean();
  if (!proyecto) return res.status(404).render('errors/404', { title: 'No encontrado', mensaje: 'Proyecto no encontrado', layout: false });
  const fase = proyecto.fases.find((f) => f._id.toString() === faseId);
  if (!fase) return res.status(404).render('errors/404', { title: 'No encontrado', mensaje: 'Fase no encontrada', layout: false });
  if (!faseAsignadaAUsuario(fase, req.user.user_id)) {
    return res.status(403).render('errors/403', {
      title: 'Acceso denegado',
      mensaje: 'No estas asignado a esta fase.',
      layout: false,
    });
  }

  const novedades = await Novedad.find({ proyecto_id: proyectoId, fase_id: faseId, tenant_id: req.tenant_id })
    .sort({ creado_en: -1 })
    .lean();

  res.render('jefe_obra/novedades', {
    title: `Novedades — ${fase.nombre}`,
    proyecto, fase, novedades, TIPOS_NOVEDAD,
    mensaje: req.query.mensaje || null,
    error: req.query.error || null,
  });
});

/**
 * POST /api/novedades
 * Foto de evidencia opcional. Emite 'novedad:nueva' via Socket.io (RNF-02).
 */
const reportar = asyncHandler(async (req, res) => {
  const { proyecto_id, fase_id, tipo, descripcion } = req.body;

  if (!proyecto_id || !fase_id || !tipo || !descripcion) {
    return res.status(400).json({ ok: false, mensaje: 'proyecto_id, fase_id, tipo y descripcion son obligatorios' });
  }

  if (!TIPOS_NOVEDAD.includes(tipo)) {
    return res.status(400).json({ ok: false, mensaje: 'Tipo de novedad no valido' });
  }

  const proyecto = await Project.findOne({ _id: proyecto_id, tenant_id: req.tenant_id }).lean();
  if (!proyecto) return res.status(404).json({ ok: false, mensaje: 'Proyecto no encontrado' });
  const fase = proyecto.fases.find((f) => f._id.toString() === fase_id);
  if (!fase) return res.status(404).json({ ok: false, mensaje: 'Fase no encontrada' });
  if (!faseAsignadaAUsuario(fase, req.user.user_id)) {
    return res.status(403).json({ ok: false, mensaje: 'No estas asignado a esta fase' });
  }

  let evidencia = {};
  if (req.file) {
    try {
      const publicId = `novedad_${fase_id}_${Date.now()}`;
      evidencia = await subirImagen(req.file.buffer, `novedades/${proyecto_id}`, publicId);
    } catch (err) {
      return res.status(500).json({ ok: false, mensaje: 'No se pudo subir la imagen: ' + err.message });
    }
  }

  const novedad = await Novedad.create({
    tenant_id: req.tenant_id,
    proyecto_id,
    fase_id,
    reportado_por: req.user.user_id,
    tipo,
    descripcion: descripcion.trim(),
    evidencia: { url: evidencia.url || null, public_id: evidencia.public_id || null },
  });

  emitirATenant(req.tenant_id, 'novedad:nueva', {
    novedadId: novedad._id,
    tipo,
    proyectoNombre: proyecto.nombre,
    reportadoPor: req.user.nombre,
    descripcion: descripcion.trim().slice(0, 100),
  });

  res.json({ ok: true, novedadId: novedad._id });
});

/**
 * POST /api/novedades/:id/gestionar  — Admin marca la novedad como gestionada
 */
const gestionar = asyncHandler(async (req, res) => {
  const { respuesta } = req.body;
  const novedad = await Novedad.findOne({ _id: req.params.id, tenant_id: req.tenant_id });
  if (!novedad) return res.status(404).json({ ok: false, mensaje: 'Novedad no encontrada' });

  novedad.estado = 'gestionada';
  novedad.respuesta_admin = (respuesta || '').trim();
  novedad.gestionado_por = req.user.user_id;
  novedad.fecha_gestion = new Date();
  await novedad.save();

  res.json({ ok: true, mensaje: 'Novedad marcada como gestionada' });
});

/**
 * GET /empresa/novedades — Admin lista todas las novedades abiertas de su tenant
 */
const listarParaAdmin = asyncHandler(async (req, res) => {
  const novedades = await Novedad.find({ tenant_id: req.tenant_id })
    .populate('reportado_por', 'nombre')
    .populate('proyecto_id', 'nombre')
    .sort({ creado_en: -1 })
    .lean();

  res.render('empresa/novedades', {
    title: 'Novedades de campo',
    novedades,
    TIPOS_NOVEDAD,
    mensaje: req.query.mensaje || null,
  });
});

module.exports = { listarNovedades, reportar, gestionar, listarParaAdmin };

function faseAsignadaAUsuario(fase, userId) {
  return (fase.personal_asignado || []).some((item) => {
    if (!item) return false;
    const id = item._id ? item._id : item;
    return id.toString() === userId;
  });
}
