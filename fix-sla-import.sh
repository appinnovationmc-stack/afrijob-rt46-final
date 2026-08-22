#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "src/lib/afriops/slaEngine.ts" ]; then
  echo "Error: src/lib/afriops/slaEngine.ts not found. Run from your repo root."
  exit 1
fi

sed -i.bak "s/import { WorkOrder, WorkOrderPriority } from '.\/types';/import { WorkOrderPriority } from '.\/types';/" src/lib/afriops/slaEngine.ts
rm -f src/lib/afriops/slaEngine.ts.bak

echo "Fixed import in src/lib/afriops/slaEngine.ts"

if command -v npx >/dev/null 2>&1 && [ -f "tsconfig.json" ]; then
  echo "Running typecheck..."
  npx tsc --noEmit --project tsconfig.json 2>&1 | grep "afriops/" || echo "No errors found in src/lib/afriops/ files."
fi
