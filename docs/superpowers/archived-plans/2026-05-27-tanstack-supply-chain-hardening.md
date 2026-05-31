# TanStack Supply-Chain Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bereinige kompromittierte TanStack-Auflösungen aus dem Workspace, hebe die Toolchain auf `pnpm@11.3.0` an und härte den sensiblen Bot-Comment-Governance-Workflow ohne Workspace-Installation.

**Architecture:** Die Fachlogik der Bot-Kommentar-Prüfung bleibt als repo-versionierte TypeScript-Datei erhalten, wird aber direkt über Node-Type-Stripping statt über `tsx` + `pnpm install` ausgeführt. Parallel dazu werden pnpm-Sicherheitsregeln zentral in `pnpm-workspace.yaml` aktiviert und alle direkten TanStack-Dependencies breit auf aktuelle sichere Versionen aktualisiert, bevor das Lockfile unter pnpm 11 vollständig neu erzeugt und verifiziert wird.

**Tech Stack:** TypeScript, Node.js 24.15.0, pnpm 11, GitHub Actions, Nx, Vitest/Node-Test, TanStack Router/Start.

---

### Task 1: Bot-Comment-Governance ohne Workspace-Install ausführbar machen

**Files:**
- Modify: `scripts/ci/check-bot-comment-handling.ts`
- Modify: `scripts/ci/check-bot-comment-handling.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/bot-comment-governance.yml`

- [x] Prüfen, dass `scripts/ci/check-bot-comment-handling.ts` nur Node-Builtins und GitHub-API nutzt, und TypeScript-Syntax auf Node-Strip-Types-Kompatibilität festziehen.
- [x] Das Root-Script `check:bot-comment-handling` von `tsx scripts/ci/check-bot-comment-handling.ts` auf direkten Node-Aufruf umstellen, bevorzugt `node --experimental-strip-types scripts/ci/check-bot-comment-handling.ts`, damit kein Workspace-Install für die Laufzeit erforderlich ist.
- [x] Einen direkten Smoke-Run lokal festlegen:
  ```bash
  node --experimental-strip-types scripts/ci/check-bot-comment-handling.ts
  ```
  Erwartung ohne GitHub-Kontext:
  ```text
  Error: Missing environment variable GITHUB_TOKEN
  ```
- [x] Den Workflow `.github/workflows/bot-comment-governance.yml` auf minimale Runtime umbauen:
  - Workspace-Installationspfad via `./.github/actions/setup-pnpm-workspace` entfernen
  - nur den vertrauenswürdigen Base-SHA auschecken
  - `actions/setup-node@v6` mit festem Node-Setup ergänzen
  - den Check direkt mit Node ausführen:
  ```yaml
      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc

      - name: Evaluate bot comment handling
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: node --experimental-strip-types scripts/ci/check-bot-comment-handling.ts
  ```
- [x] Den gezielten Test für die Prüflogik direkt nach diesem Block ausführen:
  ```bash
  node --experimental-strip-types --test scripts/ci/check-bot-comment-handling.test.ts
  ```

### Task 2: pnpm 11 und Sicherheitsprofil im Repo verankern

**Files:**
- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `.github/actions/setup-pnpm-workspace/action.yml`
- Modify: `.github/workflows/project-report-pages.yml`
- Modify: `.github/workflows/iam-acceptance.yml`

- [x] Das Root-Manifest auf `packageManager: "pnpm@11.3.0"` und eine dazu passende `engines.pnpm`-Angabe aktualisieren.
- [x] Die zentrale pnpm-Konfiguration nach `pnpm-workspace.yaml` ziehen, da pnpm laut offizieller Doku nicht-authentifizierungsbezogene Settings dort erwartet.
- [x] In `pnpm-workspace.yaml` ein konservatives Sicherheitsprofil ergänzen, z. B.:
  ```yaml
  minimumReleaseAge: 1440
  minimumReleaseAgeIgnoreMissingTime: false
  minimumReleaseAgeStrict: true
  trustPolicy: no-downgrade
  blockExoticSubdeps: true
  ```
- [x] Falls für Workspace-Pakete oder bestehende Tooling-Abhängigkeiten Ausnahmen nötig werden, diese explizit und begrenzt über `minimumReleaseAgeExclude` oder `trustPolicyExclude` dokumentieren statt Schutz pauschal aufzuweichen.
- [x] Die pnpm-Setup-Punkte in CI auf `11.3.0` anheben:
  - Composite Action `./.github/actions/setup-pnpm-workspace/action.yml`
  - Direkt genutzte `pnpm/action-setup`-Schritte in `project-report-pages.yml`
  - Direkt genutzte `pnpm/action-setup`-Schritte in `iam-acceptance.yml`
