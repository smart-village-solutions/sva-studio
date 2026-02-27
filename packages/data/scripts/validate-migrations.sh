#!/usr/bin/env bash
set -euo pipefail

bash packages/data/scripts/run-migrations.sh up
bash packages/data/scripts/run-migrations.sh down
bash packages/data/scripts/run-migrations.sh up

echo "Migration validation successful (up -> down -> up)."
