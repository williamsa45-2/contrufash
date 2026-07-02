const Project = require('../models/Project');
const User = require('../models/User');
const { ROLES } = require('../utils/roles');
const asyncHandler = require('../utils/asyncHandler');

// GET /empresa/dashboard
const dashboard = asyncHandler(async (req, res) => {
  const { tenant_id } = req;

  const [proyectos, totalPersonal] = await Promise.all([
    Project.find({ tenant_id }).sort({ creado_en: -1 }).lean(),
    User.countDocuments({ tenant_id, rol: { $ne: ROLES.ADMIN_EMPRESA } }),
  ]);

  const proyectosActivos = proyectos.filter((p) => p.estado === 'en_progreso').length;
  const presupuestoTotal = proyectos.reduce((sum, p) => sum + (p.presupuesto_total || 0), 0);

  res.render('empresa/dashboard', {
    title: 'Panel de la Empresa',
    metricas: {
      totalProyectos: proyectos.length,
      proyectosActivos,
      presupuestoTotal,
      totalPersonal,
    },
    proyectosRecientes: proyectos.slice(0, 5),
  });
});

module.exports = { dashboard };
