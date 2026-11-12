#!/usr/bin/env bash
# Ask the selection verifier to crawl one batch.
# The HTTP response is only an acknowledgement. Wait about two minutes, then
# read selection_crawl_runs and selection_crawl_url_outcomes (see
# scripts/selection-crawl-verify.sql).
#
# Required:
#   SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY  (gateway JWT; the anon key is not enough)
#   SELECTION_SECRET           (same value as the function secret, sent as x-selection-secret)
# Run this only after 20261112140000_selection_crawl_pipeline.sql is applied
# and verify-selection-domain-pages is deployed.
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "SUPABASE_URL is required" >&2
  exit 1
fi
if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "SUPABASE_SERVICE_ROLE_KEY is required" >&2
  exit 1
fi
if [[ -z "${SELECTION_SECRET:-}" ]]; then
  echo "SELECTION_SECRET is required" >&2
  exit 1
fi

curl --fail-with-body -sS -X POST \
  "${SUPABASE_URL%/}/functions/v1/verify-selection-domain-pages" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "x-selection-secret: ${SELECTION_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"batchSize":4,"trigger":"manual"}'
echo
