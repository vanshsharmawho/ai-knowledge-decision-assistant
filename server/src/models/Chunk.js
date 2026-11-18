import mongoose from 'mongoose';

/**
 * A searchable piece of a document. Every chunk carries organizationId so every
 * search can be filtered to one tenant, plus filename and page for references.
 */
const chunkSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  filename: { type: String, required: true },
  page: { type: Number, required: true },
  chunkIndex: { type: Number, required: true },
  text: { type: String, required: true },
  embedding: { type: [Number], required: true },
});

chunkSchema.index({ organizationId: 1, documentId: 1 });

export const Chunk = mongoose.model('Chunk', chunkSchema);
