import mongoose from 'mongoose';

/**
 * Certificate — an academic participation certificate issued to a participant
 * who actually attended a completed event (Phase 8).
 *
 * Eligibility is derived from real Phase-6 Registration + Phase-7 Attendance
 * records (see certificate.service.js) — a certificate is never issued for a
 * mere registration. The document keeps *snapshots* of the recipient name,
 * event title and event date so the rendered PDF stays stable even if the
 * source records are later edited. The PDF itself is rendered on demand from
 * this record (no files are stored — see the Phase 8 report).
 */

export const CERTIFICATE_STATUSES = Object.freeze(['ISSUED']);
export const CERTIFICATE_TYPES = Object.freeze(['PARTICIPATION']);

const certificateSchema = new mongoose.Schema(
  {
    certificateNumber: { type: String, required: true, unique: true },
    verificationCode: { type: String, required: true, unique: true },

    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true },
    attendance: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance', required: true },

    // Snapshots taken at issue time.
    recipientName: { type: String, required: true, trim: true },
    eventTitle: { type: String, required: true, trim: true },
    eventDate: { type: Date, default: null },
    issuerName: { type: String, default: '', trim: true },
    institution: { type: String, default: 'Sreyas Institute of Engineering and Technology', trim: true },

    certificateType: {
      type: String,
      enum: { values: CERTIFICATE_TYPES, message: '{VALUE} is not a valid certificate type.' },
      default: 'PARTICIPATION',
    },
    status: {
      type: String,
      enum: { values: CERTIFICATE_STATUSES, message: '{VALUE} is not a valid certificate status.' },
      default: 'ISSUED',
    },
    issueDate: { type: Date, default: Date.now },
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

// One certificate per (user, event, type) — enforced at the database level so a
// re-run of "Generate certificates" can never create a duplicate.
certificateSchema.index({ user: 1, event: 1, certificateType: 1 }, { unique: true });

const Certificate = mongoose.model('Certificate', certificateSchema);

export default Certificate;
