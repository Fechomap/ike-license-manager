// src/routes/telegramRoutes.js
const express = require('express');
const router = express.Router();
const telegramController = require('../controllers/telegramController');

// En lugar de usar /webhook, simplemente definimos endpoints básicos
router.get('/status', (req, res) => {
  res.json({ status: 'Telegram bot activo' });
});

// No necesitamos más rutas aquí ya que el bot maneja los comandos directamente
module.exports = router;