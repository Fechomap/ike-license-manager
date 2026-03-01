// src/middleware/authMiddleware.ts
import type { Request, Response, NextFunction } from 'express';

import { verifyToken } from '../services/authService';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Token de autorizacion requerido' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ success: false, message: 'Token de autorizacion requerido' });
    return;
  }

  try {
    const decoded = verifyToken(token);
    (req as Request & { user?: unknown }).user = decoded;
    next();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error: unknown) {
    res.status(401).json({ success: false, message: 'Token invalido o expirado' });
  }
}
