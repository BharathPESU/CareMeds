# CareMeds — Residential Care Home Medication Management System

CareMeds is a calm, safety-first medication, resident care, and pharmacy inventory platform built for residential senior care homes with three distinct staff roles: **Admin**, **Caretaker**, and **Doctor**.

## Architecture & Tech Stack
- **Framework**: Next.js 15 App Router + TypeScript (strict)
- **Database**: Supabase PostgreSQL + Drizzle ORM (`db/schema.ts`, `db/migrations/0001_init.sql`, `db/seed.ts`)
  - Calculated `stock_quantity` view (never directly edited)
  - `btree_gist` exclusion constraint preventing overlapping `dosage_schedules`
  - Trigger enforcing `dose_unit = medicine.stock_unit`
  - Append-only trigger protecting `audit_log`
  - Partial unique index preventing duplicate active alerts
  - Row-Level Security (`RLS`) enabled with zero client policies on every table (all access flows through authenticated Next.js Route Handlers)
- **Authentication & Security**: Argon2id password hashing, 12+ character password policy, TOTP MFA (`otplib` + QR codes + 10 single-use recovery codes), opaque `httpOnly; SameSite=Strict` session cookies stored as SHA-256 hashes, CSRF token validation, and 5-attempt account lockout.
- **Care Assistant**: Server-side `@google/genai` integration using the free-tier `gemini-4-hydrogen` model with strict zero-resident-data guardrails (resident names, DOBs, and identifiers are blocked before calling the model).
- **Exports**: Role-scoped CSV, Excel (`.xlsx` via `exceljs`), and printable PDF (`pdf-lib`) reports.
- **Themes**: `Clinical Calm`, `Warm Care`, and `Modern Indigo` in Light, Dark, and System modes with fixed status colours + icons + text labels.

## Connecting Your Supabase PostgreSQL Database
When `DATABASE_URL` is not configured, CareMeds automatically runs against a persistent local preview store (`/tmp/caremeds-preview-store-v1.json`) and displays a role switcher on `/login` so you can explore every workflow immediately without hardcoded passwords.

To connect your own **Supabase** project:
1. Create a Supabase project in `ap-south-1` (Mumbai) or your nearest region.
2. Copy `.env.example` to `.env.local` (or configure Vercel / AI Studio Secrets):
   - `DATABASE_URL` — Supabase **Transaction Pooler** URI (port `6543`)
   - `DIRECT_DATABASE_URL` — Supabase **Direct Connection** URI (port `5432`)
   - `SESSION_SECRET` & `MFA_ENCRYPTION_KEY` — 64-character random hex strings
   - `SETUP_TOKEN` — one-time secret for `/setup`
   - `CRON_SECRET` — secret for Vercel scheduled jobs (`/api/cron/*`)
   - `GEMINI_API_KEY` — free Gemini API key for the Care Assistant
   - Optional: `RESEND_API_KEY`, `TWILIO_*`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
3. Run the SQL migration against Supabase:
   ```bash
   psql "$DIRECT_DATABASE_URL" -f db/migrations/0001_init.sql
   ```
4. Seed baseline lookup tables (`roles`, `dose_time_windows`, `vital_types` with `NULL` thresholds, `system_settings`):
   ```bash
   npx tsx db/seed.ts
   ```
5. Open `/setup` with your `SETUP_TOKEN` to create the first Administrator account and enroll TOTP MFA.

## Verification
- **Unit tests**: `npx --yes tsx --test tests/unit/caremeds.test.ts`
- **Production build**: `npm run build`
- **Lint**: `npm run lint`
