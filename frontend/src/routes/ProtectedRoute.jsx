import { Navigate, Outlet, useLocation } from 'react-router-dom';

import useAuthStore, { selectIsAuthenticated } from '../store/useAuthStore.js';

/**
 * Gate for routes that require *any* authenticated user.
 * Unauthenticated visitors are sent to /login (with the attempted path
 * remembered in router state).
 *
 * Usage (wrapper):   <ProtectedRoute><Thing /></ProtectedRoute>
 * Usage (layout):    <Route element={<ProtectedRoute />}> ... </Route>
 *
 * NOTE: This is a UX convenience only — the backend independently enforces
 * authentication and authorization on every protected API.
 */
const ProtectedRoute = ({ children }) => {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const location = useLocation();

  // App gates rendering on isInitialized; this is a defensive fallback.
  if (!isInitialized) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children ?? <Outlet />;
};

export default ProtectedRoute;
