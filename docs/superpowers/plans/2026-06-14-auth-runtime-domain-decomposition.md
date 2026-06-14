# auth-runtime Domain Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das 41k-LOC-Gott-Paket `@sva/auth-runtime` schrittweise entlang der Domänengrenzen in eine kohärente Server-Topologie überführen, sodass die bereits vorhandenen Modulgrenzen-Guards (`@nx/enforce-module-boundaries`, Plugin-Boundary-Guards) tatsächlich greifen und der `credentials:yes`-Scope nur noch echte Auth-/Identitäts-Infrastruktur umfasst.

**Architecture:** Heute absorbiert `auth-runtime` drei unterschiedliche Verantwortungsklassen: (1) echte Auth-/Session-/Runtime-Infrastruktur, (2) den geteilten IAM-Kernel plus mehrere IAM-Fachdomänen (die teils schon doppelt in `iam-admin`/`iam-governance` existieren), (3) reine Plugin-/Business-Serverlogik (`waste-management`, `plugin-operations`). Der Umbau zieht diese Klassen in eine 4-Tier-Topologie auseinander. Leitprinzip ist eine einzige Invariante: Fachpakete dürfen ausschließlich den IAM-Kernel importieren, nie `auth-runtime`-Interna. Die Umsetzung erfolgt nach Kopplung/Risiko sortiert in kleinen, je für sich mergebaren und revertierbaren Phasen mit grünem CI nach jeder Phase.

**Tech Stack:** TypeScript strict mode, pnpm workspace, Nx, Vitest, tsx, `@nx/enforce-module-boundaries`, Plugin Boundary Guards, Complexity-/Coverage-Gate

**Verwandte Pläne:**
- `2026-06-14-plugin-waste-management-boundary-refactor.md` — betrifft das **Browser-Plugin-Paket** `@sva/plugin-waste-management` (Client-Drift). Dieser Plan hier betrifft die **server-seitige** Waste-Logik in `auth-runtime`. Phase 1 unten landet im Zielzustand jenes Plans.
- `2026-05-31-plugin-architecture-boundary-governance.md` und `2026-06-13-plugin-boundary-guard-implementation.md` — Guard-Grundlagen.

---

## Ausgangslage (Messdaten, Stand 2026-06-14)

`packages/auth-runtime/src` ≈ 40.899 LOC (ohne Tests), ~23 % des gesamten Package-Codes. Interne Subdomänen (LOC inkl. Tests):

| Subdomäne | LOC | Kopplung an Auth-Core | Klasse |
|-----------|----:|-----------------------|--------|
| `waste-management/` | 17.705 | sehr niedrig (`middleware`, `iam-account-management`, `log-context`, `db`) | Plugin/Business |
| `iam-account-management/` | 14.169 | **Kernel** (importiert `db`, `middleware`, `keycloak-admin-client`, `shared`; wird von fast allen importiert) | IAM-Kernel |
| `iam-media/` | 6.188 | mittel | IAM-Fachdomäne |
| `iam-contents/` | 5.800 | mittel (importiert `iam-account-management` 14×) | IAM-Fachdomäne |
| `iam-authorization/` | 5.728 | Kernel-nah | IAM-Kernel |
| `plugin-operations/` | 4.045 | niedrig | Plugin/Business |
| `iam-data-subject-rights/` | 3.686 | mittel | IAM-Governance |
| `keycloak-admin-client/` | 2.590 | Auth-Infra | Auth |
| `iam-instance-registry/` | 2.479 | mittel | (separat prüfen) |
| `auth-server/` | 1.855 | Auth-Infra | Auth |
| `iam-governance/` | 1.366 | mittel | IAM-Governance |
| `iam-deletion-rules/` | 1.119 | mittel | IAM-Governance |
| `shared/` | 923 | Kernel-nah | IAM-Kernel |
| `iam-groups/` | 336 | mittel | IAM-Admin |
| `iam-legal-texts/` | 214 | mittel (importiert `iam-account-management` 8×) | IAM-Governance |
| `iam-organizations/` | 200 | mittel | IAM-Admin |
| lose Top-Level-Auth-Dateien | ~8.340 | Auth-Infra | Auth |

