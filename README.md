# InvoiceShield AI

Evidence-based invoice review for finance teams. Extracts invoice fields, runs deterministic checks
(duplicates, vendor and bank-detail mismatches, unusual amounts, arithmetic), and explains the findings.
It flags anomalies; people make the decisions. Nothing is approved, rejected or paid automatically.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Firebase Auth / Firestore / Storage ·
Ollama (local AI) · Zod · Recharts · three.js (react-three-fiber) · Lucide icons · Vitest

## Quick start (no Firebase account needed)

Runs entirely locally with the Firebase emulators. Requires Node 20+ and Java 17+.

```bash
npm install
npm run emulators      # terminal 1 — Auth + Firestore emulators (uploads go to ./.data)
npm run dev:emulator   # terminal 2 — app on http://localhost:3000
```

Create an account on the sign-in page, then use **Load synthetic demo data** on the dashboard.
Upload the fictional PDFs from the **Upload invoice** page ("Try a synthetic sample"), or regenerate them with `npm run samples`.

## Using your real Firebase project

1. In the Firebase console: enable **Authentication → Email/Password**, create a **Firestore** database, and (optionally) **Storage**.
2. Copy `.env.example` to `.env.local` and fill in the web config (Project settings → General) and the service-account values
   (Project settings → Service accounts → Generate new private key). Never commit `.env.local`.
3. New projects need the Blaze plan for Storage. Without it set `STORAGE_DRIVER=local` (files go to `./.data/uploads`).
4. Deploy the locked-down rules: `firebase deploy --only firestore:rules,storage` (all data access is server-side via the Admin SDK).
5. `npm run dev`.

## AI

| `AI_PROVIDER` | Behaviour |
|---|---|
| `ollama` (default) | Local model. `ollama pull qwen2.5:3b` (fits 8 GB Macs; ~25 s per call warm), then set `OLLAMA_MODEL`. Invoice text never leaves your machine. |
| `openrouter` | Third-party API. Synthetic data only; the UI shows an "External AI provider" warning. |
| `none` | Rules-only. Extraction uses a deterministic parser and summaries use templates. |

If the model is unreachable or returns invalid JSON, the app falls back to rules-only automatically and says so in the UI.
The model never creates findings or scores: rules do. Numbers the model returns are accepted only if they appear in the document text.

## Architecture

- `src/lib/domain` — pure, tested business logic: money (integer minor units), normalisation, rules engine, scoring, review state machine, analytics.
- `src/lib/server` — server-only: Admin SDK, repositories, storage, AI providers, analysis pipeline, seed data.
- `src/app/api` — Route Handlers with a `{ data, error }` envelope, Zod validation and ownership checks on every request.
- `src/app/(app)` — Server Components for pages; client components only where interaction needs them.
- Auth: Firebase sign-in on the client → verified, HttpOnly session cookie → every page and API call re-verifies it server-side.
- Firestore: `invoices` (+ `findings`, `runs` subcollections), `vendors`, `auditEvents` (append-only), `users`.

## Scripts

`npm test` · `npm run typecheck` · `npm run lint` · `npm run build` · `npm run samples`

## Limitations (prototype)

Scores are review indicators, not fraud probabilities. Analysis runs in-process after the response (no queue), history comparison loads the
user's invoices into memory (fine to a few thousand), scanned PDFs without a text layer need to be uploaded as images for OCR, and access is
per-user rather than per-organisation. See Part B of the implementation plan for the production roadmap.
