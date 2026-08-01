const Project = require('../models/Project');
const Tenant = require('../models/Tenant');
const Lead = require('../models/Lead');
const asyncHandler = require('../utils/asyncHandler');
const { emitirATenant } = require('../config/socket');

const CATEGORIAS = ['residencial', 'comercial', 'industrial'];

/** Aplica transformaciones de Cloudinary (f_auto,q_auto + resize) sobre una URL segura. */
function optimizarImagen(url, width = 800) {
  if (!url) return null;
  if (!url.includes('/upload/')) return url; // no es una URL de Cloudinary (ej. placeholder de seed)
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_fill/`);
}

// GET / — landing publica si no hay sesion; si hay sesion valida, ya fue
// redirigida al home del rol por el middleware montado en server.js.
const mostrarLanding = asyncHandler(async (req, res) => {
  const [proyectosPublicos, empresasActivas, proyectosFinalizados] = await Promise.all([
    Project.find({ publico: true })
      .sort({ actualizado_en: -1 })
      .limit(9)
      .select('nombre descripcion categoria ubicacion area_m2 estado imagen_portada fecha_fin')
      .lean(),
    Tenant.countDocuments({ estado: 'activo' }),
    Project.countDocuments({ estado: 'finalizado' }),
  ]);

  const portafolio = proyectosPublicos.map((p) => ({
    id: String(p._id),
    nombre: p.nombre,
    descripcion: p.descripcion,
    categoria: CATEGORIAS.includes(p.categoria) ? p.categoria : 'residencial',
    ubicacion: p.ubicacion || '',
    area_m2: p.area_m2 || null,
    estado: p.estado,
    anio: p.fecha_fin ? new Date(p.fecha_fin).getFullYear() : null,
    imagen: optimizarImagen(p.imagen_portada && p.imagen_portada.url, 900) || placeholderPara(p._id),
  }));

  res.render('public/landing', {
    layout: false,
    title: 'Inicio',
    portafolio,
    metricas: {
      empresas: empresasActivas,
      proyectos: proyectosFinalizados,
    },
  });
});

function placeholderPara(id) {
  return `https://picsum.photos/seed/construfash-${id}/900/600`;
}

// POST /cotizar — crea un Lead publico y notifica en tiempo real.
const crearCotizacion = asyncHandler(async (req, res) => {
  const { nombre, telefono, email, tipo_obra, mensaje, empresa_trampa } = req.body;

  // Honeypot anti-spam: campo oculto que un bot rellenaria y un humano no ve.
  if (empresa_trampa) {
    return res.json({ ok: true });
  }

  if (!nombre || !telefono || !email || !tipo_obra) {
    return res.status(400).json({ ok: false, mensaje: 'Completa nombre, telefono, correo y tipo de obra.' });
  }

  const lead = await Lead.create({
    nombre: String(nombre).trim(),
    telefono: String(telefono).trim(),
    email: String(email).trim().toLowerCase(),
    tipo_obra,
    mensaje: mensaje ? String(mensaje).trim() : '',
  });

  // Sala global (no-tenant) para futuras bandejas de leads del Super Admin.
  emitirATenant('super_admin', 'lead:nuevo', {
    id: String(lead._id),
    nombre: lead.nombre,
    tipo_obra: lead.tipo_obra,
    creado_en: lead.creado_en,
  });

  res.json({ ok: true, mensaje: 'Recibimos tu solicitud. Te contactaremos pronto.' });
});

module.exports = { mostrarLanding, crearCotizacion };