Schlüsselbefunde:
1. **`iam-account-management` ist ein echter geteilter Kernel** — nicht zerschneidbar, wird zur expliziten Abhängigkeit.
2. **`waste-management` ist der größte Brocken, aber am losesten gekoppelt** → günstigster, risikoärmster Hebel.
3. **Domänen liegen doppelt vor:** Paket `iam-governance` besitzt bereits `dsr-*`, `deletion-rules-*`, `legal-text-*`; Paket `iam-admin` besitzt bereits `organization-*`, `group-*`, `actor-*`. Wir konsolidieren in bestehende Pakete, erfinden nichts Neues.
4. **`iam-core` ist ein leerer Platzhalter** (23 LOC, nur `index.ts`) — fertiger Slot für den Kernel.
5. **Zirkularität:** ~9 Importe der losen Auth-Top-Level-Dateien zurück in `iam-account-management`. Diese Zyklen müssen vor der Kernel-Extraktion (Phase 3) aufgelöst werden.

## Zielbild nach dem Umbau

```
 Tier 0  @sva/auth-runtime        scope:auth-runtime  credentials:yes
         OIDC · Sessions · Redis · Cookies · Middleware · Config
         keycloak-admin-client · auth-server · runtime/host/instance-resolution
                      ▲ (nur Infrastruktur, keine Fachdomäne)
                      │
 Tier 1  @sva/iam-core (KERNEL)   scope:iam-core      credentials:yes
         account-management · authorization (cache + enforcement)
         shared · identity-provider-port
            ▲            ▲              ▲
            │            │              │   ← Fachpakete importieren NUR iam-core
 Tier 2  @sva/iam-admin   @sva/iam-governance   @sva/iam-content      pii:yes
         users/roles       DSR/retention/legal    media + contents
         groups/orgs       governance-workflow
                                              
 Tier 3  Plugins (eigene Server-Logik)                scope:plugin
         plugin-waste-management ← waste-management
         plugin-operations → @sva/plugin-sdk / server-runtime
```

**Tragende Invariante:** Tier-2- und Tier-3-Pakete dürfen ausschließlich `@sva/iam-core` (und `@sva/plugin-sdk`, `@sva/core`, `@sva/server-runtime`) importieren — **niemals `@sva/auth-runtime`-Interna**. Damit schrumpft `credentials:yes` auf Tier 0 + 1. Business-/Plugin-Domänen verlieren den heute pauschal vererbten Auth-/Secret-Scope.

**Bewusst NICHT gemacht (Balance Aufwand/Nutzen):**
- Kernel (`iam-account-management` + `iam-authorization`) wird **nicht** weiter aufgebrochen.
- `iam-media` + `iam-contents` werden zu **einem** Paket `iam-content` zusammengefasst, nicht zwei.
- `auth-runtime` bleibt ein Paket; die kohärenten losen Auth-Dateien werden nicht weiter zerlegt.
- `iam-instance-registry` wird in Phase 4 separat bewertet (Bezug zum Paket `instance-registry`), nicht vorschnell verschoben.

## Absicherungsstrategie

### Technische Gates vor Start JEDER Phase
- [ ] `pnpm test:eslint` (enthält `check:plugin-architecture-boundary`, `check:plugin-ui-boundary`)
- [ ] `pnpm test:types:affected`
- [ ] `pnpm test:unit:affected`

### Zusätzliche Gates nach Abschluss JEDER Phase
- [ ] `pnpm test:coverage:affected`
- [ ] `pnpm complexity-gate`
- [ ] `pnpm check:file-placement`
- [ ] Diff-Review: Kein neues Fachpaket importiert `@sva/auth-runtime` direkt (Boundary-Tags geprüft).

### Grundregeln
- Jede Phase ist eigenständig mergebar und revertierbar.
- Pro Move zuerst eine Kompatibilitätsbrücke (Re-Export aus altem Pfad), dann Aufrufer umstellen, dann Brücke entfernen.
- Keine Verhaltensänderung — reine Topologie-/Struktur-Migration. Bestehende Tests wandern mit.

---

## Phase 0: `waste-management` aus auth-runtime herauslösen

**Warum zuerst:** Größtes Volumen (17,7k), geringste Kopplung, schwerste Scope-Verletzung (Business-Logik unter `credentials:yes`). Allein diese Phase entfernt ~43 % des auth-runtime-Volumens.

