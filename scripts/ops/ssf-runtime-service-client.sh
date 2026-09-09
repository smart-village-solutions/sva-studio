#!/usr/bin/env bash

set -euo pipefail

readonly CLIENT_ID='ssf-runtime'
readonly AUDIENCE='sva-studio-ssf-runtime'
readonly ACTION='ssf.runtime-configuration.read'

usage() {
  printf '%s\n' \
    'Usage: ssf-runtime-service-client.sh <reconcile|verify|rotate-secret>' \
    '' \
    'Required environment:' \
    '  SSF_RUNTIME_ROOT_REALM     Studio Root realm containing the service client' \
    '  KCADM_CONFIG               Existing authenticated kcadm configuration file' \
    '' \
    'Required for reconcile and rotate-secret:' \
    '  SSF_RUNTIME_SECRET_OUTPUT  Destination file for the generated client secret' \
    '' \
    'Optional environment:' \
    '  KCADM_BIN                  kcadm.sh binary (default: kcadm.sh)'
}

fail() {
  printf 'ssf-runtime service client: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

write_json() {
  local target="$1"
  local payload="$2"
  printf '%s\n' "$payload" >"$target"
}

realm="${SSF_RUNTIME_ROOT_REALM:-}"
kcadm_bin="${KCADM_BIN:-kcadm.sh}"
kcadm_config="${KCADM_CONFIG:-}"
mode="${1:-}"

[[ -n "$realm" ]] || fail 'SSF_RUNTIME_ROOT_REALM is required'
[[ -n "$kcadm_config" ]] || fail 'KCADM_CONFIG is required'
[[ -f "$kcadm_config" && -r "$kcadm_config" ]] || fail 'KCADM_CONFIG does not reference a readable file'
[[ "$mode" == 'reconcile' || "$mode" == 'verify' || "$mode" == 'rotate-secret' ]] || {
  usage >&2
  exit 2
}
if [[ "$mode" == 'reconcile' || "$mode" == 'rotate-secret' ]]; then
  [[ -n "${SSF_RUNTIME_SECRET_OUTPUT:-}" ]] || fail 'SSF_RUNTIME_SECRET_OUTPUT is required for secret delivery'
  [[ ! -L "$SSF_RUNTIME_SECRET_OUTPUT" && ! -d "$SSF_RUNTIME_SECRET_OUTPUT" ]] ||
    fail 'SSF_RUNTIME_SECRET_OUTPUT must not be a symlink or directory'
fi

require_command "$kcadm_bin"
require_command jq

temp_directory="$(mktemp -d)"
trap 'rm -rf "$temp_directory"' EXIT
umask 077

kcadm() {
  "$kcadm_bin" "$@" --config "$kcadm_config"
}

resolve_client_id() {
  kcadm get clients -r "$realm" -q "clientId=$CLIENT_ID" |
    jq -er 'if length == 0 then "" elif length == 1 then .[0].id else error("duplicate clientId") end'
}

create_client() {
  local payload="$temp_directory/client.json"
  write_json "$payload" "$(jq -n \
    --arg client_id "$CLIENT_ID" \
    '{clientId:$client_id,enabled:true,protocol:"openid-connect",publicClient:false,clientAuthenticatorType:"client-secret",serviceAccountsEnabled:true,standardFlowEnabled:false,implicitFlowEnabled:false,directAccessGrantsEnabled:false,fullScopeAllowed:false}')"
  kcadm create clients -r "$realm" -f "$payload" >/dev/null
}

ensure_client_contract() {
  local client_uuid="$1"
  local payload="$temp_directory/client-update.json"
  write_json "$payload" "$(jq -n \
    --arg client_id "$CLIENT_ID" \
    '{clientId:$client_id,enabled:true,protocol:"openid-connect",publicClient:false,clientAuthenticatorType:"client-secret",serviceAccountsEnabled:true,standardFlowEnabled:false,implicitFlowEnabled:false,directAccessGrantsEnabled:false,fullScopeAllowed:false}')"
  kcadm update "clients/$client_uuid" -r "$realm" -f "$payload" >/dev/null
}

ensure_action_role() {
  local client_uuid="$1"
  if ! kcadm get "clients/$client_uuid/roles/$ACTION" -r "$realm" >/dev/null 2>&1; then
    local payload="$temp_directory/action-role.json"
    write_json "$payload" "$(jq -n --arg name "$ACTION" '{name:$name,clientRole:true}')"
    kcadm create "clients/$client_uuid/roles" -r "$realm" -f "$payload" >/dev/null
  fi
  kcadm get "clients/$client_uuid/roles/$ACTION" -r "$realm" |
    jq -e '.composite == false' >/dev/null || fail 'action role must not be composite'
}

ensure_audience_mapper() {
  local client_uuid="$1"
  local mapper_id
  mapper_id="$(kcadm get "clients/$client_uuid/protocol-mappers/models" -r "$realm" |
    jq -r 'map(select(.name == "studio-ssf-runtime-audience")) | if length == 1 then .[0].id else "" end')"
  local payload="$temp_directory/audience-mapper.json"
  write_json "$payload" "$(jq -n \
    --arg audience "$AUDIENCE" \
    '{name:"studio-ssf-runtime-audience",protocol:"openid-connect",protocolMapper:"oidc-audience-mapper",consentRequired:false,config:{"included.client.audience":"","included.custom.audience":$audience,"id.token.claim":"false","access.token.claim":"true","userinfo.token.claim":"false","introspection.token.claim":"true"}}')"
  if [[ -n "$mapper_id" ]]; then
    kcadm update "clients/$client_uuid/protocol-mappers/models/$mapper_id" -r "$realm" -f "$payload" >/dev/null
  else
    kcadm create "clients/$client_uuid/protocol-mappers/models" -r "$realm" -f "$payload" >/dev/null
  fi
}

