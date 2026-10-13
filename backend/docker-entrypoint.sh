#!/bin/sh
set -e

# If AUTO_SEED is requested, run seed script
if [ "$AUTO_SEED" = "true" ]; then
  echo "[docker-entrypoint] AUTO_SEED=true: provisioning default dev accounts..."
  npm run seed:dev || echo "[docker-entrypoint] Warning: Account seeding skipped or encountered an error."
fi

exec "$@"
