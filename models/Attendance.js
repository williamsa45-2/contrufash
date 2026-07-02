const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Registro de asistencia diaria por fase y proyecto (SAD 2.1.4, RF-04).
 *
 * El Jefe de Obra puede tomar el pase de lista sin conexion (Offline-First,
 * DA-03). El cliente PWA almacena los registros en Dexie.js (IndexedDB) y
 * los sincroniza con el endpoint POST /api/asistencia/sync cuando vuelve
 * la red. El campo `sincronizado_desde_offline` permite auditar cuales
 * registros llegaron por sincronizacion diferida.
 */
const registroSchema = new Schema({
  usuario_id:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  nombre:      { type: String },          // se denormaliza para evitar populate en listados
  presente:    { type: Boolean, default: false },
  observacion: { type: String, trim: true },
}, { _id: false });

const attendanceSchema = new Schema(
  {
    tenant_id:   { type: String, required: true, index: true },
    proyecto_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    fase_id:     { type: Schema.Types.ObjectId, required: true },
    jefe_id:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fecha: {
      type: Date,
      required: true,
      // Solo la parte de fecha (sin hora) para que sea el indice del dia
      get: (v) => v ? new Date(v.toISOString().split('T')[0]) : v,
    },
    registros: [registroSchema],
    sincronizado_desde_offline: { type: Boolean, default: false },
    // Timestamp del dispositivo del Jefe de Obra (puede diferir del servidor)
    timestamp_cliente: { type: Date },
  },
  { timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } }
);

// Indice compuesto: un registro por fase por dia (evita duplicados)
attendanceSchema.index({ proyecto_id: 1, fase_id: 1, fecha: 1 }, { unique: true });

module.exports = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
