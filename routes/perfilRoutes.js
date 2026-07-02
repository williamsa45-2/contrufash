const express = require('express');
const router  = express.Router();

const auth = require('../middleware/auth');
const ctrl = require('../controllers/perfilController');
const notifCtrl = require('../controllers/notificacionController');

// Perfil — disponible para todos los roles autenticados
router.get('/',                     auth, ctrl.mostrarPerfil);
router.post('/actualizar',          auth, ctrl.actualizarPerfil);
router.post('/cambiar-password',    auth, ctrl.cambiarPassword);

// Notificaciones — API usada por la campana del topbar
router.get('/api/notificaciones',            auth, notifCtrl.listar);
router.get('/api/notificaciones/sin-leer',   auth, notifCtrl.conteoSinLeer);
router.post('/api/notificaciones/marcar-leidas', auth, notifCtrl.marcarTodasLeidas);
router.post('/api/notificaciones/:id/leer',  auth, notifCtrl.marcarUnaLeida);
router.delete('/api/notificaciones/limpiar', auth, notifCtrl.limpiarLeidas);

module.exports = router;
