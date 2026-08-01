const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Lead = solicitud de cotizacion enviada desde la landing page publica.
 *
 * A diferencia del resto de colecciones, NO pertenece a un tenant: es
 * el punto de entrada de una empresa constructora que aun no es cliente
 * de ConstruFash (o de un cliente final pidiendo una obra). Por eso vive
 * fuera del aislamiento multitenant y se gestiona desde Super Admin.
 */
const leadSchema = new Schema(
  {
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true },
    telefono: { type: String, required: [true, 'El telefono es obligatorio'], trim: true },
    email: { type: String, required: [true, 'El correo es obligatorio'], trim: true, lowercase: true },
    tipo_obra: {
      type: String,
      enum: ['residencial', 'comercial', 'industrial', 'remodelacion', 'otro'],
      required: true,
    },
    mensaje: { type: String, trim: true, default: '' },
    origen: { type: String, default: 'landing' },
    estado: {
      type: String,
      enum: ['nuevo', 'contactado', 'descartado'],
      default: 'nuevo',
      index: true,
    },
  },
  { timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } }
);

module.exports = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
