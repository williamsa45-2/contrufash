const Project = require('../models/Project');
const User = require('../models/User');
const { ROLES, ROLE_LABELS } = require('../utils/roles');
const asyncHandler = require('../utils/asyncHandler');

// Roles que pueden ser asignados como personal de una fase (RF-06)
const ROLES_PERSONAL_OBRA = [ROLES.JEFE_OBRA, ROLES.ALMACENISTA, ROLES.CONSTRUCTOR];
const ROLES_FORM_PROYECTO = [...ROLES_PERSONAL_OBRA, ROLES.CLIENTE];

async function obtenerPersonal(req) {
  return User.find({
    tenant_id: req.tenant_id,
    rol: { $in: ROLES_FORM_PROYECTO },
    estado: 'activo',
  })
    .select('nombre rol email')
    .lean();
}

function fechaParaFormulario(fecha) {
  return fecha ? new Date(fecha).toISOString().slice(0, 10) : '';
}

function prepararFormData(proyecto) {
  return {
    ...proyecto,
    fecha_inicio: fechaParaFormulario(proyecto.fecha_inicio),
    fecha_fin: fechaParaFormulario(proyecto.fecha_fin),
    cliente: proyecto.cliente ? String(proyecto.cliente) : '',
    fases: (proyecto.fases || []).map((fase) => ({
      ...fase,
      _id: fase._id ? String(fase._id) : undefined,
      fecha_inicio: fechaParaFormulario(fase.fecha_inicio),
      fecha_fin: fechaParaFormulario(fase.fecha_fin),
      personal_asignado: (fase.personal_asignado || []).map((id) => String(id)),
    })),
  };
}

// GET /empresa/proyectos
const listar = asyncHandler(async (req, res) => {
  const proyectos = await Project.find({ tenant_id: req.tenant_id }).sort({ creado_en: -1 }).lean();
  const proyectosConAvance = proyectos.map((p) => ({
    ...p,
    avance_real: avanceRealPonderadoLean(p),
  }));

  res.render('empresa/proyectos', {
    title: 'Proyectos',
    proyectos: proyectosConAvance,
    mensaje: req.query.mensaje || null,
    error: req.query.error || null,
  });
});

// GET /empresa/proyectos/nuevo
const mostrarFormulario = asyncHandler(async (req, res) => {
  const personal = await obtenerPersonal(req);

  res.render('empresa/nuevo-proyecto', {
    title: 'Nuevo proyecto',
    error: null,
    formData: {},
    personal,
    ROLE_LABELS,
  });
});

// GET /empresa/proyectos/:id/editar
const mostrarFormularioEdicion = asyncHandler(async (req, res) => {
  const [proyecto, personal] = await Promise.all([
    Project.findOne({ _id: req.params.id, tenant_id: req.tenant_id }).lean(),
    obtenerPersonal(req),
  ]);

  if (!proyecto) {
    return res.redirect(`/empresa/proyectos?error=${encodeURIComponent('Proyecto no encontrado')}`);
  }

  res.render('empresa/nuevo-proyecto', {
    title: 'Editar proyecto',
    error: null,
    formData: prepararFormData(proyecto),
    personal,
    ROLE_LABELS,
    editando: true,
  });
});

