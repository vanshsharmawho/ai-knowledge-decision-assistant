import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    filename: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    pageCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
    error: { type: String },
    // Private path on the server's disk. Never sent to clients, never served statically.
    storagePath: { type: String, required: true, select: false },
  },
  { timestamps: true }
);

documentSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    filename: this.filename,
    sizeBytes: this.sizeBytes,
    pageCount: this.pageCount,
    chunkCount: this.chunkCount,
    status: this.status,
    error: this.error,
    uploadedAt: this.createdAt,
  };
};

export const Document = mongoose.model('Document', documentSchema);
