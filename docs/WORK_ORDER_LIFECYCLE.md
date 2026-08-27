# Work-order lifecycle trace — 2026-08-27

Per audit item P0 #4: trace ONE work order through request → allocation →
workshop → technician → diagnosis → parts → procurement → inventory →
repair → evidence → inspection → rework → SLA → cost → invoice → payment →
closure, and identify parallel/duplicate workflows for the same business
event.

## Finding 1 — the "duplicate workflow" concern is mostly moot: two of the three candidate systems are empty in production

Row counts, live, `wtbycozfoeiepvgortvx`:

| table | rows |
|---|---|
| `public.work_orders` | 10 |
| `public.jobs` | 0 |
| `public.job_parts` | 0 |
| `rt46.work_orders` | 0 |
| `rt46.merchants` | 0 |
| `rt46.allocation_log` | 0 |
| `work_order_parts_unified` (view) | 0 |
| `inventory_movements` | 1 |
| `purchase_orders` | 0 |
| `purchase_order_items` | 0 |
| `sla_targets` | 0 |
| `document_vault` | 0 |
| `incidents` | 2 |
| `maintenance_schedules` | 2 |
| `domain_events` | 13 |
| `audit_log` | 57 |

**`jobs`/`job_parts`** (the workshop-scoped alternate work-order model) and
**the entire `rt46` schema** (the merchant-allocation model) have never
been used in production — 0 rows across every table. `public.work_orders`
is the only lifecycle with real data. This resolves most of what "eliminate
parallel/duplicate workflows" was worried about: they're not two systems
actively fighting over the same business event, one is simply dead code
still carrying real RLS/permission maintenance cost (confirmed still
enforced correctly in the security audit — see `31aeb637`) for zero
production benefit. **Decision needed from you**: drop `jobs`/`job_parts`
and `rt46.*`, or keep them for a near-term migration plan? Not deleted in
this session — that's a product/data decision, not mine to make
unilaterally, and the earlier open item in project memory already flagged
this exact question about `rt46.*` unresolved.

## Finding 2 — traced the most-complete real work order; the completion event itself was never logged

Work order `cf638b71-b665-4437-970e-a31f5ac37bda`
("E2E TEST: engine diagnostic and repair", org `ee1bafd8-...`, category
`repair`, status `completed`, has `assignee_profile_id` and
`service_provider_id` set — the most fully-populated real row found).

Its full `audit_log` trail:

| action | old status | new status | old assignee | new assignee | at |
|---|---|---|---|---|---|
| assignment_changed | null | null | null | tech A | 05:33:21 |
| update:work_orders | **completed** | **completed** | null | tech A | 05:33:21 |
| assignment_changed | null | null | tech A | tech B | 05:33:23 |
| update:work_orders | **completed** | **completed** | tech A | tech B | 05:33:23 |

The order is **already `status='completed'` at the first audit_log entry**
— the actual pending→in_progress→completed transition was never captured.
Either it happened before `generic_ops_audit_triggers` was applied
(`20260827010918`, i.e. very recently) or through a path that bypasses the
trigger. The only logged activity is two reassignments 2 seconds apart on
an already-completed order — consistent with an E2E test script
(description literally says "E2E TEST"), not a real technician workflow.
`domain_events` has zero rows for this work order id despite
`domain_events_layer` existing since `20260826223127` and this order being
touched after that. `inventory_movements` has zero rows for it despite
being a `repair` category order (no parts consumption recorded).

## Finding 3 — downstream lifecycle stages have literally never run once

`purchase_orders`, `purchase_order_items`, `sla_targets`, `document_vault`
all have **zero rows** in production. This means:

- parts → PO → approval → receipt → inventory: never exercised end-to-end
- SLA attachment/response/resolution (`attach_sla_to_work_order`,
  `record_sla_response`, `record_sla_resolution`): functions exist,
  RLS exists, but have never actually been called with a real work order
- invoice/payment: **no tables for these exist in `public` schema at all**
  (confirmed via `information_schema.tables` search, see security audit
  commit `31aeb637`) — only `rt46.work_order_invoices` exists, in the
  unused `rt46` schema

**This is not "broken code" — it's "unexercised code."** The functions and
RLS policies are real and were verified correct in the security audit.
What's missing is evidence they've ever been run against real data. That
distinction matters for the audit's own standard: I can confirm the SQL is
sound; I cannot confirm the UI actually drives a work order through parts →
procurement → inventory → invoice, because it's never happened in this
database.

## What this means for "finish the canonical work-order lifecycle"

The lifecycle as coded goes: request (✅ has data) → assignment (✅ has
data, audit-logged) → status transitions (✅ possible, but the actual
transition to `completed` for the one traced order wasn't captured by
audit) → parts (❌ zero real usage) → procurement (❌ zero real usage) →
inventory (⚠️ one row, ever, across the whole database) → invoice/payment
(❌ no table in the live schema for this) → closure (✅ `completed` status
reachable, confirmed).

**Recommendation**: before writing more lifecycle code, run ONE real work
order through the UI by hand — request → assign → diagnose → add parts →
raise a PO → receive it → issue inventory → close it — and watch whether
`domain_events`/`audit_log` populate at each step as designed. That's a
direct, cheap way to convert "the SQL looks right" into "the flow actually
works," which nothing in this session's static analysis can substitute for.
