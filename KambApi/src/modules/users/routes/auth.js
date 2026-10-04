// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { registrar, login, refresh, perfil, atualizarPerfil, alterarSenha, logout } = require('../controllers/authController');
const { loginComGoogle } = require('../controllers/googleAuthController');
const { loginComApple } = require('../controllers/appleAuthController');
const { esqueciSenha, redefinirSenha } = require('../controllers/passwordResetController');
const { protegerRota } = require('../../../middleware/auth');
const { validar, registroSchema, loginSchema, esqueciSenhaSchema, redefinirSenhaSchema } = require('../../../middleware/validator');
const { limiteAuth } = require('../../../middleware/rateLimiter');

// Registro - COM rate limit e validação
router.post('/register', limiteAuth, validar(registroSchema), registrar);

// Login - COM rate limit e validação  
router.post('/login', limiteAuth, validar(loginSchema), login);

// Google OAuth (token-based)
router.post('/google', loginComGoogle);

// Apple OAuth (token-based)
router.post('/apple', loginComApple);

// Password reset - COM rate limit
router.post('/esqueci-senha', limiteAuth, validar(esqueciSenhaSchema), esqueciSenha);
router.post('/redefinir-senha', limiteAuth, validar(redefinirSenhaSchema), redefinirSenha);

// Refresh token - SEM rate limit (já requer token válido)
router.post('/refresh', refresh);

// Rotas protegidas - SEM rate limit (já têm proteção por token)
router.use(protegerRota);
router.get('/perfil', perfil);
router.patch('/perfil', atualizarPerfil);
router.post('/alterar-senha', alterarSenha);

// F-006: revogação de sessão no servidor (o handler existia mas nunca estava roteado)
// Nota: o modelo guarda um único refresh token por utilizador (coluna refreshToken),
// por isso o logout revoga a sessão ativa — um /logout-all seria equivalente.
router.post('/logout', logout);

module.exports = router;