# LedgerMail

LedgerMail is an enterprise-grade, AI-powered platform designed to connect, synchronize, clean, and parse bank transaction emails and PDFs into uniform JSON payloads.

Built as an independent system designed for future integrations (such as with CondoSync), LedgerMail runs on a provider-based architecture, allowing new banks to be added easily.

---

## Key Features

1. **Monorepo Workspaces**: Conceptually split into independent modules (`packages/core`, `packages/providers`, `packages/llm`, `packages/validation`, `packages/gmail`, `packages/database`, `packages/shared`) and execution applications (`apps/dashboard`, `apps/api`).
2. **Multi-LLM Connector**: Supports OpenAI (Structured Outputs), Gemini (Structured Schema), and Anthropic Claude (forced Tool Calling JSON schema).
3. **Fingerprint-Based Routing**: Banks are detected using a weighted scoring model matching domains, subject patterns, HTML elements, footers, and logo URLs.
4. **Aggressive Sanitizer**: Optimizes LLM input tokens by stripping CSS styles, scripts, comments, and standard legal disclaimers.
5. **Programmatic Confidence Scores**: Calculated deterministically based on metadata matching rather than asking the LLM to rate itself.
6. **Cost & Latency Audits**: Tracks exact latency, input/output tokens, and USD cost per parse attempt in the database.
7. **Regression Testing & Fixtures**: Built-in fixtures folder for local testing against mock html notifications to prevent regressions.
8. **Replay Mode**: Allows reprocessing any saved email against any alternative LLM model directly from the UI dashboard.
9. **Multi-Mailbox Support**: Database structure allows mapping multiple Gmail, Outlook, or IMAP sources per user.

---

## Directory Structure

```text
ledgermail/
├── apps/
│   ├── dashboard/           # Next.js 15 UI Dashboard
│   └── api/                 # Express.js REST API service gateway
├── packages/
│   ├── core/                # Pipeline orchestrator, normalizer, confidence, and sanitizer
│   ├── providers/           # Versioned bank providers (Banco de Chile MVP focus)
│   ├── llm/                 # Multi-LLM provider wrappers (OpenAI, Gemini, Claude)
│   ├── validation/          # Zod validation schemas
│   ├── gmail/               # Gmail OAuth and PDF extraction logic
│   ├── database/            # Prisma client singleton and database models
│   └── shared/              # Configuration files and global loggers
├── fixtures/                # Anonymized email HTML files & expected parsed JSON results
│   └── banco-chile/
└── package.json             # Root monorepo workspace configuration
```

---

## Setup & Run Instructions

### 1. Configure Environment Variables
Copy the `.env.example` file to `.env` in the root folder:
```bash
cp .env.example .env
```
Fill in your database URL, LLM API keys (OpenAI, Gemini, Anthropic), and Gmail OAuth client keys.

### 2. Install Workspaces
Run npm install in the root folder to download all packages and link the workspaces:
```bash
npm install
```

### 3. Database Migration
Initialize and generate your Prisma database schema:
```bash
npx prisma db push --schema=packages/database/prisma/schema.prisma
```

### 4. Running the Project
Start both the REST API and the Next.js Dashboard concurrently:
```bash
npm run dev
```
* **API Service**: Runs on `http://localhost:3001`
* **Dashboard Console**: Runs on `http://localhost:3000`

---

## Testing Strategy

LedgerMail's testing is layered so that fast, free checks run on every push, while
the checks that cost real LLM tokens and depend on live Gmail run on a schedule instead.

### 1. Unit & regression tests (every push/PR, via CI)
```bash
npm run test
```
Runs Vitest across every workspace. `packages/core/test/fixtures.test.ts` mocks the DB
and LLM, then replays every HTML fixture in `/fixtures` through the real pipeline and
asserts the extracted fields match the corresponding `.expected.json`. `apps/api/test/api.test.ts`
does the same for the HTTP layer (status codes, validation, pagination, summary
aggregation) with `@ledgermail/database`, `@ledgermail/core` and `@ledgermail/gmail` mocked.
Zero network calls, zero cost — this is what `.github/workflows/ci.yml` runs on every
push and pull request.

When a new bank provider gets fully implemented, add its anonymized HTML + expected JSON
under `/fixtures/<bank>/` and the fixture test picks it up automatically.

### 2. Synthetic canary (scheduled, via `.github/workflows/canary.yml`)
```bash
npm run canary
```
This is the "test agent that acts like a user" — it exercises the live, deployed system,
not mocks. See `scripts/canary/run-canary.ts` for the full design. Two independent tiers:

- **Tier A — Gmail ingestion liveness.** Sends a real email over SMTP to a dedicated
  test inbox connected to LedgerMail, then polls `POST /api/gmail/sync` until that
  message shows up. Proves OAuth token refresh, the Gmail API fetch, and the dedupe/DB-write
  path are alive — independent of whether the email matches a bank fingerprint.
- **Tier B — parse/validate/DB/webhook pipeline.** Calls `POST /api/parse` directly
  with the real Banco de Chile fixture (unique folio/amount per run) and asserts every
  extracted field matches exactly. This is what actually proves detection, sanitization,
  the live LLM call, Zod validation, the DB write, and the CondoSync webhook dispatch
  still work end to end.

Runs every 6 hours by default (see the workflow's cron) and posts to
`CANARY_ALERT_WEBHOOK_URL` (a Slack incoming webhook, or any URL accepting `{text}`)
only when something fails. Required secrets are listed in `.env.example` under the
"Synthetic Canary" section and must be set as GitHub Actions secrets
(`CANARY_API_BASE_URL`, `CANARY_SMTP_USER`, `CANARY_SMTP_PASS`, `CANARY_TARGET_EMAIL`,
`CANARY_MAILBOX_SOURCE_ID`, `CANARY_ALERT_WEBHOOK_URL`) for the scheduled workflow to run.

### 3. Manual parser testing
The dashboard's "Probar Parser manual" button (and the underlying `POST /api/parse`
endpoint) let you paste an arbitrary sender/subject/HTML and see the extraction result
instantly — useful while tuning a new provider's prompt or fingerprint before it has
fixtures and canary coverage.

---

## MVP Quality Directive
> [!IMPORTANT]
> **No second bank provider should be fully implemented until Banco de Chile parsing achieves >99% accuracy across the fixture test dataset.**
