import api from './api.js';

/**
 * Authentication API calls. All requests go through the shared Axios instance
 * (which sends the HTTP-only auth cookie automatically). No token handling
 * happens in JavaScript.
 */
export const authService = {
  /**
   * @param {{ name: string, email: string, password: string, confirmPassword: string, role: string }} payload
   */
  async register(payload) {
    const { data } = await api.post('/auth/register', payload);
    return data; // { success, message, user }
  },

  /**
   * @returns {Promise<{ id, name, email, role }>} the authenticated user
   */
  async login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    return data.user;
  },

  async logout() {
    const { data } = await api.post('/auth/logout');
    return data;
  },

  /**
   * @returns {Promise<{ id, name, email, role }>} the current user
   * Rejects (401) when there is no valid session.
   */
  async getCurrentUser() {
    const { data } = await api.get('/auth/me');
    return data.user;
  },

  /** Self-service profile edit. Only `name` is currently editable. */
  async updateProfile({ name }) {
    const { data } = await api.patch('/auth/me', { name });
    return data.user;
  },

  /** Self-service password change. */
  async changePassword({ currentPassword, newPassword, confirmNewPassword }) {
    const { data } = await api.patch('/auth/me/password', { currentPassword, newPassword, confirmNewPassword });
    return data;
  },
};

export default authService;
