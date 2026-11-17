#!/usr/bin/env bash

set -euo pipefail

readonly CLIENT_ID='ssf-runtime'
readonly AUDIENCE='sva-studio-ssf-runtime'
readonly AUDIENCE_MAPPER_NAME='studio-ssf-runtime-audience'
readonly ACTION='ssf.runtime-configuration.read'
readonly DIRECTORY_ACTION='ssf.admin-login-directory.read'

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
  secret_output_directory="$(dirname "$SSF_RUNTIME_SECRET_OUTPUT")"
  [[ -d "$secret_output_directory" && -w "$secret_output_directory" ]] ||
    fail 'SSF_RUNTIME_SECRET_OUTPUT parent must be a writable directory'
  secret_output_probe="$(mktemp "$secret_output_directory/.ssf-runtime-secret-probe.XXXXXX")" ||
    fail 'SSF_RUNTIME_SECRET_OUTPUT cannot be created safely'
  rm -f "$secret_output_probe"
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
    '{clientId:$client_id,enabled:true,protocol:"openid-connect",publicClient:false,bearerOnly:false,clientAuthenticatorType:"client-secret",serviceAccountsEnabled:true,standardFlowEnabled:false,implicitFlowEnabled:false,directAccessGrantsEnabled:false,fullScopeAllowed:false}')"
  kcadm create clients -r "$realm" -f "$payload" >/dev/null
}

ensure_client_contract() {
  local client_uuid="$1"
  local payload="$temp_directory/client-update.json"
  write_json "$payload" "$(jq -n \
    --arg client_id "$CLIENT_ID" \
    '{clientId:$client_id,enabled:true,protocol:"openid-connect",publicClient:false,bearerOnly:false,clientAuthenticatorType:"client-secret",serviceAccountsEnabled:true,standardFlowEnabled:false,implicitFlowEnabled:false,directAccessGrantsEnabled:false,fullScopeAllowed:false}')"
  kcadm update "clients/$client_uuid" -r "$realm" -f "$payload" >/dev/null
}

ensure_action_role() {
  local client_uuid="$1"
  local action_name="$2"
  if ! kcadm get "clients/$client_uuid/roles/$action_name" -r "$realm" >/dev/null 2>&1; then
    local payload="$temp_directory/action-role.json"
    write_json "$payload" "$(jq -n --arg name "$action_name" '{name:$name,clientRole:true}')"
    kcadm create "clients/$client_uuid/roles" -r "$realm" -f "$payload" >/dev/null
  fi
  kcadm get "clients/$client_uuid/roles/$action_name" -r "$realm" |
    jq -e '.composite == false' >/dev/null || fail 'action role must not be composite'
}

desired_audience_mapper() {
  jq -nc \
    --arg name "$AUDIENCE_MAPPER_NAME" \
    --arg audience "$AUDIENCE" \
    '{name:$name,protocol:"openid-connect",protocolMapper:"oidc-audience-mapper",consentRequired:false,config:{"included.client.audience":"","included.custom.audience":$audience,"id.token.claim":"false","access.token.claim":"true","userinfo.token.claim":"false","introspection.token.claim":"true"}}'
}

# Prints the operator-owned audience mapper, or null when it is absent. Fails on an empty
# response or when the name is duplicated or held by another mapper type; jq diagnostics
# stay suppressed so response content never reaches the output.
read_audience_mapper() {
  local client_uuid="$1"
  kcadm get "clients/$client_uuid/protocol-mappers/models" -r "$realm" |
    jq -nc --argjson desired "$(desired_audience_mapper)" '
      input |
      map(select(.name == $desired.name)) |
      if length == 0 then null
      elif length == 1 and .[0].protocolMapper == $desired.protocolMapper then .[0]
      else error("ambiguous audience mapper") end
    ' 2>/dev/null
}

