// En apiRoutes.js

const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

// Rutas existentes
router.get('/status', (req, res) => {
  res.json({ message: 'API funcionando correctamente' });
});

router.post('/validate', apiController.validateToken);
router.get('/tokens', apiController.getAllTokens);

// Nueva ruta para verificar vigencia
router.get('/check-validity/:token', apiController.checkTokenValidity);

module.exports = router;