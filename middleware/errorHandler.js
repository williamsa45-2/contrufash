/**
 * Manejador de errores centralizado. Cualquier next(err) llega aqui.
 */
function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err);

  let status = err.status || 500;
  let mensaje = err.message || 'Error interno del servidor';

  if (err.name === 'ValidationError') {
    status = 400;
    mensaje = Object.values(err.errors)
      .map((e) => e.message)
      .join(' | ');
  }

  if (err.code === 11000) {
    status = 409;
    const campo = Object.keys(err.keyValue || {})[0] || 'campo';
    mensaje = `Ya existe un registro con ese ${campo}.`;
  }

  const esApi = req.path.startsWith('/api') || req.xhr || req.headers.accept === 'application/json';
  if (esApi) {
    return res.status(status).json({ ok: false, mensaje });
  }

  return res.status(status).render('errors/404', {
    title: status === 404 ? 'No encontrado' : 'Algo salio mal',
    mensaje,
    layout: false,
  });
}

function notFoundHandler(req, res) {
  const esApi = req.path.startsWith('/api') || req.xhr;
  if (esApi) {
    return res.status(404).json({ ok: false, mensaje: 'Recurso no encontrado' });
  }
  return res.status(404).render('errors/404', {
    title: 'Pagina no encontrada',
    mensaje: 'La pagina que buscas no existe o fue movida.',
    layout: false,
  });
}

module.exports = { errorHandler, notFoundHandler };
