/**
 * Role constants and helpers shared by the router guards and pages.
 * These mirror the backend role values exactly (uppercase).
 */
export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  ORGANISER: 'ORGANISER',
  USER: 'USER',
});

/** Account types a visitor may pick during registration (never ADMIN). */
export const REGISTERABLE_ROLES = Object.freeze([
  { value: ROLES.USER, label: 'Participant (User)' },
  { value: ROLES.ORGANISER, label: 'Organiser' },
]);

const HOME_PATH_BY_ROLE = {
  [ROLES.ADMIN]: '/admin',
  [ROLES.ORGANISER]: '/organiser',
  [ROLES.USER]: '/user',
};

/** The landing route for a given role after login / when redirected away. */
export const roleHomePath = (role) => HOME_PATH_BY_ROLE[role] ?? '/';

export const roleLabel = (role) =>
  ({ ADMIN: 'Admin', ORGANISER: 'Organiser', USER: 'Participant' }[role] ?? role);
