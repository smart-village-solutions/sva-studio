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

patch_nitro_request_dispatch() {
  server_entry_path="${SVA_SERVER_ENTRY_PATH:-/app/.output/server/index.mjs}"

  if [ ! -f "${server_entry_path}" ]; then
    return 0
  fi

  node <<'NODE'
const fs = require('node:fs');

const serverEntryPath = process.env.SVA_SERVER_ENTRY_PATH || '/app/.output/server/index.mjs';
const expectedCall = 'const response = await h3App.request(req, void 0, req.context);';
const compatibilityCall =
  'const response = await (typeof h3App.request === "function" ? h3App.request(req, void 0, req.context) : h3App["~request"](req, req.context));';
const legacyDelegatedServerCall = [
  'const { default: tanstackServerEntry } = await import("./chunks/build/server.mjs");',
  'const requestPathname = new URL(req.url).pathname;',
  'const shouldDelegateToTanstackServer = !requestPathname.startsWith("/assets/") && !requestPathname.startsWith("/_server/") && !requestPathname.startsWith("/_build/") && !requestPathname.startsWith("/__vite");',
  'const response = await (shouldDelegateToTanstackServer && typeof tanstackServerEntry?.fetch === "function"',
  '  ? tanstackServerEntry.fetch(req)',
  '  : (typeof h3App.request === "function" ? h3App.request(req, void 0, req.context) : h3App["~request"](req, req.context)));',
].join('\n    ');
const delegatedServerCall = [
  'const { default: tanstackServerEntry } = await import("./chunks/build/server.mjs");',
  'const requestPathname = new URL(req.url).pathname;',
  'const tryServeStaticAsset = async () => {',
  '  if (!requestPathname.startsWith("/assets/")) {',
  '    return null;',
  '  }',
  '  const [{ readFile }, pathModule] = await Promise.all([import("node:fs/promises"), import("node:path")]);',
  '  const publicRoot = pathModule.join(process.cwd(), ".output", "public");',
  '  const candidatePath = pathModule.normalize(pathModule.join(publicRoot, requestPathname));',
  '  if (!candidatePath.startsWith(publicRoot)) {',
  '    return new Response("Not found", { status: 404 });',
  '  }',
  '  try {',
  '    const body = await readFile(candidatePath);',
  '    const extension = pathModule.extname(candidatePath);',
  '    const contentType = extension === ".js"',
  '      ? "text/javascript; charset=utf-8"',
  '      : extension === ".css"',
  '        ? "text/css; charset=utf-8"',
  '        : "application/octet-stream";',
  '    return new Response(body, {',
  '      status: 200,',
  '      headers: {',
  '        "content-type": contentType,',
  '        "cache-control": "public, max-age=31536000, immutable",',
  '      },',
  '    });',
  '  } catch {',
  '    return null;',
  '  }',
  '};',
  'const staticAssetResponse = await tryServeStaticAsset();',
  'const shouldDelegateToTanstackServer = !requestPathname.startsWith("/assets/") && !requestPathname.startsWith("/_server/") && !requestPathname.startsWith("/_build/") && !requestPathname.startsWith("/__vite");',
  'const response = await (staticAssetResponse ?? (shouldDelegateToTanstackServer && typeof tanstackServerEntry?.fetch === "function"',
  '  ? tanstackServerEntry.fetch(req)',
  '  : (typeof h3App.request === "function" ? h3App.request(req, void 0, req.context) : h3App["~request"](req, req.context))));',
].join('\n    ');

if (!fs.existsSync(serverEntryPath)) {
  process.exit(0);
}

const source = fs.readFileSync(serverEntryPath, 'utf8');
const hasExpectedCall = source.includes(expectedCall);
const hasCompatibilityCall = source.includes(compatibilityCall);
const hasDelegatedServerCall = source.includes('tanstackServerEntry.fetch(req)');
const hasStaticAssetDelegation = source.includes('const staticAssetResponse = await tryServeStaticAsset();');
const hasRequestBinding = source.includes('this.request = this.request.bind(this);');
const hasTildeRequest = source.includes('this["~request"](request, context)') || source.includes('"~request"(request, context)');

if ((hasStaticAssetDelegation && hasDelegatedServerCall) || hasRequestBinding || !hasTildeRequest) {
  process.stderr.write('[entrypoint] nitro server-entry patch not needed\n');
  process.exit(0);
}

const patched = source
  .replace(expectedCall, delegatedServerCall)
  .replace(compatibilityCall, delegatedServerCall)
  .replace(legacyDelegatedServerCall, delegatedServerCall);
if (patched === source) {
  process.stderr.write('[entrypoint] nitro server-entry patch could not be applied\n');
  process.exit(1);
}

fs.writeFileSync(serverEntryPath, patched, 'utf8');
process.stderr.write('[entrypoint] applied nitro server-entry delegation patch\n');
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

if [ "${SVA_ENABLE_RUNTIME_RECOVERY_PATCH:-0}" = "1" ]; then
  echo "[entrypoint] legacy recovery patch explicitly enabled" >&2
  patch_nitro_request_dispatch
else
  echo "[entrypoint] legacy recovery patch disabled; using final build artifact as-is" >&2
fi

if [ "${SVA_START_DIAGNOSTICS:-0}" = "1" ]; then
  write_start_diagnostics
fi

exec "$@"
