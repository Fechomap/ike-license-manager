// src/routes/apiRoutes.ts
import { Router } from 'express';

import * as apiController from '../controllers/apiController';

const router = Router();

router.get('/status', (_req, res) => {
  res.json({ message: 'API funcionando correctamente' });
});

router.post('/validate', apiController.validateToken);
router.get('/tokens', apiController.getAllTokens);
router.get('/check-validity/:token', apiController.checkTokenValidity);

export default router;
