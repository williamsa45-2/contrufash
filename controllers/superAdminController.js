const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Project = require('../models/Project');
const generarTenantId = require('../utils/generarTenantId');
const { ROLES } = require('../utils/roles');
const asyncHandler = require('../utils/asyncHandler');

// GET /super_admin/dashboard
const dashboard = asyncHandler(async (req, res) => {
  const [totalEmpresas, empresasActivas, empresasSuspendidas, totalUsuarios, totalProyectos] = await Promise.all([
    Tenant.countDocuments({}),
    Tenant.countDocuments({ estado: 'activo' }),
    Tenant.countDocuments({ estado: 'suspendido' }),
    User.countDocuments({ rol: { $ne: ROLES.SUPER_ADMIN } }),
    Project.countDocuments({}),
  ]);

  const empresasRecientes = await Tenant.find({}).sort({ creado_en: -1 }).limit(5).lean();

  res.render('super_admin/dashboard', {
    title: 'Panel Super Admin',
    metricas: { totalEmpresas, empresasActivas, empresasSuspendidas, totalUsuarios, totalProyectos },
    empresasRecientes,
  });
});

// GET /super_admin/empresas
const listarEmpresas = asyncHandler(async (req, res) => {
  const empresas = await Tenant.find({}).sort({ creado_en: -1 }).lean();
  res.render('super_admin/empresas', {
    title: 'Empresas registradas',
    empresas,
    mensaje: req.query.mensaje || null,
    error: req.query.error || null,
  });
});

// GET /super_admin/empresas/nueva
const mostrarFormularioEmpresa = (req, res) => {
  res.render('super_admin/nueva-empresa', {
    title: 'Nueva empresa',
    error: null,
    formData: {},
  });
};

/**
 * POST /super_admin/empresas
 * RF-01: Provision de nuevo tenant con estrategia de compensacion (rollback).
 *
 * Pasos en secuencia:
 *   1) Generar tenant_id unico
 *   2) Crear el documento Tenant (empresa)
 *   3) Crear el usuario Admin_Empresa vinculado a ese tenant_id
 * Si el paso 3 falla, se revierte el paso 2 (se elimina el Tenant recien
 * creado) para no dejar registros huerfanos (SRS RNF-05).
 *
 * Nota: no se usan transacciones de Mongo (requieren replica set) para
 * mantener compatibilidad con una instancia local standalone; en su lugar
 * se implementa la compensacion manual paso a paso, tal como exige RNF-05.
 */
const crearEmpresa = asyncHandler(async (req, res) => {
  const { nombre_empresa, nit, contacto_nombre, contacto_email, contacto_telefono, admin_nombre, admin_email, admin_password } = req.body;

  const formData = req.body;

  if (!nombre_empresa || !admin_nombre || !admin_email || !admin_password) {
    return res.status(400).render('super_admin/nueva-empresa', {
      title: 'Nueva empresa',
      error: 'Nombre de la empresa, nombre del admin, email y contrasena son obligatorios.',
      formData,
    });
  }

  if (admin_password.length < 8) {
    return res.status(400).render('super_admin/nueva-empresa', {
      title: 'Nueva empresa',
      error: 'La contrasena del Admin_Empresa debe tener al menos 8 caracteres.',
      formData,
    });
  }

  // Paso 1: generar tenant_id unico
  const tenant_id = await generarTenantId(nombre_empresa);

  // Paso 2: crear el Tenant
  let tenant;
  try {
    tenant = await Tenant.create({
      tenant_id,
      nombre_empresa,
      nit,
      contacto: { nombre: contacto_nombre, email: contacto_email, telefono: contacto_telefono },
      creado_por: req.user.user_id,
    });
  } catch (err) {
    return res.status(400).render('super_admin/nueva-empresa', {
      title: 'Nueva empresa',
      error: `No se pudo crear la empresa: ${err.message}`,
      formData,
    });
  }

  // Paso 3: crear el Admin_Empresa vinculado al nuevo tenant
  try {
    const admin = new User({
      nombre: admin_nombre,
      email: admin_email,
      rol: ROLES.ADMIN_EMPRESA,
      tenant_id,
    });
    admin.password = admin_password;
    await admin.save();
  } catch (err) {
    // --- ROLLBACK (estrategia de compensacion, RNF-05) ---
    await Tenant.deleteOne({ _id: tenant._id });
    return res.status(400).render('super_admin/nueva-empresa', {
      title: 'Nueva empresa',
      error: `No se pudo crear el usuario Admin_Empresa, se revirtio la creacion de la empresa. Detalle: ${err.message}`,
      formData,
    });
  }

  return res.redirect(`/super_admin/empresas?mensaje=${encodeURIComponent(`Empresa "${nombre_empresa}" creada correctamente (tenant_id: ${tenant_id})`)}`);
});

// POST /super_admin/empresas/:tenant_id/suspender
const suspenderEmpresa = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findOneAndUpdate(
    { tenant_id: req.params.tenant_id },
    { estado: 'suspendido' },
    { new: true }
  );
  if (!tenant) {
    return res.redirect(`/super_admin/empresas?error=${encodeURIComponent('Empresa no encontrada')}`);
  }
  res.redirect(`/super_admin/empresas?mensaje=${encodeURIComponent(`Empresa "${tenant.nombre_empresa}" suspendida`)}`);
});

// POST /super_admin/empresas/:tenant_id/activar
const activarEmpresa = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findOneAndUpdate(
    { tenant_id: req.params.tenant_id },
    { estado: 'activo' },
    { new: true }
  );
  if (!tenant) {
    return res.redirect(`/super_admin/empresas?error=${encodeURIComponent('Empresa no encontrada')}`);
  }
  res.redirect(`/super_admin/empresas?mensaje=${encodeURIComponent(`Empresa "${tenant.nombre_empresa}" activada`)}`);
});

module.exports = {
  dashboard,
  listarEmpresas,
  mostrarFormularioEmpresa,
  crearEmpresa,
  suspenderEmpresa,
  activarEmpresa,
};
