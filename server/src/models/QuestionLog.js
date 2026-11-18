import mongoose from 'mongoose';

const questionLogSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    question: { type: String, required: true },
    questionType: { type: String },
    // answered | unanswered (not in knowledge base) | needs_review (decision unclear) | error
    outcome: { type: String, enum: ['answered', 'unanswered', 'needs_review', 'error'], required: true },
    decisionCount: { type: Number, default: 0 },
    latencyMs: { type: Number },
  },
  { timestamps: true }
);

export const QuestionLog = mongoose.model('QuestionLog', questionLogSchema);
