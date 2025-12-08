// src/routes/kamba.js
const express = require('express');
const router = express.Router();
const { protegerRota } = require('../middleware/auth');
const { conversarComKamba } = require('../controllers/kambaController');

// Protege todas as rotas do Kamba
router.use(protegerRota);

// ROTA PRINCIPAL — ACEITA POST NA RAIZ
router.post('/', conversarComKamba);

// (Opcional) Também aceita /conversar se quiseres manter compatibilidade
router.post('/conversar', conversarComKamba);

module.exports = router;