import mongoose from 'mongoose';

/**
 * A named, atomically-incrementing counter (Phase 8).
 *
 * Used to mint stable, sequential, human-readable certificate numbers without a
 * race: `Counter.findOneAndUpdate({ _id }, { $inc: { seq: 1 } }, { upsert: true,
 * new: true })` is a single atomic operation, so two concurrent generations can
 * never receive the same value.
 */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

const Counter = mongoose.model('Counter', counterSchema);

/** Return the next value for the named sequence (creating it at 1 the first time). */
export const nextSequence = async (name) => {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return doc.seq;
};

export default Counter;
