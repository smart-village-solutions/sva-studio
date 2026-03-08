#!/usr/bin/env bash
set -euo pipefail

# Start from a known state when previous runs already created schema objects.
bash packages/data/scripts/run-migrations.sh down || true
bash packages/data/scripts/run-migrations.sh up
bash packages/data/scripts/run-migrations.sh down
bash packages/data/scripts/run-migrations.sh up

echo "Migration validation successful (up -> down -> up)."
