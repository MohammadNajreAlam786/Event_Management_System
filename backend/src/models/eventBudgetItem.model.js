import mongoose from 'mongoose';

/**
 * A line in an event's budget. `actualAmount` defaults to null ("not entered
 * yet") so it is distinguishable from a real 0. Totals/variance are computed
 * in the planning service, never stored.
 */
export const BUDGET_STATUSES = Object.freeze(['PLANNED', 'APPROVED', 'PAID']);
export const BUDGET_CATEGORIES = Object.freeze([
  'VENUE',
  'EQUIPMENT',
  'FOOD',
  'TRANSPORTATION',
  'MARKETING',
  'DECORATION',
  'SPEAKERS',
  'CERTIFICATES',
  'MISCELLANEOUS',
]);

const eventBudgetItemSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    category: {
      type: String,
      enum: { values: BUDGET_CATEGORIES, message: '{VALUE} is not a valid budget category.' },
      required: [true, 'Budget category is required.'],
    },
    description: { type: String, trim: true, maxlength: [2000, 'Description is too long.'], default: '' },
    estimatedAmount: { type: Number, default: 0, min: [0, 'Estimated amount cannot be negative.'] },
    actualAmount: {
      type: Number,
      default: null,
      min: [0, 'Actual amount cannot be negative.'],
    },
    status: {
      type: String,
      enum: { values: BUDGET_STATUSES, message: '{VALUE} is not a valid budget status.' },
      default: 'PLANNED',
    },
    notes: { type: String, trim: true, maxlength: [2000, 'Notes are too long.'], default: '' },
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

eventBudgetItemSchema.index({ event: 1, status: 1 });

const EventBudgetItem = mongoose.model('EventBudgetItem', eventBudgetItemSchema);
export default EventBudgetItem;
