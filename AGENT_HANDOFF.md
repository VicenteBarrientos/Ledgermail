# LedgerMail — Agent Handoff

**Actualizado:** 2026-07-13  
**Repo:** https://github.com/VicenteBarrientos/Ledgermail  
**Local:** `C:\Users\hp\OneDrive\Desktop\mail reader`

## Estado actual

### Hecho (2026-07-13)

- **Gmail OAuth** connected for `vicente.t.barrientos.m@gmail.com` (tokens in Postgres `MailboxSource`).
- **Outlook / Hotmail OAuth** (Microsoft Graph) implemented and connected for `vicho_barrientos@hotmail.com`.
  - Package: `packages/outlook` (`@ledgermail/outlook`)
  - Routes: `GET /api/outlook/auth-url`, `POST /api/outlook/connect`, `GET /api/outlook/overview`
  - `POST /api/gmail/sync` dispatches by mailbox `type` (Gmail vs Outlook).
- Dashboard:
  - Same-origin proxy `/ledger-api/*` → API (fixes browser `Failed to fetch` / CORS).
  - Buttons: **Conectar Gmail** + **Conectar Outlook / Hotmail**.
  - OAuth callback uses `state=gmail|outlook`.
- Connect flow creates/upserts `User` by email (fixes FK `MailboxSource_userId_fkey` with `default-user`).
- Gmail overview + overview APIs for metadata scans (not bank-only).
- Local mailboxes verified with tokens; bank sync dry-run: no TEF samples in recent windows (false positive on “postulación recibida” is expected).

### Not done / open

- **UC Outlook** (`vtbarrientos@uc.cl`): university blocks agents — use **forward** bank mail to Gmail/Hotmail. Not OAuth.
- **Azure publisher verification**: multi-tenant client consent may fail for third parties until MPN/publisher verified.
- **Bank keyword false positives**: tighten subject filter so job “recibida” ≠ TEF.
- **Production env**: ensure Vercel has `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`, `OUTLOOK_REDIRECT_URI` (prod URL, not only localhost).
- **Gmail OAuth on Vercel**: `GMAIL_*` + redirect must match production dashboard origin.

## Stack (short)

| Layer | Tech |
|-------|------|
| API | Express on `apps/api` (PORT local **3002**), Vercel serverless bundle `api/index.js` |
| Dashboard | Next.js 15 `apps/dashboard` (local **3000**) |
| DB | Postgres (`ledgermail`) — local often Docker `condosync-postgres-1:5432` |
| Gmail | `packages/gmail` + Google OAuth |
| Outlook | `packages/outlook` + Microsoft Graph OAuth (tenant `common`) |
| Parse | `packages/core` + bank providers (Banco de Chile primary) |
| CondoSync | Webhook `CONDOSYNC_WEBHOOK_URL` |

## Local run

```bash
cd "C:\Users\hp\OneDrive\Desktop\mail reader"
# .env: DATABASE_URL, GMAIL_*, OUTLOOK_*, LLM keys, CONDOSYNC_WEBHOOK_URL
npm install
npx prisma db push --schema packages/database/prisma/schema.prisma
# terminal 1
cd apps/api && npx tsx src/index.ts
# terminal 2
cd apps/dashboard && npm run dev
```

- Dashboard: http://localhost:3000  
- API: http://localhost:3002  
- Proxy: http://localhost:3000/ledger-api/api/...

## Env (names only — never commit values)

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres |
| `GMAIL_CLIENT_ID` / `SECRET` / `REDIRECT_URI` | Gmail OAuth (redirect = dashboard origin) |
| `OUTLOOK_CLIENT_ID` / `SECRET` / `REDIRECT_URI` | Azure app (Web redirect = dashboard origin) |
| `ANTHROPIC_API_KEY` / OpenAI / Gemini | Parse + chat |
| `CONDOSYNC_WEBHOOK_URL` | Payments webhook |
| `PORT` | API port (local 3002) |

Azure app used locally: display name `dgerMail local` (typo OK). Secret must be **Value**, not Secret ID (`AADSTS7000215`).

## Deploy notes

- GitHub: `VicenteBarrientos/Ledgermail` branch `main`.
- Prod URLs:
  - API: https://ledgermail-api.vercel.app
  - Dashboard: https://ledgermail-dashboard.vercel.app
- API Vercel project: `ledgermail-api` (cwd `apps/api`).
- Dashboard Vercel project: `ledgermail-dashboard` (cwd `apps/dashboard`).
- API Vercel env **currently** has `DATABASE_URL`, `CONDOSYNC_WEBHOOK_URL` — **still need** for full OAuth/parse on prod:
  - `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`, `OUTLOOK_REDIRECT_URI=https://ledgermail-dashboard.vercel.app`
  - `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI=https://ledgermail-dashboard.vercel.app`
  - LLM keys (`ANTHROPIC_API_KEY` / OpenAI as used)
- Dashboard already has `NEXT_PUBLIC_API_URL` + `ANTHROPIC_API_KEY`.
- Azure + Google Cloud: add production redirect URI `https://ledgermail-dashboard.vercel.app` (Web).
- Do **not** commit `.env`.

## Obsidian (operator vault)

`C:\Users\hp\OneDrive\Documentos\Obsidian Vault\Ops\`

- [[Email Outlook]] · [[Email Gmail]] · [[Email UC]]
- [[Email brief 2026-07-13]]
- [[Onboarding cliente email LedgerMail]]

## Prioridades siguientes

1. Production env + OAuth redirect URIs for deployed dashboard URL.
2. UC bank forward rule → Gmail/Hotmail for TEF samples.
3. Tighten bank subject filter / fingerprint.
4. Optional: Azure publisher verification for multi-client consent.
5. E2E: real Banco de Chile TEF → parse → CondoSync conciliación.

## Checkpoint log

| Fecha | Nota |
|-------|------|
| 2026-07-13 | Outlook Graph package + dual connect; Gmail+Hotmail live locally; handoff created; commit/push/deploy this change set. |
| 2026-07-13 | Prod API 500: `Cannot find module '/var/task/no…` (Prisma engine). Fix: binaryTargets rhel-openssl-3.0.x + copy-engines into `api/` + vercel includeFiles. |
