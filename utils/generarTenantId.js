const Tenant = require('../models/Tenant');

function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

/**
 * Genera un tenant_id legible y unico a partir del nombre de la empresa.
 * Ej: "Constructora Andes SAS" -> "constructora-andes-7f3a"
 */
async function generarTenantId(nombreEmpresa) {
  const base = slugify(nombreEmpresa) || 'empresa';
  let intento = base;
  let sufijoExtra = 0;

  // Reintenta con un sufijo aleatorio hasta encontrar uno libre
  while (await Tenant.exists({ tenant_id: intento })) {
    const sufijo = Math.random().toString(36).slice(2, 6);
    intento = `${base}-${sufijo}`;
    sufijoExtra += 1;
    if (sufijoExtra > 10) {
      throw new Error('No fue posible generar un tenant_id unico, intenta de nuevo.');
    }
  }
  return intento;
}

module.exports = generarTenantId;
