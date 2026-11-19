/**
 * Application logic (no AI): combine independent decisions into one result.
 *
 *   - any REQUIRED requirement not met         → NEGATIVE   (e.g. not eligible), even if others are unknown
 *   - otherwise any REQUIRED check UNKNOWN/failed → NEEDS_REVIEW (can't be decided from documents)
 *   - all REQUIRED requirements met             → POSITIVE   (e.g. eligible)
 * "Met" compares the answer with the condition's passWhen (usually YES).
 *   - no required booleans (only choices / scores) → INFORMATIONAL
 *
 * Keeping this in code makes the final verdict predictable and testable,
 * instead of leaving it to a model's free-text judgement.
 */
/** Did this boolean condition meet its requirement? true / false / null (unknown). */
export function meetsRequirement(c) {
  if (c.type !== 'BOOLEAN' || c.error || c.value === 'UNKNOWN' || c.value === undefined) return null;
  return c.value === (c.passWhen || 'YES');
}

export function combineDecisions(conditions) {
  const required = conditions.filter((c) => c.required && c.type === 'BOOLEAN');
  // A failed requirement decides the outcome even if other checks are unknown.
  const failed = required.filter((c) => meetsRequirement(c) === false);
  const unclear = required.filter((c) => meetsRequirement(c) === null);

  let outcome;
  if (required.length === 0) outcome = 'INFORMATIONAL';
  else if (failed.length > 0) outcome = 'NEGATIVE';
  else if (unclear.length > 0) outcome = 'NEEDS_REVIEW';
  else outcome = 'POSITIVE';

  const scores = conditions.filter((c) => c.type === 'SCORE' && typeof c.value === 'number');
  const averageScore = scores.length ? scores.reduce((s, c) => s + c.value, 0) / scores.length : null;

  return {
    outcome,
    passed: required.filter((c) => meetsRequirement(c) === true).map((c) => c.id),
    failed: failed.map((c) => c.id),
    unclear: unclear.map((c) => c.id),
    choices: conditions.filter((c) => c.type === 'CHOICE').map((c) => ({ id: c.id, value: c.value })),
    averageScore,
  };
}
