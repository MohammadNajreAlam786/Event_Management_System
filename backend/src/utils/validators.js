/**
 * Small, dependency-free validation helpers for auth input.
 *
 * These run before Mongoose so the API can return clear, field-level messages;
 * the User schema enforces the same rules as a second layer of defence.
 */

// Pragmatic email pattern: something@something.tld with no spaces.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_MIN_LENGTH = 8;

/**
 * Password policy: at least PASSWORD_MIN_LENGTH characters, containing at
 * least one letter and one digit.
 */
export const PASSWORD_POLICY_TEXT =
  `at least ${PASSWORD_MIN_LENGTH} characters and include at least one letter and one number`;

export const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

export const isValidEmail = (value) =>
  typeof value === 'string' && EMAIL_PATTERN.test(value.trim());

export const isValidPassword = (value) =>
  typeof value === 'string' &&
  value.length >= PASSWORD_MIN_LENGTH &&
  /[A-Za-z]/.test(value) &&
  /\d/.test(value);

export const normalizeEmail = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/**
 * Validate a registration payload.
 *
 * `confirmPassword` is optional: when present it must match `password`
 * (the frontend always sends it; direct API clients may omit it).
 *
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export const validateRegistration = ({ name, email, password, confirmPassword } = {}) => {
  const errors = {};

  if (!isNonEmptyString(name)) {
    errors.name = 'Name is required.';
  } else if (name.trim().length < 2 || name.trim().length > 100) {
    errors.name = 'Name must be between 2 and 100 characters.';
  }

  if (!isNonEmptyString(email)) {
    errors.email = 'Email is required.';
  } else if (!isValidEmail(email)) {
    errors.email = 'Please provide a valid email address.';
  }

  if (!isNonEmptyString(password)) {
    errors.password = 'Password is required.';
  } else if (!isValidPassword(password)) {
    errors.password = `Password must be ${PASSWORD_POLICY_TEXT}.`;
  }

  if (confirmPassword !== undefined && confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
};

/**
 * Validate a login payload (presence only — credentials are checked later).
 *
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export const validateLogin = ({ email, password } = {}) => {
  const errors = {};

  if (!isNonEmptyString(email)) {
    errors.email = 'Email is required.';
  } else if (!isValidEmail(email)) {
    errors.email = 'Please provide a valid email address.';
  }

  if (!isNonEmptyString(password)) {
    errors.password = 'Password is required.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
};
