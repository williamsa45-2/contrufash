const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Kardex de materiales (RF-11, RF-13 — Sprint 3).
 *
 * Cada documento representa un movimiento individual de inventario.
 * El saldo actual de un material se obtiene sumando todos sus movimientos
 * (saldo = SUM cantidad WHERE tipo='entrada' - SUM cantidad WHERE tipo IN ['salida','ajuste_negativo']).
 *
 * Tipos de movimiento:
 *   entrada          - Ingreso de material al almacen (compra, devolucion desde campo)
 *   salida           - Despacho desde bodega a Jefe de Obra (vinculado a MaterialRequest)
 *   ajuste_positivo  - Correccion de inventario al alza (conteo fisico)
 *   ajuste_negativo  - Correccion de inventario a la baja (merma, vencimiento)
 */
const kardexSchema = new Schema(
  {
    tenant_id:   { type: String, required: true, index: true },
    proyecto_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },

    // Nombre del material — se usa como clave de agrupacion para el saldo
    material:    { type: String, required: true, trim: true, index: true },
    unidad:      { type: String, default: 'und', trim: true },

    tipo: {
      type: String,
      enum: ['entrada', 'salida', 'ajuste_positivo', 'ajuste_negativo'],
      required: true,
      index: true,
    },

    cantidad:    { type: Number, required: true, min: 0.001 },
    costo_unit:  { type: Number, default: 0, min: 0 }, // COP, para reporte de costos (RF-05)

    // Documento de origen (opcional): solicitud de material, OC, etc.
    referencia:  { type: String, trim: true },
    solicitud_id: { type: Schema.Types.ObjectId, ref: 'MaterialRequest', default: null },

    registrado_por: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    observacion: { type: String, trim: true },
  },
  { timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } }
);

kardexSchema.index({ tenant_id: 1, proyecto_id: 1, material: 1 });

/**
 * Calcula el saldo actual de cada material en un proyecto.
 * Retorna: [{ material, unidad, saldo, costo_total, ultima_entrada }]
 */
kardexSchema.statics.saldosPorProyecto = async function (tenant_id, proyecto_id) {
  return this.aggregate([
    { $match: { tenant_id, proyecto_id: new mongoose.Types.ObjectId(proyecto_id) } },
    {
      $group: {
        _id: { material: '$material', unidad: '$unidad' },
        entradas: {
          $sum: {
            $cond: [{ $in: ['$tipo', ['entrada', 'ajuste_positivo']] }, '$cantidad', 0],
          },
        },
        salidas: {
          $sum: {
            $cond: [{ $in: ['$tipo', ['salida', 'ajuste_negativo']] }, '$cantidad', 0],
          },
        },
        costo_total: { $sum: { $multiply: ['$cantidad', '$costo_unit'] } },
        ultima_entrada: { $max: '$creado_en' },
      },
    },
    {
      $project: {
        _id: 0,
        material: '$_id.material',
        unidad: '$_id.unidad',
        saldo: { $subtract: ['$entradas', '$salidas'] },
        entradas: 1,
        salidas: 1,
        costo_total: 1,
        ultima_entrada: 1,
      },
    },
    { $sort: { material: 1 } },
  ]);
};

module.exports = mongoose.models.KardexEntry || mongoose.model('KardexEntry', kardexSchema);
