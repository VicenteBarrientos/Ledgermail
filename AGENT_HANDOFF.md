# LedgerMail — Agent Handoff

**Actualizado:** 2026-07-13 (sesión cerrada)  
**Repo:** https://github.com/VicenteBarrientos/Ledgermail (`main`)  
**Local:** `C:\Users\hp\OneDrive\Desktop\mail reader`  
**Owner:** Vicente Barrientos

---

## TL;DR para el próximo agente

| Área | Estado |
|------|--------|
| **Código dual Gmail + Outlook** | Merged on `main` |
| **OAuth local** | Gmail + Hotmail connected and verified |
| **Commit / push** | Done (`c6b5fe2` bundle fix; earlier `946d058` Outlook feature) |
| **Deploy API** | https://ledgermail-api.vercel.app — **alive** (`GET /api/mailboxes` → 200) |
| **Deploy dashboard** | https://ledgermail-dashboard.vercel.app — **alive** |
| **Prod Outlook/Gmail OAuth** | **Not configured** — missing Vercel env + Azure/Google prod redirects |
| **Local dev servers** | **Stopped** (cleaned up duplicate background tasks) |
| **UC email** | Outlook university — **no agent OAuth**; forward TEFs only |

**Next agent priority:** wire production OAuth env + redirects, then re-test Conectar Outlook/Gmail on prod dashboard.

---

## Hecho en esta sesión (2026-07-13)

### Product / code

- **`@ledgermail/outlook`**: Microsoft Graph OAuth (`Mail.Read`, refresh tokens), sync + overview.
- **API routes:**
  - `GET/POST` Gmail auth-url / connect / overview / sync
  - `GET/POST` Outlook auth-url / connect / overview
  - `POST /api/gmail/sync` dispatches by `MailboxSource.type` (`GMAIL_OAUTH` | `OUTLOOK_OAUTH`)
- **Dashboard:** Conectar Gmail + Conectar Outlook / Hotmail; OAuth `state=gmail|outlook`; same-origin proxy `/ledger-api/*` → API (fixes `Failed to fetch`).
- **Connect FK fix:** upsert `User` by email (was failing on `default-user`).
- **Secret gotcha documented:** Azure `AADSTS7000215` = pasted Secret **ID** instead of **Value**.

### Local verification (user machine)

| Mailbox | Type | Tokens |
|---------|------|--------|
| `vicente.t.barrientos.m@gmail.com` | Gmail OAuth | OK (local DB) |
| `vicho_barrientos@hotmail.com` | Outlook OAuth | OK (local DB) |
| `test-sync@ledgermail.com` | placeholder | ignore |

Bank sync dry-run: no real TEF samples; one false positive (“postulación recibida”). Connectors work.

### Deploy / runtime fixes

1. First prod 500s: missing module `@ledgermail/shared/src/index.ts` (workspace `main` is `.ts`).
2. **Fix shipped:** esbuild → `api/server.js`; thin `api/index.ts` only `require("./server.js")`.
3. Prisma: `binaryTargets` includes `rhel-openssl-3.0.x`; copy-engines into `apps/api` + `apps/api/api`; engine path helper in `packages/database/src/client.ts`.
4. **Verified after fix:** `GET https://ledgermail-api.vercel.app/api/mailboxes` → **200** `[]` (prod DB empty of mailboxes is OK; different from local).
5. `GET /api/outlook/auth-url` on prod returns *“Outlook OAuth is not configured”* until env is set (expected).

### Ops / vault (Obsidian)

`C:\Users\hp\OneDrive\Documentos\Obsidian Vault\Ops\`

- Email Outlook, Email Gmail, Email UC
- Email brief 2026-07-13
- Onboarding cliente email LedgerMail

### Cleanup

- Killed duplicate local dashboard/API background processes.
- Local ports **not** left running at handoff close.
- `.github/workflows` **not** pushed (GitHub PAT lacks `workflow` scope) — still untracked locally if present.

---

## Not done / open (ordered)

1. **Prod OAuth env (blocking for prod connect)**  
   Vercel project **`ledgermail-api`** currently: `DATABASE_URL`, `CONDOSYNC_WEBHOOK_URL` only.  
   Add:
   - `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`
   - `OUTLOOK_REDIRECT_URI=https://ledgermail-dashboard.vercel.app`
   - `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`
   - `GMAIL_REDIRECT_URI=https://ledgermail-dashboard.vercel.app`
   - LLM keys as needed for parse/chat  
   Azure app (`dgerMail local`) + Google OAuth client: add redirect  
   `https://ledgermail-dashboard.vercel.app`  
   Redeploy API after env change.

2. **UC (`vtbarrientos@uc.cl`)** — no third-party agents. Forward bank TEFs → Gmail/Hotmail.

3. **Tighten bank subject filter** — avoid matching job “recibida”.

4. **Azure publisher verification** — may block *client* multi-tenant consent later.

5. **E2E** TEF → parse → CondoSync conciliación with real bank mail.

6. Optional: push CI workflows with a token that has `workflow` scope.

---

## Stack (short)

| Layer | Tech |
|-------|------|
| API | Express `apps/api`, local **3002**, Vercel `ledgermail-api` |
| Serverless entry | `api/index.ts` → `require("./server.js")` (esbuild bundle) |
| Dashboard | Next.js 15 `apps/dashboard`, local **3000**, `ledgermail-dashboard` |
| DB | Postgres `ledgermail` (local often Docker `condosync-postgres-1`) |
| Gmail | `packages/gmail` |
| Outlook | `packages/outlook` (Graph, tenant `common`) |
| CondoSync | `CONDOSYNC_WEBHOOK_URL` |

## Local run (when needed)

```bash
cd "C:\Users\hp\OneDrive\Desktop\mail reader"
# .env: DATABASE_URL, GMAIL_*, OUTLOOK_*, LLM, CONDOSYNC_WEBHOOK_URL, PORT=3002
npm install
npx prisma db push --schema packages/database/prisma/schema.prisma
cd apps/api && npx tsx src/index.ts          # :3002
cd apps/dashboard && npm run dev             # :3000
```

Proxy: `http://localhost:3000/ledger-api/api/...` → API.

## Env (names only — never commit values)

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres |
| `GMAIL_CLIENT_*` / `GMAIL_REDIRECT_URI` | Google OAuth |
| `OUTLOOK_CLIENT_*` / `OUTLOOK_REDIRECT_URI` | Azure app Web redirect |
| `ANTHROPIC_API_KEY` / OpenAI / Gemini | Parse + chat |
| `CONDOSYNC_WEBHOOK_URL` | Payments webhook |
| `PORT` | Local API (3002) |

Azure display name: **`dgerMail local`**. Secret = column **Value**, not Secret ID.

## Deploy

| Project | URL |
|---------|-----|
| API | https://ledgermail-api.vercel.app |
| Dashboard | https://ledgermail-dashboard.vercel.app |

Deploy from monorepo root with Vercel project linked (`Root Directory` = `apps/api` for API).  
Do **not** commit `.env`.

## Checkpoint log

| Fecha | Nota |
|-------|------|
| 2026-07-13 | Outlook Graph + dual connect; Gmail+Hotmail live **locally**. |
| 2026-07-13 | Commit/push feature + handoff; deploy API/dashboard. |
| 2026-07-13 | Prod 500: TS workspace main on Vercel → fixed via `api/server.js` bundle entry. |
| 2026-07-13 | Prod `mailboxes` **200**. Outlook auth-url waits on prod env. Local servers stopped. **Session closed.** |
