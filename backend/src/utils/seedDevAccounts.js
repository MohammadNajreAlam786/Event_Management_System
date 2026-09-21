import 'dotenv/config';

import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { logger } from './logger.js';
import { isValidEmail, isValidPassword, PASSWORD_POLICY_TEXT } from './validators.js';
import User, { ROLES, USER_STATUS } from '../models/user.model.js';

/**
 * Development / test account provisioning.
 *
 * Converges the database on exactly the three fixed local accounts below
 * (one per role). It is idempotent and safe to re-run:
 *   - an account already using the target email  -> password/role/status refreshed
 *   - the previous same-role dev account          -> email re-pointed + refreshed
 *   - nothing found                               -> created
 *
 * It does NOT touch authentication, RBAC, the User schema or any route. Writes
 * go through the existing Mongoose model, so passwords are hashed by the
 * model's pre('save') bcrypt hook exactly like every other account.
 *
 * These are non-secret local credentials for development and testing only.
 *
 * Usage:  npm run seed:dev        (from the backend/ directory)
 */
const DEV_ACCOUNTS = [
  { name: 'System Administrator', email: 'admin@gmail.com',     password: 'admin@123',     role: ROLES.ADMIN },
  { name: 'Olivia Organiser',     email: 'organiser@gmail.com', password: 'organiser@123', role: ROLES.ORGANISER },
  { name: 'Uma Participant',      email: 'user@gmail.com',      password: 'user@123',      role: ROLES.USER },
];

/**
 * Previous local dev accounts (pre-existing). Each is superseded 1:1 by the
 * matching-role entry above; the seeder re-points these by email rather than
 * leaving a duplicate behind. Only these exact addresses are ever reused.
 */
const SUPERSEDED_BY_ROLE = {
  [ROLES.ADMIN]: 'admin@eventms.local',
  [ROLES.ORGANISER]: 'organiser@eventms.local',
  [ROLES.USER]: 'user@eventms.local',
};

const provision = async ({ name, email, password, role }) => {
  const target = email.trim().toLowerCase();

  let doc = await User.findOne({ email: target }).select('+password');
  let action;

  if (doc) {
    action = 'updated (email already present)';
  } else {
    const legacyEmail = SUPERSEDED_BY_ROLE[role];
    doc = legacyEmail
      ? await User.findOne({ email: legacyEmail }).select('+password')
      : null;
    action = doc ? `updated (re-pointed from ${doc.email})` : 'created';
  }

  if (doc) {
    doc.name = name;
    doc.email = target;
    doc.role = role;
    doc.status = USER_STATUS.ACTIVE;
    doc.password = password; // re-hashed by the model's pre('save') hook
    await doc.save();
  } else {
    doc = await User.create({
      name,
      email: target,
      password,
      role,
      status: USER_STATUS.ACTIVE,
    });
  }

  return { email: target, role: doc.role, action };
};

const seedDevAccounts = async () => {
  for (const acct of DEV_ACCOUNTS) {
    if (!isValidEmail(acct.email)) {
      throw new Error(`${acct.email} is not a valid email address.`);
    }
    if (!isValidPassword(acct.password)) {
      throw new Error(`Password for ${acct.email} must be ${PASSWORD_POLICY_TEXT}.`);
    }
  }

  await connectDatabase(env.mongoUri);

  const results = [];
  for (const acct of DEV_ACCOUNTS) {
    // Sequential on purpose: re-point + create must not race on the email index.
    results.push(await provision(acct)); // eslint-disable-line no-await-in-loop
  }

  for (const r of results) {
    logger.info(`dev account ${r.action}: ${r.email} (${r.role})`);
  }

  const total = await User.countDocuments();
  logger.info(`Total user accounts in ${env.mongoUri.split('/').pop()}: ${total}.`);
  if (total !== DEV_ACCOUNTS.length) {
    logger.warn(
      `Expected exactly ${DEV_ACCOUNTS.length} accounts but found ${total}. ` +
        'Extra accounts were left untouched — remove them manually if unwanted.',
    );
  }
};

seedDevAccounts()
  .then(() => {
    logger.info('Dev account seed finished.');
  })
  .catch((error) => {
    logger.error('Dev account seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase().catch(() => {});
  });
