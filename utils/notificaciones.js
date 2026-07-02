const Notificacion = require('../models/Notificacion');
const User = require('../models/User');
const { emitirATenant } = require('../config/socket');

/**
 * Crea una notificacion persistente para uno o varios destinatarios
 * Y emite el evento Socket.io correspondiente al tenant.
 *
 * @param {object} opts
 * @param {string}   opts.tenant_id
 * @param {string[]} opts.destinatarios_roles  - roles que deben recibir la notif (ej: ['admin_empresa'])
 * @param {string}   [opts.destinatario_id]    - si se conoce el _id especifico del usuario
 * @param {string}   opts.tipo
 * @param {string}   opts.titulo
 * @param {string}   [opts.cuerpo]
 * @param {string}   [opts.url_accion]
 * @param {object}   [opts.meta]
 * @param {string}   [opts.evento_socket]      - nombre del evento Socket.io (si difiere del tipo)
 * @param {object}   [opts.payload_socket]     - payload del evento Socket.io
 */
async function crearNotificacion(opts) {
  const {
    tenant_id,
    destinatarios_roles = [],
    destinatario_id     = null,
    tipo,
    titulo,
    cuerpo = '',
    url_accion = null,
    meta = {},
    evento_socket = tipo,
    payload_socket = {},
  } = opts;

  try {
    let ids = [];

    if (destinatario_id) {
      ids = [destinatario_id];
    } else if (destinatarios_roles.length) {
      const usuarios = await User.find({
        tenant_id,
        rol: { $in: destinatarios_roles },
        estado: 'activo',
      }).select('_id').lean();
      ids = usuarios.map((u) => u._id.toString());
    }

    if (ids.length) {
      const docs = ids.map((uid) => ({
        tenant_id,
        destinatario_id: uid,
        tipo,
        titulo,
        cuerpo,
        url_accion,
        meta,
      }));
      await Notificacion.insertMany(docs, { ordered: false }).catch(() => {});
    }

    // Emitir evento Socket.io al canal del tenant
    emitirATenant(tenant_id, evento_socket, {
      titulo,
      cuerpo,
      url_accion,
      ...payload_socket,
    });
  } catch (err) {
    console.error('[Notificacion] Error al crear:', err.message);
  }
}

module.exports = { crearNotificacion };
