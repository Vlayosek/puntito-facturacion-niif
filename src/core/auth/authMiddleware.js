/**
 * authMiddleware — Middleware Express para validar JWT en todos los endpoints protegidos
 * Extrae el usuario del token y lo agrega a req.user
 */

import { AuthService } from '../auth/AuthService.js';

/**
 * Middleware que requiere autenticacion JWT valida.
 * Uso: app.use('/api/invoices', authenticate, handler)
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'No autorizado. Se requiere token JWT.',
      code: 'NO_TOKEN'
    });
  }

  const token = authHeader.substring(7); // Quitar "Bearer "

  try {
    const payload = AuthService.verifyToken(token);
    req.user = payload; // { idUsuario, idCliente, usuario, nombre, empresaNombre, empresaRuc }
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: err.message,
      code: 'INVALID_TOKEN'
    });
  }
}
