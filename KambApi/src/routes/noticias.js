// src/routes/noticias.js
const express = require('express');
const router = express.Router();
const { ultimas } = require('../controllers/noticiasController');

router.get('/', ultimas);

module.exports = router;