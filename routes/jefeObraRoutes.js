const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const tenantScope = require('../middleware/tenantScope');
const { upload, comprimirImagen } = require('../middleware/upload');
const { ROLES } = require('../utils/roles');

const avanceCtrl = require('../controllers/avanceController');
const asistenciaCtrl = require('../controllers/asistenciaController');
const materialCtrl = require('../controllers/materialController');
const novedadCtrl = require('../controllers/novedadController');
const constructorCtrl = require('../controllers/constructorController');

const jefeAuth = [auth, rbac(ROLES.JEFE_OBRA), tenantScope];

// --- Avance de fase ---
router.get('/proyectos/:proyectoId/fase/:faseId/avance', ...jefeAuth, avanceCtrl.mostrarFormAvance);
router.post('/api/jefe_obra/proyectos/:proyectoId/fase/:faseId/avance', ...jefeAuth,
  upload.single('foto'), comprimirImagen, avanceCtrl.actualizarAvance);

// --- Asistencia ---
router.get('/proyectos/:proyectoId/fase/:faseId/asistencia', ...jefeAuth, asistenciaCtrl.mostrarAsistencia);

// API: guardar asistencia online
router.post('/api/asistencia/guardar', ...jefeAuth, asistenciaCtrl.guardarAsistencia);

// API: sincronizacion offline (Dexie.js -> servidor)
router.post('/api/asistencia/sync', ...jefeAuth, asistenciaCtrl.syncOffline);

// API: historial de asistencia de una fase
router.get('/api/asistencia/historial/:proyectoId/:faseId', ...jefeAuth, asistenciaCtrl.historial);

// --- Solicitud de materiales ---
router.get('/proyectos/:proyectoId/fase/:faseId/materiales', ...jefeAuth, materialCtrl.mostrarFormSolicitud);
router.post('/api/materiales/solicitar', ...jefeAuth, materialCtrl.crearSolicitud);

// --- Novedades ---
router.get('/proyectos/:proyectoId/fase/:faseId/novedades', ...jefeAuth, novedadCtrl.listarNovedades);
router.post('/api/novedades', ...jefeAuth, upload.single('foto'), comprimirImagen, novedadCtrl.reportar);

// Sprint 4 — Revision de fotos de cumplimiento del constructor
router.get('/proyectos/:proyectoId/fase/:faseId/fotos-constructor', ...jefeAuth, constructorCtrl.revisarFotos);
router.post('/api/jefe_obra/fotos/:id/revisar', ...jefeAuth, constructorCtrl.revisarFotoAccion);

module.exports = router;
