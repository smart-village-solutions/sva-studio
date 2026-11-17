#!/usr/bin/env bash
# shellcheck disable=SC2016 # jq programs passed through replace_state use jq $variables
# Isolated kcadm.sh stand-in for operator tests. Never talks to Keycloak.
#
# FAKE_KCADM_STATE holds one JSON file per resource path ("/" replaced by "__").
# Every call is appended to "$FAKE_KCADM_STATE/calls" as "<operation> <path>".
# Protocol mapper writes mutate state; like Keycloak, a mapper PUT whose body id
# does not match the path id is rejected with unknown_error.

set -euo pipefail

state="${FAKE_KCADM_STATE:?FAKE_KCADM_STATE is required}"
operation="$1"
path="$2"
shift 2
payload=''
while (($#)); do
  if [[ "$1" == '-f' ]]; then
    payload="$2"
  fi
  shift
done

printf '%s %s\n' "$operation" "$path" >>"$state/calls"

resource() {
  printf '%s/%s.json' "$state" "${1//\//__}"
}

replace_state() {
  local file="$1"
  shift
  jq "$@" "$file" >"$file.next"
  mv "$file.next" "$file"
}

case "$operation:$path" in
  get:*)
    cat "$(resource "$path")"
    ;;
  create:*/protocol-mappers/models)
    replace_state "$(resource "$path")" --slurpfile mapper "$payload" '. + [$mapper[0] + {id: "created-mapper"}]'
    ;;
  update:*/protocol-mappers/models/*)
    mapper_id="${path##*/}"
    jq -e --arg id "$mapper_id" '.id == $id' "$payload" >/dev/null || {
      printf 'unknown_error\n' >&2
      exit 1
    }
    replace_state "$(resource "${path%/*}")" --slurpfile mapper "$payload" --arg id "$mapper_id" \
      'map(if .id == $id then $mapper[0] else . end)'
    ;;
esac
