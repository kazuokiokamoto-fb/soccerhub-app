#!/usr/bin/env bash
# Ask the selection verifier to crawl one batch.
# The HTTP response is only an acknowledgement. Wait about two minutes, then
# read selection_crawl_runs and selection_crawl_url_outcomes (see
# scripts/selection-crawl-verify.sql).
#
# Required: SUPABASE_URL and one of SUPABASE_SERVICE_ROLE_KEY or SELECTION_SECRET.
# Run this only after 20261112140000_selection_crawl_pipeline.sql is applied
# and verify-selection-domain-pages is deployed.
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "SUPABASE_URL is required" >&2
  exit 1
fi

key="${SUPABASE_SERVICE_ROLE_KEY:-${SELECTION_SECRET:-}}"
if [[ -z "${key}" ]]; then
  echo "SUPABASE_SERVICE_ROLE_KEY or SELECTION_SECRET is required" >&2
  exit 1
fi

curl --fail-with-body -sS -X POST \
  "${SUPABASE_URL%/}/functions/v1/verify-selection-domain-pages" \
  -H "Authorization: Bearer ${key}" \
  -H "Content-Type: application/json" \
  -d '{"batchSize":4,"trigger":"manual"}'
echo
