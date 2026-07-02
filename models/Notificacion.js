const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Notificacion persistente por usuario (Sprint 4 — Centro de Notificaciones).
 *
 * Socket.io (Sprint 2) emite eventos en tiempo real; este modelo los persiste
 * para que el usuario los vea aunque no estuviera conectado cuando ocurrieron.
 * El centro de notificaciones (campana en topbar) muestra el conteo de no-leidas
 * y la lista completa al hacer clic.
 *
 * Tipos de notificacion (mapeados desde los eventos de Socket.io):
 *   material_solicitado   → Admin
 *   material_aprobado     → Almacenista
 *   material_rechazado    → Jefe de Obra
 *   material_despachado   → Jefe de Obra
 *   novedad_nueva         → Admin
 *   fase_avance           → Admin
 *   alerta_constructor    → Jefe de Obra (Sprint 4)
 *   foto_cumplimiento     → Jefe de Obra (Sprint 4)
 */
const notificacionSchema = new Schema(
  {
    tenant_id:      { type: String, required: true, index: true },
    destinatario_id:{ type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tipo:           {
      type: String,
      enum: [
        'material_solicitado','material_aprobado','material_rechazado','material_despachado',
        'novedad_nueva','fase_avance','alerta_constructor','foto_cumplimiento','sistema',
      ],
      required: true,
    },
    titulo:         { type: String, required: true },
    cuerpo:         { type: String, default: '' },
    url_accion:     { type: String, default: null },  // ruta a donde ir al hacer clic
    leida:          { type: Boolean, default: false, index: true },
    meta:           { type: Schema.Types.Mixed },      // datos extra opcionales (proyectoId, faseId…)
  },
  { timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } }
);

notificacionSchema.index({ destinatario_id: 1, leida: 1, creado_en: -1 });

module.exports = mongoose.models.Notificacion || mongoose.model('Notificacion', notificacionSchema);
