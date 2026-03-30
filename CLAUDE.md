# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

SVA Studio is a headless/API-first CMS platform for the Smart Village App — a pnpm workspace monorepo managed with Nx. The main app is a **TanStack Start** (React 19) app with type-safe routing, OIDC auth, Redis sessions, and an OpenTelemetry observability pipeline.

Full development rules: [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md)
Agent/Nx instructions: [AGENTS.md](AGENTS.md)
Architecture (arc42): [docs/architecture/README.md](docs/architecture/README.md)

---

## Commands

```bash
# Dev server
pnpm nx run sva-studio-react:serve

# Build all
pnpm build

# Lint all
pnpm lint

# Tests
pnpm test:unit                                        # all unit tests (serial)
pnpm test:types                                       # TypeScript type checks
pnpm test:e2e                                         # Playwright E2E
pnpm test:ci                                          # full CI suite

# Targeted (faster)
pnpm nx affected --target=test:unit                   # only affected vs main
pnpm nx run sva-studio-react:test:unit                # single project
cd packages/data && npx vitest run tests/xyz.test.tsx # single file

# Coverage & quality gates
pnpm test:coverage
pnpm coverage-gate
pnpm complexity-gate

# File placement validation (enforced in CI)
pnpm check:file-placement

# Install local git hooks
pnpm hooks:install

# List all Nx projects
pnpm nx show projects
```

---

## Workspace Structure

```
apps/
  sva-studio-react/     # TanStack Start app (main frontend + SSR)
packages/
  auth/                 # @sva/auth  — OIDC login, Redis session management
  core/                 # @sva/core  — framework-agnostic core logic
  data/                 # @sva/data  — data loading, state management
  routing/              # @sva/routing — type-safe route factories (core + plugin routes)
  sdk/                  # @sva/sdk   — createSdkLogger, OpenTelemetry pipeline
  monitoring-client/    # @sva/monitoring-client
  plugin-example/       # reference plugin implementation
  plugin-news/          # news plugin
tooling/
  quality/              # complexity-policy.json
  testing/              # coverage-policy.json
deploy/
  portainer/            # Docker Swarm production deployment
scripts/                # CI and ops scripts (tsx)
openspec/               # OpenSpec change proposals
docs/                   # arc42 architecture docs, ADRs, guides (German)
```

Internal packages use `workspace:*` protocol. Dependency direction: `core` → `routing/auth/sdk` → `sva-studio-react`.

---

## Architecture

**Routing**: TanStack Router with two layers — framework route factories in `@sva/core` and plugin-contributed routes in `@sva/routing`. Plugins extend routing dynamically at runtime without modifying core app files.

**Auth**: OIDC-based login via `@sva/auth`. Sessions stored in Redis (TLS in production). Generate local certs with `./dev/generate-tls-certs.sh` before running Redis locally.

**Observability**: `@sva/sdk` wraps the OpenTelemetry pipeline. Server code must use `createSdkLogger({ component: '...' })` — never `console.*`. See `docs/development/monitoring-stack.md` for local stack setup.

**i18n**: All UI text goes through `t('key')` (react-i18next). Keys must exist in both `de` and `en`. Build fails (`check:i18n`) if keys are missing.

**Design system**: Tailwind CSS 4 with HSL-based CSS variables. Use semantic tokens (`bg-primary`, `text-foreground`, etc.) — not raw colors. Dynamic data-driven styles may use inline styles only when encapsulated in a reusable component.

**Plugins**: Self-contained packages with their own routes, components, and translations. `plugin-example` is the reference implementation.

**Module boundaries**: Enforced by `@nx/enforce-module-boundaries` via scope tags in `project.json`. Scope hierarchy: `core` → `data/sdk/monitoring` → `auth` → `routing/plugin` → `app`.

---

## Local Development Services

