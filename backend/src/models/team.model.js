import mongoose from 'mongoose';

/**
 * A participant team registered for a TEAM-type event (Phase 14).
 *
 * Deliberately NOT a replacement for Registration: each team member (leader
 * included) still gets their own Registration row (see registration.model.js's
 * `team` reference), so QR attendance, certificates and analytics keep working
 * per-individual exactly as before — this model only holds the team-level
 * metadata (name, generated id, leader, declared size, team-level status).
 */
export const TEAM_REGISTRATION_STATUSES = Object.freeze(['REGISTERED', 'CANCELLED']);

const teamSchema = new mongoose.Schema(
  {
    // Public identifier shown to users, e.g. "TEAM-AB12CD". Generated and
    // validated by the server only — never accepted from a client.
    teamId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Team name is required.'],
      trim: true,
      minlength: [2, 'Team name must be at least 2 characters.'],
      maxlength: [120, 'Team name must be at most 120 characters.'],
    },
    leader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    size: {
      type: Number,
      required: true,
      min: [2, 'A team must have at least 2 members.'],
    },
    status: {
      type: String,
      enum: { values: TEAM_REGISTRATION_STATUSES, message: '{VALUE} is not a valid team status.' },
      default: 'REGISTERED',
    },
    cancelledAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  },
);

teamSchema.index({ event: 1, status: 1 });

const Team = mongoose.model('Team', teamSchema);

export default Team;
