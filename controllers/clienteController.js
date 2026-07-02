const Project      = require('../models/Project');
const CompliancePhoto = require('../models/CompliancePhoto');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /cliente/dashboard
 * Panel del cliente: lista de sus proyectos con avance general.
 */
const dashboard = asyncHandler(async (req, res) => {
  const proyectos = await Project.find({
    tenant_id: req.tenant_id,
    cliente: req.user.user_id,
  })
    .select('nombre estado fecha_inicio fecha_fin presupuesto_total fases')
    .lean();

  res.render('cliente/dashboard', { title: 'Mis proyectos', proyectos });
});

/**
 * GET /cliente/proyectos/:id/galeria
 * Galería fotográfica del proyecto organizada por fase (RNF-03, RF-16).
 * Incluye fotos de avance de fase (evidencia_url) + fotos de cumplimiento de constructores.
 */
const galeria = asyncHandler(async (req, res) => {
  const proyecto = await Project.findOne({
    _id: req.params.id,
    tenant_id: req.tenant_id,
    cliente: req.user.user_id,
  }).lean();

  if (!proyecto) {
    return res.status(404).render('errors/404', {
      title: 'No encontrado',
      mensaje: 'Proyecto no encontrado o no tienes acceso.',
      layout: false,
    });
  }

  // Fotos de cumplimiento aprobadas de este proyecto, agrupadas por fase
  const fotosCompliance = await CompliancePhoto.find({
    proyecto_id: req.params.id,
    tenant_id: req.tenant_id,
    estado: 'aprobada',
  })
    .populate('constructor_id', 'nombre')
    .sort({ creado_en: -1 })
    .lean();

  // Agrupar compliance photos por fase_id
  const fotosPorFase = {};
  for (const f of fotosCompliance) {
    const key = f.fase_id.toString();
    if (!fotosPorFase[key]) fotosPorFase[key] = [];
    fotosPorFase[key].push(f);
  }

  const fasesConFotos = proyecto.fases
    .sort((a, b) => a.orden - b.orden)
    .map((f) => ({
      ...f,
      fotosCumplimiento: fotosPorFase[f._id.toString()] || [],
      // evidencia_url viene del propio subdocumento de la fase (Jefe de Obra)
    }));

  const totalFotos = fotosCompliance.length +
    proyecto.fases.filter((f) => f.evidencia_url).length;

  res.render('cliente/galeria', {
    title: `Galería — ${proyecto.nombre}`,
    proyecto,
    fasesConFotos,
    totalFotos,
  });
});

module.exports = { dashboard, galeria };
