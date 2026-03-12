#!/usr/bin/env bash
set -euo pipefail

# Generates one temporary file containing all required Swarm secrets.
# Intended for manual copy/paste into the Portainer UI.
#
# Usage:
#   scripts/ops/generate-swarm-secrets.sh
#   scripts/ops/generate-swarm-secrets.sh --dir "$HOME/sva-secrets"
#   scripts/ops/generate-swarm-secrets.sh --file "sva-secrets-$(date +%F).txt"
#
# Notes:
# - Existing output file is never overwritten.
# - File includes placeholders for secrets that usually come from external systems.

OUT_DIR="${HOME}/sva-secrets"
OUT_FILE_NAME="sva-studio-secrets.txt"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)
      OUT_DIR="$2"
      shift 2
      ;;
    --file)
      OUT_FILE_NAME="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '1,40p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$OUT_DIR" ]]; then
  mkdir -p "$OUT_DIR"
  chmod 700 "$OUT_DIR"
fi
OUT_FILE_PATH="${OUT_DIR}/${OUT_FILE_NAME}"

if [[ -f "$OUT_FILE_PATH" ]]; then
  echo "Refusing to overwrite existing file: $OUT_FILE_PATH" >&2
  exit 1
fi

rand_hex_32() {
  openssl rand -hex 32 | tr -d '\n\r'
}

rand_pw() {
  openssl rand -base64 24 | tr -d '\n\r'
}

rand_key_material() {
  openssl rand -base64 32 | tr -d '\n\r'
}

cat > "$OUT_FILE_PATH" <<EOF
# SVA Studio Swarm Secrets (temporary copy source)
# Delete this file after copying values into Portainer Secrets.
#
# Format:
# secret_name=value

sva_studio_app_auth_client_secret=REPLACE_ME_OIDC_CLIENT_SECRET
sva_studio_app_auth_state_secret=$(rand_hex_32)
sva_studio_app_encryption_key=$(rand_hex_32)
sva_studio_app_pii_keyring_json-k1=$(rand_key_material)
sva_studio_app_db_password=$(rand_pw)
sva_studio_redis_password=$(rand_pw)
sva_studio_postgres_password=$(rand_pw)
sva_studio_keycloak_admin_client_secret=REPLACE_ME_KEYCLOAK_ADMIN_CLIENT_SECRET
EOF

chmod 600 "$OUT_FILE_PATH"

echo
echo "Created: $OUT_FILE_PATH"
echo
echo "Next:"
echo "1) Replace the two REPLACE_ME values"
echo "2) Copy each line into Portainer > Secrets (name + value)"
echo "3) Delete the file when done: rm -f \"$OUT_FILE_PATH\""
