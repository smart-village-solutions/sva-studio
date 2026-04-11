#!/usr/bin/env bash
set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

find_workspace_node() {
  if [ -n "${SVA_WORKSPACE_NODE:-}" ] && [ -x "${SVA_WORKSPACE_NODE}" ]; then
    printf '%s\n' "${SVA_WORKSPACE_NODE}"
    return 0
  fi

  if [ -n "${NVM_BIN:-}" ] && [ -x "${NVM_BIN}/node" ]; then
    printf '%s\n' "${NVM_BIN}/node"
    return 0
  fi

  if [ -f "${workspace_root}/.nvmrc" ] && [ -n "${HOME:-}" ]; then
    local requested_major
    requested_major="$(tr -d '[:space:]v' < "${workspace_root}/.nvmrc")"
    local candidate
    for candidate in "${HOME}"/.nvm/versions/node/v"${requested_major}".*/bin/node; do
      if [ -x "${candidate}" ]; then
        printf '%s\n' "${candidate}"
        return 0
      fi
    done
  fi

  local path_entry
  OLD_IFS="${IFS}"
  IFS=':'
  for path_entry in ${PATH}; do
    case "${path_entry}" in
      *"/node_modules/.bin")
        continue
        ;;
    esac

    if [ -x "${path_entry}/node" ]; then
      printf '%s\n' "${path_entry}/node"
      IFS="${OLD_IFS}"
      return 0
    fi
  done
  IFS="${OLD_IFS}"

  return 1
}

node_bin="$(find_workspace_node || true)"
if [ -z "${node_bin}" ]; then
  echo "Workspace-Node konnte nicht ermittelt werden." >&2
  exit 1
fi

exec "${node_bin}" "$@"
