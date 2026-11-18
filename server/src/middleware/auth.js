import { Organization } from '../models/Organization.js';
import { Errors } from '../utils/AppError.js';
import { isAssistantTokenFormat, verifyAdminJwt } from '../utils/tokens.js';

/**
 * Protects the admin dashboard APIs. Accepts only an admin JWT.
 * An assistant token is explicitly rejected here, so a public widget key
 * can never be used to manage an organization.
 */
export async function requireAdmin(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw Errors.unauthorized();
    if (isAssistantTokenFormat(token)) {
      throw Errors.forbidden('An assistant token cannot be used to access the dashboard.');
    }

    let payload;
    try {
      payload = verifyAdminJwt(token);
    } catch {
      throw Errors.unauthorized('Your session has expired. Please log in again.');
    }

    const org = await Organization.findById(payload.sub);
    if (!org) throw Errors.unauthorized('Organization no longer exists.');

    req.org = org; // every admin handler scopes its queries to req.org._id
    next();
  } catch (err) {
    next(err);
  }
}