ensure_service_account_role() {
  local client_uuid="$1"
  local service_account_user_id role_id
  service_account_user_id="$(kcadm get "clients/$client_uuid/service-account-user" -r "$realm" | jq -er '.id')"
  role_id="$(kcadm get "clients/$client_uuid/roles/$ACTION" -r "$realm" | jq -er '.id')"
  local payload="$temp_directory/role-mapping.json"
  write_json "$payload" "$(jq -n --arg id "$role_id" --arg name "$ACTION" '[{id:$id,name:$name,clientRole:true}]')"
  local current="$temp_directory/current-role-mappings.json"
  kcadm get "users/$service_account_user_id/role-mappings/clients/$client_uuid" -r "$realm" >"$current"
  if ! jq -e --arg role_id "$role_id" 'length == 1 and .[0].id == $role_id' "$current" >/dev/null; then
    if [[ "$(jq 'length' "$current")" -gt 0 ]]; then
      kcadm delete "users/$service_account_user_id/role-mappings/clients/$client_uuid" -r "$realm" -f "$current" >/dev/null
    fi
    kcadm create "users/$service_account_user_id/role-mappings/clients/$client_uuid" -r "$realm" -f "$payload" >/dev/null
  fi
}

ensure_action_scope() {
  local client_uuid="$1"
  local role_id
  role_id="$(kcadm get "clients/$client_uuid/roles/$ACTION" -r "$realm" | jq -er '.id')"
  local payload="$temp_directory/action-scope.json"
  write_json "$payload" "$(jq -n --arg id "$role_id" --arg name "$ACTION" '[{id:$id,name:$name,clientRole:true}]')"
  local current="$temp_directory/current-action-scopes.json"
  kcadm get "clients/$client_uuid/scope-mappings/clients/$client_uuid" -r "$realm" >"$current"
  if ! jq -e --arg role_id "$role_id" 'length == 1 and .[0].id == $role_id' "$current" >/dev/null; then
    if [[ "$(jq 'length' "$current")" -gt 0 ]]; then
      kcadm delete "clients/$client_uuid/scope-mappings/clients/$client_uuid" -r "$realm" -f "$current" >/dev/null
    fi
    kcadm create "clients/$client_uuid/scope-mappings/clients/$client_uuid" -r "$realm" -f "$payload" >/dev/null
  fi
}

