import mongoose from 'mongoose';

/**
 * A preparation task for an event. Belongs to exactly one Event; the
 * organiser who owns that Event manages it. `assignedTo` is a free-text
 * name/label for now (no User reference — team members are a separate,
 * non-account model in this phase).
 */
export const TASK_STATUSES = Object.freeze(['TODO', 'IN_PROGRESS', 'COMPLETED']);
export const TASK_PRIORITIES = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const eventTaskSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required.'],
      trim: true,
      minlength: [2, 'Task title must be at least 2 characters.'],
      maxlength: [200, 'Task title must be at most 200 characters.'],
    },
    description: { type: String, trim: true, maxlength: [2000, 'Description is too long.'], default: '' },
    assignedTo: { type: String, trim: true, maxlength: [150, 'Assignee is too long.'], default: '' },
    priority: {
      type: String,
      enum: { values: TASK_PRIORITIES, message: '{VALUE} is not a valid priority.' },
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: { values: TASK_STATUSES, message: '{VALUE} is not a valid task status.' },
      default: 'TODO',
    },
    dueDate: { type: Date, default: null },
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

eventTaskSchema.index({ event: 1, status: 1 });
eventTaskSchema.index({ event: 1, dueDate: 1 });

const EventTask = mongoose.model('EventTask', eventTaskSchema);
export default EventTask;
