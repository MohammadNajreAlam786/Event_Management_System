import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import { PASSWORD_MIN_LENGTH } from '../utils/validators.js';

/**
 * Role and status enums. Values are stored exactly as written (uppercase).
 */
export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  ORGANISER: 'ORGANISER',
  USER: 'USER',
});

export const USER_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});

/** Roles a visitor may self-assign at registration (never ADMIN). */
export const PUBLIC_REGISTRATION_ROLES = Object.freeze([ROLES.USER, ROLES.ORGANISER]);

const BCRYPT_SALT_ROUNDS = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters.'],
      maxlength: [100, 'Name must be at most 100 characters.'],
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_PATTERN, 'Please provide a valid email address.'],
    },
    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`],
      // Never returned by default queries; must be explicitly `.select('+password')`.
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: Object.values(ROLES),
        message: '{VALUE} is not a valid role.',
      },
      default: ROLES.USER,
    },
    status: {
      type: String,
      enum: {
        values: Object.values(USER_STATUS),
        message: '{VALUE} is not a valid status.',
      },
      default: USER_STATUS.ACTIVE,
    },
  },
  {
    timestamps: true, // adds createdAt / updatedAt
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.password;
        return ret;
      },
    },
  },
);

// Hash the password whenever it is set or changed.
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, BCRYPT_SALT_ROUNDS);
    return next();
  } catch (error) {
    return next(error);
  }
});

/**
 * Compare a plaintext candidate against the stored hash.
 * Requires the document to have been loaded with the password field.
 */
userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

/** Safe projection returned to clients (no password, no __v). */
userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    status: this.status,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const User = mongoose.model('User', userSchema);

export default User;
