/**
 * ConstruFash — Registro del Service Worker y gestion de Background Sync.
 * Se incluye en el layout principal (Sprint 3).
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((reg) => {
      console.log('[SW] Registrado. Scope:', reg.scope);

      // Cuando hay actualizacion disponible, notificar al usuario
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            if (window.CF && window.CF.mostrarNotificacion) {
              window.CF.mostrarNotificacion(
                '🔄 Nueva version disponible. Recarga la pagina para actualizar.',
                'info'
              );
            }
          }
        });
      });
    })
    .catch((err) => console.warn('[SW] Error al registrar:', err));

  // Escuchar mensajes del SW (ej: peticion de sync-asistencia por Background Sync)
  navigator.serviceWorker.addEventListener('message', async (event) => {
    if (event.data && event.data.tipo === 'sync-asistencia') {
      if (window.CF && window.CF.sincronizarAsistencia) {
        await window.CF.sincronizarAsistencia();
      }
    }
  });

  // Registrar Background Sync cuando el usuario vuelve a estar online
  window.addEventListener('online', async () => {
    if (!('SyncManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register('sync-asistencia');
    } catch (e) {
      // SyncManager no disponible en todos los navegadores; el sync manual en offline.js cubre el caso
    }
  });
})();
