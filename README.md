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

## Regression Testing Suite

To execute the unit tests and check Banco de Chile parsing against the fixture files, run:
```bash
npm run test
```
This runs Vitest on the tests folder, executing structural clean checks, amount normalizers, confidence score assertions, and fixture validations.

---

## MVP Quality Directive
> [!IMPORTANT]
> **No second bank provider should be fully implemented until Banco de Chile parsing achieves >99% accuracy across the fixture test dataset.**
