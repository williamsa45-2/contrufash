/**
 * Middleware de aislamiento multitenant (SAD DA-01, SRS RF-03 / RNF-04).
 *
 * Se coloca despues de auth() en cualquier ruta de rol "de empresa"
 * (admin_empresa, jefe_obra, almacenista, constructor, cliente).
 * Garantiza que el request trae un tenant_id valido en el JWT y lo deja
 * disponible en req.tenant_id para que los controladores SIEMPRE filtren
 * sus consultas a Mongo por ese campo. Ninguna consulta a una coleccion
 * con datos de empresa deberia ejecutarse sin tenant_id en el filtro.
 */
function tenantScope(req, res, next) {
  if (!req.user || !req.user.tenant_id) {
    const esApi = req.path.startsWith('/api') || req.xhr;
    const mensaje = 'No se pudo determinar la empresa (tenant) asociada a tu usuario.';
    if (esApi) return res.status(403).json({ ok: false, mensaje });
    return res.status(403).render('errors/403', { title: 'Acceso denegado', mensaje, layout: false });
  }
  req.tenant_id = req.user.tenant_id;
  next();
}

module.exports = tenantScope;
