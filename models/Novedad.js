const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Novedad / Reporte de campo (SAD 2.1.4, RF-10).
 *
 * El Jefe de Obra reporta al Admin_Empresa cualquier incidente, retraso,
 * o condicion que bloquee el avance de una fase. Puede adjuntar una foto.
 * El Admin puede marcarla como gestionada con una respuesta.
 */
const novedadSchema = new Schema(
  {
    tenant_id:   { type: String, required: true, index: true },
    proyecto_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    fase_id:     { type: Schema.Types.ObjectId, required: true },
    reportado_por: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    tipo: {
      type: String,
      enum: ['retraso', 'bloqueo', 'material', 'seguridad', 'otro'],
      required: true,
    },
    descripcion: { type: String, required: true, trim: true },
    evidencia: {
      url:       { type: String, default: null },
      public_id: { type: String, default: null },
    },

    estado: {
      type: String,
      enum: ['abierta', 'gestionada'],
      default: 'abierta',
      index: true,
    },
    respuesta_admin: { type: String, trim: true },
    gestionado_por:  { type: Schema.Types.ObjectId, ref: 'User', default: null },
    fecha_gestion:   { type: Date, default: null },
  },
  { timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } }
);

module.exports = mongoose.models.Novedad || mongoose.model('Novedad', novedadSchema);
