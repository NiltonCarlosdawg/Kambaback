const express = require('express');
const router = express.Router();

const {
  registrar,
  login,
  refresh,
  perfil,
  atualizarPerfil
} = require('../controllers/authController');

const { protegerRota } = require('../middleware/auth');
const { validar, registroSchema, loginSchema, refreshTokenSchema, atualizarPerfilSchema } = require('../middleware/validator');

// ==========================================
// ROTAS PÚBLICAS (sem autenticação)
// ==========================================
router.post('/register', validar(registroSchema), registrar);
router.post('/login',    validar(loginSchema),    login);
router.post('/refresh',  validar(refreshTokenSchema), refresh);

// ==========================================
// ROTAS PROTEGIDAS (com JWT)
// ==========================================
router.use(protegerRota); // todas as rotas abaixo exigem token

router.get('/perfil', perfil);
router.patch('/perfil', validar(atualizarPerfilSchema), atualizarPerfil);

// ==========================================
// FUTURAS ROTAS
// ==========================================
// router.post('/esqueci-senha', ...)
// router.post('/verificar-email', ...)

module.exports = router;
