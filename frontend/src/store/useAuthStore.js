import { create } from 'zustand';

import authService from '../services/authService.js';

/**
 * Authentication state (Zustand).
 *
 * Strategy: the JWT lives in an HTTP-only cookie the browser manages, so this
 * store never holds a token — only the non-sensitive user profile
 * ({ id, name, email, role }) plus status flags.
 *
 *   status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated'
 *   isInitialized: the one-time session check on app load has completed
 */
const useAuthStore = create((set, get) => ({
  user: null,
  status: 'idle',
  isInitialized: false,
  isLoading: false,
  error: null,

  /** Run once on app start: rehydrate the session from the cookie via /auth/me. */
  initialize: async () => {
    if (get().isInitialized) return;
    try {
      const user = await authService.getCurrentUser();
      set({ user, status: 'authenticated' });
    } catch {
      set({ user: null, status: 'unauthenticated' });
    } finally {
      set({ isInitialized: true });
    }
  },

  /** @returns {Promise<{id,name,email,role}>} resolves with the user on success. */
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.login(email, password);
      set({ user, status: 'authenticated', isLoading: false });
      return user;
    } catch (err) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /** Register a USER or ORGANISER. Does not log in (caller redirects to /login). */
  register: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authService.register(payload);
      set({ isLoading: false });
      return data;
    } catch (err) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /** Self-service profile edit — updates the store's `user` immediately on success. */
  updateProfile: async (payload) => {
    const user = await authService.updateProfile(payload);
    set({ user });
    return user;
  },

  /** Self-service password change. Does not touch the local session/user. */
  changePassword: async (payload) => authService.changePassword(payload),

  logout: async () => {
    try {
      await authService.logout();
    } catch {
      // Even if the request fails, drop local state.
    } finally {
      set({ user: null, status: 'unauthenticated', error: null });
    }
  },

  clearError: () => set({ error: null }),
}));

/** Convenience selectors. */
export const selectIsAuthenticated = (state) => state.status === 'authenticated' && !!state.user;

export default useAuthStore;
