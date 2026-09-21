import mongoose from 'mongoose';

/** A single item in an event's run-of-show. Ordered chronologically by startTime. */
export const SCHEDULE_TYPES = Object.freeze([
  'SESSION',
  'REGISTRATION',
  'CEREMONY',
  'BREAK',
  'MEAL',
  'WORKSHOP',
  'OTHER',
]);

const eventScheduleSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    title: {
      type: String,
      required: [true, 'Schedule item title is required.'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters.'],
      maxlength: [200, 'Title must be at most 200 characters.'],
    },
    description: { type: String, trim: true, maxlength: [2000, 'Description is too long.'], default: '' },
    startTime: { type: Date, required: [true, 'Start time is required.'] },
    endTime: { type: Date, required: [true, 'End time is required.'] },
    location: { type: String, trim: true, maxlength: [200, 'Location is too long.'], default: '' },
    type: {
      type: String,
      enum: { values: SCHEDULE_TYPES, message: '{VALUE} is not a valid schedule type.' },
      default: 'SESSION',
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

eventScheduleSchema.pre('validate', function checkTimeOrder(next) {
  if (this.startTime && this.endTime && this.endTime < this.startTime) {
    this.invalidate('endTime', 'End time must not be before the start time.');
  }
  next();
});

eventScheduleSchema.index({ event: 1, startTime: 1 });

const EventSchedule = mongoose.model('EventSchedule', eventScheduleSchema);
export default EventSchedule;
