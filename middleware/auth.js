const { verificarToken } = require('../utils/jwt');

/**
 * Middleware de autenticacion (SRS RF-04, RNF-03).
 *
 * Acepta el token de dos formas:
 *  - Header "Authorization: Bearer <token>" (llamadas fetch/AJAX, localStorage).
 *  - Cookie "token" (navegacion normal entre vistas EJS).
 *
 * El login (ver public/js/auth-client.js) guarda el token en AMBOS sitios:
 * localStorage para las peticiones fetch del propio cliente, y una cookie
 * no-httpOnly para que las cargas de pagina completas (GET /empresa/dashboard,
 * etc.) tambien puedan autenticarse sin tener que convertir todo el panel
 * EJS en una SPA. El SRS (3.3.2) acepta localStorage en el entorno academico;
 * en produccion se recomienda migrar a cookies httpOnly (RNF-03).
 */
function auth(req, res, next) {
  let token = null;

  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return rechazar(req, res, 'No autenticado. Inicia sesion para continuar.');
  }

  try {
    const payload = verificarToken(token);
    req.user = payload; // { user_id, rol, tenant_id }
    res.locals.user = payload;
    return next();
  } catch (err) {
    return rechazar(req, res, 'Tu sesion expiro o el token no es valido. Inicia sesion de nuevo.');
  }
}

function rechazar(req, res, mensaje) {
  const esApi = req.path.startsWith('/api') || req.xhr || req.headers.accept === 'application/json';
  if (esApi) {
    return res.status(401).json({ ok: false, mensaje });
  }
  res.clearCookie('token');
  return res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}`);
}

module.exports = auth;
