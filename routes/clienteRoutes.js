const express = require('express');
const router  = express.Router();

const auth        = require('../middleware/auth');
const rbac        = require('../middleware/rbac');
const tenantScope = require('../middleware/tenantScope');
const { ROLES }   = require('../utils/roles');
const ctrl        = require('../controllers/clienteController');

const cliAuth = [auth, rbac(ROLES.CLIENTE), tenantScope];

router.get('/dashboard', ...cliAuth, ctrl.dashboard);
router.get('/proyectos/:id/galeria', ...cliAuth, ctrl.galeria);

module.exports = router;
