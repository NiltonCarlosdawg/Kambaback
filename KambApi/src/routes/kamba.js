const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { validar } = require('../middleware/validator');
const { conversarComKamba } = require('../controllers/kambaController');
const { protegerRota } = require('../middleware/auth');

// ==========================================
// TODAS AS ROTAS DO KAMBA SÃO PROTEGIDAS
// ==========================================
router.use(protegerRota);

// ==========================================
// SCHEMA DE VALIDAÇÃO JOI – só aceita mensagem
// ==========================================
const conversaSchema = validar(
  Joi.object({
    mensagem: Joi.string().min(1).max(500).required()
      .messages({
        'any.required': 'Manda uma mensagem pro Kamba, mano!',
        'string.empty': 'A mensagem não pode estar vazia',
        'string.max': 'Mensagem muito longa, kamba! Máximo 500 caracteres'
      })
  })
);

// ==========================================
// ROTAS
// ==========================================
router.post('/conversa', conversaSchema, conversarComKamba);

// Futuras rotas (ex: comandos de voz)
// router.post('/comando-voz', upload.single('audio'), processarVoz);

// Exportar router corretamente
module.exports = router;
