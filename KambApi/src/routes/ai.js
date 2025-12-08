// src/routes/ai.js
const express = require('express');
const router = express.Router();
const { protegerRota } = require('../middleware/auth');
const { salvarApiKey, obterConfig } = require('../controllers/aiConfigController');

router.use(protegerRota);

router.post('/config', salvarApiKey);
router.get('/config', obterConfig);

module.exports = router;