# AfriJob RT46 Enhancement — Status

This replaces the previous `RT46_IMPLEMENTATION.md`, which described a version of this
feature set that was never actually run against the database and referenced tables
(`rt46.merchants`, `rt46.work_orders` as originally drafted) that didn't match what's
live in production. Everything below has been verified directly against the live
Supabase project (`wtbycozfoeiepvgortvx`).

## What's live in the database (verified, not assumed)

All 10 migrations in `supabase/migrations/` are now the exact SQL applied to production
— including the two earliest ones (base schema + insurance compliance), which I
reconstructed column-for-column and policy-for-policy from live `information_schema`
and `pg_policies` introspection after confirming I didn't have their original source
files. These are marked as reconstructed in-file; they're not a guess, but if you want
belt-and-suspenders certainty, `supabase db pull` will confirm they match byte-for-byte.

All 7 RT46 problem areas are implemented as real Postgres schema, functions, triggers,
RLS policies, and `pg_cron` jobs — enforced at the database layer regardless of what the
frontend does:

1. **Insurance auto-suspend** — daily cron checks `insurance_valid_until`; expired
   merchants are suspended and blocked from new allocation until a verified policy is
   re-uploaded.
2. **Fair allocation** — `rt46.allocate_work_order()` scores every eligible merchant on
   capacity, B-BBEE level, region match, and quality score; every candidate (eligible or
   excluded, with reason) is written to `rt46.allocation_log`.
3. **Quality control** — checklist templates per category, auto-seeded on allocation;
   before/during/after evidence requires GPS + timestamp; a DB trigger blocks marking a
   work order `completed` until the checklist is done, evidence exists, and the latest
   quality review passed with no open rework case.
4. **SLA / turnaround** — per-category targets, `due_at` set on allocation, breach
   detection every 15 minutes via cron, auto-escalation notifications to admins.
5. **Fraud detection** — repeated-vehicle, volume-spike, high-cancellation-rate, and
   shared-bank/contact detection (daily scan + real-time trigger); full
   Open → Under Review → Confirmed/Dismissed workflow; one-click suspend that refuses to
   run without a reason.
6. **Continuous merchant verification** — facilities/equipment/technicians/bank-details
   tables, critical-field change logging with an automatic 72h re-verification hold,
   daily re-inspection scheduler, auto-suspend on failed inspection / auto capacity-cut
   on conditional pass.
7. **Parts & pricing integrity** — part number/description/source/qty/unit price are all
   mandatory at insert time; price-variance flagging against `parts_price_reference`;
   invoice photo required and enforced by the DB before a job over R10,000 can close.

Migration files for all 7 areas are in `supabase/migrations/` (10 files total, exact SQL
that is live in production today).

## What's in the frontend now

All 6 screens (`/rt46`, `/rt46/merchants`, `/rt46/work-orders`, `/rt46/compliance`,
`/rt46/quality`, `/rt46/fraud-flags`) have been rewritten from scratch against the real
schema above — the version previously in this repo pointed at a fictional schema
(`rt46.merchants` with fields like `max_active_jobs`, `critical_compliance_status` etc.
that never existed) and would not have worked.

Also fixed: `tailwind.config.js` and `postcss.config.js` were missing from the whole
project (not just the RT46 addition) — the app could not have been built at all without
them. Both have been added, inferring the design tokens from what `index.css` and the
components already reference.

### Frontend scope — now closed
Both gaps flagged in the previous pass are now built:
- **PDF job reports for RT46** (`src/lib/pdf/RT46WorkOrderReport.tsx` +
  `src/hooks/useRt46WorkOrderReport.ts`) — pulls the work order, checklist, GPS-tagged
  evidence, parts/labour, and latest quality review, signs the private evidence URLs,
  renders an A4 PDF, uploads it, stamps `work_orders.pdf_report_url`, and hands it to
  the OS share sheet. Wired into the "Generate & share PDF report" button on
  `/rt46/quality`.
- **Offline queueing for RT46 evidence + checklist** (`useRt46SyncQueue.ts`, new Dexie
  tables in `offlineDb.ts` v3) — mirrors the core app's `useSyncQueue` pattern. Evidence
  photos still capture GPS + timestamp at the moment of capture even offline; checklist
  toggles queue the same way. Both flush automatically once connectivity returns, mounted
  once in `AppShell.tsx` alongside the existing sync queue.

### A real bug caught and fixed during this pass
The `rt46-evidence` storage bucket is **private** (correctly — evidence and insurance
documents shouldn't be public), but the first draft of the evidence thumbnail grid and
the insurance-document link both called `getPublicUrl()`, which silently returns a URL
that would 403 on a private bucket. Fixed by adding a shared `useSignedUrl()` hook and
using it everywhere a private-bucket file is displayed. Also surfaced a related gap in
the earlier session's work: `merchant_insurance_policies.document_storage_path` had no
storage bucket or RLS policy behind it at all — nothing could have uploaded or read an
insurance document before this. It now resolves against `rt46-evidence` using the same
`{merchant_id}/...` path convention the evidence/invoice policies already use, so no new
migration was needed — but there is currently no merchant-facing upload UI for insurance
documents (only the admin verification screen you asked for). That's a real remaining
gap if merchants need to self-serve uploads through this app rather than another channel.

### Still not built (explicitly out of scope, not overlooked)
- Merchant self-service insurance document upload UI (see above).
- A merged view showing not-yet-synced offline evidence photos inline in the same grid
  as synced ones (they queue and upload correctly, they just don't render locally with a
  "pending" badge yet the way the core app's `PhotoGrid` does).

### Verification method — still the one honest caveat
Every file above was reviewed by hand against this project's `tsconfig.json`
(`strict`, `noUnusedLocals`, `noUnusedParameters`) — including a second pass that caught
and fixed the private-bucket bug above and several unused-import false-positives from an
automated scan (manually re-verified each one with `grep -c`). I still could not run
`npm install && npm run build` myself — no network access in this sandbox. That remains
the one step I need you to run before trusting this compiles.

## Recommended next steps, in order
1. `npm install && npm run build` — first real compile of this code (I have no network
   access in this sandbox, so this is the one thing I could not verify myself).
2. Optional: `supabase db pull` to double-check the two reconstructed baseline
   migrations match production byte-for-byte.
3. Manually exercise one full work order lifecycle in a staging environment: create →
   allocate → checklist → evidence → parts/labour → quality review → generate PDF report
   → close, to confirm the DB gates and the new report/offline flows behave as intended
   with real data before field merchants touch it.
4. Decide whether merchants need a self-service insurance upload UI in-app (currently
   out of scope — only admin verification was requested/built).
