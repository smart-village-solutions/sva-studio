# Common `kcadm.sh` Patterns

## Login with dedicated config

```bash
export KCADM_CONFIG=/tmp/kcadm.config

kcadm.sh config credentials \
  --server http://127.0.0.1:8080 \
  --realm master \
  --user admin \
  --password "$ADMIN_PASSWORD" \
  --config "$KCADM_CONFIG"
```

## List realms

```bash
kcadm.sh get realms --config "$KCADM_CONFIG" | jq '.[].realm'
```

## Create a realm

```bash
kcadm.sh create realms \
  -s realm="$REALM" \
  -s enabled=true \
  --config "$KCADM_CONFIG"
```

## Find a client by `clientId`

```bash
kcadm.sh get clients \
  -r "$REALM" \
  -q clientId="$CLIENT_ID" \
  --config "$KCADM_CONFIG"
```

## Find a user by username or email

```bash
kcadm.sh get users \
  -r "$REALM" \
  -q username="$USERNAME" \
  --config "$KCADM_CONFIG"

kcadm.sh get users \
  -r "$REALM" \
  -q email="$EMAIL" \
  --config "$KCADM_CONFIG"
```

## Create a user and reset the password

```bash
kcadm.sh create users \
  -r "$REALM" \
  -s username="$USERNAME" \
  -s enabled=true \
  -s email="$EMAIL" \
  --config "$KCADM_CONFIG"

kcadm.sh set-password \
  -r "$REALM" \
  --username "$USERNAME" \
  --new-password "$NEW_PASSWORD" \
  --temporary \
  --config "$KCADM_CONFIG"
```

## Inspect and terminate user sessions

```bash
kcadm.sh get "users/$USER_ID/sessions" \
  -r "$REALM" \
  --config "$KCADM_CONFIG"

kcadm.sh delete "sessions/$SESSION_ID" \
  -r "$REALM" \
  --config "$KCADM_CONFIG"
```

## Add a realm role to a user

```bash
USER_ID="$(kcadm.sh get users -r "$REALM" -q username="$USERNAME" --config "$KCADM_CONFIG" | jq -er '.[0].id')"

kcadm.sh add-roles \
  -r "$REALM" \
  --uid "$USER_ID" \
  --rolename "$ROLE_NAME" \
  --config "$KCADM_CONFIG"
```

## Add a client role to a user

```bash
USER_ID="$(kcadm.sh get users -r "$REALM" -q username="$USERNAME" --config "$KCADM_CONFIG" | jq -er '.[0].id')"

kcadm.sh add-roles \
  -r "$REALM" \
  --uid "$USER_ID" \
  --cclientid "$CLIENT_ID" \
  --rolename "$ROLE_NAME" \
  --config "$KCADM_CONFIG"
```

## Add a user to a group

```bash
USER_ID="$(kcadm.sh get users -r "$REALM" -q username="$USERNAME" --config "$KCADM_CONFIG" | jq -er '.[0].id')"
GROUP_ID="$(kcadm.sh get groups -r "$REALM" --config "$KCADM_CONFIG" | jq -er --arg group_name "$GROUP_NAME" '.[] | select(.name == $group_name) | .id')"

kcadm.sh update "users/$USER_ID/groups/$GROUP_ID" \
  -n \
  -r "$REALM" \
  --config "$KCADM_CONFIG"
```

## Trigger required actions for a user

```bash
USER_ID="$(kcadm.sh get users -r "$REALM" -q username="$USERNAME" --config "$KCADM_CONFIG" | jq -er '.[0].id')"

kcadm.sh update "users/$USER_ID" \
  -r "$REALM" \
  -s 'requiredActions=["UPDATE_PASSWORD","VERIFY_EMAIL"]' \
  --config "$KCADM_CONFIG"
```

## Create a client and fetch installation data

```bash
CLIENT_UUID="$(kcadm.sh create clients -r "$REALM" -s clientId="$CLIENT_ID" -s enabled=true -i --config "$KCADM_CONFIG")"

kcadm.sh get "clients/$CLIENT_UUID/installation/providers/keycloak-oidc-keycloak-json" \
  -r "$REALM" \
  --config "$KCADM_CONFIG"
```

## Inspect realm keys

```bash
kcadm.sh get keys \
  -r "$REALM" \
  --config "$KCADM_CONFIG"
```

## Create a key provider component

```bash
REALM_ID="$(kcadm.sh get "realms/$REALM" --config "$KCADM_CONFIG" | jq -er '.id')"

kcadm.sh create components \
  -r "$REALM" \
  -s name=rsa-generated \
  -s providerId=rsa-generated \
  -s providerType=org.keycloak.keys.KeyProvider \
  -s parentId="$REALM_ID" \
  -s 'config.priority=["101"]' \
  -s 'config.enabled=["true"]' \
  -s 'config.active=["true"]' \
  -s 'config.keySize=["2048"]' \
  --config "$KCADM_CONFIG"
```

## Configure an identity provider

```bash
kcadm.sh create identity-provider/instances \
  -r "$REALM" \
  -s alias=google \
  -s providerId=google \
  -s enabled=true \
  -s "config.clientId=$CLIENT_ID" \
  -s "config.clientSecret=$CLIENT_SECRET" \
  --config "$KCADM_CONFIG"
```

## Inspect raw JSON safely

```bash
kcadm.sh get "users/$USER_ID" -r "$REALM" --config "$KCADM_CONFIG" | jq '{id, username, enabled, email}'
```
