/**
 * ConstruFash — Módulo offline + notificaciones en tiempo real (Sprint 2)
 * SAD DA-03 (Offline-First) + RNF-02 (Notificaciones)
 *
 * Depende de (CDN incluido en el layout):
 *   - Dexie.js    https://unpkg.com/dexie@latest/dist/dexie.min.js
 *   - Socket.io   /socket.io/socket.io.js  (servido automaticamente por el servidor)
 */

/* =========================================================================
   1. DEXIE — Base de datos local IndexedDB
   ========================================================================= */
const db = new Dexie('ConstruFashOffline');

db.version(1).stores({
  asistencia: '++id, proyecto_id, fase_id, fecha, sincronizado',
});

/**
 * Guarda un registro de asistencia local (Write-Through, SAD 3.2).
 * Siempre escribe en Dexie primero; luego intenta subir al servidor.
 */
async function guardarAsistenciaLocal(payload) {
  const id = await db.asistencia.add({
    ...payload,
    sincronizado: false,
    timestamp_cliente: new Date().toISOString(),
  });
  return id;
}

/**
 * Sincroniza todos los registros de asistencia pendientes con el servidor.
 * Se llama automaticamente cuando el browser detecta que volvio la red.
 */
async function sincronizarAsistencia() {
  const pendientes = await db.asistencia.where('sincronizado').equals(0).toArray();
  if (!pendientes.length) return;

  const token = localStorage.getItem('cf_token') || '';

  try {
    const res = await fetch('/api/asistencia/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ registros: pendientes }),
    });

    if (!res.ok) throw new Error('Respuesta no OK del servidor');

    const data = await res.json();
    const sincronizados = (data.resultados || [])
      .filter((r) => r.estado === 'sincronizado')
      .map((r) => r.fase_id);

    // Marcar como sincronizados en IndexedDB
    for (const r of sincronizados) {
      await db.asistencia.where('fase_id').equals(r).modify({ sincronizado: 1 });
    }

    const total = sincronizados.length;
    if (total > 0) {
      mostrarNotificacion(`✓ ${total} registro(s) de asistencia sincronizados`, 'success');
    }
  } catch (err) {
    console.warn('[Offline] Fallo la sincronizacion de asistencia:', err.message);
  }
}

/* =========================================================================
   2. INDICADOR DE ESTADO DE RED
   ========================================================================= */
function actualizarIndicadorRed() {
  const banner = document.getElementById('cf-offline-banner');
  if (!banner) return;
  if (navigator.onLine) {
    banner.style.display = 'none';
  } else {
    banner.style.display = 'flex';
  }
}

window.addEventListener('online', () => {
  actualizarIndicadorRed();
  sincronizarAsistencia();
});

window.addEventListener('offline', actualizarIndicadorRed);

document.addEventListener('DOMContentLoaded', actualizarIndicadorRed);

/* =========================================================================
   3. SOCKET.IO — Notificaciones en tiempo real (RNF-02)
   ========================================================================= */
(function iniciarSocket() {
  if (typeof io === 'undefined') return; // Socket.io no disponible

  const socket = io({ transports: ['websocket', 'polling'] });

  // Unirse a la sala del tenant para recibir notificaciones contextualizadas
  const tenantId = document.body.dataset.tenantId;
  if (tenantId) {
    socket.emit('join:tenant', tenantId);
  }

  // --- Eventos que recibe el cliente ---

  socket.on('material:solicitado', (d) => {
    window.dispatchEvent(new Event('cf-notif-nueva'));
    mostrarNotificacion(`📦 Nueva solicitud de materiales — ${d.proyectoNombre} (por ${d.solicitante})`, 'info');
  });

  socket.on('material:aprobado', (d) => {
    window.dispatchEvent(new Event('cf-notif-nueva'));
    mostrarNotificacion(`✅ Materiales aprobados — ${d.proyectoNombre || ''} (por ${d.aprobadoPor})`, 'success');
  });

  socket.on('material:rechazado', (d) => {
    window.dispatchEvent(new Event('cf-notif-nueva'));
    mostrarNotificacion(`❌ Solicitud rechazada — ${d.rechazadoPor}: ${d.razon}`, 'danger');
  });

  socket.on('material:despachado', (d) => {
    window.dispatchEvent(new Event('cf-notif-nueva'));
    mostrarNotificacion(`🚛 Materiales despachados — ${d.proyectoNombre || ''} (por ${d.despachador})`, 'success');
  });

  socket.on('novedad:nueva', (d) => {
    window.dispatchEvent(new Event('cf-notif-nueva'));
    const emoji = { retraso: '⏰', bloqueo: '🚧', material: '📦', seguridad: '⚠️', otro: 'ℹ️' }[d.tipo] || 'ℹ️';
    mostrarNotificacion(`${emoji} Novedad [${d.tipo}] — ${d.proyectoNombre}: ${d.descripcion}`, 'warning');
  });

  socket.on('fase:avance', (d) => {
    window.dispatchEvent(new Event('cf-notif-nueva'));
    mostrarNotificacion(`📊 ${d.nombreFase}: avance actualizado a ${d.avance}% (por ${d.actualizadoPor})`, 'info');
  });

  socket.on('foto_cumplimiento', (d) => {
    window.dispatchEvent(new Event('cf-notif-nueva'));
    mostrarNotificacion(`📷 Nueva foto de cumplimiento — ${d.faseNombre} (${d.constructor})`, 'info');
  });

  socket.on('alerta_constructor', (d) => {
    window.dispatchEvent(new Event('cf-notif-nueva'));
    mostrarNotificacion(`⚠️ Alerta de campo — ${d.proyectoNombre}: ${d.mensaje}`, 'warning');
  });

  socket.on('foto_revisada', (d) => {
    window.dispatchEvent(new Event('cf-notif-nueva'));
    mostrarNotificacion(d.accion === 'aprobar' ? '✅ Tu foto fue aprobada' : '❌ Tu foto fue rechazada — revisa el comentario', d.accion === 'aprobar' ? 'success' : 'danger');
  });
})();

/* =========================================================================
   4. SISTEMA DE NOTIFICACIONES TOAST
   ========================================================================= */
function mostrarNotificacion(mensaje, tipo = 'info') {
  let contenedor = document.getElementById('cf-toasts');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'cf-toasts';
    contenedor.style.cssText =
      'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:340px;';
    document.body.appendChild(contenedor);
  }

  const colores = {
    success: { bg: 'var(--success-100)', border: 'var(--success-600)', text: 'var(--success-600)' },
    danger:  { bg: 'var(--danger-100)',  border: 'var(--danger-600)',  text: 'var(--danger-600)' },
    warning: { bg: 'var(--warning-100)', border: 'var(--warning-600)', text: 'var(--warning-600)' },
    info:    { bg: 'var(--blueprint-100)',border: 'var(--blueprint-500)',text: 'var(--blueprint-500)' },
  };
  const c = colores[tipo] || colores.info;

  const toast = document.createElement('div');
  toast.style.cssText = `
    background:${c.bg}; border:1px solid ${c.border}; color:${c.text};
    padding:11px 14px; border-radius:7px; font-size:0.84rem;
    box-shadow:0 4px 16px rgba(0,0,0,0.12); opacity:0;
    transition:opacity .25s ease; line-height:1.4;
  `;
  toast.textContent = mensaje;
  contenedor.appendChild(toast);

  // Fade in
  requestAnimationFrame(() => { toast.style.opacity = '1'; });

  // Auto-remove after 6s
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 6000);
}

/* Exponer para uso en vistas */
window.CF = { guardarAsistenciaLocal, sincronizarAsistencia, mostrarNotificacion, db };