```bash
# Start Redis + Postgres
docker-compose up -d redis postgres

# Start monitoring stack (Prometheus, Loki, Grafana, OTEL Collector)
docker-compose -f docker-compose.monitoring.yml up -d

# Generate Redis TLS certs (required before first Redis start)
./dev/generate-tls-certs.sh
```

See `docs/development/postgres-setup.md` and `docs/development/monitoring-stack.md` for full setup details.

---

## Non-Negotiable Rules

1. **No hardcoded strings** — always `t('key')`, both `de` and `en` must be defined
2. **No `console.*` in server code** — use `createSdkLogger` from `@sva/sdk`
3. **No inline styles** for static values — use design system tokens
4. **Tests required** for all new behavior — coverage gate enforced in CI
5. **File placement** enforced by CI — new markdown only in `docs/` subdirs (not root)
6. **WCAG 2.1 AA** — semantic HTML, keyboard nav, color contrast, ARIA where needed
7. **Input validation** with `zod` client-side AND server-side; RLS policies for all Supabase tables
8. **Module boundaries** enforced by `@nx/enforce-module-boundaries` — check tags in `project.json`

---

## File Placement Rules

Only these markdown files are allowed at repo root: `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `DEBUGGING.md`, `DEVELOPMENT_RULES.md`, `AGENTS.md`, `CLAUDE.md`.

| Content type      | Location                               |
|-------------------|----------------------------------------|
| Debug scripts     | `scripts/debug/auth/` or `scripts/debug/otel/` |
| Staging docs      | `docs/staging/YYYY-MM/`               |
| PR docs           | `docs/pr/<number>/`                   |
| Operative reports | `docs/reports/`                        |
| Architecture docs | `docs/architecture/` (arc42)          |
| ADRs              | `docs/adr/`                           |

All documentation must be written in **German** (with correct Umlaute: ä, ö, ü, ß).

---

## Review Agents

Für PR-Reviews und Code-Analysen stehen Claude-Varianten der Copilot-Agents unter `.claude/agents/` bereit. Der Orchestrator koordiniert die passenden Fachreviewer parallel.

| Agent | Datei | Trigger |
|-------|-------|---------|
| **PR Orchestrator** | `pr-review-orchestrator.md` | Einstiegspunkt für jeden PR-Review |
| **PR Fixer** | `pr-fixer.agent.md` | Iterativer Fix-Loop: Threads, Tests, Quality Gates |
| **Code Quality** | `code-quality.md` | Jede Codeänderung |
| **Documentation** | `documentation.md` | Jede PR |
| **Test Quality** | `test-quality.md` | Neue Logik, Verhaltensänderungen |
| **Security & Privacy** | `security-privacy.md` | Auth, Sessions, PII, Secrets |
| **UX & Accessibility** | `ux-accessibility.md` | UI, Formulare, Navigation |
| **i18n & Content** | `i18n-content.md` | user-facing Texte, i18n-Keys |
| **User Journey** | `user-journey-usability.md` | UI-Flows, Onboarding |
| **Operations** | `operations-reliability.md` | Infra, Deployments, Monitoring |
| **Interoperability** | `interoperability-data.md` | APIs, Datenformate, Migrationen |
| **Logging** | `logging.md` | Server-Code, Fehlerpfade |
| **Performance** | `performance.md` | Rendering, Caching, Bundle |
| **Architecture** | `architecture.md` | Modulgrenzen, ADRs, FIT |

**Nutzung**: Starte den Orchestrator, gib Branch/PR-Kontext mit. Er wählt die richtigen Fachreviewer und startet sie parallel via Agent-Tool. Output-Templates liegen in `.github/agents/templates/`.

---

## PR Checklist

Before opening a PR: `pnpm test:unit && pnpm test:types && pnpm test:eslint && pnpm check:file-placement`

For architecture/IAM/security changes, update the relevant arc42 sections (`docs/architecture/`) and create an ADR under `docs/adr/`. Reference affected arc42 sections in the PR description.

See `docs/reports/PR_CHECKLIST.md` for the full checklist.
