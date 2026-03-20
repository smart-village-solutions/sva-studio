#!/bin/sh
set -eu

# ---------------------------------------------------------------------------
# Laufzeitvariablen validieren und abgeleitete URLs aufbauen.
#
# Im Acceptance-Profil werden sensible Werte direkt als Stack-Variablen gesetzt.
# Dieser Entrypoint validiert den Mindestvertrag und baut fehlende Verbindungs-URLs
# aus den Einzelkomponenten zusammen.
# ---------------------------------------------------------------------------

require_env() {
  _name="$1"
  eval "_value=\${$_name:-}"
  if [ -z "$_value" ]; then
    echo "Required environment variable $_name is not set." >&2
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

if [ -z "${APP_DB_PASSWORD:-}" ]; then
  if [ -n "${POSTGRES_PASSWORD:-}" ]; then
    export APP_DB_PASSWORD="${POSTGRES_PASSWORD}"
  fi
fi

require_env SVA_AUTH_CLIENT_SECRET
require_env SVA_AUTH_STATE_SECRET
require_env ENCRYPTION_KEY
require_env IAM_PII_KEYRING_JSON
require_env APP_DB_PASSWORD
require_env REDIS_PASSWORD
require_env KEYCLOAK_ADMIN_CLIENT_SECRET

# IAM_DATABASE_URL aus Einzelkomponenten zusammenbauen,
# falls noch nicht explizit gesetzt.
if [ -z "${IAM_DATABASE_URL:-}" ] && [ -n "${APP_DB_PASSWORD:-}" ]; then
  db_password_encoded=$(urlencode "${APP_DB_PASSWORD}")
  export IAM_DATABASE_URL="postgres://${APP_DB_USER:-sva_app}:${db_password_encoded}@postgres:5432/${POSTGRES_DB:-sva_studio}"
fi

if [ -z "${REDIS_URL:-}" ]; then
  export REDIS_URL="redis://redis:6379"
fi

if [ "${SVA_START_DIAGNOSTICS:-0}" = "1" ]; then
  write_start_diagnostics
fi

exec "$@"
