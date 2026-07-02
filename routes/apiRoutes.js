const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const tenantScope = require('../middleware/tenantScope');
const { upload, comprimirImagen } = require('../middleware/upload');
const { ROLES } = require('../utils/roles');

const asistenciaCtrl = require('../controllers/asistenciaController');
const materialCtrl = require('../controllers/materialController');
const novedadCtrl = require('../controllers/novedadController');
const avanceCtrl = require('../controllers/avanceController');
const kardexCtrl = require('../controllers/kardexController');
const constructorCtrl = require('../controllers/constructorController');
const reporteCtrl = require('../controllers/reporteController');

const adminAuth = [auth, rbac(ROLES.ADMIN_EMPRESA), tenantScope];
const jefeAuth = [auth, rbac(ROLES.JEFE_OBRA), tenantScope];
const almacenAuth = [auth, rbac(ROLES.ALMACENISTA), tenantScope];
const constructorAuth = [auth, rbac(ROLES.CONSTRUCTOR), tenantScope];

// Admin empresa
router.post('/api/materiales/:id/aprobar', ...adminAuth, materialCtrl.aprobar);
router.post('/api/materiales/:id/rechazar', ...adminAuth, materialCtrl.rechazar);
router.post('/api/novedades/:id/gestionar', ...adminAuth, novedadCtrl.gestionar);
router.get('/api/reportes/proyecto/:id', ...adminAuth, reporteCtrl.reporteProyecto);

// Jefe de obra
router.post('/api/jefe_obra/proyectos/:proyectoId/fase/:faseId/avance', ...jefeAuth,
  upload.single('foto'), comprimirImagen, avanceCtrl.actualizarAvance);
router.post('/api/asistencia/guardar', ...jefeAuth, asistenciaCtrl.guardarAsistencia);
router.post('/api/asistencia/sync', ...jefeAuth, asistenciaCtrl.syncOffline);
router.get('/api/asistencia/historial/:proyectoId/:faseId', ...jefeAuth, asistenciaCtrl.historial);
router.post('/api/materiales/solicitar', ...jefeAuth, materialCtrl.crearSolicitud);
router.post('/api/novedades', ...jefeAuth, upload.single('foto'), comprimirImagen, novedadCtrl.reportar);
router.post('/api/jefe_obra/fotos/:id/revisar', ...jefeAuth, constructorCtrl.revisarFotoAccion);

// Almacenista
router.post('/api/materiales/:id/despachar', ...almacenAuth,
  upload.single('foto'), comprimirImagen, materialCtrl.despachar);
router.post('/api/kardex/entrada', ...almacenAuth, kardexCtrl.registrarEntrada);
router.post('/api/kardex/ajuste', ...almacenAuth, kardexCtrl.registrarAjuste);

// Constructor
router.post('/api/construccion/fotos', ...constructorAuth,
  upload.single('foto'), comprimirImagen, constructorCtrl.subirFoto);
router.post('/api/construccion/alerta', ...constructorAuth, constructorCtrl.reportarAlerta);

module.exports = router;
