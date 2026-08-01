require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Project = require('../models/Project');
const CompliancePhoto = require('../models/CompliancePhoto');
const MaterialRequest = require('../models/MaterialRequest');
const KardexEntry = require('../models/KardexEntry');
const Attendance = require('../models/Attendance');
const Novedad = require('../models/Novedad');
const Notificacion = require('../models/Notificacion');

const { ROLES } = require('../utils/roles');

/**
 * Seed de datos de demostracion para ConstruFash.
 *
 * Crea:
 *  - Super Admin global (idempotente, igual que antes)
 *  - Una empresa (Tenant) de demo con un usuario por cada rol
 *  - Un proyecto con 5 fases, cada una con una imagen de evidencia
 *    (fase.evidencia_url) para que el Gantt y la galeria del cliente
 *    se vean pobladas desde el primer login
 *  - Fotos de cumplimiento (CompliancePhoto) del Constructor por fase
 *  - Solicitudes de materiales, movimientos de Kardex, asistencia y
 *    una novedad de ejemplo, tambien con foto
 *
 * Es re-ejecutable: si la empresa demo ya existe, no duplica nada.
 *
 * Uso:
 *   npm run seed
 */

// Imagenes de muestra (Lorem Picsum, gratuitas y estables via seed fijo)
// para que cada corrida del script genere siempre las mismas URLs.
const imagen = (seed, w = 900, h = 600) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

const TENANT_ID = 'horizonte-demo';
const DIA = 24 * 60 * 60 * 1000;
const hoy = new Date();
const fecha = (offsetDias) => new Date(hoy.getTime() + offsetDias * DIA);

async function crearSuperAdmin() {
  const email = (process.env.SEED_SUPERADMIN_EMAIL || 'admin@gmail.com').toLowerCase();
  const password = process.env.SEED_SUPERADMIN_PASSWORD || '123456';

  const existente = await User.findOne({ email });
  if (existente) {
    console.log(`[Seed] Ya existe un usuario con email ${email}, no se crea duplicado.`);
    return existente;
  }

  const superAdmin = new User({
    nombre: 'Super Admin',
    email,
    rol: ROLES.SUPER_ADMIN,
    tenant_id: null,
  });
  superAdmin.password = password;
  await superAdmin.save();
  console.log('[Seed] Super Admin creado:');
  console.log(`        email:    ${email}`);
  console.log(`        password: ${password}`);
  return superAdmin;
}

async function crearUsuario({ nombre, email, rol, tenant_id, password = 'Demo123!' }) {
  email = email.toLowerCase();
  let user = await User.findOne({ email });
  if (user) return user;
  user = new User({ nombre, email, rol, tenant_id, estado: 'activo' });
  user.password = password;
  await user.save();
  return user;
}

