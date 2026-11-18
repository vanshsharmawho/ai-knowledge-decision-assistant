import { config } from '../config.js';
import { AppError, Errors } from '../utils/AppError.js';

/**
 * Thin wrapper over the Gemini REST API (no SDK, so nothing version-specific).
 * - generateJSON: structured output constrained by a response schema
 * - generateText: free text
 * - embedTexts: vector embeddings for retrieval
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class LLMError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function assertKey() {
  if (!config.gemini.apiKey) {
    throw new AppError(503, 'LLM_NOT_CONFIGURED', 'The AI service is not configured on the server (missing GEMINI_API_KEY).');
  }
}

async function post(path, body, { retries = 1 } = {}) {
  assertKey();
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.gemini.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.gemini.timeoutMs),
      });
      if (res.ok) return await res.json();

      const text = await res.text();
      lastErr = new LLMError(`Gemini ${res.status}: ${text.slice(0, 300)}`, res.status);
      // Retry only on rate limits and server errors
      if (res.status !== 429 && res.status < 500) break;
    } catch (err) {
      lastErr = new LLMError(`Gemini request failed: ${err.message}`, 0);
    }
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
  }
  console.error('[gemini]', lastErr.message);
  throw lastErr;
}

/**
 * Gemini 2.5 models "think" before answering by default, and thinking tokens count
 * against maxOutputTokens, which can leave an empty answer. Our prompts are
 * narrow and structured, so thinking is turned off (configurable).
 */
function thinkingConfig(model) {
  // Gemini 3.x: optional thinking level (e.g. "low") from .env; unset = model default
  if (config.gemini.thinkingLevel && !/2\.5/.test(model)) return { thinkingLevel: config.gemini.thinkingLevel };
  if (!/2\.5/.test(model) || /pro/.test(model)) return undefined;
  return { thinkingBudget: config.gemini.thinkingBudget };
}

function textFrom(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || '').join('');
  if (!text) {
    const reason = response?.candidates?.[0]?.finishReason || response?.promptFeedback?.blockReason || 'empty';
    throw new LLMError(`Gemini returned no text (${reason})`, 0);
  }
  return text;
}

/**
 * Ask a model for JSON that matches `schema` (Gemini OpenAPI-style schema).
 * Returns the parsed object.
 */
export async function generateJSON({ model, system, prompt, schema, temperature = 0, maxOutputTokens = 2048 }) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens,
      responseMimeType: 'application/json',
      responseSchema: schema,
      thinkingConfig: thinkingConfig(model),
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const text = await withFallback(model, async (m) => {
    body.generationConfig.thinkingConfig = thinkingConfig(m);
    return textFrom(await post(`models/${m}:generateContent`, body));
  });
  try {
    return JSON.parse(text);
  } catch {
    throw new LLMError(`Model did not return valid JSON: ${text.slice(0, 200)}`, 0);
  }
}

export async function generateText({ model, system, prompt, temperature = 0.2, maxOutputTokens = 1024 }) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens, thinkingConfig: thinkingConfig(model) },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  return withFallback(model, async (m) => {
    body.generationConfig.thinkingConfig = thinkingConfig(m);
    return textFrom(await post(`models/${m}:generateContent`, body));
  });
}

/**
 * Free-tier Gemini models are sometimes overloaded (503) or rate-limited (429).
 * Try the requested model first, then the other configured model, so one busy
 * model does not take the whole assistant down.
 */
async function withFallback(model, fn) {
  const chain = [model, ...config.gemini.fallbackModels.filter((m) => m && m !== model)];
  let lastErr;
  for (const m of chain) {
    try {
      return await fn(m);
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof LLMError && (err.status === 0 || err.status === 429 || err.status >= 500);
      if (!retryable) throw err;
      console.warn(`[gemini] ${m} unavailable (${err.status || 'timeout'}), trying next model`);
    }
  }
  throw lastErr;
}

/**
 * Embed many texts. taskType: RETRIEVAL_DOCUMENT for chunks, RETRIEVAL_QUERY for questions.
 */
export async function embedTexts(texts, taskType = 'RETRIEVAL_DOCUMENT') {
  const model = config.gemini.embedModel;
  const out = [];
  const BATCH = 50;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const response = await post(`models/${model}:batchEmbedContents`, {
      requests: batch.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: config.gemini.embedDimensions,
      })),
    });
    for (const e of response.embeddings || []) out.push(normalize(e.values));
  }
  if (out.length !== texts.length) throw new LLMError('Embedding count mismatch', 0);
  return out;
}

export async function embedQuery(text) {
  const [v] = await embedTexts([text], 'RETRIEVAL_QUERY');
  return v;
}

// Unit-length vectors make cosine similarity a plain dot product.
function normalize(v) {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

/** Map low-level LLM errors to a user-facing error. */
export function toUserError(err) {
  if (err instanceof AppError) return err;
  return Errors.llmUnavailable();
}
