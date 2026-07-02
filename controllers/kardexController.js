const KardexEntry = require('../models/KardexEntry');
const MaterialRequest = require('../models/MaterialRequest');
const Project = require('../models/Project');
const asyncHandler = require('../utils/asyncHandler');

/* ------------------------------------------------------------------ */
/* VISTAS                                                               */
/* ------------------------------------------------------------------ */

/**
 * GET /bodega/kardex/:proyectoId
 * Vista principal del kardex: saldos actuales + historial de movimientos.
 */
const mostrarKardex = asyncHandler(async (req, res) => {
  const { proyectoId } = req.params;

  const proyecto = await Project.findOne({ _id: proyectoId, tenant_id: req.tenant_id }).lean();
  if (!proyecto) {
    return res.status(404).render('errors/404', {
      title: 'No encontrado', mensaje: 'Proyecto no encontrado.', layout: false,
    });
  }

  const [saldos, movimientos] = await Promise.all([
    KardexEntry.saldosPorProyecto(req.tenant_id, proyectoId),
    KardexEntry.find({ tenant_id: req.tenant_id, proyecto_id: proyectoId })
      .sort({ creado_en: -1 })
      .limit(60)
      .populate('registrado_por', 'nombre')
      .lean(),
  ]);

  res.render('bodega/kardex', {
    title: `Kardex — ${proyecto.nombre}`,
    proyecto,
    saldos,
    movimientos,
    mensaje: req.query.mensaje || null,
    error: req.query.error || null,
  });
});

/**
 * GET /bodega/kardex  (seleccionar proyecto)
 */
const seleccionarProyecto = asyncHandler(async (req, res) => {
  const proyectos = await Project.find({ tenant_id: req.tenant_id }).select('nombre estado').lean();
  res.render('bodega/kardex-select', { title: 'Seleccionar proyecto — Kardex', proyectos });
});

/* ------------------------------------------------------------------ */
/* API                                                                  */
/* ------------------------------------------------------------------ */

/**
 * POST /api/kardex/entrada
 * Registra una entrada manual de material (compra, devolucion).
 */
const registrarEntrada = asyncHandler(async (req, res) => {
  const { proyecto_id, material, unidad, cantidad, costo_unit, referencia, observacion } = req.body;

  if (!proyecto_id || !material || !cantidad) {
    return res.status(400).json({ ok: false, mensaje: 'proyecto_id, material y cantidad son obligatorios' });
  }

  const proyecto = await Project.findOne({ _id: proyecto_id, tenant_id: req.tenant_id }).lean();
  if (!proyecto) return res.status(404).json({ ok: false, mensaje: 'Proyecto no encontrado' });

  const entrada = await KardexEntry.create({
    tenant_id: req.tenant_id,
    proyecto_id,
    material: material.trim(),
    unidad: (unidad || 'und').trim(),
    tipo: 'entrada',
    cantidad: Number(cantidad),
    costo_unit: Number(costo_unit) || 0,
    referencia: (referencia || '').trim(),
    observacion: (observacion || '').trim(),
    registrado_por: req.user.user_id,
  });

  res.json({ ok: true, entradaId: entrada._id, mensaje: 'Entrada registrada en el kardex' });
});

/**
 * POST /api/kardex/ajuste
 * Ajuste manual de inventario (positivo o negativo).
 */
const registrarAjuste = asyncHandler(async (req, res) => {
  const { proyecto_id, material, unidad, cantidad, tipo, observacion } = req.body;

  if (!['ajuste_positivo', 'ajuste_negativo'].includes(tipo)) {
    return res.status(400).json({ ok: false, mensaje: 'tipo debe ser ajuste_positivo o ajuste_negativo' });
  }

  const proyecto = await Project.findOne({ _id: proyecto_id, tenant_id: req.tenant_id }).lean();
  if (!proyecto) return res.status(404).json({ ok: false, mensaje: 'Proyecto no encontrado' });

  await KardexEntry.create({
    tenant_id: req.tenant_id,
    proyecto_id,
    material: material.trim(),
    unidad: (unidad || 'und').trim(),
    tipo,
    cantidad: Number(cantidad),
    costo_unit: 0,
    observacion: (observacion || '').trim(),
    registrado_por: req.user.user_id,
  });

  res.json({ ok: true, mensaje: 'Ajuste registrado' });
});

/**
 * Funcion interna (no ruta HTTP): crea la salida de kardex automaticamente
 * cuando el Almacenista confirma un despacho (MaterialRequest -> 'despachada').
 * Se llama desde materialController.despachar() despues de guardar el doc.
 */
async function registrarSalidaPorDespacho(tenant_id, solicitud, almacenistaId) {
  const entradas = solicitud.items.map((it) => ({
    tenant_id,
    proyecto_id: solicitud.proyecto_id,
    material: it.nombre,
    unidad: it.unidad || 'und',
    tipo: 'salida',
    cantidad: it.cantidad,
    costo_unit: 0,
    referencia: `Despacho solicitud ${solicitud._id}`,
    solicitud_id: solicitud._id,
    registrado_por: almacenistaId,
    observacion: 'Salida automatica por despacho aprobado',
  }));

  await KardexEntry.insertMany(entradas).catch((err) => {
    console.warn('[Kardex] Error al registrar salidas automaticas:', err.message);
  });
}

module.exports = {
  mostrarKardex,
  seleccionarProyecto,
  registrarEntrada,
  registrarAjuste,
  registrarSalidaPorDespacho,
};
