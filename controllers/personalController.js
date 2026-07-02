const User = require('../models/User');
const { ROLES, ROLE_LABELS } = require('../utils/roles');
const asyncHandler = require('../utils/asyncHandler');

// Roles que el Admin_Empresa puede crear dentro de su tenant
const ROLES_ASIGNABLES = [ROLES.JEFE_OBRA, ROLES.ALMACENISTA, ROLES.CONSTRUCTOR, ROLES.CLIENTE];

// GET /empresa/personal
const listar = asyncHandler(async (req, res) => {
  const personal = await User.find({ tenant_id: req.tenant_id, rol: { $ne: ROLES.ADMIN_EMPRESA } })
    .sort({ creado_en: -1 })
    .lean();

  res.render('empresa/personal', {
    title: 'Personal',
    personal,
    ROLE_LABELS,
    mensaje: req.query.mensaje || null,
    error: req.query.error || null,
  });
});

// GET /empresa/personal/nuevo
const mostrarFormulario = (req, res) => {
  res.render('empresa/nuevo-personal', {
    title: 'Nuevo integrante',
    error: null,
    formData: {},
    ROLES_ASIGNABLES,
    ROLE_LABELS,
  });
};

// POST /empresa/personal
const crear = asyncHandler(async (req, res) => {
  const { nombre, email, password, rol, telefono } = req.body;
  const formData = req.body;

  if (!nombre || !email || !password || !rol) {
    return res.status(400).render('empresa/nuevo-personal', {
      title: 'Nuevo integrante',
      error: 'Nombre, email, contrasena y rol son obligatorios.',
      formData,
      ROLES_ASIGNABLES,
      ROLE_LABELS,
    });
  }

  if (!ROLES_ASIGNABLES.includes(rol)) {
    return res.status(400).render('empresa/nuevo-personal', {
      title: 'Nuevo integrante',
      error: 'Rol no valido para este panel.',
      formData,
      ROLES_ASIGNABLES,
      ROLE_LABELS,
    });
  }

  if (password.length < 8) {
    return res.status(400).render('empresa/nuevo-personal', {
      title: 'Nuevo integrante',
      error: 'La contrasena debe tener al menos 8 caracteres.',
      formData,
      ROLES_ASIGNABLES,
      ROLE_LABELS,
    });
  }

  try {
    const nuevo = new User({ nombre, email, rol, telefono, tenant_id: req.tenant_id });
    nuevo.password = password;
    await nuevo.save();
  } catch (err) {
    return res.status(400).render('empresa/nuevo-personal', {
      title: 'Nuevo integrante',
      error: err.code === 11000 ? 'Ya existe un usuario con ese email.' : err.message,
      formData,
      ROLES_ASIGNABLES,
      ROLE_LABELS,
    });
  }

  res.redirect(`/empresa/personal?mensaje=${encodeURIComponent(`${nombre} fue agregado como ${ROLE_LABELS[rol]}`)}`);
});

// POST /empresa/personal/:id/estado  (toggle activo/inactivo)
const cambiarEstado = asyncHandler(async (req, res) => {
  const usuario = await User.findOne({ _id: req.params.id, tenant_id: req.tenant_id });
  if (!usuario) {
    return res.redirect(`/empresa/personal?error=${encodeURIComponent('Usuario no encontrado')}`);
  }
  usuario.estado = usuario.estado === 'activo' ? 'inactivo' : 'activo';
  await usuario.save();
  res.redirect(`/empresa/personal?mensaje=${encodeURIComponent(`${usuario.nombre} ahora esta ${usuario.estado}`)}`);
});

module.exports = { listar, mostrarFormulario, crear, cambiarEstado, ROLES_ASIGNABLES };
