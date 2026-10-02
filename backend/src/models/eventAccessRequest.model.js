import mongoose from 'mongoose';

export const ACCESS_REQUEST_STATUSES = Object.freeze(['REQUESTED', 'APPROVED', 'REJECTED']);

const eventAccessRequestSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    teamMember: { type: mongoose.Schema.Types.ObjectId, ref: 'EventTeamMember', required: true, index: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ACCESS_REQUEST_STATUSES, default: 'REQUESTED', index: true },
    reason: { type: String, trim: true, maxlength: [1000, 'Reason is too long.'], default: '' },
    requestedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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

// A member may have only one outstanding request for an event, while keeping
// resolved request history intact.
eventAccessRequestSchema.index(
  { event: 1, requester: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'REQUESTED' } },
);
eventAccessRequestSchema.index({ event: 1, createdAt: -1 });

const EventAccessRequest = mongoose.model('EventAccessRequest', eventAccessRequestSchema);
export default EventAccessRequest;