**Files:**
- Move: `packages/auth-runtime/src/waste-management/**` → Ziel-Paket (Server-Runtime-Heimat des Waste-Plugins, abgestimmt mit `2026-06-14-plugin-waste-management-boundary-refactor.md` — host-owned Server-Package außerhalb von `packages/plugin-*`, NICHT in das Browser-Plugin-Paket)
- Modify: `packages/auth-runtime/src/index.ts` (Re-Exports entfernen)
- Modify: Ziel-`project.json` (Scope-Tags), `tsconfig`-Pfade, `package.json` (workspace-Deps)
- Modify: Aufrufer von `@sva/auth-runtime` Waste-Exports (Routen/Loader in `sva-studio-react`)

**Steps:**
- [ ] Genaue externe Aufrufer der Waste-Exports ermitteln: `grep -rn "auth-runtime" --include='*.ts' --include='*.tsx' | grep -i waste`
- [ ] Ziel-Server-Paket bestimmen/anlegen (mit `2026-06-14-plugin-waste-management-boundary-refactor.md` abstimmen, um Doppelarbeit zu vermeiden). Scope-Tag passend zu Plugin-Server-Runtime, **ohne** `credentials:yes` falls fachlich vertretbar.
- [ ] Erlaubte Restabhängigkeiten von `waste-management` (`middleware`, `iam-account-management`, `log-context`, `db`) auf den IAM-Kernel-Vertrag bzw. SDK umbiegen. Falls Kernel-Extraktion (Phase 3) noch aussteht: temporäre, schmale Re-Export-Brücke aus `auth-runtime` nur für diese vier Symbole.
- [ ] Code + Tests verschieben, Importpfade anpassen.
- [ ] Kompatibilitäts-Re-Exports aus altem `auth-runtime`-Pfad, dann Aufrufer umstellen, dann Re-Exports entfernen.
- [ ] Gates vor/nach Phase ausführen (s. o.).

## Phase 1: `plugin-operations` aus auth-runtime herauslösen

**Warum:** Niedrige Kopplung, letzte Plugin-Serverlogik in Auth. Bringt `auth-runtime` auf rein IAM-/Auth-Inhalte.

**Files:**
- Move: `packages/auth-runtime/src/plugin-operations/**` → `@sva/plugin-sdk` (Server-Runtime-Teil) oder dediziertes Plugin-Server-Paket
- Modify: `packages/auth-runtime/src/index.ts`, betroffene `project.json`/`tsconfig`/`package.json`
- Modify: Aufrufer (u. a. `iam-data-subject-rights` importiert `plugin-operations` 2×)

**Steps:**
- [ ] Aufrufer ermitteln: `grep -rn "plugin-operations" packages apps --include='*.ts'`
- [ ] Zielort festlegen (bevorzugt `@sva/plugin-sdk` Server-Subpfad, da Plugins generisch betroffen).
- [ ] Verschieben mit Brücke → Umstellung → Brücke entfernen.
- [ ] Gates vor/nach Phase.

## Phase 2: IAM-Fachdomänen in bestehende Pakete konsolidieren

**Warum:** Löst die Domänen-Duplikation auf (Governance/Admin existieren bereits als Pakete). Mittlere Kopplung — Brücken nötig.

### Phase 2a: Governance-Domäne → `@sva/iam-governance`
**Files:**
- Move: `packages/auth-runtime/src/iam-data-subject-rights/**`, `iam-deletion-rules/**`, `iam-legal-texts/**`, `iam-governance/**` → `packages/iam-governance/src/`
- Modify: `packages/iam-governance/src/index.ts`, `auth-runtime/src/index.ts`, betroffene `project.json`

**Steps:**
- [ ] Überschneidungen mit vorhandenen `iam-governance`-Dateien (`dsr-*`, `deletion-rules-*`, `legal-text-*`) prüfen und zusammenführen (keine Doppel-Implementierung stehen lassen).
- [ ] Gemeinsame Abhängigkeit `iam-account-management` über Kernel-Vertrag/Brücke beziehen (final nach Phase 3).
- [ ] Verschieben mit Brücke → Umstellung → Brücke entfernen.
- [ ] Sicherstellen, dass `pii:yes`-Tag korrekt bleibt.
- [ ] Gates vor/nach Phase.

### Phase 2b: Admin-Domäne → `@sva/iam-admin`
**Files:**
- Move: `packages/auth-runtime/src/iam-organizations/**`, `iam-groups/**` → `packages/iam-admin/src/`
- Modify: `packages/iam-admin/src/index.ts`, `auth-runtime/src/index.ts`

