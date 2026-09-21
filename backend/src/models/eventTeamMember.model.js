import mongoose from 'mongoose';

/**
 * A person helping run an event. This is deliberately NOT a User account —
 * it just holds contact details + a responsibility. Later phases may link
 * confirmed members to real accounts.
 */
export const TEAM_STATUSES = Object.freeze(['INVITED', 'CONFIRMED', 'ACTIVE', 'COMPLETED']);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const eventTeamMemberSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    name: {
      type: String,
      required: [true, 'Team member name is required.'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters.'],
      maxlength: [150, 'Name must be at most 150 characters.'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      validate: {
        validator: (v) => !v || EMAIL_PATTERN.test(v),
        message: 'Please provide a valid email address.',
      },
    },
    role: { type: String, trim: true, maxlength: [120, 'Role is too long.'], default: '' },
    responsibility: { type: String, trim: true, maxlength: [500, 'Responsibility is too long.'], default: '' },
    status: {
      type: String,
      enum: { values: TEAM_STATUSES, message: '{VALUE} is not a valid team status.' },
      default: 'INVITED',
    },
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

eventTeamMemberSchema.index({ event: 1, status: 1 });

const EventTeamMember = mongoose.model('EventTeamMember', eventTeamMemberSchema);
export default EventTeamMember;
