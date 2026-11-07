import mongoose from 'mongoose';

/**
 * Separate audit model avoids overwriting or migrating the existing
 * BatchInvoice schema. Revisions are never edited in place.
 * PENDING records are created before applying an update, so even a crash
 * between updating the invoice and finishing the audit can be inspected.
 */
const revisionSchema = new mongoose.Schema({
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BatchInvoice',
    required: true,
    index: true,
  },
  action: {
    type: String,
    enum: ['EDIT', 'ROLLBACK'],
    required: true,
  },
  reason: { type: String, required: true, minlength: 3, maxlength: 500 },
  fromVersion: { type: Number, required: true, min: 0 },
  toVersion: { type: Number, required: true, min: 1 },
  targetVersion: { type: Number, default: null },
  actorId: { type: String, required: true },
  state: {
    type: String,
    enum: ['PENDING', 'APPLIED', 'ABORTED'],
    default: 'PENDING',
    index: true,
  },
  before: { type: mongoose.Schema.Types.Mixed, required: true },
  after: { type: mongoose.Schema.Types.Mixed, required: true },
  committedAt: Date,
  error: String,
}, { timestamps: true, minimize: false });

revisionSchema.index({ invoiceId: 1, fromVersion: 1, createdAt: -1 });

export default mongoose.models.BatchInvoiceRevision ||
  mongoose.model('BatchInvoiceRevision', revisionSchema);
