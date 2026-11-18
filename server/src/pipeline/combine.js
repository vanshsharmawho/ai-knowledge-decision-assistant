/**
 * Application logic (no AI): combine independent decisions into one result.
 *
 *   - any REQUIRED boolean = NO            → NEGATIVE   (e.g. not eligible)
 *   - any REQUIRED boolean = UNKNOWN/failed → NEEDS_REVIEW (can't be decided from documents)
 *   - all REQUIRED booleans = YES           → POSITIVE   (e.g. eligible)
 *   - no required booleans (only choices / scores) → INFORMATIONAL
 *
 * Keeping this in code makes the final verdict predictable and testable,
 * instead of leaving it to a model's free-text judgement.
 */
export function combineDecisions(conditions) {
  const required = conditions.filter((c) => c.required && c.type === 'BOOLEAN');
  const failed = required.filter((c) => c.value === 'NO');
  const unclear = required.filter((c) => c.value === 'UNKNOWN' || c.error);

  let outcome;
  if (required.length === 0) outcome = 'INFORMATIONAL';
  else if (failed.length > 0) outcome = 'NEGATIVE';
  else if (unclear.length > 0) outcome = 'NEEDS_REVIEW';
  else outcome = 'POSITIVE';

  const scores = conditions.filter((c) => c.type === 'SCORE' && typeof c.value === 'number');
  const averageScore = scores.length ? scores.reduce((s, c) => s + c.value, 0) / scores.length : null;

  return {
    outcome,
    passed: required.filter((c) => c.value === 'YES').map((c) => c.id),
    failed: failed.map((c) => c.id),
    unclear: unclear.map((c) => c.id),
    choices: conditions.filter((c) => c.type === 'CHOICE').map((c) => ({ id: c.id, value: c.value })),
    averageScore,
  };
}
