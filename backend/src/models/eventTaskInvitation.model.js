import mongoose from 'mongoose';

export const INVITATION_STATUSES = Object.freeze(['PENDING', 'ACCEPTED', 'DECLINED']);

// One invitation is attached to one assigned task. The recipient is always a
// real USER account, resolved server-side from the team contact's email.
const eventTaskInvitationSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'EventTask', required: true, unique: true, index: true },
    teamMember: { type: mongoose.Schema.Types.ObjectId, ref: 'EventTeamMember', required: true, index: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: INVITATION_STATUSES, default: 'PENDING', index: true },
    respondedAt: { type: Date, default: null },
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

eventTaskInvitationSchema.index({ recipient: 1, status: 1, createdAt: -1 });
eventTaskInvitationSchema.index({ event: 1, teamMember: 1 });

const EventTaskInvitation = mongoose.model('EventTaskInvitation', eventTaskInvitationSchema);
export default EventTaskInvitation;
