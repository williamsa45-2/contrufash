const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { ROLES } = require('../utils/roles');
const ctrl = require('../controllers/superAdminController');

router.use(auth, rbac(ROLES.SUPER_ADMIN));

router.get('/dashboard', ctrl.dashboard);
router.get('/empresas', ctrl.listarEmpresas);
router.get('/empresas/nueva', ctrl.mostrarFormularioEmpresa);
router.post('/empresas', ctrl.crearEmpresa);
router.post('/empresas/:tenant_id/suspender', ctrl.suspenderEmpresa);
router.post('/empresas/:tenant_id/activar', ctrl.activarEmpresa);

module.exports = router;