# Succeeds when the mapper JSON in $1 matches the desired contract; extra server-side keys are ignored.
audience_mapper_aligned() {
  jq -e --argjson desired "$(desired_audience_mapper)" '
    (.config // {}) as $config |
    .protocol == $desired.protocol and
    .protocolMapper == $desired.protocolMapper and
    all($desired.config | to_entries[]; ($config[.key] // "") == .value)
  ' <<<"$1" >/dev/null
}

ensure_audience_mapper() {
  local client_uuid="$1"
  local current
  local payload="$temp_directory/audience-mapper.json"
  current="$(read_audience_mapper "$client_uuid")" || fail 'failed to resolve the audience mapper uniquely'
  if [[ "$current" == 'null' ]]; then
    write_json "$payload" "$(desired_audience_mapper)"
    kcadm create "clients/$client_uuid/protocol-mappers/models" -r "$realm" -f "$payload" >/dev/null
  elif ! audience_mapper_aligned "$current"; then
    # Keycloak resolves the stored mapper from the body id, so the update keeps it and unrelated server keys.
    write_json "$payload" "$(jq -c --argjson desired "$(desired_audience_mapper)" '. * $desired' <<<"$current")"
    kcadm update "clients/$client_uuid/protocol-mappers/models/$(jq -r '.id' <<<"$current")" -r "$realm" -f "$payload" >/dev/null
  fi
}

read_action_roles() {
  local client_uuid="$1"
  kcadm get "clients/$client_uuid/roles" -r "$realm" |
    jq -e --arg runtime "$ACTION" --arg directory "$DIRECTORY_ACTION" '
      [.[] | select(.name == $runtime or .name == $directory)] |
      if length == 2 and all(.composite == false) then . else error("missing or composite action role") end
    '
}

ensure_action_mapping() {
  local client_uuid="$1"
  local mapping_path="$2"
  local payload="$temp_directory/action-roles.json"
  local current="$temp_directory/current-action-roles.json"
  local extras="$temp_directory/extra-action-roles.json"
  local missing="$temp_directory/missing-action-roles.json"
  read_action_roles "$client_uuid" >"$payload"
  kcadm get "$mapping_path" -r "$realm" >"$current"
  jq --slurpfile desired "$payload" '[.[] | select(.id as $id | $desired[0] | all(.id != $id))]' "$current" >"$extras"
  jq --slurpfile current "$current" '[.[] | select(.id as $id | $current[0] | all(.id != $id))]' "$payload" >"$missing"
  if [[ "$(jq 'length' "$extras")" -gt 0 ]]; then
    kcadm delete "$mapping_path" -r "$realm" -f "$extras" >/dev/null
  fi
  if [[ "$(jq 'length' "$missing")" -gt 0 ]]; then
    kcadm create "$mapping_path" -r "$realm" -f "$missing" >/dev/null
  fi
}

ensure_service_account_role() {
  local client_uuid="$1"
  local service_account_user_id
  service_account_user_id="$(kcadm get "clients/$client_uuid/service-account-user" -r "$realm" | jq -er '.id')"
  ensure_action_mapping "$client_uuid" "users/$service_account_user_id/role-mappings/clients/$client_uuid"
}

ensure_action_scope() {
  local client_uuid="$1"
  ensure_action_mapping "$client_uuid" "clients/$client_uuid/scope-mappings/clients/$client_uuid"
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
      .bearerOnly == false and
      .clientAuthenticatorType == "client-secret" and
      .serviceAccountsEnabled == true and
      .standardFlowEnabled == false and
      .implicitFlowEnabled == false and
      .directAccessGrantsEnabled == false and
      .fullScopeAllowed == false
    ' >/dev/null || fail 'client contract is not aligned'
  local audience_mapper service_account_user_id expected_role_ids
  audience_mapper="$(read_audience_mapper "$client_uuid")" || fail 'failed to resolve the audience mapper uniquely'
  audience_mapper_aligned "$audience_mapper" || fail 'audience mapper is not aligned'
  service_account_user_id="$(kcadm get "clients/$client_uuid/service-account-user" -r "$realm" | jq -er '.id')"
  expected_role_ids="$(read_action_roles "$client_uuid" | jq -c '[.[].id] | sort')"
  kcadm get "users/$service_account_user_id/role-mappings/clients/$client_uuid" -r "$realm" |
    jq -e --argjson expected "$expected_role_ids" '[.[].id] | sort == $expected' >/dev/null ||
    fail 'service account action roles are not aligned'
  kcadm get "clients/$client_uuid/scope-mappings/clients/$client_uuid" -r "$realm" |
    jq -e --argjson expected "$expected_role_ids" '[.[].id] | sort == $expected' >/dev/null ||
    fail 'client action scopes are not aligned'
  printf 'ssf-runtime service client: verified realm=%s client=%s audience=%s actions=%s,%s\n' \
    "$realm" "$CLIENT_ID" "$AUDIENCE" "$ACTION" "$DIRECTORY_ACTION"
}

client_uuid="$(resolve_client_id)" || fail "failed to resolve clientId $CLIENT_ID uniquely"

if [[ "$mode" == 'reconcile' ]]; then
  if [[ -z "$client_uuid" ]]; then
    create_client
    client_uuid="$(resolve_client_id)"
  fi
  ensure_client_contract "$client_uuid"
  ensure_action_role "$client_uuid" "$ACTION"
  ensure_action_role "$client_uuid" "$DIRECTORY_ACTION"
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
