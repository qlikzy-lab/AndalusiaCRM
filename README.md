# Andalusia Academy — WhatsApp Lead Ingestion

Upload screenshots of WhatsApp messages (inbox lists or individual chats); Claude
reads them, extracts lead data, deduplicates it, and saves structured leads to a
local CRM. Built for a non-technical user managing school enquiries.

- **Stack:** Next.js (App Router) + TypeScript + Tailwind CSS
- **AI vision:** Anthropic Claude (`claude-sonnet-4-6`)
- **Database:** SQLite via Prisma (local)
- UI is in English; AI-generated notes are in English (internal use).

## Setup

```bash
npm install          # uses an isolated npm cache (see .npmrc)
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npx prisma migrate dev       # creates prisma/dev.db (already done once)
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable            | Where        | Purpose                          |
| ------------------- | ------------ | -------------------------------- |
| `ANTHROPIC_API_KEY` | `.env.local` | Calls Claude to read screenshots |
| `DATABASE_URL`      | `.env`       | SQLite path (`file:./dev.db`)    |

> The shared npm cache on this machine has root-owned entries that break installs,
> so `.npmrc` points npm at `/tmp/acrm-npm-cache`.

## Mock mode (no API key / no credits)

Set `MOCK_EXTRACTION=1` to make `/api/extract` return fixture leads instead of
calling Claude — useful for working on the UI:

```bash
MOCK_EXTRACTION=1 npm run dev
```

## Build status — all phases complete

- **Phase 1 ✅** — Foundation, upload screen, `/api/extract` (Claude vision,
  HEIC→JPEG, strict JSON parsing, graceful errors).
- **Phase 2 ✅** — Deduplication, review screen (edit / merge / skip / save-as-new),
  save to DB + `pushToCRM()`.
- **Phase 3 ✅** — CRM dashboard (search, status filter, manual add, inline edit,
  delete, CSV export).

## Project structure

```
app/
  page.tsx              Upload screen
  review/page.tsx       Review screen (dedup results, edit, save)
  crm/page.tsx          CRM dashboard (search, filter, edit, CSV)
  api/extract/route.ts  Screenshots → Claude → JSON + dedup
  api/leads/route.ts    List + save leads
  api/leads/[id]/route.ts  Edit + delete a lead
lib/
  anthropic.ts          Claude client + multi-image extract + JSON parse
  prompt.ts             Extraction system prompt
  normalize.ts          Phone normalization (Tunisian +216)
  leadStatus.ts         Status labels + colors
  crm.ts                pushToCRM() placeholder
  prisma.ts             Prisma client singleton
  types.ts              Shared types
prisma/schema.prisma    Lead model
```
