// src/routes/noticias.js
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { protegerRota } = require('../../../middleware/auth');
const { validar } = require('../../../middleware/validator');
const { ultimas, resumo, impacto } = require('../controllers/noticiasController');

// F-016: as rotas de notícias são pagas (cache miss -> chamada ao LLM no
// /resumo e às APIs externas no /) — exigem autenticação e categoria
// limitada a um conjunto fechado, senão qualquer string anónima enche o
// Redis de chaves de cache e queima quota de IA (DoS de custo).
// União das categorias do backend (angola/global/mercados) com as que o
// frontend News.tsx envia (geral/financas/tech) para não partir a UI.
const noticiasQuerySchema = validar(
  Joi.object({
    categoria: Joi.string()
      .valid('angola', 'global', 'mercados', 'geral', 'financas', 'tech')
      .default('angola'),
  }).unknown(true),
  'query',
);

router.get('/', protegerRota, noticiasQuerySchema, ultimas);
router.get('/resumo', protegerRota, noticiasQuerySchema, resumo);
router.get('/impacto', protegerRota, impacto);

module.exports = router;