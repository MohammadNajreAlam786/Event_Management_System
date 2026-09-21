import 'dotenv/config';

import { env, assertRequiredEnv } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { logger } from './logger.js';
import { isValidEmail, isValidPassword, PASSWORD_POLICY_TEXT } from './validators.js';
import User, { ROLES, USER_STATUS } from '../models/user.model.js';

/**
 * Idempotent creation of the initial ADMIN account.
 *
 * Credentials come exclusively from environment variables
 * (ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD). Running this multiple times
 * will NOT create duplicates — if an account with ADMIN_EMAIL already exists
 * it is left untouched.
 *
 * Usage:  npm run seed:admin        (from the backend/ directory)
 */
const seedAdmin = async () => {
  assertRequiredEnv({ requireAdmin: true });

  const email = env.admin.email.trim().toLowerCase();
  const { name, password } = env.admin;

  if (!isValidEmail(email)) {
    throw new Error('ADMIN_EMAIL is not a valid email address.');
  }
  if (!isValidPassword(password)) {
    throw new Error(`ADMIN_PASSWORD must be ${PASSWORD_POLICY_TEXT}.`);
  }

  await connectDatabase(env.mongoUri);

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== ROLES.ADMIN) {
      logger.warn(
        `A non-admin account already uses ${email} (role: ${existing.role}). No changes made.`,
      );
    } else {
      logger.info(`Admin account already exists for ${email}. Nothing to do.`);
    }
    return;
  }

  const admin = await User.create({
    name: name.trim(),
    email,
    password,
    role: ROLES.ADMIN,
    status: USER_STATUS.ACTIVE,
  });

  logger.info(`Admin account created: ${admin.email} (id ${admin._id}).`);
};

seedAdmin()
  .then(() => {
    logger.info('Admin seed finished.');
  })
  .catch((error) => {
    logger.error('Admin seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase().catch(() => {});
  });
