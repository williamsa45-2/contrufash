const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Fase de un proyecto (subdocumento embebido).
 * avance_real se actualiza desde campo (Jefe de Obra) en sprints posteriores;
 * en Sprint 1 solo se visualiza junto al plan en el Gantt (RF-07).
 * evidencia_url queda preparado para el bloqueo de cierre (RF-08, Sprint 2).
 */
const phaseSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    orden: { type: Number, required: true, default: 0 },
    fecha_inicio: { type: Date, required: true },
    fecha_fin: { type: Date, required: true },
    presupuesto_asignado: { type: Number, required: true, min: 0, default: 0 },
    estado: {
      type: String,
      enum: ['pendiente', 'en_progreso', 'completada'],
      default: 'pendiente',
    },
    avance_real: { type: Number, min: 0, max: 100, default: 0 },
    personal_asignado: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    evidencia_url: { type: String, default: null }, // se completa en Sprint 2 (Cloudinary)
  },
  { _id: true }
);

const projectSchema = new Schema(
  {
    tenant_id: { type: String, required: true, index: true },
    nombre: { type: String, required: [true, 'El nombre del proyecto es obligatorio'], trim: true },
    descripcion: { type: String, trim: true },
    fecha_inicio: { type: Date, required: true },
    fecha_fin: { type: Date, required: true },
    presupuesto_total: { type: Number, required: true, min: 0 },
    estado: {
      type: String,
      enum: ['planeado', 'en_progreso', 'finalizado', 'cancelado'],
      default: 'planeado',
      index: true,
    },
    fases: {
      type: [phaseSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'El proyecto debe tener al menos una fase',
      },
    },
    cliente: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    creado_por: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } }
);

projectSchema.index({ tenant_id: 1, estado: 1 });

// % de avance planificado a la fecha actual, usado para el contraste del Gantt (RF-07)
projectSchema.methods.avancePlanificadoHoy = function () {
  const hoy = new Date();
  if (hoy <= this.fecha_inicio) return 0;
  if (hoy >= this.fecha_fin) return 100;
  const total = this.fecha_fin - this.fecha_inicio;
  const transcurrido = hoy - this.fecha_inicio;
  return Math.round((transcurrido / total) * 100);
};

// % de avance real ponderado por presupuesto de cada fase
projectSchema.methods.avanceRealPonderado = function () {
  if (!this.fases.length) return 0;
  const presupuestoTotalFases = this.fases.reduce((sum, f) => sum + (f.presupuesto_asignado || 0), 0);
  if (presupuestoTotalFases === 0) {
    const promedio = this.fases.reduce((sum, f) => sum + (f.avance_real || 0), 0) / this.fases.length;
    return Math.round(promedio);
  }
  const ponderado = this.fases.reduce(
    (sum, f) => sum + (f.avance_real || 0) * (f.presupuesto_asignado || 0),
    0
  );
  return Math.round(ponderado / presupuestoTotalFases);
};

module.exports = mongoose.models.Project || mongoose.model('Project', projectSchema);
