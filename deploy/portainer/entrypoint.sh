#!/bin/sh
set -eu

# ---------------------------------------------------------------------------
# Swarm-Secrets in Umgebungsvariablen laden.
#
# Im Swarm-Modus liegen Secrets als Dateien unter /run/secrets/.
# Dieser Entrypoint liest sie vor dem App-Start in Env-Variablen ein.
# Ohne /run/secrets (z. B. lokaler Docker-Build) bleibt das Skript ein No-Op,
# da die Variablen dann bereits über die environment-Sektion gesetzt sind.
# ---------------------------------------------------------------------------

load_secret() {
  _file="/run/secrets/$1"
  if [ -f "$_file" ]; then
    # Command substitution entfernt finale Newlines; optionales CR aus CRLF wird danach entfernt.
    _value=$(cat "$_file")
    _cr=$(printf '\r')
    case "$_value" in
      *"$_cr") _value=${_value%"$_cr"} ;;
    esac
    printf '%s' "$_value"
  fi
}

require_env() {
  _name="$1"
  eval "_value=\${$_name:-}"
  if [ -z "$_value" ]; then
    echo "Required secret $_name is not set." >&2
    exit 1
  fi
}

urlencode() {
  node -e 'process.stdout.write(encodeURIComponent(process.argv[1] ?? ""))' "$1"
}

write_start_diagnostics() {
  export SVA_START_DIAGNOSTICS_FILE="${SVA_START_DIAGNOSTICS_FILE:-/tmp/sva-entrypoint-diagnostics.json}"

  node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const diagnosticsPath = process.env.SVA_START_DIAGNOSTICS_FILE || '/tmp/sva-entrypoint-diagnostics.json';
const appRoot = process.cwd();
const publicAssetsDir = path.join(appRoot, '.output', 'public', 'assets');
const serverEntryPath = path.join(appRoot, '.output', 'server', 'index.mjs');
const serverBuildAssetsDir = path.join(appRoot, '.output', 'server', 'chunks', 'build');
const legacyNitroAssetsDir = path.join(appRoot, 'node_modules', '.nitro', 'vite', 'services', 'ssr', 'assets');

const safeStat = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      path: filePath,
    };
  }

  const stat = fs.statSync(filePath);
  return {
    exists: true,
    path: filePath,
    size_bytes: stat.size,
  };
};

const listFiles = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath).sort();
};

const findFirstFile = (dirPath, prefix, excludePrefix = null) => {
  return listFiles(dirPath).find((fileName) => {
    if (!fileName.startsWith(prefix)) {
      return false;
    }

    if (excludePrefix && fileName.startsWith(excludePrefix)) {
      return false;
    }

    return fileName.endsWith('.js') || fileName.endsWith('.mjs');
  }) ?? null;
};

const resolveBuildArtifact = (prefix, excludePrefix = null) => {
  const serverBuildFile = findFirstFile(serverBuildAssetsDir, prefix, excludePrefix);
  if (serverBuildFile) {
    return {
      fileName: serverBuildFile,
      path: path.join(serverBuildAssetsDir, serverBuildFile),
      source: 'output_server_chunks_build',
    };
  }

  const legacyNitroFile = findFirstFile(legacyNitroAssetsDir, prefix, excludePrefix);
  if (legacyNitroFile) {
    return {
      fileName: legacyNitroFile,
      path: path.join(legacyNitroAssetsDir, legacyNitroFile),
      source: 'legacy_node_modules_nitro',
    };
  }

  return null;
};

const startManifestArtifact = resolveBuildArtifact('_tanstack-start-manifest_v-');
const routerBundleArtifact = resolveBuildArtifact('router-', 'router-diagnostics.server-');
const startManifestPath = startManifestArtifact ? startManifestArtifact.path : null;
const routerBundlePath = routerBundleArtifact ? routerBundleArtifact.path : null;
const startManifestContent = startManifestPath ? fs.readFileSync(startManifestPath, 'utf8') : '';
const clientEntryMatch = startManifestContent.match(/"clientEntry":\s*"([^"]+)"/);
const publicAssets = listFiles(publicAssetsDir);

