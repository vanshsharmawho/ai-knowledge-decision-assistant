import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Organization } from '../models/Organization.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Errors } from '../utils/AppError.js';
import { newAssistantToken, signAdminJwt } from '../utils/tokens.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Organization name must be at least 2 characters.').max(120),
  email: z.string().trim().email('Please enter a valid email.'),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(200),
});

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email.'),
  password: z.string().min(1, 'Please enter your password.'),
});

function parse(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw Errors.badRequest('VALIDATION_ERROR', result.error.issues[0].message);
  }
  return result.data;
}

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password } = parse(registerSchema, req.body);

    const existing = await Organization.findOne({ email: email.toLowerCase() });
    if (existing) throw Errors.conflict('EMAIL_TAKEN', 'An account with this email already exists.');

    const org = await Organization.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      assistantToken: newAssistantToken(),
    });

    res.status(201).json({ token: signAdminJwt(org), organization: org.toPublic() });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    const org = await Organization.findOne({ email: email.toLowerCase() });
    // Same message for unknown email and wrong password, so emails can't be probed.
    if (!org || !(await bcrypt.compare(password, org.passwordHash))) {
      throw Errors.unauthorized('Incorrect email or password.');
    }
    res.json({ token: signAdminJwt(org), organization: org.toPublic() });
  })
);

router.get(
  '/me',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({ organization: req.org.toPublic() });
  })
);

export default router;
