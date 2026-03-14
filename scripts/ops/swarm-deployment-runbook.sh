#!/bin/bash
# SVA Studio – Docker Swarm Deployment Runbook
# Dieses Skript registriert Secrets und deployed den sva-studio Stack auf Planetary Quantum

set -e

REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
SECRETS_DIR="${SECRETS_DIR:-${HOME}/sva-secrets}"
ENDPOINT="sva"
STACK_NAME="sva-studio"

# Farbige Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== SVA Studio Docker Swarm Setup ===${NC}"

# Step 1: Secrets validieren
echo -e "\n${YELLOW}Step 1: Validating secrets...${NC}"
SECRETS=(
  "app-db-password.txt:sva_studio_app_db_password"
  "encryption-key.txt:sva_studio_app_encryption_key"
  "keycloak-admin-client-secret.txt:sva_studio_keycloak_admin_client_secret"
  "oidc-client-secret.txt:sva_studio_app_auth_client_secret"
  "pii-keyring-k1.txt:sva_studio_app_pii_keyring_json-k1"
  "postgres-password.txt:sva_studio_postgres_password"
  "redis-password.txt:sva_studio_redis_password"
  "state-secret.txt:sva_studio_app_auth_state_secret"
)

for secret in "${SECRETS[@]}"; do
  IFS=':' read -r file secretname <<< "$secret"
  if [ ! -f "$SECRETS_DIR/$file" ]; then
    echo -e "${RED}✗ Missing: $file${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Found: $file${NC}"
done

# Step 2: Quantum-CLI Auth prüfen
echo -e "\n${YELLOW}Step 2: Checking quantum-cli authentication...${NC}"
if ! quantum-cli auth status > /dev/null 2>&1; then
  echo -e "${RED}✗ quantum-cli not authenticated. Please set QUANTUM_API_KEY:${NC}"
  echo "export QUANTUM_API_KEY=ptr_your-api-key-here"
  exit 1
fi
echo -e "${GREEN}✓ quantum-cli authenticated${NC}"

# Step 3: Secrets in Docker Swarm registrieren (lokal – müssen dann SCP'd werden)
echo -e "\n${YELLOW}Step 3: Preparing secrets for Swarm registration...${NC}"
echo "Run these commands ON node-005.sva (via SSH):"
echo ""

echo "# 1) Remote Temp-Directory einmalig erstellen und lokal merken"
echo "REMOTE_TMP=\$(ssh node-005.sva 'mktemp -d /tmp/sva-secrets-XXXXXX')"
echo "echo \"Remote temp dir: \$REMOTE_TMP\""
echo ""
echo "# 2) Dateien hochladen"

for secret in "${SECRETS[@]}"; do
  IFS=':' read -r file secretname <<< "$secret"
  echo "docker secret create $secretname < \$REMOTE_TMP/$file"
done

echo ""
echo "To upload secrets to node-005.sva, run:"
cd "$SECRETS_DIR"
for secret in "${SECRETS[@]}"; do
  IFS=':' read -r file secretname <<< "$secret"
  echo "scp $file node-005.sva:\$REMOTE_TMP/"
done
echo "ssh node-005.sva 'chmod 700 \"\$REMOTE_TMP\"'"
echo "ssh node-005.sva 'rm -rf \"\$REMOTE_TMP\"'  # Clean up after secret registration"

echo ""
echo -e "${YELLOW}Step 4: After secrets are registered, deploy stack:${NC}"
echo "cd $REPO_ROOT"
echo "quantum-cli stacks update --endpoint $ENDPOINT --stack $STACK_NAME --wait --project ."

echo ""
echo -e "${YELLOW}Or run this entire setup automatically (if you have SSH/SCP configured):${NC}"
echo "bash $REPO_ROOT/scripts/ops/deploy-sva-studio.sh"
