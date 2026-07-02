const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Solicitud de materiales (SAD 2.1.2 / 2.1.3 / 2.1.4, RF-09 a RF-13).
 *
 * Flujo de estados:
 *   pendiente_aprobacion  -> Admin_Empresa recibe notificacion Socket.io
 *   aprobada              -> Almacenista recibe notificacion Socket.io
 *   despachada            -> Jefe de Obra recibe notificacion, foto de entrega obligatoria
 *   rechazada             -> Fin de flujo, razon requerida
 */
const itemSchema = new Schema({
  nombre:   { type: String, required: true, trim: true },
  cantidad: { type: Number, required: true, min: 1 },
  unidad:   { type: String, default: 'und', trim: true },
}, { _id: false });

const materialRequestSchema = new Schema(
  {
    tenant_id:   { type: String, required: true, index: true },
    proyecto_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    fase_id:     { type: Schema.Types.ObjectId, required: true },

    // Quien solicita (Jefe de Obra)
    solicitante_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    items: {
      type: [itemSchema],
      validate: { validator: (arr) => arr.length > 0, message: 'La solicitud debe tener al menos un material' },
    },

    observacion_solicitud: { type: String, trim: true },

    estado: {
      type: String,
      enum: ['pendiente_aprobacion', 'aprobada', 'rechazada', 'despachada'],
      default: 'pendiente_aprobacion',
      index: true,
    },

    // Paso 2: Admin aprueba o rechaza
    aprobado_por:    { type: Schema.Types.ObjectId, ref: 'User', default: null },
    fecha_aprobacion: { type: Date, default: null },
    razon_rechazo:   { type: String, trim: true },

    // Paso 3: Almacenista despacha y adjunta foto de entrega (RF-12)
    despachado_por:    { type: Schema.Types.ObjectId, ref: 'User', default: null },
    fecha_despacho:    { type: Date, default: null },
    evidencia_entrega: {
      url:       { type: String, default: null },
      public_id: { type: String, default: null },
    },
    observacion_despacho: { type: String, trim: true },
  },
  { timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } }
);

module.exports = mongoose.models.MaterialRequest ||
  mongoose.model('MaterialRequest', materialRequestSchema);
