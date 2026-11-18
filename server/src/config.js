import 'dotenv/config';
import path from 'node:path';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 5000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  publicAppUrl: (process.env.PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/$/, ''),

  mongoUri: required('MONGODB_URI'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Primary provider for text generation: "groq" or "gemini" (the other is the fallback)
  llmProvider: (process.env.LLM_PROVIDER || 'groq').toLowerCase(),
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    chatModel: process.env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile',
    decisionModel: process.env.GROQ_DECISION_MODEL || 'llama-3.1-8b-instant',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    chatModel: process.env.GEMINI_CHAT_MODEL || 'gemini-3.8-flash',
    decisionModel: process.env.GEMINI_DECISION_MODEL || 'gemini-3.5-flash-lite',
    embedModel: process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001',
    embedDimensions: Number(process.env.EMBED_DIMENSIONS || 768),
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 60000),
    // Tried in order when the requested model is overloaded
    fallbackModels: (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.5-flash-lite,gemini-3.8-flash')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
    thinkingBudget: Number(process.env.GEMINI_THINKING_BUDGET || 0),
    thinkingLevel: process.env.GEMINI_THINKING_LEVEL || '',
  },

  retrieval: {
    useAtlasVectorSearch: process.env.USE_ATLAS_VECTOR_SEARCH === 'true',
    atlasIndex: process.env.ATLAS_VECTOR_INDEX || 'chunk_vector_index',
    minSimilarity: Number(process.env.MIN_SIMILARITY || 0.45),
    minSufficiency: Number(process.env.MIN_SUFFICIENCY || 0.35),
    topK: 6,
  },

  limits: {
    maxDocsPerOrg: 10,
    maxPagesPerPdf: 20,
    maxBytesPerPdf: 10 * 1024 * 1024,
    maxQuestionLength: 1000,
  },

  storageDir: path.resolve(process.env.STORAGE_DIR || './storage'),
};
