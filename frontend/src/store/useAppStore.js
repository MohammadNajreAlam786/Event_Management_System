import { create } from 'zustand';

/**
 * Global application store (Zustand) for non-auth UI state.
 * Authentication/session state lives in useAuthStore.js.
 */
const useAppStore = create((set) => ({
  appName: 'AI-Powered Event Planning & Management System',

  // Backend connectivity: 'unknown' | 'checking' | 'online' | 'offline'.
  backendStatus: 'unknown',
  backendMessage: '',

  setBackendStatus: (backendStatus, backendMessage = '') =>
    set({ backendStatus, backendMessage }),
}));

export default useAppStore;
