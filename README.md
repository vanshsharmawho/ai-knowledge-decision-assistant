# AI Knowledge & Decision Assistant

A multi-tenant SaaS where organizations upload their PDFs and get an embeddable AI assistant that answers visitors' questions **only from that organization's documents**, with document and page references.

Multi-condition questions ("Am I eligible if…?") are not sent to one big prompt. An LLM breaks them into independent conditions, small **System 1 decision models** evaluate each condition **in parallel** with typed outputs (boolean, choice, score, classification), plain code checks numeric rules and combines the results, and only then does the LLM write the final answer.

---

## Contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Setup](#setup)
4. [Architecture](#architecture)
5. [Document processing and retrieval](#document-processing-and-retrieval)
6. [AI pipeline and System 1 decision models](#ai-pipeline-and-system-1-decision-models)
7. [Tenant isolation](#tenant-isolation)
8. [Security](#security)
9. [Database schema](#database-schema)
10. [API](#api)
11. [Error handling](#error-handling)
12. [Testing](#testing)
13. [Assumptions and limitations](#assumptions-and-limitations)

---

## Features

**Organization dashboard**
- Sign up / log in (one admin account per organization)
- Upload, replace and delete PDFs, with limits enforced on both client and server: **10 PDFs per organization, 20 pages and 10 MB per PDF**
- See each document's status (processing / ready / failed), page count and number of searchable chunks
- Get the assistant's **public URL**, **iframe embed code** and **script embed code** (floating chat button); regenerate the link at any time
- Usage: questions asked, answered, not found in the knowledge base, sent for human review
- "Try it here" chat that shows each decision and a per-stage timing trace

**Public assistant (no login)**
- Opened from the public URL, an iframe, or the floating button on any website
- Answers grounded in the organization's documents, with references such as `Scholarship_Rules.pdf — Page 4`
- Shows the structured decision (each condition and its result) for multi-condition questions
- Says clearly when the documents don't contain the answer, instead of guessing

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite, React Router | Fast dev setup; dashboard and widget in one app |
| Backend | Node.js + Express | Simple REST API, easy to reason about |
| Database | MongoDB (Atlas) via Mongoose | Flexible documents for chunks + embeddings; Atlas Vector Search available |
| LLM (understanding, answers) | Groq `openai/gpt-oss-120b` (fallback: Gemini Flash) | Strong reasoning for decomposition and grounded writing |
| System 1 decision model | Groq `openai/gpt-oss-20b`, low reasoning effort (fallback: Gemini Flash-Lite) | Small and very fast (~1,000 tokens/s); used only for narrow typed decisions |
| Embeddings | Gemini `gemini-embedding-001` (768 dims) | Good multilingual retrieval embeddings, free tier |
| PDF parsing | `pdf-parse` (pdf.js) with a per-page renderer | Keeps page numbers for references |
| Validation | `zod` | Validates every model output and every request body |

Models are configured in `.env`, so they can be swapped without code changes. Providers retire models often (the project started on Llama 3.x, which Groq has since removed); changing two lines in `.env` is enough.

---

## Setup

### Prerequisites
- Node.js 20+
- A MongoDB Atlas cluster (free M0 works) or local MongoDB
- A free **Groq** API key: https://console.groq.com
- A free **Gemini** API key (embeddings): https://aistudio.google.com

### 1. Backend

```bash
cd server
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Fill in `.env`:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/PDF_Chat_BOX?retryWrites=true&w=majority
JWT_SECRET=<long random string>
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
```

```bash
npm run dev                 # → http://localhost:5000/api/health
```

### 2. Frontend

```bash
cd client
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:5000
npm run dev                 # → http://localhost:5173
```

### 3. Demo data (optional but recommended)

With the server running:

```bash
cd server
npm run seed                # creates 2 organizations and uploads their PDFs
npm run test:isolation      # runs the tenant isolation test
```

Seeded logins:

| Organization | Email | Password |
|---|---|---|
| Northfield University | admin@northfield.test | northfield123 |
| Brightline Technologies | hr@brightline.test | brightline123 |

### 4. Embedding demo
Open `test-data/embed-demo.html`, replace `PASTE_ASSISTANT_TOKEN_HERE` with a token from the dashboard, and open the file in a browser: it shows the assistant embedded in an iframe and as a floating chat button on an "external" website.

### Optional: Atlas Vector Search
Retrieval works out of the box with in-app similarity search. To use Atlas Vector Search instead, create a vector index named `chunk_vector_index` on the `chunks` collection:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
    { "type": "filter", "path": "organizationId" }
  ]
}
```

Then set `USE_ATLAS_VECTOR_SEARCH=true`. If the index call fails, the server falls back to in-app search automatically.

---

## Architecture

```mermaid
flowchart LR
  subgraph Client["Browser"]
    D["Dashboard (React)<br/>admin JWT"]
    W["Assistant widget<br/>/assistant/:token"]
    X["External website<br/>iframe or embed.js"]
  end

  subgraph API["Express API"]
    AUTH["/api/auth"]
    DOCS["/api/documents"]
    ASST["/api/assistant"]
    ASK["POST /api/ask"]
    PIPE["Question pipeline"]
  end

  subgraph AI["AI providers"]
    LLM["LLM<br/>gpt-oss-120b"]
    S1["System 1 model<br/>gpt-oss-20b"]
    EMB["Embeddings<br/>gemini-embedding-001"]
  end

  DB[("MongoDB<br/>organizations, documents,<br/>chunks, questionlogs")]
  FS[("Private file storage<br/>never served")]

  D --> AUTH & DOCS & ASST
  X --> W --> ASK --> PIPE
  DOCS --> FS
  DOCS --> EMB
  DOCS --> DB
  PIPE --> DB
  PIPE --> EMB & S1 & LLM
```

```
kb-assistant/
├── client/                    React app (dashboard + public widget)
│   ├── public/embed.js        floating-button embed script
│   └── src/
│       ├── pages/             Login, Register, Dashboard, AssistantChat
│       └── components/        DocumentsPanel, AssistantPanel, UsagePanel, ChatBox
├── server/
│   ├── src/
│   │   ├── routes/            auth, documents, assistant, usage, ask
│   │   ├── middleware/        requireAdmin, errorHandler
│   │   ├── models/            Organization, Document, Chunk, QuestionLog
│   │   ├── services/          pdf, chunker, retrieval, gemini, llm
│   │   └── pipeline/          decisionModels, decompose, combine, generate, index
│   └── scripts/               seed-demo, isolation-test, smoke-test
└── test-data/                 PDFs for 2 orgs, invalid files, TEST_QUESTIONS.md, embed-demo.html
```

---

## Document processing and retrieval

**Upload → validate → extract → chunk → embed → store**

1. **Validate before storing.** Multer keeps the upload in memory with a 10 MB cap. The server checks the `.pdf` extension and MIME type, the `%PDF-` magic bytes, the organization's document count (≤ 10), and the page count (≤ 20). It also rejects PDFs with no extractable text (scanned images). Invalid files never reach the database or disk.
2. **Page-aware extraction.** A custom pdf.js page renderer extracts text **page by page**, so every chunk knows its page number.
3. **Chunking.** Each page is split into ~900-character chunks along paragraph and sentence boundaries, with a 150-character overlap so rules split across chunks still match. Chunks never cross pages.
4. **Embedding.** Each chunk is embedded with `gemini-embedding-001` (768 dimensions, normalized), prefixed with its filename and page for extra context.
5. **Storage.** Chunks are stored with `organizationId`, `documentId`, `filename`, `page`, `text` and `embedding`. The original PDF is stored on private disk (`server/storage/<orgId>/`), never served by any route. If embedding fails, the document is marked `failed` and its chunks are removed.

**Hybrid retrieval (per question, per organization)**
- **Vector search**: cosine similarity between the question embedding and the organization's chunk embeddings (in-app, or Atlas `$vectorSearch` with an `organizationId` filter).
- **Keyword search**: BM25 over the same chunks. This catches exact terms that embeddings sometimes miss, such as "CGPA", "Form SF-2" or "L5".
- **Fusion**: Reciprocal Rank Fusion of both rankings; top chunks become *evidence*, labelled `E1, E2…` so models can cite them without seeing database ids.
- **Relevance gate**: if the best chunk has low similarity **and** no keyword overlap, the system answers "not in the knowledge base" **without calling any LLM**.
- **Summary questions** ("summarise these documents") have no searchable keywords, so they use the opening chunks of each document instead.

---

## AI pipeline and System 1 decision models

### Why not one LLM call

A single prompt that has to classify, retrieve, check five conditions, compare numbers and write prose is hard to test, hard to debug, and prone to confident mistakes such as "8.2 is below 8.0". This system separates **understanding**, **deciding**, **combining** and **explaining**, and gives each step to the component best suited to it.

| Responsibility | Component |
|---|---|
| Resolve tenant from token, validate input, enforce limits | Application logic |
| Classify question type | **System 1** (classification) |
| Find evidence | Hybrid retrieval (vector + BM25) |
| Is there enough evidence to answer? | **System 1** (score 0–1) |
| Understand the question, break it into conditions | LLM (planning only, decides nothing) |
| Evaluate each condition | **System 1** (boolean / choice / score), **in parallel** |
| Numeric comparisons (CGPA ≥ 8.0, 8 months < 12) | **Rule engine** (plain code) |
| Combine decisions into a verdict | Application logic |
| Write the final answer with references | LLM (cannot change the verdict) |
| Fallback if the answer-writing LLM fails | Application logic (template answer from the decisions) |

### Flow

```mermaid
flowchart TD
  Q["Visitor question + assistant token"] --> T["Resolve organization from token<br/>(application logic)"]
  T --> P1{{"In parallel"}}
  P1 --> C["System 1: classify question type"]
  P1 --> R["Hybrid retrieval<br/>(this organization only)"]
  C --> G
  R --> G{"Relevant evidence?"}
  G -- "no" --> NF["'Not in the knowledge base'<br/>(no LLM call)"]
  G -- "yes" --> P2{{"In parallel"}}
  P2 --> S["System 1: evidence sufficiency score"]
  P2 --> DEC["LLM: decompose into conditions<br/>(only if a decision is needed)"]
  DEC --> RC["Retrieve evidence per condition"]
  RC --> P3{{"In parallel"}}
  P3 --> B1["System 1: BOOLEAN C1"]
  P3 --> B2["System 1: BOOLEAN C2<br/>+ rule engine for numbers"]
  P3 --> CH["System 1: CHOICE C3"]
  B1 & B2 & CH --> COMB["Combine (application logic)<br/>POSITIVE / NEGATIVE / NEEDS_REVIEW / INFORMATIONAL"]
  S --> GEN
  COMB --> GEN["LLM: grounded answer + references"]
  GEN --> A["Answer, decision breakdown, sources"]
```

### System 1 decision models

Each decision model is a **narrow, typed function**: one question in, one constrained value out. They run on a small fast model (`openai/gpt-oss-20b`, low reasoning effort) at temperature 0. They see only the user's stated facts and the evidence for *their* condition, and they never write user-facing prose.

| Type | Output | Example |
|---|---|---|
| **Classification** | one of `DIRECT_INFORMATION, POLICY, PROCEDURAL, ELIGIBILITY_DECISION, COMPARISON, SUMMARY, SMALL_TALK` | "Can I get the merit scholarship?" → `ELIGIBILITY_DECISION` |
| **Boolean** | `YES / NO / UNKNOWN` + confidence + cited evidence + numeric rule | "Is a 2nd-year student eligible?" → `YES` |
| **Choice** | one option from a list given by the planner, or `UNKNOWN` | "Which scholarship fits?" → `Need-Based Grant` |
| **Score** | 0–1 | Evidence sufficiency → `0.92` |

Guarantees around them:
- **Schema-constrained output** (JSON mode / response schema) **and** `zod` validation; malformed output is retried once, then treated as `UNKNOWN`.
- **Confidence floor**: a result with confidence < 0.5 becomes `UNKNOWN`.
- **Rule engine**: for numeric conditions the model only *extracts* `userValue`, `operator` and `threshold`; **code** does the comparison and overrides the model. The UI marks these as "rule engine".
- **Failure isolation**: decisions run with `Promise.allSettled`; one failed decision becomes `UNKNOWN` → `NEEDS_REVIEW`, never a crash.

### Worked example

> *"I'm in 2nd year with a CGPA of 8.2 and I already have a sports scholarship. Can I get the merit scholarship?"*

1. Classification → `ELIGIBILITY_DECISION`; retrieval finds Scholarship_Rules.pdf pages 2–3 (in parallel).
2. LLM plan: goal "Eligibility for the Merit Scholarship"; facts year = 2, CGPA = 8.2, existing scholarship = Sports; conditions:
   - **C1** BOOLEAN: is a 2nd-year student eligible?
   - **C2** BOOLEAN: does a CGPA of 8.2 meet the requirement?
   - **C3** BOOLEAN: can a student holding a Sports Scholarship also receive the Merit Scholarship?
3. Three System 1 calls in parallel:
   - C1 → `YES` (p.2)
   - C2 → model extracts `8.2 ≥ 8.0`, **rule engine** → `YES` (p.2)
   - C3 → `NO` (p.3)
4. Combine: a required condition is `NO` → **NEGATIVE**.
5. LLM writes: "No, you can't receive the Merit Scholarship while holding the Sports Scholarship. Your year and CGPA qualify, but only one university scholarship is allowed at a time; you could give up the Sports Scholarship and apply for Merit instead." Sources: Scholarship_Rules.pdf, pages 2 and 3.

### Parallelism
- Classification runs **alongside** retrieval.
- Sufficiency scoring runs **alongside** decomposition.
- All condition decisions run **at the same time**.
- Per-condition retrieval embeds all condition queries in **one batch** call.

### Fallbacks
- Primary LLM provider fails (429/503/timeout) → the other provider (Groq ↔ Gemini) is used automatically.
- Classification fails → defaults to `DIRECT_INFORMATION` and continues.
- Decomposition fails → answers as a normal grounded question.
- Answer generation fails after decisions succeeded → a template answer is built from the decisions.
- Retrieval or embeddings unavailable → clear `503 LLM_UNAVAILABLE` message.

---

## Tenant isolation

Isolation is enforced **on the server**, never by the client:

1. **Tenant comes only from credentials.** Admin routes take the organization from the verified JWT (`req.org`); `POST /api/ask` takes it from the assistant token. No endpoint accepts an `organizationId` from the request.
2. **Every query is scoped.** Every read, update and delete of documents, chunks and logs filters on `organizationId`. A document id from another organization returns **404** (not 403), so ids can't be probed.
3. **Retrieval is scoped by construction.** The only way to search is `createRetriever(orgId)`, which loads only that organization's chunks; Atlas Vector Search also applies an `organizationId` filter.
4. **Two token types that can't be confused.** Admin JWTs carry `typ: "admin"`; assistant tokens (`asst_…`) are rejected by every admin route with 403.
5. **Files are private.** PDFs are stored under `storage/<orgId>/` and are never served.

**Test:** `npm run test:isolation` creates two organizations and checks that:
- each organization lists only its own documents
- Org A cannot delete Org B's document
- an assistant token can't access the dashboard API
- a fake token is rejected
- Org A's assistant refuses a question only Org B's documents can answer, and vice versa
- answers cite only the asking organization's files

---

## Security

| Concern | Measure |
|---|---|
| Passwords | bcrypt (10 rounds); same error for unknown email and wrong password |
| Admin sessions | JWT signed with `JWT_SECRET`, 7-day expiry, typed `admin` |
| Assistant token | 24 random bytes (`asst_` + base64url), carries no tenant information, can only call `/api/ask`; regenerating invalidates every old URL and embed |
| Public endpoint abuse | Rate limit: 20 questions / minute / IP; question length ≤ 1,000 characters; JSON body ≤ 100 KB |
| CORS | Admin APIs only from the dashboard origin; the public ask API from any origin (it must be embeddable) |
| Uploads | Size, type, magic-bytes and page validation before storage; filenames sanitized; files never served |
| Prompt injection from documents | Models are told to use evidence only as data; decisions are typed and validated; the verdict is computed by code, so text inside a PDF can't flip it |
| Secrets | Only in `.env` (git-ignored); `.env.example` has placeholders |

---

## Database schema

```
Organization  { _id, name, email (unique), passwordHash, assistantToken (unique), assistantTokenRotatedAt, createdAt }
Document      { _id, organizationId*, filename, sizeBytes, pageCount, chunkCount, status: processing|ready|failed, error, storagePath (private), createdAt }
Chunk         { _id, organizationId*, documentId*, filename, page, chunkIndex, text, embedding[768] }
QuestionLog   { _id, organizationId*, question, questionType, outcome: answered|unanswered|needs_review|error, decisionCount, latencyMs, createdAt }
                                                                                                   * indexed
```

---

## API

All responses are JSON. Errors look like `{ "error": { "code": "PAGE_LIMIT_EXCEEDED", "message": "…" } }`.

### Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password }` | Creates the organization and its assistant token; returns `{ token, organization }` |
| POST | `/api/auth/login` | `{ email, password }` | Returns `{ token, organization }` |
| GET | `/api/auth/me` | | Admin JWT |

### Documents (admin JWT)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/documents` | List + limits |
| POST | `/api/documents` | `multipart/form-data`, field `file`; optional `replaceDocumentId` |
| DELETE | `/api/documents/:id` | Removes the document, its chunks and its file |

### Assistant (admin JWT)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/assistant` | `{ token, url, embed: { iframe, script } }` |
| POST | `/api/assistant/regenerate` | New token; old URL stops working |
| GET | `/api/usage` | Totals and recent questions |

### Public
| Method | Path | Notes |
|---|---|---|
| GET | `/api/public/assistant/:token` | `{ name }` for the widget header |
| POST | `/api/ask` | `{ token, question, debug? }` |

`POST /api/ask` response:

```json
{
  "status": "answered",
  "answered": true,
  "answer": "No, you can't receive the Merit Scholarship while holding the Sports Scholarship…",
  "references": [
    { "filename": "Scholarship_Rules.pdf", "page": 2, "display": "Scholarship_Rules.pdf — Page 2" },
    { "filename": "Scholarship_Rules.pdf", "page": 3, "display": "Scholarship_Rules.pdf — Page 3" }
  ],
  "questionType": "ELIGIBILITY_DECISION",
  "decision": {
    "goal": "Eligibility for the Merit Scholarship",
    "outcome": "NEGATIVE",
    "conditions": [
      { "id": "C1", "type": "BOOLEAN", "question": "Is a 2nd-year student eligible?", "value": "YES", "decidedBy": "decision-model" },
      { "id": "C2", "type": "BOOLEAN", "question": "Does a CGPA of 8.2 meet the minimum?", "value": "YES", "decidedBy": "rule-engine",
        "rule": { "userValue": 8.2, "operator": ">=", "threshold": 8 } },
      { "id": "C3", "type": "BOOLEAN", "question": "Can a Sports Scholarship holder also get Merit?", "value": "NO", "decidedBy": "decision-model" }
    ]
  },
  "latencyMs": 6200
}
```

`status` is one of `answered`, `not_found` (not in the knowledge base) or `needs_review` (a required condition couldn't be decided). With `"debug": true` the response also includes `trace`, a timing for each pipeline stage.

---

## Error handling

| Situation | Response |
|---|---|
| File over 10 MB | 400 `LIMIT_FILE_SIZE`: "File is too large. Maximum size is 10 MB per PDF." |
| Not a PDF / corrupted / password-protected | 400 `INVALID_FILE_TYPE` or `INVALID_PDF` |
| More than 20 pages | 400 `PAGE_LIMIT_EXCEEDED`: "This PDF has 25 pages. The maximum is 20…" |
| 11th document | 400 `DOCUMENT_LIMIT_REACHED` |
| Scanned PDF without text | 400 `NO_TEXT` |
| Embedding failure during upload | 502 `PROCESSING_FAILED`, document marked failed, no partial chunks |
| Empty / too long question | 400 `EMPTY_QUESTION` / `QUESTION_TOO_LONG` |
| Invalid or regenerated assistant token | 401 `INVALID_ASSISTANT_TOKEN` |
| Too many questions | 429 `RATE_LIMITED` |
| Nothing relevant in documents | 200 with `status: "not_found"` and a clear message |
| One decision model fails | That condition becomes `UNKNOWN` → `status: "needs_review"` |
| All LLM providers unavailable | 503 `LLM_UNAVAILABLE` |

---

## Testing

- **Test data:** `test-data/` holds 3 PDFs for a university and 3 for a company, plus invalid files for upload errors. `make_pdfs.py` regenerates them.
- **Test questions:** `test-data/TEST_QUESTIONS.md` lists 18 questions with expected answers and sources: direct facts, policies, procedures, comparisons, multi-condition eligibility (passing, failing, numeric, missing information), summaries, questions the documents can't answer, and the cross-tenant check.
- **Isolation test:** `npm run test:isolation`
- **Smoke test:** `node scripts/smoke-test.js <file.pdf> "<question>"` registers a throwaway organization, uploads, asks and prints the trace.

---

## Assumptions and limitations

- **One admin per organization**; no team members or roles yet.
- **Text PDFs only**: scanned or image-only PDFs are rejected (no OCR). Tables are read as text, so complex tables may lose structure.
- **Each question is independent**: the assistant has no conversation memory, so "what about the hostel?" after a scholarship question isn't linked to it.
- **Processing is synchronous** (fine within the 20-page limit); a job queue would be needed for larger files.
- **In-app vector search** loads one organization's chunks per question. That's fast at this scale (≤ 10 × 20 pages), but larger tenants should switch on Atlas Vector Search (supported, see Setup).
- **Free-tier LLM limits**: Groq and Gemini free tiers have rate limits; the server retries and falls back between providers, but heavy use needs paid keys. Output-token reservations are kept small per role to stay within Groq's tokens-per-minute limit.
- **Latency**: a multi-condition question makes about 5 sequential AI stages (several of them parallel inside), typically 5–15 s on free tiers.
- **Decision quality depends on retrieval**: if a rule isn't retrieved, its condition becomes `UNKNOWN` and the answer is marked for human review rather than guessed.
- The assistant token is a **publishable key** by design (it appears in embed code). It only allows asking questions, is rate-limited, and can be rotated.
