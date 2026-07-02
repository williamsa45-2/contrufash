const express = require('express');
const router  = express.Router();

const auth        = require('../middleware/auth');
const rbac        = require('../middleware/rbac');
const tenantScope = require('../middleware/tenantScope');
const { upload, comprimirImagen } = require('../middleware/upload');
const { ROLES }   = require('../utils/roles');
const ctrl        = require('../controllers/constructorController');

const constrAuth = [auth, rbac(ROLES.CONSTRUCTOR), tenantScope];

// Panel principal
router.get('/dashboard', ...constrAuth, ctrl.dashboard);

// Fotos de cumplimiento (RF-14)
router.get('/proyectos/:proyectoId/fase/:faseId/fotos', ...constrAuth, ctrl.mostrarFotos);
router.post('/api/construccion/fotos', ...constrAuth, upload.single('foto'), comprimirImagen, ctrl.subirFoto);

// Alerta al Jefe de Obra (RF-15)
router.post('/api/construccion/alerta', ...constrAuth, ctrl.reportarAlerta);

module.exports = router;
