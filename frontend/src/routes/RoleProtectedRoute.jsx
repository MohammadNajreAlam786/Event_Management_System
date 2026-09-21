import { Navigate, Outlet, useLocation } from 'react-router-dom';

import useAuthStore, { selectIsAuthenticated } from '../store/useAuthStore.js';
import { roleHomePath } from '../utils/roles.js';

/**
 * Gate for routes restricted to one or more roles. Use after authentication:
 *
 *   <RoleProtectedRoute roles={['ADMIN']}><AdminPage /></RoleProtectedRoute>
 *
 * Behaviour:
 *   - not logged in           -> redirect to /login
 *   - logged in, wrong role   -> redirect to the user's own area
 *   - logged in, allowed role -> render children
 *
 * The backend enforces the same role rules on its APIs.
 */
const RoleProtectedRoute = ({ roles = [], children }) => {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isInitialized) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const allowed = roles.map((r) => String(r).toUpperCase());
  if (allowed.length > 0 && !allowed.includes(user.role)) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }

  return children ?? <Outlet />;
};

export default RoleProtectedRoute;
