#!/usr/bin/env sh
set -eu

image_ref="${SVA_IMAGE_REF:-}"
case "${image_ref}" in
  ghcr.io/smart-village-solutions/sva-studio@sha256:* | ghcr.io/smart-village-solutions/sva-studio:*@sha256:*) ;;
  *)
    echo 'SVA_IMAGE_REF must use the approved Studio repository and an immutable sha256 digest.' >&2
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

ingress_mode="${SVA_TENANT_INGRESS_MODE:-external}"
case "${ingress_mode}" in
  external) ;;
  kassel-traefik-file)
    if [ -z "${SVA_KASSEL_TRAEFIK_DYNAMIC_DIR_HOST:-}" ]; then
      echo 'SVA_KASSEL_TRAEFIK_DYNAMIC_DIR_HOST must be set in kassel-traefik-file mode.' >&2
      exit 64
    fi
    ;;
  *)
    echo 'SVA_TENANT_INGRESS_MODE must be external or kassel-traefik-file.' >&2
    exit 64
    ;;
esac

if [ "${1:-}" = '--validate-only' ]; then
  exit 0
fi

if [ "${ingress_mode}" = 'kassel-traefik-file' ]; then
  exec docker compose \
    -f app.compose.yml \
    -f keycloak-provisioner.compose.yml \
    -f kassel-ingress.compose.yml \
    up -d app provisioner
fi

exec docker compose \
  -f app.compose.yml \
  -f keycloak-provisioner.compose.yml \
  up -d app provisioner
