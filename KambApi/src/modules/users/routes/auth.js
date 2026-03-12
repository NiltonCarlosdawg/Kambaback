// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { registrar, login, refresh, perfil, atualizarPerfil } = require('../controllers/authController');
const { protegerRota } = require('../../../middleware/auth');
const { validar, registroSchema, loginSchema } = require('../../../middleware/validator');
const { limiteAuth } = require('../../../middleware/rateLimiter'); // Importe o rate limiter

// Registro - COM rate limit e validação
router.post('/register', limiteAuth, validar(registroSchema), registrar);

// Login - COM rate limit e validação  
router.post('/login', limiteAuth, validar(loginSchema), login);

// Refresh token - SEM rate limit (já requer token válido)
router.post('/refresh', refresh);

// Rotas protegidas - SEM rate limit (já têm proteção por token)
router.use(protegerRota);
router.get('/perfil', perfil);
router.patch('/perfil', atualizarPerfil);

module.exports = router;