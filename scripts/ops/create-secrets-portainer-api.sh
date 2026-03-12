#!/bin/bash
# SVA Studio – Docker Secrets via Portainer API
# Erstellt alle erforderlichen Secrets auf dem sva-Endpoint (ID 64) über die Portainer REST API
# Keine SSH erforderlich!

set -e

SECRETS_DIR="/Users/wilimzig/sva-secrets"
PORTAINER_URL="https://console.planetary-quantum.com"
ENDPOINT_ID="64"  # sva Endpoint

# Farbige Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  SVA Studio – Create Secrets via Portainer API             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

# Step 1: Portainer Token prüfen/erzeugen
echo -e "\n${YELLOW}Step 1: Portainer Authentication${NC}"
if [ -z "$PORTAINER_TOKEN" ]; then
  echo -e "${YELLOW}PORTAINER_TOKEN nicht gesetzt. Bitte eingeben:${NC}"
  read -sp "Portainer API Token (dpt_...): " PORTAINER_TOKEN
  echo ""
  if [ -z "$PORTAINER_TOKEN" ]; then
    echo -e "${RED}✗ Token erforderlich${NC}"
    echo "Portainer Token erzeugen: https://console.planetary-quantum.com/#!/settings/tokens"
    exit 1
  fi
fi
export PORTAINER_TOKEN
echo -e "${GREEN}✓ Token bereit${NC}"

# Step 2: Token validieren
echo -e "\n${YELLOW}Step 2: Validating Portainer access...${NC}"
if ! curl -s -H "X-API-Key: $PORTAINER_TOKEN" \
  "$PORTAINER_URL/api/endpoints/$ENDPOINT_ID/status" \
  > /dev/null 2>&1; then
  echo -e "${RED}✗ Cannot access Portainer API. Check token and endpoint ID.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Portainer API accessible${NC}"

# Step 3: Secrets vorbereiten
echo -e "\n${YELLOW}Step 3: Preparing secrets...${NC}"

declare -A SECRETS=(
  [postgres-password.txt]="sva_studio_postgres_password"
  [redis-password.txt]="sva_studio_redis_password"
  [app-db-password.txt]="sva_studio_app_db_password"
  [encryption-key.txt]="sva_studio_app_encryption_key"
  [state-secret.txt]="sva_studio_app_auth_state_secret"
  [oidc-client-secret.txt]="sva_studio_app_auth_client_secret"
  [pii-keyring.json]="sva_studio_app_pii_keyring_json-k1"
  [keycloak-admin-client-secret.txt]="sva_studio_keycloak_admin_client_secret"
)

# Prüfen, ob alle Secret-Dateien existieren
for secretfile in "${!SECRETS[@]}"; do
  if [ ! -f "$SECRETS_DIR/$secretfile" ]; then
    echo -e "${RED}✗ Missing: $secretfile${NC}"
    exit 1
  fi
done
echo -e "${GREEN}✓ All secret files found${NC}"

# Step 4: Secrets via Portainer API erstellen
echo -e "\n${YELLOW}Step 4: Creating secrets in Portainer...${NC}"

CREATED=0
FAILED=0

for secretfile in "${!SECRETS[@]}"; do
  secretname="${SECRETS[$secretfile]}"
  secretpath="$SECRETS_DIR/$secretfile"

  # Secret-Wert auslesen
  secretvalue=$(cat "$secretpath")

  # Zur API senden
  response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "X-API-Key: $PORTAINER_TOKEN" \
    -H "Content-Type: application/json" \
    "$PORTAINER_URL/api/endpoints/$ENDPOINT_ID/docker/secrets/create" \
    -d "{
      \"Name\": \"$secretname\",
      \"Data\": \"$(echo -n "$secretvalue" | base64)\"
    }")

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$http_code" = "409" ]; then
    # Secret existiert bereits
    echo -e "${YELLOW}⚠ Already exists: $secretname${NC}"
  elif [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Created: $secretname${NC}"
    ((CREATED++))
  else
    echo -e "${RED}✗ Failed ($http_code): $secretname${NC}"
    echo "  Response: $body"
    ((FAILED++))
  fi
done

# Summary
echo -e "\n${YELLOW}Summary:${NC}"
echo -e "${GREEN}✓ Created: $CREATED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}✗ Failed: $FAILED${NC}"
  exit 1
fi

# Step 5: Verify
echo -e "\n${YELLOW}Step 5: Verifying secrets...${NC}"
secrets_list=$(curl -s \
  -H "X-API-Key: $PORTAINER_TOKEN" \
  "$PORTAINER_URL/api/endpoints/$ENDPOINT_ID/docker/secrets" | \
  jq -r '.[].Spec.Name' | grep sva_studio | wc -l)

echo -e "${GREEN}✓ Found $secrets_list sva_studio secrets in Portainer${NC}"

echo -e "\n${GREEN}=== SUCCESS ===${NC}"
echo -e "All secrets created! You can now deploy the stack:\n"
echo -e "  cd /Users/wilimzig/Documents/Projects/SVA/sva-studio"
echo -e "  export QUANTUM_API_KEY=ptr_..."
echo -e "  quantum-cli stack update --endpoint sva --wait sva-studio\n"
