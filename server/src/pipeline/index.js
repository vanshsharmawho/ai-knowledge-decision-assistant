import { config } from '../config.js';
import { Errors } from '../utils/AppError.js';
import { QuestionLog } from '../models/QuestionLog.js';
import { createRetriever } from '../services/retrieval.js';
import { toUserError as baseUserError } from '../services/gemini.js';
import { classifyQuestion, scoreEvidenceSufficiency, DECIDERS } from './decisionModels.js';
import { decomposeQuestion } from './decompose.js';
import { combineDecisions, meetsRequirement } from './combine.js';
import { generateAnswer } from './generate.js';
import { labelEvidence, mergeChunks, toReferences } from './evidence.js';

/**
 * The question pipeline.
 *
 *   tenant (already resolved from token)
 *     │
 *     ├─ A. in parallel: [System 1] classify question  +  hybrid retrieval (tenant-scoped)
 *     ├─ B. gate: no relevant chunks → "not in knowledge base" (no LLM call)
 *     ├─ C. in parallel: [System 1] evidence-sufficiency score  +  [LLM] decompose into conditions
 *     ├─ D. per-condition retrieval, then [System 1] decisions IN PARALLEL (boolean/choice/score,
 *     │     numeric rules checked by the rule engine)
 *     ├─ E. [App logic] combine decisions into one outcome
 *     └─ F. [LLM] grounded answer + references (template fallback if the LLM fails)
 */
export async function answerQuestion(org, question, { debug = false } = {}) {
  const started = Date.now();
  const trace = [];
  // With debug on, errors carry the pipeline trace so you can see which stage failed.
  const toUserError = (err) => {
    const e = baseUserError(err);
    if (debug) e.details = { trace, cause: err.message?.slice(0, 300) };
    return e;
  };
  const step = async (stage, fn, meta) => {
    const t = Date.now();
    try {
      const result = await fn();
      trace.push({ stage, ms: Date.now() - t, ...(meta ? meta(result) : {}) });
      return result;
    } catch (err) {
      trace.push({ stage, ms: Date.now() - t, error: err.message.slice(0, 200) });
      throw err;
    }
  };

  const finish = async (payload, outcome, questionType, decisionCount = 0) => {
    const latencyMs = Date.now() - started;
    QuestionLog.create({ organizationId: org._id, question, questionType, outcome, decisionCount, latencyMs }).catch(
      (e) => console.warn('[log] failed:', e.message)
    );
    return { ...payload, questionType, latencyMs, trace: debug ? trace : undefined };
  };

  const notFound = (questionType, why) =>
    finish(
      {
        status: 'not_found',
        answered: false,
        answer: `I couldn't find this in ${org.name}'s documents, so I can't answer it reliably. Please contact ${org.name} directly for help with this question.`,
        references: [],
        decision: null,
        reason: why,
      },
      'unanswered',
      questionType
    );

  // ---------- A. classify + retrieve (parallel) ----------
  const retriever = await createRetriever(org._id);
  if (retriever.chunkCount === 0) return notFound(undefined, 'empty_knowledge_base');

  let classification, mainHits;
  try {
    [classification, [mainHits]] = await Promise.all([
      step('classify [System 1: classification]', () => classifyQuestion(question), (r) => ({ result: r.questionType })).catch(
        () => ({ questionType: 'DIRECT_INFORMATION', needsStructuredDecision: false, confidence: 0, fallback: true })
      ),
      step('retrieve [hybrid vector + keyword]', () => retriever.search([question], 8), (r) => ({ hits: r[0].length })),
    ]);
  } catch (err) {
    await finish({}, 'error', undefined);
    throw toUserError(err);
  }
  const questionType = classification.questionType;

  if (questionType === 'SMALL_TALK') {
    return finish(
      {
        status: 'answered',
        answered: true,
        answer: `Hi! I'm ${org.name}'s assistant. Ask me anything about ${org.name}'s documents, policies or procedures.`,
        references: [],
        decision: null,
      },
      'answered',
      questionType
    );
  }

  // ---------- Summary questions: use each document's opening sections instead of search ----------
  if (questionType === 'SUMMARY') {
    const evidence = labelEvidence(retriever.overview());
    trace.push({ stage: 'overview evidence [application logic]', ms: 0, hits: evidence.length });
    let generated;
    try {
      generated = await step('generate answer [LLM]', () => generateAnswer({ question, questionType, evidence, decision: null }));
    } catch (err) {
      await finish({}, 'error', questionType);
      throw toUserError(err);
    }
    return finish(
      {
        status: 'answered',
        answered: true,
        answer: generated.answer,
        references: toReferences(generated.citedEvidenceIds, evidence),
        decision: null,
      },
      'answered',
      questionType
    );
  }

  // ---------- B. relevance gate (application logic, no LLM) ----------
  const top = mainHits[0];
  if (!top || (top.similarity < config.retrieval.minSimilarity && top.keywordScore === 0)) {
    return notFound(questionType, 'no_relevant_chunks');
  }

  // ---------- C. sufficiency score + decomposition (parallel) ----------
  const mainEvidence = labelEvidence(mainHits.slice(0, 6));
  const needsDecision = classification.needsStructuredDecision || questionType === 'ELIGIBILITY_DECISION';

  const [sufficiency, plan] = await Promise.all([
    step(
      'evidence sufficiency [System 1: score]',
      () => scoreEvidenceSufficiency(question, mainEvidence),
      (r) => ({ score: r.score })
    ).catch(() => null),
    needsDecision
      ? step('decompose [LLM]', () => decomposeQuestion(question, mainEvidence), (r) => ({
          conditions: r.conditions.length,
        })).catch(() => null)
      : null,
  ]);

  if (sufficiency && sufficiency.score < config.retrieval.minSufficiency && !plan) {
    return notFound(questionType, 'insufficient_evidence');
  }

  // ---------- D + E. parallel decisions, then combine ----------
  let decision = null;
  let conditionHits = [];
  if (plan) {
    try {
      conditionHits = await step('retrieve per condition', () =>
        retriever.search(plan.conditions.map((c) => c.searchQuery), 4)
      );
    } catch {
      conditionHits = plan.conditions.map(() => []);
    }

    const settled = await step(
      `decisions x${plan.conditions.length} [System 1, parallel]`,
      () =>
        Promise.allSettled(
          plan.conditions.map((c, i) => {
            // Each decision sees only the evidence found for ITS condition, so rules don't bleed into each other.
            const own = conditionHits[i] || [];
            const evidence = labelEvidence(own.length ? own : mainHits.slice(0, 3));
            return DECIDERS[c.type](c, plan.facts, evidence).then((r) => ({ ...r, evidence }));
          })
        ),
      (r) => ({ failed: r.filter((x) => x.status === 'rejected').length })
    );

    const conditions = plan.conditions.map((c, i) => {
      const s = settled[i];
      if (s.status === 'fulfilled') {
        const r = s.value;
        return {
          id: c.id,
          type: c.type,
          question: c.question,
          required: c.required,
          options: c.options,
          passWhen: c.passWhen,
          value: r.value,
          confidence: r.confidence,
          reason: cleanReason(r.reason),
          decidedBy: r.decidedBy,
          rule: r.rule,
          references: toReferences(r.evidenceIds, r.evidence),
        };
      }
      // A failed decision model never crashes the answer: it becomes UNKNOWN → human review.
      return {
        id: c.id,
        type: c.type,
        question: c.question,
        required: c.required,
        value: 'UNKNOWN',
        reason: 'This check could not be completed automatically.',
        decidedBy: 'none',
        error: true,
        references: [],
      };
    });

    for (const c of conditions) c.met = meetsRequirement(c); // true / false / null, shown in the UI
    const combined = combineDecisions(conditions);
    trace.push({ stage: 'combine [application logic]', ms: 0, outcome: combined.outcome });
    decision = { goal: plan.goal, facts: plan.facts, conditions, combined };
  }

  // ---------- F. grounded answer ----------
  const finalEvidence = labelEvidence(mergeChunks(mainHits.slice(0, 6), ...conditionHits).slice(0, 12));
  let generated;
  try {
    generated = await step('generate answer [LLM]', () =>
      generateAnswer({ question, questionType, evidence: finalEvidence, decision })
    );
  } catch (err) {
    if (!decision) {
      await finish({}, 'error', questionType);
      throw toUserError(err);
    }
    generated = templateAnswer(decision); // decisions still produce a useful answer without the LLM
  }

  if (!generated.answerable && !decision) return notFound(questionType, 'model_found_no_answer');

  let references = toReferences(generated.citedEvidenceIds, finalEvidence);
  if (decision) {
    const decisionRefs = decision.conditions.flatMap((c) => c.references);
    references = dedupeRefs([...references, ...decisionRefs]);
  }

  const needsReview = decision?.combined.outcome === 'NEEDS_REVIEW';
  return finish(
    {
      status: needsReview ? 'needs_review' : 'answered',
      answered: true,
      answer: generated.answer,
      references,
      decision: decision && {
        goal: decision.goal,
        facts: decision.facts,
        outcome: decision.combined.outcome,
        conditions: decision.conditions,
      },
    },
    needsReview ? 'needs_review' : 'answered',
    questionType,
    decision?.conditions.length || 0
  );
}

