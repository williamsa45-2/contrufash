const jwt = require('jsonwebtoken');

/**
 * Genera un JWT con user_id, rol y tenant_id (SRS RF-04).
 * @param {{_id: any, rol: string, tenant_id: string|null}} user
 */
function generarToken(user) {
  const payload = {
    user_id: user._id.toString(),
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    tenant_id: user.tenant_id || null,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

function verificarToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { generarToken, verificarToken };
