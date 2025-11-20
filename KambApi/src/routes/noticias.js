const express = require('express');
const router = express.Router();

const { obterNoticias } = require('../controllers/noticiasController');
const { protegerRota } = require('../middleware/auth');

// ==========================================
// ROTAS DE NOTÍCIAS
// ==========================================

// Caso queira contar visualizações por usuário, manter protegido
router.use(protegerRota); 
// Se quiser que seja totalmente público, comentar a linha acima

router.get('/', obterNoticias);
// ?filtro=angola (já está fixo)

// Exportar router corretamente
module.exports = router;