async function seed() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/construfash';
  await mongoose.connect(uri);
  console.log(`[Seed] Conectado a ${mongoose.connection.name}`);

  // 1) Super Admin global
  const superAdmin = await crearSuperAdmin();

  // 2) Empresa (tenant) de demo
  let tenant = await Tenant.findOne({ tenant_id: TENANT_ID });
  const tenantYaExistia = Boolean(tenant);
  if (!tenant) {
    tenant = await Tenant.create({
      tenant_id: TENANT_ID,
      nombre_empresa: 'Constructora Horizonte SAS',
      nit: '900123456-7',
      estado: 'activo',
      plan: 'pro',
      limites: { max_usuarios: 30, max_proyectos_activos: 10 },
      contacto: {
        nombre: 'Laura Martinez',
        email: 'contacto@horizonte.demo',
        telefono: '3001234567',
      },
      creado_por: superAdmin._id,
    });
    console.log(`[Seed] Empresa demo creada: ${tenant.nombre_empresa} (${tenant.tenant_id})`);
  } else {
    console.log(`[Seed] La empresa demo "${tenant.tenant_id}" ya existia, se reutiliza.`);
  }

  if (tenantYaExistia) {
    console.log('[Seed] Como la empresa demo ya existia, no se vuelve a poblar el resto de datos.');
    console.log('[Seed] Si quieres regenerarlos, borra la coleccion "tenants" (o el tenant demo) y vuelve a correr "npm run seed".');
    await mongoose.disconnect();
    process.exit(0);
  }

  // 3) Un usuario por rol dentro de la empresa demo
  const admin = await crearUsuario({
    nombre: 'Laura Martinez',
    email: 'admin@horizonte.demo',
    rol: ROLES.ADMIN_EMPRESA,
    tenant_id: TENANT_ID,
  });

  const jefeLopez = await crearUsuario({
    nombre: 'Carlos Lopez',
    email: 'jefe.lopez@horizonte.demo',
    rol: ROLES.JEFE_OBRA,
    tenant_id: TENANT_ID,
  });

  const almacenista = await crearUsuario({
    nombre: 'Diana Ruiz',
    email: 'bodega@horizonte.demo',
    rol: ROLES.ALMACENISTA,
    tenant_id: TENANT_ID,
  });

  const constructorGomez = await crearUsuario({
    nombre: 'Andres Gomez',
    email: 'constructor.gomez@horizonte.demo',
    rol: ROLES.CONSTRUCTOR,
    tenant_id: TENANT_ID,
  });

  const constructorDiaz = await crearUsuario({
    nombre: 'Felipe Diaz',
    email: 'constructor.diaz@horizonte.demo',
    rol: ROLES.CONSTRUCTOR,
    tenant_id: TENANT_ID,
  });

  const cliente = await crearUsuario({
    nombre: 'Marcela Torres',
    email: 'cliente@horizonte.demo',
    rol: ROLES.CLIENTE,
    tenant_id: TENANT_ID,
  });

  console.log('[Seed] Usuarios de demo creados (password para todos: "Demo123!").');

  // 4) Proyecto con 5 fases, cada una con su imagen de evidencia
  const fases = [
    {
      nombre: 'Cimentacion y excavacion',
      orden: 1,
      fecha_inicio: fecha(-90),
      fecha_fin: fecha(-61),
      presupuesto_asignado: 60000000,
      estado: 'completada',
      avance_real: 100,
      personal_asignado: [jefeLopez._id, constructorGomez._id],
      evidencia_url: imagen('horizonte-fase-cimentacion'),
    },
    {
      nombre: 'Estructura en concreto',
      orden: 2,
      fecha_inicio: fecha(-60),
      fecha_fin: fecha(-16),
      presupuesto_asignado: 120000000,
      estado: 'completada',
      avance_real: 100,
      personal_asignado: [jefeLopez._id, constructorGomez._id, constructorDiaz._id],
      evidencia_url: imagen('horizonte-fase-estructura'),
    },
    {
      nombre: 'Mamposteria y fachada',
      orden: 3,
      fecha_inicio: fecha(-15),
      fecha_fin: fecha(20),
      presupuesto_asignado: 85000000,
      estado: 'en_progreso',
      avance_real: 55,
      personal_asignado: [jefeLopez._id, constructorDiaz._id],
      evidencia_url: imagen('horizonte-fase-fachada'),
    },
    {
      nombre: 'Instalaciones electricas e hidraulicas',
      orden: 4,
      fecha_inicio: fecha(15),
      fecha_fin: fecha(50),
      presupuesto_asignado: 70000000,
      estado: 'pendiente',
      avance_real: 0,
      personal_asignado: [constructorGomez._id],
      evidencia_url: null,
    },
    {
      nombre: 'Acabados y entrega',
      orden: 5,
      fecha_inicio: fecha(51),
      fecha_fin: fecha(90),
      presupuesto_asignado: 65000000,
      estado: 'pendiente',
      avance_real: 0,
      personal_asignado: [],
      evidencia_url: null,
    },
  ];

  const proyecto = await Project.create({
    tenant_id: TENANT_ID,
    nombre: 'Edificio Aurora - Torre Residencial',
    descripcion: 'Construccion de torre residencial de 8 pisos, 32 apartamentos, con zonas comunes y parqueadero subterraneo.',
    fecha_inicio: fases[0].fecha_inicio,
    fecha_fin: fases[fases.length - 1].fecha_fin,
    presupuesto_total: fases.reduce((sum, f) => sum + f.presupuesto_asignado, 0),
    estado: 'en_progreso',
    fases,
    cliente: cliente._id,
    creado_por: admin._id,
    // Vitrina publica (landing page): esta empresa demo opta por mostrar
    // el proyecto en el portafolio publico de ConstruFash.
    publico: true,
    categoria: 'residencial',
    ubicacion: 'Bogota, Colombia',
    area_m2: 4200,
    imagen_portada: { url: imagen('horizonte-aurora-portada', 1200, 800), public_id: null },
  });

  console.log(`[Seed] Proyecto creado: "${proyecto.nombre}" con ${proyecto.fases.length} fases (con imagenes en evidencia_url).`);

  const [faseCimentacion, faseEstructura, faseFachada, faseInstalaciones] = proyecto.fases;

  // 5) Fotos de cumplimiento del Constructor por fase (galeria del cliente + panel del Jefe de Obra)
  const fotosCumplimiento = [
    {
      fase: faseCimentacion,
      constructor: constructorGomez,
      descripcion: 'Vaciado de zapatas terminado, listo para revision.',
      estado: 'aprobada',
      revisado_por: jefeLopez._id,
      comentario: 'Excelente acabado, aprobado.',
      seedImg: 'horizonte-foto-cimentacion-1',
    },
    {
      fase: faseCimentacion,
      constructor: constructorGomez,
      descripcion: 'Impermeabilizacion de la placa de cimentacion.',
      estado: 'aprobada',
      revisado_por: jefeLopez._id,
      comentario: 'Conforme.',
      seedImg: 'horizonte-foto-cimentacion-2',
    },
    {
      fase: faseEstructura,
      constructor: constructorDiaz,
      descripcion: 'Fundida de columnas piso 3 finalizada.',
      estado: 'aprobada',
      revisado_por: jefeLopez._id,
      comentario: 'Aprobado, buen curado.',
      seedImg: 'horizonte-foto-estructura-1',
    },
    {
      fase: faseFachada,
      constructor: constructorDiaz,
      descripcion: 'Avance de muros en bloque, fachada norte.',
      estado: 'pendiente_revision',
      seedImg: 'horizonte-foto-fachada-1',
    },
    {
      fase: faseFachada,
      constructor: constructorGomez,
      descripcion: 'Instalacion de andamios para pañete.',
      estado: 'pendiente_revision',
      seedImg: 'horizonte-foto-fachada-2',
    },
  ];

  for (const f of fotosCumplimiento) {
    await CompliancePhoto.create({
      tenant_id: TENANT_ID,
      proyecto_id: proyecto._id,
      fase_id: f.fase._id,
      constructor_id: f.constructor._id,
      descripcion: f.descripcion,
      foto: { url: imagen(f.seedImg), public_id: f.seedImg },
      estado: f.estado,
      revisado_por: f.revisado_por || null,
      comentario: f.comentario || '',
      fecha_revision: f.revisado_por ? fecha(-2) : null,
    });
  }
  console.log(`[Seed] ${fotosCumplimiento.length} fotos de cumplimiento creadas.`);

  // 6) Solicitudes de materiales
  const solicitud1 = await MaterialRequest.create({
    tenant_id: TENANT_ID,
    proyecto_id: proyecto._id,
    fase_id: faseFachada._id,
    solicitante_id: jefeLopez._id,
    items: [
      { nombre: 'Bloque de concreto 15cm', cantidad: 2000, unidad: 'und' },
      { nombre: 'Cemento gris', cantidad: 150, unidad: 'bulto' },
    ],
    observacion_solicitud: 'Se necesita para continuar mamposteria fachada norte.',
    estado: 'despachada',
    aprobado_por: admin._id,
    fecha_aprobacion: fecha(-6),
    despachado_por: almacenista._id,
    fecha_despacho: fecha(-5),
    evidencia_entrega: { url: imagen('horizonte-despacho-1'), public_id: 'horizonte-despacho-1' },
    observacion_despacho: 'Entregado completo en obra.',
  });

  const solicitud2 = await MaterialRequest.create({
    tenant_id: TENANT_ID,
    proyecto_id: proyecto._id,
    fase_id: faseInstalaciones._id,
    solicitante_id: jefeLopez._id,
    items: [
      { nombre: 'Tuberia PVC 1/2 pulgada', cantidad: 80, unidad: 'm' },
      { nombre: 'Cable encauchetado 12 AWG', cantidad: 200, unidad: 'm' },
    ],
    observacion_solicitud: 'Para iniciar instalaciones hidraulicas y electricas.',
    estado: 'pendiente_aprobacion',
  });

  console.log('[Seed] 2 solicitudes de materiales creadas.');

  // 7) Movimientos de Kardex
  const kardexEntradas = [
    { material: 'Cemento gris', unidad: 'bulto', tipo: 'entrada', cantidad: 300, costo_unit: 28000, referencia: 'OC-001' },
    { material: 'Bloque de concreto 15cm', unidad: 'und', tipo: 'entrada', cantidad: 5000, costo_unit: 1800, referencia: 'OC-002' },
    { material: 'Cemento gris', unidad: 'bulto', tipo: 'salida', cantidad: 150, costo_unit: 28000, referencia: 'Despacho', solicitud_id: solicitud1._id },
    { material: 'Bloque de concreto 15cm', unidad: 'und', tipo: 'salida', cantidad: 2000, costo_unit: 1800, referencia: 'Despacho', solicitud_id: solicitud1._id },
  ];
  for (const k of kardexEntradas) {
    await KardexEntry.create({
      tenant_id: TENANT_ID,
      proyecto_id: proyecto._id,
      registrado_por: almacenista._id,
      ...k,
    });
  }
  console.log('[Seed] Movimientos de Kardex creados.');

  // 8) Asistencia del dia para la fase en progreso
  await Attendance.create({
    tenant_id: TENANT_ID,
    proyecto_id: proyecto._id,
    fase_id: faseFachada._id,
    jefe_id: jefeLopez._id,
    fecha: new Date(hoy.toISOString().split('T')[0]),
    registros: [
      { usuario_id: constructorGomez._id, nombre: constructorGomez.nombre, presente: true },
      { usuario_id: constructorDiaz._id, nombre: constructorDiaz.nombre, presente: true },
    ],
    sincronizado_desde_offline: false,
  });
  console.log('[Seed] Registro de asistencia del dia creado.');

  // 9) Novedad de ejemplo (con foto)
  await Novedad.create({
    tenant_id: TENANT_ID,
    proyecto_id: proyecto._id,
    fase_id: faseFachada._id,
    reportado_por: jefeLopez._id,
    tipo: 'material',
    descripcion: 'El pedido de cemento llego con 10 bultos humedos, se solicito reposicion.',
    evidencia: { url: imagen('horizonte-novedad-1'), public_id: 'horizonte-novedad-1' },
    estado: 'abierta',
  });
  console.log('[Seed] Novedad de ejemplo creada.');

  // 10) Notificaciones de ejemplo
  await Notificacion.create([
    {
      tenant_id: TENANT_ID,
      destinatario_id: admin._id,
      tipo: 'novedad_nueva',
      titulo: 'Nueva novedad reportada',
      cuerpo: 'Carlos Lopez reporto una novedad en "Mamposteria y fachada".',
      url_accion: '/empresa/novedades',
      leida: false,
    },
    {
      tenant_id: TENANT_ID,
      destinatario_id: jefeLopez._id,
      tipo: 'foto_cumplimiento',
      titulo: 'Fotos pendientes de revision',
      cuerpo: 'Hay 2 fotos de cumplimiento esperando tu revision.',
      url_accion: '/jefe_obra/fotos-constructor',
      leida: false,
    },
  ]);
  console.log('[Seed] Notificaciones de ejemplo creadas.');

  // Resumen final
  console.log('\n[Seed] === Listo ===');
  console.log(`Empresa demo:   ${tenant.nombre_empresa}  (tenant_id: ${tenant.tenant_id})`);
  console.log('Password para todos los usuarios de demo: Demo123!');
  console.log('Usuarios:');
  console.log(`  Admin empresa:   ${admin.email}`);
  console.log(`  Jefe de obra:    ${jefeLopez.email}`);
  console.log(`  Almacenista:     ${almacenista.email}`);
  console.log(`  Constructor:     ${constructorGomez.email}`);
  console.log(`  Constructor:     ${constructorDiaz.email}`);
  console.log(`  Cliente:         ${cliente.email}`);
  console.log('Cambia estas contrasenas despues del primer login en un entorno real.\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});