**Steps:**
- [ ] Mit vorhandenen `organization-*`/`group-*`-Dateien in `iam-admin` zusammenführen, Duplikate auflösen.
- [ ] `identity-provider-port.ts`-Dopplung (existiert in `auth-runtime` und `iam-admin`) konsolidieren — kanonische Quelle festlegen.
- [ ] Verschieben mit Brücke → Umstellung → Brücke entfernen.
- [ ] Gates vor/nach Phase.

## Phase 3: IAM-Kernel nach `@sva/iam-core` extrahieren

**Warum zuletzt:** Höchstes Risiko. Voraussetzung ist das Auflösen der ~9 zirkulären Importe zwischen den losen Auth-Top-Level-Dateien und `iam-account-management`.

**Files:**
- Move: `packages/auth-runtime/src/iam-account-management/**`, `iam-authorization/**` (+ `iam-authorization-cache*.ts`), `shared/**`, `identity-provider-port.ts` → `packages/iam-core/src/`
- Modify: `packages/iam-core/src/index.ts` (heute leer), `project.json` (Scope/`credentials:yes`), alle Tier-2/3-Importeure

**Steps:**
- [ ] Zyklen kartieren: `grep -rn "from '\\.\\./iam-account-management" packages/auth-runtime/src/*.ts`
- [ ] Zyklen auflösen — geteilte Typen/Ports in `iam-core` ziehen oder Dependency-Inversion via `identity-provider-port`, sodass `auth-runtime` → `iam-core` zeigt, nicht umgekehrt.
- [ ] `iam-core` `project.json` mit `scope:iam-core`, `credentials:yes`, ggf. `pii:yes` versehen; Modulgrenzen-Regeln in der Workspace-ESLint-Config ergänzen (Tier-2/3 → `iam-core` erlaubt; `auth-runtime` → `iam-core` erlaubt; `iam-core` → `auth-runtime` verboten).
- [ ] Kernel verschieben, alle Aufrufer (Phase-0–2-Brücken inklusive) auf `@sva/iam-core` umstellen, alle temporären `auth-runtime`-Brücken entfernen.
- [ ] Gates vor/nach Phase + expliziter Boundary-Check: kein Fachpaket importiert mehr `@sva/auth-runtime`.

## Phase 4 (optional): `iam-media` + `iam-contents` → `@sva/iam-content`

**Warum optional:** Eigener Lebenszyklus, kein bestehendes Zielpaket. Nur sinnvoll, wenn Media/Content eigenständig weiterentwickelt werden.

**Files:**
- Create: `packages/iam-content/` (project.json, tsconfig, package.json, src/index.ts)
- Move: `packages/auth-runtime/src/iam-media/**`, `iam-contents/**` → `packages/iam-content/src/`

**Steps:**
- [ ] Neues Paket gerüstet (Scope-Tags `scope:iam-content`, `pii:yes` je nach Inhalt; **kein** `credentials:yes`).
- [ ] Abhängigkeiten ausschließlich auf `@sva/iam-core`.
- [ ] Verschieben mit Brücke → Umstellung → Brücke entfernen.
- [ ] `iam-instance-registry` separat bewerten: gehört es zu `@sva/instance-registry`? Entscheidung dokumentieren (ADR), ggf. eigene Mini-Phase.
- [ ] Gates vor/nach Phase.

---

## Abschluss / Definition of Done

- [ ] `@sva/auth-runtime` enthält nur noch Auth-/Session-/Runtime-Infrastruktur; Volumen deutlich reduziert.
- [ ] Kein Tier-2/3-Paket importiert `@sva/auth-runtime`-Interna (per Boundary-Guard erzwungen).
- [ ] `credentials:yes` nur noch auf `auth-runtime` und `iam-core`.
- [ ] Keine Domänen-Duplikate mehr zwischen `auth-runtime` und `iam-admin`/`iam-governance`.
- [ ] Alle temporären Re-Export-Brücken entfernt.
- [ ] `pnpm test:ci` grün.
- [ ] ADR unter `docs/adr/` zur neuen Server-Topologie; relevante arc42-Abschnitte (`docs/architecture/`) aktualisiert.
- [ ] Complexity-/Coverage-Baselines nicht gewachsen (idealerweise geschrumpft durch kleinere, fokussierte Dateien).
