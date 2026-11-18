import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { newAssistantToken } from '../utils/tokens.js';
import { config } from '../config.js';

const router = Router();
router.use(requireAdmin);

function assistantInfo(org) {
  const url = `${config.publicAppUrl}/assistant/${org.assistantToken}`;
  const iframe =
    `<iframe src="${url}" title="${escapeAttr(org.name)} assistant" ` +
    `style="width:100%;max-width:420px;height:600px;border:1px solid #ddd;border-radius:12px" ` +
    `allow="clipboard-write"></iframe>`;
  const script =
    `<script src="${config.publicAppUrl}/embed.js" data-assistant-token="${org.assistantToken}" ` +
    `data-title="${escapeAttr(org.name)}" defer></script>`;
  return {
    token: org.assistantToken,
    url,
    rotatedAt: org.assistantTokenRotatedAt,
    embed: { iframe, script },
  };
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(assistantInfo(req.org));
  })
);

// Regenerating immediately invalidates the old URL and every page that embeds it.
router.post(
  '/regenerate',
  asyncHandler(async (req, res) => {
    req.org.assistantToken = newAssistantToken();
    req.org.assistantTokenRotatedAt = new Date();
    await req.org.save();
    res.json(assistantInfo(req.org));
  })
);

export default router;
