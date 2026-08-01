const express = require('express');
const router = express.Router();
const { mostrarLanding, crearCotizacion } = require('../controllers/landingController');

router.get('/', mostrarLanding);
router.post('/cotizar', crearCotizacion);

module.exports = router;
