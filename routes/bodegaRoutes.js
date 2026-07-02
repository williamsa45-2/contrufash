const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const tenantScope = require('../middleware/tenantScope');
const { upload, comprimirImagen } = require('../middleware/upload');
const { ROLES } = require('../utils/roles');
const materialCtrl = require('../controllers/materialController');
const kardexCtrl = require('../controllers/kardexController');

const almAuth = [auth, rbac(ROLES.ALMACENISTA), tenantScope];

// Sprint 2
router.get('/materiales', ...almAuth, materialCtrl.listarParaAlmacenista);
router.post('/api/materiales/:id/despachar', ...almAuth,
  upload.single('foto'), comprimirImagen, materialCtrl.despachar);

// Sprint 3 — Kardex
router.get('/kardex', ...almAuth, kardexCtrl.seleccionarProyecto);
router.get('/kardex/:proyectoId', ...almAuth, kardexCtrl.mostrarKardex);
router.post('/api/kardex/entrada', ...almAuth, kardexCtrl.registrarEntrada);
router.post('/api/kardex/ajuste', ...almAuth, kardexCtrl.registrarAjuste);

module.exports = router;