/** Remove internal evidence labels ("E2 states…", "(E1)") from text shown to visitors. */
function cleanReason(text) {
  if (!text) return text;
  return text
    .replace(/\(\s*E\d+(\s*,\s*E\d+)*\s*\)/g, '')
    .replace(/\bE\d+\s+(states|says|shows|permits|indicates|mentions|confirms)\b/gi, 'The document $1')
    .replace(/\b(in|from|per|according to)\s+E\d+\b/gi, '$1 the document')
    .replace(/\bE\d+\b/g, 'the document')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

function dedupeRefs(refs) {
  const seen = new Set();
  return refs
    .filter((r) => {
      const k = `${r.filename}#${r.page}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.filename.localeCompare(b.filename) || a.page - b.page);
}

/** Used only if the answer-writing LLM fails after decisions succeeded. */
function templateAnswer(decision) {
  const verdict = {
    POSITIVE: 'Based on the documents, yes, all the required conditions are met.',
    NEGATIVE: 'Based on the documents, no, at least one required condition is not met.',
    NEEDS_REVIEW: 'This cannot be fully decided from the documents. Please contact the organization.',
    INFORMATIONAL: 'Here is what the documents indicate:',
  }[decision.combined.outcome];
  const lines = decision.conditions.map(
    (c) => `• ${c.question} → ${c.met === true ? 'met' : c.met === false ? 'not met' : c.value}${c.reason ? ` (${c.reason})` : ''}`
  );
  return { answerable: true, answer: [verdict, ...lines].join('\n'), citedEvidenceIds: [] };
}

export function validateQuestion(q) {
  if (typeof q !== 'string' || !q.trim()) throw Errors.badRequest('EMPTY_QUESTION', 'Please type a question.');
  if (q.length > config.limits.maxQuestionLength) {
    throw Errors.badRequest('QUESTION_TOO_LONG', `Questions can be at most ${config.limits.maxQuestionLength} characters.`);
  }
  return q.trim();
}
