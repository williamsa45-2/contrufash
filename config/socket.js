/**
 * Socket.io - Notificaciones en tiempo real (SAD Stack Tecnologico / RNF-02).
 *
 * Cada usuario se une a una sala con nombre igual a su tenant_id al conectar.
 * Los controladores emiten eventos a esa sala para que solo los usuarios de
 * la misma empresa reciban la notificacion (aislamiento multitenant).
 *
 * Eventos definidos en Sprint 2:
 *   'novedad:nueva'        - Jefe de Obra reporta un retraso o bloqueo
 *   'material:solicitado'  - Jefe de Obra solicita materiales al Admin
 *   'material:aprobado'    - Admin aprueba una solicitud (notifica al Almacenista)
 *   'material:despachado'  - Almacenista confirma despacho (notifica al Jefe de Obra)
 *   'fase:avance'          - Jefe de Obra actualiza avance de una fase
 */

let _io = null;

function initSocket(httpServer) {
  const { Server } = require('socket.io');
  _io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  _io.on('connection', (socket) => {
    // El cliente envia su tenant_id al conectar para unirse a la sala correcta
    socket.on('join:tenant', (tenant_id) => {
      if (tenant_id) {
        socket.join(`tenant:${tenant_id}`);
      }
    });
  });

  return _io;
}

/** Devuelve la instancia de io para usarla desde los controladores. */
function getIO() {
  if (!_io) throw new Error('[Socket] initSocket() no ha sido llamado aun');
  return _io;
}

/**
 * Emite un evento a todos los usuarios conectados de un tenant.
 * @param {string} tenant_id
 * @param {string} evento    - nombre del evento Socket.io
 * @param {object} payload   - datos del evento
 */
function emitirATenant(tenant_id, evento, payload) {
  if (!_io || !tenant_id) return;
  _io.to(`tenant:${tenant_id}`).emit(evento, payload);
}

module.exports = { initSocket, getIO, emitirATenant };
