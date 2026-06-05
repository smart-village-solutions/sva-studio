# Public Waste Web Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated production release path for `apps/public-waste-calendar-web` that deploys the public waste calendar via Git tags like `waste-web-v1.2.3` without changing the normal Studio stack or workflows.

**Architecture:** Introduce a dedicated production runtime for the public waste app, a dedicated Swarm/Portainer stack definition, and a dedicated GitHub Actions workflow that builds a separate image and updates only `PUBLIC_WASTE_IMAGE_TAG` in the `web-waste-calendar` stack. Keep runtime config in split `PUBLIC_WASTE_*` variables and preserve `PUBLIC_WASTE_CONFIG_JSON` only as a local/dev compatibility fallback.

**Tech Stack:** Nx, pnpm, Vite, React, Node.js 24, TypeScript, Vitest, Playwright, Docker Swarm, Portainer API, GitHub Actions, OpenSpec

---

### Task 1: Formalize the Change Contract in OpenSpec

**Files:**
- Create: `openspec/changes/add-public-waste-web-release-pipeline/proposal.md`
- Create: `openspec/changes/add-public-waste-web-release-pipeline/tasks.md`
- Create: `openspec/changes/add-public-waste-web-release-pipeline/specs/public-waste-calendar/spec.md`
- Create: `openspec/changes/add-public-waste-web-release-pipeline/specs/deployment-topology/spec.md`
- Create: `openspec/changes/add-public-waste-web-release-pipeline/specs/architecture-documentation/spec.md`
- Reference: `docs/superpowers/specs/2026-06-05-public-waste-web-release-design.md`

- [ ] **Step 1: Scaffold the OpenSpec change directory**

```bash
mkdir -p \
  openspec/changes/add-public-waste-web-release-pipeline/specs/public-waste-calendar \
  openspec/changes/add-public-waste-web-release-pipeline/specs/deployment-topology \
  openspec/changes/add-public-waste-web-release-pipeline/specs/architecture-documentation
```

- [ ] **Step 2: Draft the proposal with explicit Studio isolation**