// POST /empresa/proyectos
const crear = asyncHandler(async (req, res) => {
  const { nombre, descripcion, fecha_inicio, fecha_fin, presupuesto_total, fases_json, cliente } = req.body;
  const formData = req.body;

  const personal = await obtenerPersonal(req);

  const rerenderConError = (mensaje, status = 400) =>
    res.status(status).render('empresa/nuevo-proyecto', {
      title: 'Nuevo proyecto',
      error: mensaje,
      formData: { ...formData, _id: req.params.id },
      personal,
      ROLE_LABELS,
    });

  if (!nombre || !fecha_inicio || !fecha_fin || !presupuesto_total) {
    return rerenderConError('Nombre, fechas y presupuesto total son obligatorios.');
  }

  if (new Date(fecha_fin) <= new Date(fecha_inicio)) {
    return rerenderConError('La fecha de fin debe ser posterior a la fecha de inicio.');
  }

  let fases;
  try {
    fases = JSON.parse(fases_json || '[]');
  } catch (e) {
    return rerenderConError('El listado de fases llego en un formato invalido.');
  }

  if (!Array.isArray(fases) || fases.length === 0) {
    return rerenderConError('Agrega al menos una fase al cronograma.');
  }

  for (const [i, fase] of fases.entries()) {
    if (!fase.nombre || !fase.fecha_inicio || !fase.fecha_fin) {
      return rerenderConError(`La fase #${i + 1} necesita nombre y fechas.`);
    }
  }

  const idsPersonalObra = new Set(
    personal
      .filter((p) => ROLES_PERSONAL_OBRA.includes(p.rol))
      .map((p) => p._id.toString())
  );
  const idsClientes = new Set(
    personal
      .filter((p) => p.rol === ROLES.CLIENTE)
      .map((p) => p._id.toString())
  );

  if (cliente && !idsClientes.has(cliente.toString())) {
    return rerenderConError('El cliente seleccionado no existe o no pertenece a tu empresa.');
  }

  for (const [i, fase] of fases.entries()) {
    const asignados = Array.isArray(fase.personal_asignado) ? fase.personal_asignado : [];
    const invalido = asignados.find((id) => !idsPersonalObra.has(String(id)));
    if (invalido) {
      return rerenderConError(`La fase #${i + 1} tiene personal invalido o no disponible.`);
    }
  }

  try {
    const proyecto = await Project.create({
      tenant_id: req.tenant_id,
      nombre,
      descripcion,
      fecha_inicio,
      fecha_fin,
      presupuesto_total,
      cliente: cliente || null,
      creado_por: req.user.user_id,
      fases: fases.map((f, i) => ({
        nombre: f.nombre,
        orden: i,
        fecha_inicio: f.fecha_inicio,
        fecha_fin: f.fecha_fin,
        presupuesto_asignado: Number(f.presupuesto_asignado) || 0,
        personal_asignado: Array.isArray(f.personal_asignado) ? f.personal_asignado : [],
      })),
    });

    return res.redirect(`/empresa/proyectos/${proyecto._id}?mensaje=${encodeURIComponent('Proyecto creado correctamente')}`);
  } catch (err) {
    return rerenderConError(`No se pudo crear el proyecto: ${err.message}`);
  }
});

