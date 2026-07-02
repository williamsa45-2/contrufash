const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const tenantScope = require('../middleware/tenantScope');
const { ROLES } = require('../utils/roles');

const empresaCtrl = require('../controllers/empresaController');
const personalCtrl = require('../controllers/personalController');
const proyectoCtrl = require('../controllers/proyectoController');
const materialCtrl = require('../controllers/materialController');
const novedadCtrl = require('../controllers/novedadController');
const reporteCtrl = require('../controllers/reporteController');
const exportCtrl = require('../controllers/exportController');
const { upload, comprimirImagen } = require('../middleware/upload');

router.use(auth, rbac(ROLES.ADMIN_EMPRESA), tenantScope);

router.get('/dashboard', empresaCtrl.dashboard);

router.get('/personal', personalCtrl.listar);
router.get('/personal/nuevo', personalCtrl.mostrarFormulario);
router.post('/personal', personalCtrl.crear);
router.post('/personal/:id/estado', personalCtrl.cambiarEstado);

router.get('/proyectos', proyectoCtrl.listar);
router.get('/proyectos/nuevo', proyectoCtrl.mostrarFormulario);
router.post('/proyectos', proyectoCtrl.crear);
router.get('/proyectos/:id', proyectoCtrl.detalle);

// Sprint 2 — Aprobacion de materiales
router.get('/materiales', materialCtrl.listarParaAdmin);
router.post('/api/materiales/:id/aprobar', materialCtrl.aprobar);
router.post('/api/materiales/:id/rechazar', materialCtrl.rechazar);

// Sprint 2 — Novedades de campo
router.get('/novedades', novedadCtrl.listarParaAdmin);
router.post('/api/novedades/:id/gestionar', novedadCtrl.gestionar);

// Sprint 3 — Reportes y exportaciones
router.get('/reportes', reporteCtrl.dashboardReportes);
router.get('/api/reportes/proyecto/:id', reporteCtrl.reporteProyecto);
router.get('/reportes/:id/pdf', exportCtrl.exportarPDF);
router.get('/reportes/:id/excel', exportCtrl.exportarExcel);

module.exports = router;
