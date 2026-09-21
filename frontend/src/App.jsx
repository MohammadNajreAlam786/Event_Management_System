import { useEffect } from 'react';

import AppRoutes from './routes/AppRoutes.jsx';
import FullScreenLoader from './components/FullScreenLoader.jsx';
import useAuthStore from './store/useAuthStore.js';

/**
 * Application shell. Runs the one-time session rehydration (/auth/me) before
 * rendering routes, so guards see a settled auth state and don't flash-redirect.
 * The router provider is set up in main.jsx.
 */
const App = () => {
  const initialize = useAuthStore((s) => s.initialize);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!isInitialized) {
    return <FullScreenLoader label="Starting…" />;
  }

  return <AppRoutes />;
};

export default App;
