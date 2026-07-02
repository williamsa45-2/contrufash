const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Foto de cumplimiento del Constructor (Sprint 4 — RF-14/RF-15).
 *
 * El Constructor sube una o varias fotos que certifiquen la finalizacion
 * de su actividad dentro de una fase. El Jefe de Obra las revisa desde
 * su panel y puede aprobarlas o solicitar corrección.
 */
const compliancePhotoSchema = new Schema(
  {
    tenant_id:      { type: String, required: true, index: true },
    proyecto_id:    { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    fase_id:        { type: Schema.Types.ObjectId, required: true },
    constructor_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    descripcion:    { type: String, required: true, trim: true },
    foto: {
      url:       { type: String, required: true },
      public_id: { type: String, required: true },
    },

    estado: {
      type: String,
      enum: ['pendiente_revision', 'aprobada', 'rechazada'],
      default: 'pendiente_revision',
      index: true,
    },
    revisado_por:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
    comentario:     { type: String, default: '' },
    fecha_revision: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } }
);

module.exports = mongoose.models.CompliancePhoto ||
  mongoose.model('CompliancePhoto', compliancePhotoSchema);