write_secret() {
  local client_uuid="$1"
  local output="${SSF_RUNTIME_SECRET_OUTPUT:-}"
  local secret_file="$temp_directory/client-secret"
  kcadm get "clients/$client_uuid/client-secret" -r "$realm" | jq -er '.value' >"$secret_file"
  chmod 600 "$secret_file"
  mv "$secret_file" "$output"
  chmod 600 "$output"
  printf 'ssf-runtime service client: secret written with mode 0600\n'
}

verify_contract() {
  local client_uuid="$1"
  kcadm get "clients/$client_uuid" -r "$realm" |
    jq -e --arg client_id "$CLIENT_ID" '
      .clientId == $client_id and
      .enabled == true and
      .protocol == "openid-connect" and
      .publicClient == false and
      .clientAuthenticatorType == "client-secret" and
      .serviceAccountsEnabled == true and
      .standardFlowEnabled == false and
      .implicitFlowEnabled == false and
      .directAccessGrantsEnabled == false and
      .fullScopeAllowed == false
    ' >/dev/null || fail 'client contract is not aligned'
  kcadm get "clients/$client_uuid/protocol-mappers/models" -r "$realm" |
    jq -e --arg audience "$AUDIENCE" '
      any(
        .name == "studio-ssf-runtime-audience" and
        .protocolMapper == "oidc-audience-mapper" and
        .config["included.custom.audience"] == $audience and
        .config["access.token.claim"] == "true"
      )
    ' >/dev/null || fail 'audience mapper is not aligned'
  local service_account_user_id role_id
  service_account_user_id="$(kcadm get "clients/$client_uuid/service-account-user" -r "$realm" | jq -er '.id')"
  role_id="$(kcadm get "clients/$client_uuid/roles/$ACTION" -r "$realm" | jq -er '.id')"
  kcadm get "clients/$client_uuid/roles/$ACTION" -r "$realm" |
    jq -e '.composite == false' >/dev/null || fail 'action role must not be composite'
  kcadm get "users/$service_account_user_id/role-mappings/clients/$client_uuid" -r "$realm" |
    jq -e --arg role_id "$role_id" 'length == 1 and .[0].id == $role_id' >/dev/null ||
    fail 'service account action role is not aligned'
  kcadm get "clients/$client_uuid/scope-mappings/clients/$client_uuid" -r "$realm" |
    jq -e --arg role_id "$role_id" 'length == 1 and .[0].id == $role_id' >/dev/null ||
    fail 'client action scope is not aligned'
  printf 'ssf-runtime service client: verified realm=%s client=%s audience=%s action=%s\n' \
    "$realm" "$CLIENT_ID" "$AUDIENCE" "$ACTION"
}

client_uuid="$(resolve_client_id)" || fail "clientId $CLIENT_ID is not unique"

if [[ "$mode" == 'reconcile' ]]; then
  if [[ -z "$client_uuid" ]]; then
    create_client
    client_uuid="$(resolve_client_id)"
  fi
  ensure_client_contract "$client_uuid"
  ensure_action_role "$client_uuid"
  ensure_audience_mapper "$client_uuid"
  ensure_service_account_role "$client_uuid"
  ensure_action_scope "$client_uuid"
  verify_contract "$client_uuid"
  write_secret "$client_uuid"
elif [[ "$mode" == 'rotate-secret' ]]; then
  [[ -n "$client_uuid" ]] || fail 'client does not exist'
  kcadm create "clients/$client_uuid/client-secret" -r "$realm" >/dev/null
  write_secret "$client_uuid"
  verify_contract "$client_uuid"
else
  [[ -n "$client_uuid" ]] || fail 'client does not exist'
  verify_contract "$client_uuid"
fi
