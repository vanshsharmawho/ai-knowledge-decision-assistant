import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Organization } from '../models/Organization.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { isAssistantTokenFormat } from '../utils/tokens.js';
import { answerQuestion, validateQuestion } from '../pipeline/index.js';

const router = Router();

// Public endpoint: limit abuse per IP.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many questions. Please wait a minute and try again.' } },
});

/** Resolve the organization from an assistant token. Server-side only. */
async function orgFromAssistantToken(token) {
  if (!isAssistantTokenFormat(token)) {
    throw new AppError(401, 'INVALID_ASSISTANT_TOKEN', 'This assistant link is invalid or has been replaced.');
  }
  const org = await Organization.findOne({ assistantToken: token });
  if (!org) throw new AppError(401, 'INVALID_ASSISTANT_TOKEN', 'This assistant link is invalid or has been replaced.');
  return org;
}

// Lets the chat widget show the organization's name (nothing else is exposed).
router.get(
  '/assistant/:token',
  asyncHandler(async (req, res) => {
    const org = await orgFromAssistantToken(req.params.token);
    res.json({ name: org.name });
  })
);

/**
 * POST /api/ask
 * Body: { token: "asst_…", question: "…", debug?: boolean }
 * The token alone decides the tenant; the client can never pass an organization id.
 */
export const askHandlers = [
  limiter,
  asyncHandler(async (req, res) => {
    const { token, question, debug } = req.body || {};
    const org = await orgFromAssistantToken(token);
    const q = validateQuestion(question);
    const result = await answerQuestion(org, q, { debug: Boolean(debug) });
    res.json(result);
  }),
];

router.post('/ask', ...askHandlers);

export default router;
