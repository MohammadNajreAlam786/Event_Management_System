import { useEffect } from 'react';

import api from '../services/api.js';
import useAppStore from '../store/useAppStore.js';

const statusStyles = {
  online: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  offline: 'border-rose-200 bg-rose-50 text-rose-700',
  checking: 'border-amber-200 bg-amber-50 text-amber-700',
  unknown: 'border-slate-200 bg-slate-50 text-slate-600',
};

/**
 * Calls the backend health endpoint through the shared Axios instance and
 * records the result in the Zustand store. Demonstrates the
 * frontend -> backend communication path for Phase 0.
 */
const BackendStatus = () => {
  const backendStatus = useAppStore((state) => state.backendStatus);
  const backendMessage = useAppStore((state) => state.backendMessage);
  const setBackendStatus = useAppStore((state) => state.setBackendStatus);

  useEffect(() => {
    let active = true;
    setBackendStatus('checking');

    api
      .get('/health')
      .then((response) => {
        if (!active) return;
        setBackendStatus('online', response.data?.message || 'Backend is running');
      })
      .catch((error) => {
        if (!active) return;
        setBackendStatus('offline', error.message);
      });

    return () => {
      active = false;
    };
  }, [setBackendStatus]);

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${statusStyles[backendStatus]}`}>
      <p className="font-medium">Backend connection: {backendStatus}</p>
      {backendMessage && <p className="mt-1 opacity-80">{backendMessage}</p>}
    </div>
  );
};

export default BackendStatus;
