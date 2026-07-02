const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const tenantScope = require('../middleware/tenantScope');
const { ROLES } = require('../utils/roles');
const panelCtrl = require('../controllers/panelController');

router.get('/bodega/dashboard', auth, rbac(ROLES.ALMACENISTA), tenantScope, panelCtrl.almacenistaDashboard);

module.exports = router;

// Sprint 4 — Dashboard del cliente reemplazado por clienteController
// (panelRoutes solo conserva las rutas que NO tienen su propio router)
