const Notificacion = require('../models/Notificacion');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/notificaciones
 * Lista las ultimas 40 notificaciones del usuario autenticado.
 */
const listar = asyncHandler(async (req, res) => {
  const filtro = { destinatario_id: req.user.user_id };
  if (req.user.tenant_id) filtro.tenant_id = req.user.tenant_id;

  const notifs = await Notificacion.find(filtro)
    .sort({ creado_en: -1 })
    .limit(40)
    .lean();
  res.json({ ok: true, notificaciones: notifs });
});

/**
 * GET /api/notificaciones/sin-leer
 * Retorna solo el conteo de notificaciones no leidas (para el badge de la campana).
 */
const conteoSinLeer = asyncHandler(async (req, res) => {
  const filtro = { destinatario_id: req.user.user_id, leida: false };
  if (req.user.tenant_id) filtro.tenant_id = req.user.tenant_id;

  const count = await Notificacion.countDocuments(filtro);
  res.json({ ok: true, count });
});

/**
 * POST /api/notificaciones/marcar-leidas
 * Marca todas las notificaciones del usuario como leidas.
 */
const marcarTodasLeidas = asyncHandler(async (req, res) => {
  await Notificacion.updateMany(
    filtroNotificacionesUsuario(req, { leida: false }),
    { leida: true }
  );
  res.json({ ok: true, mensaje: 'Notificaciones marcadas como leidas' });
});

/**
 * POST /api/notificaciones/:id/leer
 * Marca una notificacion especifica como leida.
 */
const marcarUnaLeida = asyncHandler(async (req, res) => {
  await Notificacion.findOneAndUpdate(
    filtroNotificacionesUsuario(req, { _id: req.params.id }),
    { leida: true }
  );
  res.json({ ok: true });
});

/**
 * DELETE /api/notificaciones/limpiar
 * Elimina las notificaciones leidas del usuario (limpieza manual).
 */
const limpiarLeidas = asyncHandler(async (req, res) => {
  const { deletedCount } = await Notificacion.deleteMany({
    ...filtroNotificacionesUsuario(req),
    leida: true,
  });
  res.json({ ok: true, eliminadas: deletedCount });
});

module.exports = { listar, conteoSinLeer, marcarTodasLeidas, marcarUnaLeida, limpiarLeidas };

function filtroNotificacionesUsuario(req, extra = {}) {
  const filtro = { destinatario_id: req.user.user_id, ...extra };
  if (req.user.tenant_id) filtro.tenant_id = req.user.tenant_id;
  return filtro;
}
