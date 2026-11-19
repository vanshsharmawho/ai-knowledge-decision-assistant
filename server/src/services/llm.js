import { config } from '../config.js';
import { AppError } from '../utils/AppError.js';
import * as gemini from './gemini.js';

/**
 * Provider-neutral LLM access.
 *
 *   role "chat"     → bigger model: understands/decomposes questions, writes answers
 *   role "decision" → small fast model: System 1 structured decisions
 *
 * The primary provider (LLM_PROVIDER) is tried first; if it is overloaded,
 * rate-limited or not configured, the other provider is used.
 * Embeddings always come from Gemini (see gemini.js).
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function providers() {
  const order = config.llmProvider === 'gemini' ? ['gemini', 'groq'] : ['groq', 'gemini'];
  return order.filter((p) => (p === 'groq' ? Boolean(config.groq.apiKey) : Boolean(config.gemini.apiKey)));
}

export async function generateJSON({ role = 'chat', system, prompt, schema, temperature = 0, maxOutputTokens = 2048 }) {
  const list = providers();
  if (list.length === 0) {
    throw new AppError(503, 'LLM_NOT_CONFIGURED', 'No AI provider is configured on the server (set GROQ_API_KEY or GEMINI_API_KEY).');
  }
  let lastErr;
  for (const provider of list) {
    try {
      if (provider === 'groq') {
        return await groqJSON({ role, system, prompt, schema, temperature, maxOutputTokens });
      }
      const model = role === 'decision' ? config.gemini.decisionModel : config.gemini.chatModel;
      return await gemini.generateJSON({ model, system, prompt, schema, temperature, maxOutputTokens });
    } catch (err) {
      lastErr = err;
      console.warn(`[llm] ${provider} failed for ${role}: ${err.message.slice(0, 160)}`);
    }
  }
  throw lastErr;
}

// ---------------- Groq (OpenAI-compatible API) ----------------

async function groqJSON({ role, system, prompt, schema, temperature, maxOutputTokens }) {
  const model = role === 'decision' ? config.groq.decisionModel : config.groq.chatModel;
  const isReasoning = /gpt-oss|qwen3|deepseek-r1/i.test(model);
  const schemaText = JSON.stringify(toJsonSchema(schema));
  const messages = [
    {
      role: 'system',
      content: `${system || ''}\n\nRespond with ONLY a JSON object that matches this JSON Schema (no prose, no markdown):\n${schemaText}`,
    },
    { role: 'user', content: prompt },
  ];

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.groq.apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          // Groq's free tier counts max_tokens against a tokens-per-minute limit, so reserve
          // only what each role needs. Reasoning models (gpt-oss) also spend tokens thinking,
          // so they get a little more room and a low reasoning effort.
          max_tokens: role === 'decision' ? (isReasoning ? 1024 : 400) : isReasoning ? 2500 : 1500,
          ...(isReasoning ? { reasoning_effort: config.groq.reasoningEffort } : {}),
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(config.gemini.timeoutMs),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content || '';
        try {
          return JSON.parse(text);
        } catch {
          throw new gemini.LLMError(`Groq returned invalid JSON: ${text.slice(0, 160)}`, 0);
        }
      }
      const body = await res.text();
      lastErr = new gemini.LLMError(`Groq ${res.status}: ${body.slice(0, 300)}`, res.status);
      if (res.status !== 429 && res.status < 500) break;
    } catch (err) {
      lastErr = err instanceof gemini.LLMError ? err : new gemini.LLMError(`Groq request failed: ${err.message}`, 0);
    }
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
  }
  throw lastErr;
}

/** Convert the Gemini-style schema (OBJECT/STRING…) into standard JSON Schema for the prompt. */
function toJsonSchema(s) {
  if (!s || typeof s !== 'object') return s;
  const out = {};
  if (s.type) out.type = s.type.toLowerCase();
  if (s.nullable) out.type = [out.type, 'null'];
  if (s.enum) out.enum = s.enum;
  if (s.description) out.description = s.description;
  if (s.properties) {
    out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toJsonSchema(v)]));
  }
  if (s.items) out.items = toJsonSchema(s.items);
  if (s.required) out.required = s.required;
  return out;
}