const report = {
  timestamp: new Date().toISOString(),
  pid: process.pid,
  app_root: appRoot,
  env: {
    node_env: process.env.NODE_ENV ?? null,
    host: process.env.HOST ?? null,
    port: process.env.PORT ?? null,
    public_base_url: process.env.SVA_PUBLIC_BASE_URL ?? null,
    iam_database_url_set: Boolean(process.env.IAM_DATABASE_URL),
    redis_url_set: Boolean(process.env.REDIS_URL),
    auth_client_secret_set: Boolean(process.env.SVA_AUTH_CLIENT_SECRET),
    encryption_key_set: Boolean(process.env.ENCRYPTION_KEY),
  },
  artifacts: {
    server_entry: safeStat(serverEntryPath),
    public_asset_count: publicAssets.length,
    public_assets: publicAssets.slice(0, 20),
    start_manifest: {
      exists: Boolean(startManifestPath),
      path: startManifestPath,
      source: startManifestArtifact ? startManifestArtifact.source : null,
      has_root_child_route: startManifestContent.includes('"children": ["/"]') || startManifestContent.includes('"children":["/"]'),
      has_slash_route: startManifestContent.includes('"/": {') || startManifestContent.includes('"/":{"'),
      client_entry: clientEntryMatch ? clientEntryMatch[1] : null,
    },
    router_bundle: {
      ...safeStat(routerBundlePath ?? path.join(serverBuildAssetsDir, 'router-*.mjs')),
      source: routerBundleArtifact ? routerBundleArtifact.source : null,
    },
  },
};

fs.writeFileSync(diagnosticsPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

process.stderr.write(`[entrypoint] wrote startup diagnostics to ${diagnosticsPath}\n`);
process.stderr.write(
  `[entrypoint] server_entry=${report.artifacts.server_entry.exists} manifest=${report.artifacts.start_manifest.exists} root_child_route=${report.artifacts.start_manifest.has_root_child_route} slash_route=${report.artifacts.start_manifest.has_slash_route} public_assets=${report.artifacts.public_asset_count}\n`
);
NODE
}

val=$(load_secret sva_studio_app_auth_client_secret)
[ -n "$val" ] && export SVA_AUTH_CLIENT_SECRET="$val"

val=$(load_secret sva_studio_app_auth_state_secret)
[ -n "$val" ] && export SVA_AUTH_STATE_SECRET="$val"

val=$(load_secret sva_studio_app_encryption_key)
[ -n "$val" ] && export ENCRYPTION_KEY="$val"

val=$(load_secret sva_studio_app_pii_keyring_json-k1)
[ -n "$val" ] && export IAM_PII_KEYRING_JSON=$(node -e "process.stdout.write(JSON.stringify({k1: process.argv[1]}))" "$val")

val=$(load_secret sva_studio_app_db_password)
[ -n "$val" ] && export APP_DB_PASSWORD="$val"

val=$(load_secret sva_studio_redis_password)
[ -n "$val" ] && export REDIS_PASSWORD="$val"

val=$(load_secret sva_studio_keycloak_admin_client_secret)
[ -n "$val" ] && export KEYCLOAK_ADMIN_CLIENT_SECRET="$val"

has_expected_swarm_secret_file() {
  for _secret_name in \
    sva_studio_app_auth_client_secret \
    sva_studio_app_auth_state_secret \
    sva_studio_app_encryption_key \
    sva_studio_app_pii_keyring_json-k1 \
    sva_studio_app_db_password \
    sva_studio_redis_password
  do
    if [ -f "/run/secrets/${_secret_name}" ]; then
      return 0
    fi
  done
  return 1
}

if has_expected_swarm_secret_file; then
  require_env SVA_AUTH_CLIENT_SECRET
  require_env SVA_AUTH_STATE_SECRET
  require_env ENCRYPTION_KEY
  require_env IAM_PII_KEYRING_JSON
  require_env APP_DB_PASSWORD
  require_env REDIS_PASSWORD
fi

# IAM_DATABASE_URL aus Einzelkomponenten zusammenbauen,
# falls noch nicht explizit gesetzt.
if [ -z "${IAM_DATABASE_URL:-}" ] && [ -n "${APP_DB_PASSWORD:-}" ]; then
  db_password_encoded=$(urlencode "${APP_DB_PASSWORD}")
  export IAM_DATABASE_URL="postgres://${APP_DB_USER:-sva_app}:${db_password_encoded}@postgres:5432/${POSTGRES_DB:-sva_studio}"
fi

if [ -z "${REDIS_URL:-}" ]; then
  if [ -n "${REDIS_PASSWORD:-}" ]; then
    redis_password_encoded=$(urlencode "${REDIS_PASSWORD}")
    export REDIS_URL="redis://:${redis_password_encoded}@redis:6379"
  else
    export REDIS_URL="redis://redis:6379"
  fi
fi

if [ "${SVA_START_DIAGNOSTICS:-0}" = "1" ]; then
  write_start_diagnostics
fi

exec "$@"
