#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CONFIG_PATH="${ROOT_DIR}/packages/data/goose.config.json"
CACHE_ROOT="${ROOT_DIR}/artifacts/tools/goose"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to resolve goose configuration."
  exit 1
fi

GOOSE_VERSION="$(node -e "const fs=require('fs'); const c=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(c.version);" "${CONFIG_PATH}")"
GOOSE_REPO="$(node -e "const fs=require('fs'); const c=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(c.repo);" "${CONFIG_PATH}")"

uname_s="$(uname -s)"
uname_m="$(uname -m)"

case "${uname_s}" in
  Darwin) platform="darwin" ;;
  Linux) platform="linux" ;;
  *)
    echo "Unsupported OS for goose wrapper: ${uname_s}"
    exit 1
    ;;
esac

case "${uname_m}" in
  arm64|aarch64) arch="arm64" ;;
  x86_64|amd64) arch="x86_64" ;;
  *)
    echo "Unsupported architecture for goose wrapper: ${uname_m}"
    exit 1
    ;;
esac

asset="goose_${platform}_${arch}"
bin_dir="${CACHE_ROOT}/${GOOSE_VERSION}/${platform}-${arch}"
bin_path="${bin_dir}/goose"

install_goose() {
  mkdir -p "${bin_dir}"

  local checksums_path="${bin_dir}/checksums.txt"
  local download_url="https://github.com/${GOOSE_REPO}/releases/download/${GOOSE_VERSION}/${asset}"
  local checksums_url="https://github.com/${GOOSE_REPO}/releases/download/${GOOSE_VERSION}/checksums.txt"
  local -a curl_args=(
    --fail
    --show-error
    --location
    --retry 5
    --retry-delay 2
    --retry-all-errors
  )

  curl "${curl_args[@]}" "${checksums_url}" -o "${checksums_path}"
  curl "${curl_args[@]}" "${download_url}" -o "${bin_path}"
  chmod +x "${bin_path}"

  local expected_checksum
  expected_checksum="$(awk -v target="${asset}" '$2 == target { print $1 }' "${checksums_path}")"
  if [ -z "${expected_checksum}" ]; then
    echo "Unable to resolve checksum for ${asset} from ${checksums_url}"
    exit 1
  fi

  local actual_checksum
  if command -v shasum >/dev/null 2>&1; then
    actual_checksum="$(shasum -a 256 "${bin_path}" | awk '{print $1}')"
  elif command -v sha256sum >/dev/null 2>&1; then
    actual_checksum="$(sha256sum "${bin_path}" | awk '{print $1}')"
  else
    echo "Neither shasum nor sha256sum is available to verify goose binary."
    exit 1
  fi

  if [ "${expected_checksum}" != "${actual_checksum}" ]; then
    echo "Checksum verification failed for ${asset}"
    echo "expected=${expected_checksum}"
    echo "actual=${actual_checksum}"
    exit 1
  fi
}

if [ ! -x "${bin_path}" ]; then
  install_goose
fi

if [ "${1:-}" = "--print-bin" ]; then
  printf '%s\n' "${bin_path}"
  exit 0
fi

exec "${bin_path}" "$@"
