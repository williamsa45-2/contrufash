const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /perfil
 * Vista del perfil del usuario autenticado (todos los roles).
 */
const mostrarPerfil = asyncHandler(async (req, res) => {
  const usuario = await User.findById(req.user.user_id)
    .select('-password_hash')
    .lean();

  if (!usuario) return res.status(404).render('errors/404', { title: 'No encontrado', mensaje: 'Usuario no encontrado.', layout: false });

  res.render('perfil/index', {
    title: 'Mi perfil',
    usuario,
    mensaje: req.query.mensaje || null,
    error: req.query.error || null,
  });
});

/**
 * POST /perfil/actualizar
 * Actualiza nombre y telefono del usuario.
 */
const actualizarPerfil = asyncHandler(async (req, res) => {
  const { nombre, telefono } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.redirect('/perfil?error=' + encodeURIComponent('El nombre no puede estar vacío'));
  }

  await User.findByIdAndUpdate(req.user.user_id, {
    nombre: nombre.trim(),
    telefono: (telefono || '').trim(),
  });

  res.redirect('/perfil?mensaje=' + encodeURIComponent('Perfil actualizado correctamente'));
});

/**
 * POST /perfil/cambiar-password
 * Cambia la contraseña verificando la actual primero.
 */
const cambiarPassword = asyncHandler(async (req, res) => {
  const { password_actual, password_nueva, password_confirmar } = req.body;

  if (!password_actual || !password_nueva || !password_confirmar) {
    return res.redirect('/perfil?error=' + encodeURIComponent('Todos los campos de contraseña son obligatorios'));
  }

  if (password_nueva.length < 8) {
    return res.redirect('/perfil?error=' + encodeURIComponent('La nueva contraseña debe tener al menos 8 caracteres'));
  }

  if (password_nueva !== password_confirmar) {
    return res.redirect('/perfil?error=' + encodeURIComponent('La nueva contraseña y la confirmación no coinciden'));
  }

  const usuario = await User.findById(req.user.user_id).select('+password_hash');
  if (!usuario) return res.status(404).send('Usuario no encontrado');

  const correcta = await usuario.compararPassword(password_actual);
  if (!correcta) {
    return res.redirect('/perfil?error=' + encodeURIComponent('La contraseña actual es incorrecta'));
  }

  usuario.password = password_nueva;
  await usuario.save();

  // Forzar re-login limpiando la cookie para que el JWT se regenere con datos frescos
  res.clearCookie('token');
  res.redirect('/login?redirect=' + encodeURIComponent('/perfil?mensaje=' + encodeURIComponent('Contraseña cambiada. Inicia sesión de nuevo.')));
});

module.exports = { mostrarPerfil, actualizarPerfil, cambiarPassword };
