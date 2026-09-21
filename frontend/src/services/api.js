import axios from 'axios';

/**
 * Centralised Axios instance. The base URL comes from VITE_API_URL
 * (see frontend/.env.example); a localhost default keeps the app working
 * without a .env file during development.
 *
 * Feature-specific API modules will be built on top of this instance in
 * later phases — do not scatter raw axios calls through the app.
 */
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL,
  timeout: 10000,
  // Send/receive the HTTP-only auth cookie on every request.
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Normalise errors so callers receive a consistent Error with the HTTP status
// and any field-level validation errors attached.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    const normalised = new Error(
      data?.message || error.message || 'Unexpected network error',
    );
    normalised.status = error.response?.status ?? null;
    const isBlob = typeof Blob !== 'undefined' && data instanceof Blob;
    normalised.fieldErrors = isBlob ? null : data?.errors ?? null;
    // Some controlled error responses (e.g. an "already checked in" 409) carry a
    // structured `data` payload the caller needs — surface it too.
    normalised.data = isBlob ? null : data?.data ?? null;
    // A blob-typed request (PDF download) returns its error body as a Blob.
    normalised.responseBlob = isBlob ? data : null;
    return Promise.reject(normalised);
  },
);

export default api;
