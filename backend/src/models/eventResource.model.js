import mongoose from 'mongoose';

/**
 * A physical/logistical resource needed for an event. `estimatedTotalCost`
 * is a virtual (quantity × estimatedUnitCost) — never stored, so it can't
 * drift.
 */
export const RESOURCE_STATUSES = Object.freeze(['REQUIRED', 'ORDERED', 'AVAILABLE', 'NOT_AVAILABLE']);
export const RESOURCE_CATEGORIES = Object.freeze([
  'EQUIPMENT',
  'FURNITURE',
  'TECHNICAL',
  'STATIONERY',
  'FOOD',
  'TRANSPORT',
  'DECORATION',
  'OTHER',
]);

const eventResourceSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    name: {
      type: String,
      required: [true, 'Resource name is required.'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters.'],
      maxlength: [200, 'Name must be at most 200 characters.'],
    },
    description: { type: String, trim: true, maxlength: [2000, 'Description is too long.'], default: '' },
    category: {
      type: String,
      enum: { values: RESOURCE_CATEGORIES, message: '{VALUE} is not a valid resource category.' },
      default: 'OTHER',
    },
    quantity: { type: Number, default: 1, min: [1, 'Quantity must be at least 1.'] },
    unit: { type: String, trim: true, maxlength: [30, 'Unit is too long.'], default: '' },
    status: {
      type: String,
      enum: { values: RESOURCE_STATUSES, message: '{VALUE} is not a valid resource status.' },
      default: 'REQUIRED',
    },
    estimatedUnitCost: { type: Number, default: 0, min: [0, 'Estimated cost cannot be negative.'] },
    notes: { type: String, trim: true, maxlength: [2000, 'Notes are too long.'], default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  },
);

eventResourceSchema.virtual('estimatedTotalCost').get(function total() {
  return (this.quantity || 0) * (this.estimatedUnitCost || 0);
});

eventResourceSchema.index({ event: 1, status: 1 });

const EventResource = mongoose.model('EventResource', eventResourceSchema);
export default EventResource;
