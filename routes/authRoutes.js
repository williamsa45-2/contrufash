const express = require('express');
const router = express.Router();
const { mostrarLogin, login, logout } = require('../controllers/authController');

router.get('/login', mostrarLogin);
router.post('/api/auth/login', login);
router.get('/logout', logout);

module.exports = router;
