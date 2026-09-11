#!/usr/bin/env sh
set -eu

image_ref="${SVA_IMAGE_REF:-}"
case "${image_ref}" in
  *@sha256:*) ;;
  *)
    echo 'SVA_IMAGE_REF must be a complete image reference with an immutable sha256 digest.' >&2
    exit 64
    ;;
esac

digest="${image_ref##*@sha256:}"
if [ "${#digest}" -ne 64 ]; then
  echo 'SVA_IMAGE_REF must contain exactly 64 lowercase hexadecimal digest characters.' >&2
  exit 64
fi
case "${digest}" in
  *[!0-9a-f]*)
    echo 'SVA_IMAGE_REF must contain exactly 64 lowercase hexadecimal digest characters.' >&2
    exit 64
    ;;
esac

if [ "${1:-}" = '--validate-only' ]; then
  exit 0
fi

exec docker compose \
  -f app.compose.yml \
  -f keycloak-provisioner.compose.yml \
  up -d app provisioner