```md
# Change: Öffentlicher Releasepfad für den Abfallkalender

## Why
Die öffentliche Webversion des Abfallkalenders benötigt einen eigenen
Release- und Deployvertrag, damit Releases nicht über den normalen
Studio-Stack laufen und operative Änderungen am Bürger-Frontend den
bestehenden Studio-Betrieb nicht beeinflussen.

## What Changes
- eigener Produktionspfad für `apps/public-waste-calendar-web`
- eigener Swarm-/Portainer-Stack `web-waste-calendar`
- Git-Tag-getriebener Releaseworkflow `waste-web-vX.Y.Z`
- produktive Runtime-Konfiguration über einzelne `PUBLIC_WASTE_*`-Variablen
- **BREAKING (betrieblich):** produktionsführende Konfiguration ist nicht mehr
  `PUBLIC_WASTE_CONFIG_JSON`, sondern aufgetrennte Variablen

## Impact
- Affected specs: `web-waste-calendar`, `deployment-topology`, `architecture-documentation`
- Affected code: `apps/public-waste-calendar-web`, `deploy/portainer/*`, `.github/workflows/*`, `scripts/ops/*`
- Affected arc42 sections: `05-building-block-view`, `07-deployment-view`, `08-cross-cutting-concepts`
```

- [ ] **Step 3: Add spec deltas for capability, deployment, and docs**

```md
## ADDED Requirements
### Requirement: Öffentliche Abfallkalender-App hat einen isolierten Releasepfad
Das System SHALL für `web-waste-calendar` einen eigenen Releasepfad
bereitstellen, der weder den `studio`-Stack noch den `studio`-Releaseworkflow
mitverwendet.

#### Scenario: Git-Tag triggert nur den öffentlichen Waste-Release
- **WHEN** ein Git-Tag `waste-web-v1.2.3` gepusht wird
- **THEN** baut und deployt das System nur die öffentliche Waste-Web-Runtime
- **AND** der normale Studio-Releasepfad bleibt unberührt
```

- [ ] **Step 4: Validate the change**

Run: `openspec validate add-public-waste-web-release-pipeline --strict`  
Expected: `Change 'add-public-waste-web-release-pipeline' is valid`

- [ ] **Step 5: Commit**

```bash
git add openspec/changes/add-public-waste-web-release-pipeline
git commit -m "spec: add public waste web release pipeline change"
```

### Task 2: Split Production Config into `PUBLIC_WASTE_*` Variables

**Files:**
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-config.server.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-bootstrap.server.ts`
- Modify: `apps/public-waste-calendar-web/src/server.ts`
- Modify: `apps/public-waste-calendar-web/public-waste-config.example.json`
- Test: `apps/public-waste-calendar-web/src/lib/public-waste-config.server.test.ts`
- Test: `apps/public-waste-calendar-web/src/lib/public-waste-bootstrap.server.test.ts`

- [ ] **Step 1: Add failing tests for split env vars and JSON fallback**

```ts
it('reads production config from split PUBLIC_WASTE_* environment variables', () => {
  expect(
    readPublicWasteConfigFromEnvironment({
      PUBLIC_WASTE_INSTANCE_ID: 'bb-prignitz',
      PUBLIC_WASTE_DATABASE_URL: 'postgres://example',
      PUBLIC_WASTE_SCHEMA_NAME: 'public',
      PUBLIC_WASTE_PDF_URL_TEMPLATE: 'https://example.invalid/{locationKey}/{year}.pdf',
    })
  ).toEqual({
    instanceId: 'bb-prignitz',
    supabase: {
      databaseUrl: 'postgres://example',
      schemaName: 'public',
    },
    pdf: {
      urlTemplate: 'https://example.invalid/{locationKey}/{year}.pdf',
    },
  });
});

it('falls back to PUBLIC_WASTE_CONFIG_JSON only when split variables are absent', () => {
  expect(
    readPublicWasteBootstrapStateFromEnvironment({
      rawConfigJson: JSON.stringify({
        instanceId: 'bb-prignitz',
        supabase: { databaseUrl: 'postgres://example', schemaName: 'public' },
        pdf: { urlTemplate: 'https://example.invalid/{locationKey}/{year}.pdf' },
      }),
    })
  ).toMatchObject({ status: 'ready' });
});
```

- [ ] **Step 2: Run the focused tests to confirm they fail**

Run:

```bash
cd apps/public-waste-calendar-web
pnpm exec vitest run \
  src/lib/public-waste-config.server.test.ts \
  src/lib/public-waste-bootstrap.server.test.ts
```

Expected: FAIL with missing `readPublicWasteConfigFromEnvironment` or wrong bootstrap precedence

- [ ] **Step 3: Implement split-variable config loading**

```ts
export const readPublicWasteConfigFromEnvironment = (
  env: NodeJS.ProcessEnv = process.env,
): PublicWasteConfig | null => {
  const instanceId = readString(env.PUBLIC_WASTE_INSTANCE_ID);
  const databaseUrl = readString(env.PUBLIC_WASTE_DATABASE_URL);
  const schemaName = readString(env.PUBLIC_WASTE_SCHEMA_NAME);
  const urlTemplate = readString(env.PUBLIC_WASTE_PDF_URL_TEMPLATE);

  if (!instanceId || !databaseUrl || !schemaName || !urlTemplate) {
    return null;
  }

  return {
    instanceId,
    supabase: {
      databaseUrl,
      schemaName,
    },
    pdf: {
      urlTemplate,
    },
  };
};

export const readPublicWasteBootstrapStateFromEnvironment = (input: {
  readonly env?: NodeJS.ProcessEnv;
  readonly rawConfigJson?: string | undefined;
} = {}): PublicWasteBootstrapState => {
  const envConfig = readPublicWasteConfigFromEnvironment(input.env ?? process.env);
  if (envConfig) {
    return resolvePublicWasteBootstrapState(envConfig);
  }

  const rawConfigJson = input.rawConfigJson ?? (input.env ?? process.env).PUBLIC_WASTE_CONFIG_JSON;
  // existing JSON fallback path stays here
};
```

- [ ] **Step 4: Re-run tests and typecheck**

Run:

```bash
cd apps/public-waste-calendar-web
pnpm exec vitest run \
  src/lib/public-waste-config.server.test.ts \
  src/lib/public-waste-bootstrap.server.test.ts
cd ../..
pnpm nx run public-waste-calendar-web:test:types
```

Expected: PASS; `tsc --noEmit` completes without errors

- [ ] **Step 5: Commit**

```bash
git add \
  apps/public-waste-calendar-web/src/lib/public-waste-config.server.ts \
  apps/public-waste-calendar-web/src/lib/public-waste-bootstrap.server.ts \
  apps/public-waste-calendar-web/src/server.ts \
  apps/public-waste-calendar-web/public-waste-config.example.json \
  apps/public-waste-calendar-web/src/lib/public-waste-config.server.test.ts \
  apps/public-waste-calendar-web/src/lib/public-waste-bootstrap.server.test.ts
git commit -m "feat: split public waste runtime config variables"
```

### Task 3: Add a Production Node Runtime for the Public Waste App

**Files:**
- Create: `apps/public-waste-calendar-web/src/server/public-waste-runtime.ts`
- Create: `apps/public-waste-calendar-web/src/server/public-waste-http-server.ts`
- Create: `apps/public-waste-calendar-web/src/server/main.ts`
- Create: `apps/public-waste-calendar-web/tsconfig.server.json`
- Modify: `apps/public-waste-calendar-web/package.json`
- Modify: `apps/public-waste-calendar-web/project.json`
- Test: `apps/public-waste-calendar-web/src/server/public-waste-runtime.test.ts`
- Test: `apps/public-waste-calendar-web/src/server/public-waste-http-server.test.ts`

- [ ] **Step 1: Add failing runtime tests for `/health/live` and `/api/public-waste/*`**

```ts
it('returns 200 for /health/live when config is valid', async () => {
  const runtime = await createPublicWasteRuntime({ env: validEnv, assetsDir: '/tmp/assets' });
  const response = await runtime.handle(new Request('http://localhost/health/live'));
  expect(response.status).toBe(200);
});

it('returns 500 for API requests when runtime config is invalid', async () => {
  const runtime = await createPublicWasteRuntime({ env: {}, assetsDir: '/tmp/assets' });
  const response = await runtime.handle(new Request('http://localhost/api/public-waste/selection'));
  expect(response.status).toBe(500);
});
```

- [ ] **Step 2: Run the new tests to verify failure**

Run:

```bash
cd apps/public-waste-calendar-web
pnpm exec vitest run \
  src/server/public-waste-runtime.test.ts \
  src/server/public-waste-http-server.test.ts
```

Expected: FAIL because the production server files do not exist yet

- [ ] **Step 3: Implement the runtime, build scripts, and server entry**

```ts
// apps/public-waste-calendar-web/src/server/public-waste-runtime.ts
export const createPublicWasteRuntime = async (input: {
  readonly env?: NodeJS.ProcessEnv;
  readonly assetsDir: string;
}) => {
  const bootstrapState = readPublicWasteBootstrapStateFromEnvironment({ env: input.env });
  const pool =
    bootstrapState.status === 'ready'
      ? new Pool({ connectionString: bootstrapState.config.supabase.databaseUrl, max: 4 })
      : null;

  const repository =
    bootstrapState.status === 'ready' && pool
      ? createPublicWasteRepository({
          schemaName: bootstrapState.config.supabase.schemaName,
          execute: async ({ text, values }) => {
            const result = await pool.query(text, values ? [...values] : undefined);
            return {
              rowCount: result.rowCount ?? 0,
              rows: result.rows,
            };
          },
        })
      : null;

  return {
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname === '/health/live') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }
      if (url.pathname.startsWith('/api/public-waste/')) {
        // delegate to existing endpoint handlers
      }
      // fall through to static asset serving / SPA index.html
    },
    async close() {
      await pool?.end();
    },
  };
};
```

```json
// apps/public-waste-calendar-web/package.json
{
  "scripts": {
    "build:client": "vite build",
    "build:server": "tsc -p tsconfig.server.json",
    "build": "pnpm run build:client && pnpm run build:server",
    "start": "node dist-server/server/main.js"
  }
}
```

- [ ] **Step 4: Build and test the production runtime**

Run:

```bash
cd apps/public-waste-calendar-web
pnpm exec vitest run \
  src/server/public-waste-runtime.test.ts \
  src/server/public-waste-http-server.test.ts \
  src/lib/public-waste-endpoints.server.test.ts
cd ../..
pnpm nx run public-waste-calendar-web:test:types
pnpm nx run public-waste-calendar-web:build
```

Expected: PASS; `dist/` and `dist-server/` are created

- [ ] **Step 5: Commit**

```bash
git add \
  apps/public-waste-calendar-web/src/server/public-waste-runtime.ts \
  apps/public-waste-calendar-web/src/server/public-waste-http-server.ts \
  apps/public-waste-calendar-web/src/server/main.ts \
  apps/public-waste-calendar-web/tsconfig.server.json \
  apps/public-waste-calendar-web/package.json \
  apps/public-waste-calendar-web/project.json \
  apps/public-waste-calendar-web/src/server/public-waste-runtime.test.ts \
  apps/public-waste-calendar-web/src/server/public-waste-http-server.test.ts
git commit -m "feat: add public waste production runtime"
```

### Task 4: Define an Isolated Image and Stack for `web-waste-calendar`

**Files:**
- Create: `deploy/portainer/Dockerfile.public-waste`
- Create: `deploy/portainer/docker-compose.public-waste.yml`
- Create: `config/runtime/public-waste.vars.example`
- Modify: `.quantum`
- Test: `apps/public-waste-calendar-web/package.json`

- [ ] **Step 1: Create the dedicated Dockerfile and stack compose**

```dockerfile
FROM node:24.15.0-alpine AS build
WORKDIR /workspace
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
RUN npm install -g pnpm@11.3.0
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm nx run public-waste-calendar-web:build --skip-nx-cache

FROM node:24.15.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /workspace/apps/public-waste-calendar-web/dist ./dist
COPY --from=build /workspace/apps/public-waste-calendar-web/dist-server ./dist-server
COPY --from=build /workspace/apps/public-waste-calendar-web/node_modules ./node_modules
EXPOSE 3002
CMD ["node", "dist-server/server/main.js"]
```

```yaml
version: '3.8'

services:
  app:
    image: ghcr.io/smart-village-solutions/public-waste-calendar-web:${PUBLIC_WASTE_IMAGE_TAG}
    environment:
      NODE_ENV: production
      PORT: 3002
      HOST: 0.0.0.0
      PUBLIC_WASTE_INSTANCE_ID: '${PUBLIC_WASTE_INSTANCE_ID}'
      PUBLIC_WASTE_DATABASE_URL: '${PUBLIC_WASTE_DATABASE_URL}'
      PUBLIC_WASTE_SCHEMA_NAME: '${PUBLIC_WASTE_SCHEMA_NAME}'
      PUBLIC_WASTE_PDF_URL_TEMPLATE: '${PUBLIC_WASTE_PDF_URL_TEMPLATE}'
      PUBLIC_WASTE_BASE_URL: '${PUBLIC_WASTE_BASE_URL}'
    networks:
      - public
    deploy:
      replicas: 1
      labels:
        - traefik.enable=true
        - traefik.docker.network=public
        - traefik.public-waste.frontend.rule=Host:${PUBLIC_WASTE_PUBLIC_HOST}
        - traefik.public-waste.port=3002

networks:
  public:
    external: true
```

- [ ] **Step 2: Validate the compose contract**

Run:

```bash
docker compose -f deploy/portainer/docker-compose.public-waste.yml config
```

Expected: rendered compose output with `PUBLIC_WASTE_*` environment references and no schema errors

- [ ] **Step 3: Add runtime profile example and Quantum environment mapping**

```yaml
# .quantum
environments:
  - name: public-waste
    compose: deploy/portainer/docker-compose.public-waste.yml
```

```dotenv
# config/runtime/public-waste.vars.example
PUBLIC_WASTE_IMAGE_TAG=v0.0.0-dev
PUBLIC_WASTE_PUBLIC_HOST=bb-prignitz.abfallkalender.smart-village.app
PUBLIC_WASTE_BASE_URL=https://bb-prignitz.abfallkalender.smart-village.app
PUBLIC_WASTE_INSTANCE_ID=bb-prignitz
PUBLIC_WASTE_SCHEMA_NAME=public
```

- [ ] **Step 4: Build the dedicated image locally once**

Run:

```bash
docker build -f deploy/portainer/Dockerfile.public-waste -t public-waste-calendar-web:dev .
```

Expected: image build finishes successfully without touching `sva-studio`

- [ ] **Step 5: Commit**

```bash
git add \
  deploy/portainer/Dockerfile.public-waste \
  deploy/portainer/docker-compose.public-waste.yml \
  config/runtime/public-waste.vars.example \
  .quantum
git commit -m "feat: add public waste stack artifacts"
```

### Task 5: Automate Git-Tag Releases and Portainer Stack Updates

**Files:**
- Create: `scripts/ops/public-waste/portainer-release.ts`
- Create: `scripts/ops/public-waste/portainer-release.test.ts`
- Create: `.github/workflows/public-waste-web-release.yml`
- Modify: `tsconfig.scripts.json`

- [ ] **Step 1: Add failing tests for tag validation and env-only stack update**

```ts
it('accepts waste-web SemVer tags', () => {
  expect(parseWasteWebReleaseTag('refs/tags/waste-web-v1.2.3')).toEqual({
    imageTag: 'v1.2.3',
    gitTag: 'waste-web-v1.2.3',
  });
});

it('updates only PUBLIC_WASTE_IMAGE_TAG and preserves other stack env values', () => {
  const nextEnv = updateStackEnv(
    [
      { name: 'PUBLIC_WASTE_IMAGE_TAG', value: 'v1.2.2' },
      { name: 'PUBLIC_WASTE_PUBLIC_HOST', value: 'bb-prignitz.abfallkalender.smart-village.app' },
    ],
    'v1.2.3',
  );

  expect(nextEnv).toEqual([
    { name: 'PUBLIC_WASTE_IMAGE_TAG', value: 'v1.2.3' },
    { name: 'PUBLIC_WASTE_PUBLIC_HOST', value: 'bb-prignitz.abfallkalender.smart-village.app' },
  ]);
});
```

- [ ] **Step 2: Run the script test to confirm it fails**

Run:

```bash
pnpm exec vitest run scripts/ops/public-waste/portainer-release.test.ts
```

Expected: FAIL because the release script does not exist yet

- [ ] **Step 3: Implement the Portainer release script and workflow**

```ts
// scripts/ops/public-waste/portainer-release.ts
export const parseWasteWebReleaseTag = (ref: string) => {
  const match = /^refs\/tags\/waste-web-v(\d+\.\d+\.\d+)$/.exec(ref);
  if (!match) {
    throw new Error(`Ungueltiges Waste-Web-Release-Tag: ${ref}`);
  }

  return {
    gitTag: `waste-web-v${match[1]}`,
    imageTag: `v${match[1]}`,
  };
};

export const updateStackEnv = (
  env: readonly { name: string; value: string }[],
  imageTag: string,
) =>
  env.map((entry) =>
    entry.name === 'PUBLIC_WASTE_IMAGE_TAG' ? { ...entry, value: imageTag } : entry,
  );
```

```yaml
name: Public Waste Web Release

on:
  push:
    tags:
      - 'waste-web-v*.*.*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: ./.github/actions/setup-pnpm-workspace
      - run: pnpm nx run public-waste-calendar-web:build
      - uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GHCR_PUSH_TOKEN || secrets.GITHUB_TOKEN }}
      - run: docker buildx build --platform linux/amd64 -f deploy/portainer/Dockerfile.public-waste -t ghcr.io/smart-village-solutions/public-waste-calendar-web:${IMAGE_TAG} --push .
      - run: pnpm exec tsx scripts/ops/public-waste/portainer-release.ts
        env:
          GITHUB_REF: ${{ github.ref }}
          QUANTUM_API_KEY: ${{ secrets.QUANTUM_API_KEY }}
          QUANTUM_HOST: ${{ secrets.QUANTUM_HOST }}
          QUANTUM_ENDPOINT_ID: ${{ secrets.QUANTUM_ENDPOINT_ID }}
          PUBLIC_WASTE_STACK_NAME: web-waste-calendar
```

- [ ] **Step 4: Run tests and scripts typecheck**

Run:

```bash
pnpm exec vitest run scripts/ops/public-waste/portainer-release.test.ts
pnpm exec tsc -p tsconfig.scripts.json --noEmit
```

Expected: PASS; scripts compile cleanly

- [ ] **Step 5: Commit**

```bash
git add \
  scripts/ops/public-waste/portainer-release.ts \
  scripts/ops/public-waste/portainer-release.test.ts \
  .github/workflows/public-waste-web-release.yml \
  tsconfig.scripts.json
git commit -m "feat: automate public waste web releases"
```

### Task 6: Update Docs and Run Final Verification

**Files:**
- Create: `docs/guides/public-waste-web-release-runbook.md`
- Modify: `docs/architecture/07-deployment-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/guides/deployment-overview.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Reference: `docs/superpowers/specs/2026-06-05-public-waste-web-release-design.md`

- [ ] **Step 1: Document the isolated public waste release contract**

```md
## Öffentliches Waste-Web-Release

- eigener Stack: `web-waste-calendar`
- eigener Workflow: `public-waste-web-release.yml`
- Trigger: Git-Tag `waste-web-vX.Y.Z`
- Versionsträger im Stack: `PUBLIC_WASTE_IMAGE_TAG`
- produktive Runtime-Konfiguration: split `PUBLIC_WASTE_*` variables
- keine Mitnutzung des normalen `studio`-Releasepfads
```

- [ ] **Step 2: Run the smallest relevant verification suite**

Run:

```bash
cd apps/public-waste-calendar-web
pnpm exec vitest run \
  src/lib/public-waste-config.server.test.ts \
  src/lib/public-waste-bootstrap.server.test.ts \
  src/lib/public-waste-endpoints.server.test.ts \
  src/server/public-waste-runtime.test.ts \
  src/server/public-waste-http-server.test.ts
cd ../..
pnpm nx run public-waste-calendar-web:test:types
pnpm nx run public-waste-calendar-web:build
pnpm exec tsc -p tsconfig.scripts.json --noEmit
docker compose -f deploy/portainer/docker-compose.public-waste.yml config
openspec validate add-public-waste-web-release-pipeline --strict
pnpm check:file-placement
```

Expected:

- all focused Vitest files PASS
- app typecheck PASS
- app build PASS
- scripts typecheck PASS
- compose config renders successfully
- OpenSpec validation PASS
- file placement check PASS

- [ ] **Step 3: Commit**

```bash
git add \
  docs/guides/public-waste-web-release-runbook.md \
  docs/architecture/05-building-block-view.md \
  docs/architecture/07-deployment-view.md \
  docs/architecture/08-cross-cutting-concepts.md \
  docs/guides/deployment-overview.md
git commit -m "docs: document public waste web release path"
```

## Spec Coverage Check

- Isolierter Releasepfad: Task 1, Task 4, Task 5, Task 6
- Eigener Stack `web-waste-calendar`: Task 4, Task 5, Task 6
- Git-Tag `waste-web-vX.Y.Z`: Task 1, Task 5
- Nur Versionsupdate im Stack: Task 5
- Split `PUBLIC_WASTE_*` variables statt produktivem JSON blob: Task 2, Task 4, Task 6
- Keine Studio-Beeinflussung: Task 1, Task 4, Task 5, Task 6
- Fail-closed runtime and smoke checks: Task 3, Task 5, Task 6

## Self-Review

- Keine `TODO`-/`TBD`-Platzhalter im Plan
- Alle neuen Runtime-Dateien und Workflow-Artefakte sind konkret benannt
- Alle produktiven Änderungen sind auf `public-waste-calendar-web`, den eigenen Stack und den eigenen Workflow begrenzt
- OpenSpec-, Architektur-, Runtime-, Deploy- und Verifikationsarbeit sind jeweils einem Task zugeordnet