// POST /empresa/proyectos/:id/editar
const editar = asyncHandler(async (req, res) => {
  const { nombre, descripcion, fecha_inicio, fecha_fin, presupuesto_total, fases_json, cliente } = req.body;
  const personal = await obtenerPersonal(req);
  const formData = req.body;
  const rerenderConError = (mensaje) =>
    res.status(400).render('empresa/nuevo-proyecto', {
      title: 'Editar proyecto',
      error: mensaje,
      formData,
      personal,
      ROLE_LABELS,
      editando: true,
    });

  if (!nombre || !fecha_inicio || !fecha_fin || !presupuesto_total) {
    return rerenderConError('Nombre, fechas y presupuesto total son obligatorios.');
  }
  if (new Date(fecha_fin) <= new Date(fecha_inicio)) {
    return rerenderConError('La fecha de fin debe ser posterior a la fecha de inicio.');
  }

  let fases;
  try {
    fases = JSON.parse(fases_json || '[]');
  } catch (e) {
    return rerenderConError('El listado de fases llego en un formato invalido.');
  }
  if (!Array.isArray(fases) || fases.length === 0) {
    return rerenderConError('Agrega al menos una fase al cronograma.');
  }

  const idsPersonalObra = new Set(
    personal.filter((p) => ROLES_PERSONAL_OBRA.includes(p.rol)).map((p) => String(p._id))
  );
  const idsClientes = new Set(
    personal.filter((p) => p.rol === ROLES.CLIENTE).map((p) => String(p._id))
  );
  if (cliente && !idsClientes.has(String(cliente))) {
    return rerenderConError('El cliente seleccionado no existe o no pertenece a tu empresa.');
  }

  for (const [i, fase] of fases.entries()) {
    if (!fase.nombre || !fase.fecha_inicio || !fase.fecha_fin) {
      return rerenderConError(`La fase #${i + 1} necesita nombre y fechas.`);
    }
    const asignados = Array.isArray(fase.personal_asignado) ? fase.personal_asignado : [];
    if (asignados.some((id) => !idsPersonalObra.has(String(id)))) {
      return rerenderConError(`La fase #${i + 1} tiene personal invalido o no disponible.`);
    }
  }

  const proyecto = await Project.findOne({ _id: req.params.id, tenant_id: req.tenant_id });
  if (!proyecto) {
    return res.redirect(`/empresa/proyectos?error=${encodeURIComponent('Proyecto no encontrado')}`);
  }

  proyecto.nombre = nombre;
  proyecto.descripcion = descripcion;
  proyecto.fecha_inicio = fecha_inicio;
  proyecto.fecha_fin = fecha_fin;
  proyecto.presupuesto_total = presupuesto_total;
  proyecto.cliente = cliente || null;
  proyecto.fases = fases.map((f, i) => ({
    _id: f._id,
    nombre: f.nombre,
    orden: i,
    fecha_inicio: f.fecha_inicio,
    fecha_fin: f.fecha_fin,
    presupuesto_asignado: Number(f.presupuesto_asignado) || 0,
    estado: f.estado || 'pendiente',
    avance_real: Number(f.avance_real) || 0,
    personal_asignado: Array.isArray(f.personal_asignado) ? f.personal_asignado : [],
  }));

  try {
    await proyecto.save();
  } catch (err) {
    return rerenderConError(`No se pudo actualizar el proyecto: ${err.message}`);
  }

  res.redirect(`/empresa/proyectos/${proyecto._id}?mensaje=${encodeURIComponent('Proyecto actualizado correctamente')}`);
});

// GET /empresa/proyectos/:id
const detalle = asyncHandler(async (req, res) => {
  const proyecto = await Project.findOne({ _id: req.params.id, tenant_id: req.tenant_id })
    .populate('fases.personal_asignado', 'nombre rol')
    .populate('creado_por', 'nombre')
    .lean();

  if (!proyecto) {
    return res.status(404).render('errors/404', {
      title: 'Proyecto no encontrado',
      mensaje: 'Este proyecto no existe o no pertenece a tu empresa.',
      layout: false,
    });
  }

  // Datos para el Gantt (Chart.js): contraste planificado vs avance real (RF-07)
  const ganttData = proyecto.fases
    .sort((a, b) => a.orden - b.orden)
    .map((f) => ({
      nombre: f.nombre,
      inicio: f.fecha_inicio,
      fin: f.fecha_fin,
      estado: f.estado,
      avance_real: f.avance_real,
      planificado: porcentajePlanificado(f.fecha_inicio, f.fecha_fin),
    }));

  res.render('empresa/proyecto-detalle', {
    title: proyecto.nombre,
    proyecto,
    ganttData,
    avanceReal: avanceRealPonderadoLean(proyecto),
    mensaje: req.query.mensaje || null,
  });
});

function porcentajePlanificado(fechaInicio, fechaFin) {
  const hoy = new Date();
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  if (hoy <= inicio) return 0;
  if (hoy >= fin) return 100;
  return Math.round(((hoy - inicio) / (fin - inicio)) * 100);
}

function avanceRealPonderadoLean(proyecto) {
  const fases = proyecto.fases || [];
  if (!fases.length) return 0;
  const presupuestoTotalFases = fases.reduce((s, f) => s + (f.presupuesto_asignado || 0), 0);
  if (presupuestoTotalFases === 0) {
    return Math.round(fases.reduce((s, f) => s + (f.avance_real || 0), 0) / fases.length);
  }
  const ponderado = fases.reduce((s, f) => s + (f.avance_real || 0) * (f.presupuesto_asignado || 0), 0);
  return Math.round(ponderado / presupuestoTotalFases);
}

module.exports = { listar, mostrarFormulario, mostrarFormularioEdicion, crear, editar, detalle };