- [x] Einen isolierten Konsistenzcheck nach diesem Block ausführen:
  ```bash
  pnpm --version
  pnpm config get minimumReleaseAge
  pnpm config get trustPolicy
  ```
  Erwartung: `11.3.0`, `1440`, `no-downgrade`.

### Task 3: TanStack breit aktualisieren und kompromittierte Auflösungen entfernen

**Files:**
- Modify: `apps/sva-studio-react/package.json`
- Modify: `packages/routing/package.json`
- Modify: `packages/plugin-events/package.json`
- Modify: `packages/plugin-news/package.json`
- Modify: `packages/plugin-poi/package.json`
- Modify: `packages/plugin-waste-management/package.json`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [x] Direkte TanStack-Dependencies auf sichere aktuelle Zielstände anheben:
  ```text
  @tanstack/react-router            -> ^1.170.8
  @tanstack/react-router-devtools   -> ^1.167.0
  @tanstack/react-start             -> ^1.168.13
  @tanstack/devtools-vite           -> ^0.7.0
  @tanstack/react-devtools          -> ^0.10.5
  ```
- [x] Alle Workspace-Packages mit direkter `@tanstack/react-router`-Abhängigkeit auf denselben aktuellen Stand ziehen, damit kein unnötiger Versionssplit im Monorepo stehen bleibt.
- [x] Root-`pnpm.overrides` nach dem Upgrade bereinigen:
  - TanStack-Overrides nur behalten, wenn der Resolver sie weiterhin für einen sicheren, einheitlichen Graph benötigt
  - veraltete Pinning-Artefakte entfernen, wenn direkte Dependency-Versionen bereits stabil genug sind
- [x] Das Lockfile unter pnpm 11 vollständig neu erzeugen:
  ```bash
  pnpm install --frozen-lockfile=false
  ```
- [x] Direkt danach IOC- und Versionsprüfungen ausführen:
  ```bash
  rg -n '1\.169\.5|1\.169\.8|1\.166\.16|1\.166\.19|1\.167\.68|1\.167\.71' pnpm-lock.yaml
  rg -n '@tanstack/start-plugin-core@1\.169\.5' pnpm-lock.yaml
  ```
  Erwartung: keine Treffer.
- [x] Wenn das neue Sicherheitsprofil Installationen blockiert, die Sperre nicht global lockern, sondern die konkrete Ursache identifizieren und nur notwendige, eng begrenzte Ausnahmen konfigurieren.

### Task 4: Verifikation, Doku und Abschluss-Gates

**Files:**
- Create or Modify: `docs/development/pnpm-supply-chain-hardening.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`
- Modify: `docs/superpowers/archived-plans/2026-05-27-tanstack-supply-chain-hardening.md`

- [x] Eine kurze Fachdoku unter `docs/development/pnpm-supply-chain-hardening.md` anlegen oder aktualisieren, die erklärt:
  - warum `pnpm@11.3.0` eingeführt wurde
  - welche Schutzmechanismen aktiv sind
  - wie Ausnahmen kontrolliert ergänzt werden
  - warum `bot-comment-governance` ohne `pnpm install` läuft
- [x] Den Architektur-/Risikoabschnitt in `docs/architecture/11-risks-and-technical-debt.md` um den entschärften Supply-Chain-Pfad ergänzen, sofern dort der passende Schulden- oder Risiko-Kontext anschlussfähig ist.
- [x] Nach jedem abgeschlossenen Änderungsblock die betroffenen Prüfungen ausführen und nicht auf rotem Stand weiterarbeiten.
- [x] Abschlussverifikation mindestens mit folgenden Befehlen durchführen:
  ```bash
  node --experimental-strip-types --test scripts/ci/check-bot-comment-handling.test.ts
  pnpm nx run sva-studio-react:build
  pnpm test:unit
  pnpm test:types
  pnpm test:eslint
  ```
- [x] Wenn Laufzeit und Ressourcen es zulassen, zusätzlich das bevorzugte PR-Gate ausführen:
  ```bash
  pnpm test:pr
  ```
- [x] Nach erfolgreicher Umsetzung diese Plan-Datei selbst aktualisieren und alle erledigten Schritte auf `- [x]` setzen.
