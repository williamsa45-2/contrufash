const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { generarToken, verificarToken } = require('../utils/jwt');
const { ROLE_HOME, ROLES } = require('../utils/roles');
const asyncHandler = require('../utils/asyncHandler');

// GET /login
const mostrarLogin = (req, res) => {
  // Si ya tiene una cookie de sesion valida, lo mandamos directo a su panel
  const token = req.cookies && req.cookies.token;
  if (token) {
    try {
      const payload = verificarToken(token);
      return res.redirect(ROLE_HOME[payload.rol] || '/');
    } catch (e) {
      res.clearCookie('token');
    }
  }
  res.render('auth/login', {
    title: 'Iniciar sesion',
    layout: false,
    error: null,
    redirectTo: req.query.redirect || null,
  });
};

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ ok: false, mensaje: 'Email y contrasena son obligatorios' });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password_hash');
  if (!user) {
    return res.status(401).json({ ok: false, mensaje: 'Credenciales invalidas' });
  }

  if (user.estado !== 'activo') {
    return res.status(403).json({ ok: false, mensaje: 'Tu usuario esta inactivo. Contacta a tu administrador.' });
  }

  // Si pertenece a un tenant (todos los roles excepto super_admin), valida que la empresa siga activa (RF-02)
  if (user.tenant_id && user.rol !== ROLES.SUPER_ADMIN) {
    const tenant = await Tenant.findOne({ tenant_id: user.tenant_id });
    if (!tenant || tenant.estado !== 'activo') {
      return res.status(403).json({
        ok: false,
        mensaje: 'La empresa asociada a tu cuenta esta suspendida. Contacta al Super Admin.',
      });
    }
  }

  const passwordOk = await user.compararPassword(password);
  if (!passwordOk) {
    return res.status(401).json({ ok: false, mensaje: 'Credenciales invalidas' });
  }

  const token = generarToken(user);

  res.json({
    ok: true,
    token,
    user: user.toSafeJSON(),
    redirect: ROLE_HOME[user.rol] || '/',
  });
});

// GET /logout
const logout = (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
};

module.exports = { mostrarLogin, login, logout };
