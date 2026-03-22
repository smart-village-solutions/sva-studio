# Common `kcadm.sh` Patterns

## Login with dedicated config

```bash
export KCADM_CONFIG=/tmp/kcadm.config

kcadm.sh config credentials \
  --server http://127.0.0.1:8080 \
  --realm master \
  --user admin \
  --password '<password>' \
  --config "$KCADM_CONFIG"
```

## List realms

```bash
kcadm.sh get realms --config "$KCADM_CONFIG" | jq '.[].realm'
```

## Create a realm

```bash
kcadm.sh create realms \
  -s realm=<realm> \
  -s enabled=true \
  --config "$KCADM_CONFIG"
```

## Find a client by `clientId`

```bash
kcadm.sh get clients \
  -r <realm> \
  -q clientId=<client-id> \
  --config "$KCADM_CONFIG"
```

## Find a user by username or email

```bash
kcadm.sh get users \
  -r <realm> \
  -q username=<username> \
  --config "$KCADM_CONFIG"

kcadm.sh get users \
  -r <realm> \
  -q email=<mail@example.org> \
  --config "$KCADM_CONFIG"
```

## Create a user and reset the password

```bash
kcadm.sh create users \
  -r <realm> \
  -s username=<username> \
  -s enabled=true \
  -s email=<mail@example.org> \
  --config "$KCADM_CONFIG"

kcadm.sh set-password \
  -r <realm> \
  --username <username> \
  --new-password '<password>' \
  --temporary \
  --config "$KCADM_CONFIG"
```

## Inspect and terminate user sessions

```bash
kcadm.sh get users/<user-id>/sessions \
  -r <realm> \
  --config "$KCADM_CONFIG"

kcadm.sh delete sessions/<session-id> \
  -r <realm> \
  --config "$KCADM_CONFIG"
```

## Add a realm role to a user

```bash
USER_ID="$(kcadm.sh get users -r <realm> -q username=<username> --config "$KCADM_CONFIG" | jq -r '.[0].id')"

kcadm.sh add-roles \
  -r <realm> \
  --uid "$USER_ID" \
  --rolename <role-name> \
  --config "$KCADM_CONFIG"
```

## Add a client role to a user

```bash
USER_ID="$(kcadm.sh get users -r <realm> -q username=<username> --config "$KCADM_CONFIG" | jq -r '.[0].id')"

kcadm.sh add-roles \
  -r <realm> \
  --uid "$USER_ID" \
  --cclientid <client-id> \
  --rolename <role-name> \
  --config "$KCADM_CONFIG"
```

## Add a user to a group

```bash
USER_ID="$(kcadm.sh get users -r <realm> -q username=<username> --config "$KCADM_CONFIG" | jq -r '.[0].id')"
GROUP_ID="$(kcadm.sh get groups -r <realm> --config "$KCADM_CONFIG" | jq -r '.[] | select(.name == "<group-name>") | .id')"

kcadm.sh update "users/$USER_ID/groups/$GROUP_ID" \
  -r <realm> \
  --config "$KCADM_CONFIG"
```

## Trigger required actions for a user

```bash
USER_ID="$(kcadm.sh get users -r <realm> -q username=<username> --config "$KCADM_CONFIG" | jq -r '.[0].id')"

kcadm.sh update "users/$USER_ID" \
  -r <realm> \
  -s 'requiredActions=["UPDATE_PASSWORD","VERIFY_EMAIL"]' \
  --config "$KCADM_CONFIG"
```

## Create a client and fetch installation data

```bash
CLIENT_ID="$(kcadm.sh create clients -r <realm> -s clientId=<client-id> -s enabled=true -i --config "$KCADM_CONFIG")"

kcadm.sh get "clients/$CLIENT_ID/installation/providers/keycloak-oidc-keycloak-json" \
  -r <realm> \
  --config "$KCADM_CONFIG"
```

## Inspect realm keys

```bash
kcadm.sh get keys \
  -r <realm> \
  --config "$KCADM_CONFIG"
```

## Create a key provider component

```bash
REALM_ID="$(kcadm.sh get "realms/<realm>" --config "$KCADM_CONFIG" | jq -r '.id')"

kcadm.sh create components \
  -r <realm> \
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
  -r <realm> \
  -s alias=google \
  -s providerId=google \
  -s enabled=true \
  -s 'config.clientId=<client-id>' \
  -s 'config.clientSecret=<client-secret>' \
  --config "$KCADM_CONFIG"
```

## Inspect raw JSON safely

```bash
kcadm.sh get users/<user-id> -r <realm> --config "$KCADM_CONFIG" | jq '{id, username, enabled, email}'
```
