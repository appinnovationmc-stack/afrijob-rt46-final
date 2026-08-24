# AfriOps Production Readiness Contract

This repository is not considered production-ready merely because the TypeScript bundle builds.

## Required gates

1. `npm ci`
2. `npm run build`
3. `npm run lint`
4. `npm audit --omit=dev --audit-level=high`
5. Validate Supabase migrations in a disposable/branch database before production application.
6. Verify tenant isolation with two authenticated organisations.
7. Verify every role can only perform actions permitted by its database RLS policies.
8. Verify offline mutation replay and conflict handling for every mutation advertised as offline-capable.
9. Verify Android and iOS Capacitor builds on the supported toolchains.
10. Perform browser smoke tests for sign-in, organisation setup, work orders, Asset 360, procurement, inventory, incidents, maintenance, SLA, documents, notifications, search, admin, billing and RT46.

## No-fabrication rule

A feature is only labelled complete when its implementation exists, the relevant build/type checks pass, and any security or cross-tenant behaviour has been exercised where applicable. UI presence alone is not evidence that the underlying workflow is complete.

## Known product dependencies

- Payment-provider/webhook integration is required before billing can be treated as fully automated.
- Generic offline support must follow the data model for inspections, evidence, parts consumption and signatures; do not create a queue for a feature whose authoritative schema does not exist.
- Cost dashboards require actual cost data to be written through real work-order/parts workflows.
