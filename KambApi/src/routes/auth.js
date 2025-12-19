// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { registrar, login, refresh, perfil, atualizarPerfil } = require('../controllers/authController');
const { protegerRota } = require('../middleware/auth');
const { validar, registroSchema, loginSchema } = require('../middleware/validator');

// Registro — com validação
router.post('/register', validar(registroSchema), registrar);
//router.post('/register', authController.registrar);

// Login — com validação
router.post('/login', validar(loginSchema), login);

// Refresh token
router.post('/refresh', refresh);

// Rotas protegidas
router.use(protegerRota);
router.get('/perfil', perfil);
router.patch('/perfil', atualizarPerfil);

module.exports = router;