import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { QuestionLog } from '../models/QuestionLog.js';

const router = Router();
router.use(requireAdmin);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const orgId = req.org._id;
    const [byOutcome, recent] = await Promise.all([
      QuestionLog.aggregate([{ $match: { organizationId: orgId } }, { $group: { _id: '$outcome', count: { $sum: 1 } } }]),
      QuestionLog.find({ organizationId: orgId }).sort({ createdAt: -1 }).limit(10).select('question outcome questionType createdAt latencyMs'),
    ]);
    const counts = Object.fromEntries(byOutcome.map((x) => [x._id, x.count]));
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    res.json({
      totals: {
        asked: total,
        answered: counts.answered || 0,
        unanswered: counts.unanswered || 0,
        needsReview: counts.needs_review || 0,
        errors: counts.error || 0,
      },
      recent,
    });
  })
);

export default router;
