const { ROLE_LABELS } = require('../utils/roles');

/**
 * Middleware RBAC (SRS RF-05). Uso: router.get('/ruta', auth, rbac('admin_empresa'), controlador)
 * Debe ejecutarse SIEMPRE despues de `auth`, ya que depende de req.user.rol.
 */
function rbac(...rolesPermitidos) {
  return function (req, res, next) {
    if (!req.user) {
      // No deberia ocurrir si rbac() va despues de auth(), pero por seguridad:
      return res.status(401).json({ ok: false, mensaje: 'No autenticado' });
    }

    if (!rolesPermitidos.includes(req.user.rol)) {
      const esApi = req.path.startsWith('/api') || req.xhr;
      const mensaje = `Tu rol (${ROLE_LABELS[req.user.rol] || req.user.rol}) no tiene permiso para acceder a este recurso.`;
      if (esApi) {
        return res.status(403).json({ ok: false, mensaje });
      }
      return res.status(403).render('errors/403', {
        title: 'Acceso denegado',
        mensaje,
        layout: false,
      });
    }

    return next();
  };
}

module.exports = rbac;
