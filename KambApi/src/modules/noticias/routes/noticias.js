// src/routes/noticias.js
const express = require('express');
const router = express.Router();
const { protegerRota } = require('../../../middleware/auth');
const { ultimas, resumo, impacto } = require('../controllers/noticiasController');

router.get('/', ultimas);
router.get('/resumo', resumo);
router.get('/impacto', protegerRota, impacto);

module.exports = router;