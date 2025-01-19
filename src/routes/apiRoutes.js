// src/routes/apiRoutes.js
const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

router.get('/status', (req, res) => {
  res.json({ message: 'API funcionando correctamente' });
});

// Cambiado de validateLicense a validateToken
router.post('/validate', apiController.validateToken);

// Si existe el método getAllTokens en el controlador o en el servicio...
router.get('/tokens', apiController.getAllTokens);

module.exports = router;