import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

/**
 * Assistant tokens are *publishable* keys: they end up in public web pages
 * (that is the point of an embeddable widget), so they are random, unguessable,
 * carry no information about the organization, and can only call POST /api/ask.
 * They are never accepted by admin endpoints, and can be regenerated at any time.
 */
export function newAssistantToken() {
  return 'asst_' + crypto.randomBytes(24).toString('base64url');
}

export function isAssistantTokenFormat(token) {
  return typeof token === 'string' && /^asst_[A-Za-z0-9_-]{32}$/.test(token);
}

/** Admin session token (JWT). Typed so it can never be confused with an assistant token. */
export function signAdminJwt(org) {
  return jwt.sign({ sub: org._id.toString(), typ: 'admin' }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export function verifyAdminJwt(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  if (payload.typ !== 'admin') throw new Error('Wrong token type');
  return payload;
}
