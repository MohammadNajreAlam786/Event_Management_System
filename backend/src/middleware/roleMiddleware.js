import { ApiError } from '../utils/apiError.js';

/**
 * Role-based authorization guard. Use after `authenticate`.
 *
 *   router.get('/admin/thing', authenticate, requireRole('ADMIN'), handler);
 *   router.get('/staff/thing', authenticate, requireRole('ADMIN', 'ORGANISER'), handler);
 *
 * Rejects any authenticated user whose role is not in the allowed list.
 */
export const requireRole = (...allowedRoles) => {
  const allowed = allowedRoles.map((role) => String(role).toUpperCase());

  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required. Please log in.'));
    }
    if (!allowed.includes(req.user.role)) {
      return next(ApiError.forbidden('You are not authorized to access this resource.'));
    }
    return next();
  };
};
