/**
 * Comportamiento global ligero para los paneles EJS.
 * Sprint 1: solo confirmaciones para acciones sensibles (suspender empresa,
 * desactivar usuario). Las interacciones mas ricas (Gantt, formularios
 * dinamicos de fases) viven en sus propios scripts por vista.
 */
document.addEventListener('click', function (e) {
  const el = e.target.closest('[data-confirm]');
  if (!el) return;
  const mensaje = el.getAttribute('data-confirm') || '¿Confirmas esta accion?';
  if (!window.confirm(mensaje)) {
    e.preventDefault();
  }
});
