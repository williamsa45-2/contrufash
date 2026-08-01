const Project = require('../models/Project');
const { subirImagen } = require('../config/cloudinary');
const { emitirATenant } = require('../config/socket');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /jefe_obra/proyectos/:proyectoId/fase/:faseId/avance
 * Vista del formulario para actualizar avance + subir evidencia (RF-08).
 */
const mostrarFormAvance = asyncHandler(async (req, res) => {
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

  res.render('jefe_obra/avance', {
    title: `Avance — ${fase.nombre}`,
    proyecto,
    fase,
  });
});

/**
 * POST /api/jefe_obra/proyectos/:proyectoId/fase/:faseId/avance
 * Actualiza avance_real y sube foto de evidencia a Cloudinary.
 * Emite 'fase:avance' via Socket.io al tenant.
 */
const actualizarAvance = asyncHandler(async (req, res) => {
  const { proyectoId, faseId } = req.params;
  const { avance_real, estado } = req.body;

  const proyecto = await Project.findOne({ _id: proyectoId, tenant_id: req.tenant_id });
  if (!proyecto) return res.status(404).json({ ok: false, mensaje: 'Proyecto no encontrado' });

  const fase = proyecto.fases.id(faseId);
  if (!fase) return res.status(404).json({ ok: false, mensaje: 'Fase no encontrada' });
  if (!faseAsignadaAUsuario(fase, req.user.user_id)) {
    return res.status(403).json({ ok: false, mensaje: 'No estas asignado a esta fase' });
  }

  const avanceNum = Math.min(100, Math.max(0, Number(avance_real) || fase.avance_real));
  fase.avance_real = avanceNum;

  if (estado && ['pendiente', 'en_progreso', 'completada'].includes(estado)) {
    // Bloqueo RF-08: no se puede cerrar una fase sin evidencia fotografica
    if (estado === 'completada' && !req.file && !fase.evidencia_url) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Para marcar una fase como completada debes adjuntar al menos una foto de evidencia.',
      });
    }
    fase.estado = estado;
  }

  // Subir foto de evidencia a Cloudinary si se adjunto una
  if (req.file) {
    try {
      const publicId = `fase_${faseId}_${Date.now()}`;
      const { url } = await subirImagen(req.file.buffer, `proyectos/${proyectoId}/fases`, publicId);
      fase.evidencia_url = url;
    } catch (err) {
      return res.status(500).json({ ok: false, mensaje: 'No se pudo subir la imagen a Cloudinary: ' + err.message });
    }
  }

  // Si el proyecto estaba planeado y ahora tiene una fase en progreso, actualizarlo
  if (proyecto.estado === 'planeado' && fase.estado !== 'pendiente') {
    proyecto.estado = 'en_progreso';
  }
  // Si todas las fases estan completadas, cerrar el proyecto
  if (proyecto.fases.every((f) => f.estado === 'completada')) {
    proyecto.estado = 'finalizado';
  }

  await proyecto.save();

  // Notificar en tiempo real al Admin y demas usuarios del tenant
  emitirATenant(req.tenant_id, 'fase:avance', {
    proyectoId,
    faseId,
    nombreFase: fase.nombre,
    avance: fase.avance_real,
    estado: fase.estado,
    actualizadoPor: req.user.nombre,
  });

  res.json({ ok: true, avance: fase.avance_real, estado: fase.estado, evidencia_url: fase.evidencia_url });
});

module.exports = { mostrarFormAvance, actualizarAvance };

function faseAsignadaAUsuario(fase, userId) {
  return (fase.personal_asignado || []).some((item) => {
    if (!item) return false;
    const id = item._id ? item._id : item;
    return id.toString() === userId;
  });
}
