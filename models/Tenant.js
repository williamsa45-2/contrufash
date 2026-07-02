const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Tenant = Empresa constructora registrada en el sistema (SAD 2.1.1, SRS RF-01/02).
 * tenant_id es el identificador unico que aisla los datos de cada empresa
 * en el resto de colecciones (User, Project, etc.).
 */
const tenantSchema = new Schema(
  {
    tenant_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    nombre_empresa: {
      type: String,
      required: [true, 'El nombre de la empresa es obligatorio'],
      trim: true,
    },
    nit: {
      type: String,
      trim: true,
    },
    estado: {
      type: String,
      enum: ['activo', 'suspendido'],
      default: 'activo',
      index: true,
    },
    plan: {
      type: String,
      enum: ['academico', 'basico', 'pro'],
      default: 'academico',
    },
    limites: {
      max_usuarios: { type: Number, default: 20 },
      max_proyectos_activos: { type: Number, default: 5 },
    },
    contacto: {
      nombre: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      telefono: { type: String, trim: true },
    },
    creado_por: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } }
);

module.exports = mongoose.models.Tenant || mongoose.model('Tenant', tenantSchema);
