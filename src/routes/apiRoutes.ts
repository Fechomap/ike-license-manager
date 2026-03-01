// src/routes/apiRoutes.ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import * as apiController from '../controllers/apiController';
import { authenticate } from '../middleware/authMiddleware';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 5, // maximo 5 intentos por ventana
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos de login. Intente en 15 minutos.' },
});

const router = Router();

// Publicos
router.get('/status', (_req, res) => {
  res.json({ status: 'API is running', timestamp: new Date().toISOString() });
});
router.post('/validate', apiController.validateToken);
router.get('/check-validity/:token', apiController.checkTokenValidity);

// Login con rate limiting
router.post('/login', loginLimiter, apiController.login);

// Protegidos (admin)
router.get('/tokens', authenticate, apiController.getAllTokens);

export default router;
