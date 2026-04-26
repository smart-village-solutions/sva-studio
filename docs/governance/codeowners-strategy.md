# CODEOWNERS-Strategie und Pfadverantwortung

Dieses Dokument beschreibt die Strategie zur Zuweisung von Pfadverantwortlichkeiten im SVA Studio Repository. Ziel ist es, sicherzustellen, dass kritische Codebereiche immer von den richtigen Fachexperten geprüft werden und keine "verwaisten" Pfade ohne klare Zuständigkeit existieren.

## Betriebsmodell

Die CODEOWNERS-Strategie ist rollenbasiert formuliert und fuer kleine Teams sowie wachsende Maintainer-Strukturen geeignet. Teamnamen in diesem Dokument beschreiben Funktionsrollen, keine zwingend bereits organisatorisch getrennten Einheiten. In fruehen Projektphasen koennen mehrere Rollen kommissarisch durch dieselbe Verantwortungsgruppe wahrgenommen werden, solange Review-Pfade, Audit-Spur und Eskalation eindeutig bleiben.

## 1. Kategorisierung der Pfade

Wir unterteilen das Repository in drei Kritikalitätsstufen, um den Review-Aufwand und die notwendige Expertise zu steuern.

### KRITISCH (Mandatory Review)
Diese Pfade haben direkten Einfluss auf die Sicherheit, Stabilität oder die Kernfunktionalität des Systems. Änderungen hier erfordern zwingend Reviews durch spezialisierte Teams.

| Pfad | Komponente | Begründung |
| --- | --- | --- |
| `apps/` | Applikationen | Direktes User-Interface, hohe Auswirkung auf UX und Systemintegration. |
| `packages/core/` | Core Framework | Basislogik für das gesamte System; Breaking Changes wirken sich überall aus. |
| `packages/auth-runtime/` | Security / Auth Runtime | Sicherheitskritisch (OIDC, Sessions, Verschlüsselung). |
| `packages/iam-admin/`, `packages/iam-governance/`, `packages/instance-registry/` | IAM-Fachlogik | Sicherheitskritische Benutzer-, Governance- und Instanzverwaltung. |
| `packages/sdk/` | SDK / Logger | Grundlage für Logging, Monitoring und Standard-Interfaces. |
| `.github/workflows/` | CI/CD | Deployment-Logik, Security-Scans und Automatisierung. |
| `rules/` | Validierung | Einhaltung von Architektur- und Code-Standards. |
| `nx.json`, `package.json`, `pnpm-*.yaml` | Infrastruktur | Workspace-Konfiguration und Abhängigkeitsmanagement. |

### WICHTIG (Expert Review empfohlen)
Diese Pfade betreffen funktionale Module oder wichtige Tooling-Bereiche. Ein Review durch das jeweilige Team oder einen Maintainer ist erforderlich.

| Pfad | Komponente |
| --- | --- |
| `packages/data/` | Data Loading & State |
| `packages/routing/` | Routing-Logik |
| `packages/monitoring-client/` | Monitoring Integration |
| `tooling/` | Test-Infrastruktur |
| `scripts/ci/` | CI-Hilfsskripte |
| `docs/architecture/` | Architektur-Doku (arc42) |
| `docs/governance/` | Governance & Richtlinien |

### OPTIONAL / OPERATIV (Standard Review)
Pfade für Beispiele, Debugging-Tools oder rein informative Dokumente. Hier reicht ein Standard-Review durch einen Maintainer.

| Pfad | Komponente |
| --- | --- |
| `scripts/debug/` | Debug-Tools |
| `docs/images/`, `docs/reports/` | Bilder und Berichte |
| `concepts/`, `specs/` | Konzepte und Spezifikationen |

## 2. Owner-Modell

Wir setzen primär auf **Team-Ownership** statt auf Einzelpersonen, um "Bus-Faktor"-Risiken zu minimieren und eine kontinuierliche Verfügbarkeit für Reviews zu gewährleisten.

- **Fachteams:** Spezialisierte Gruppen (z.B. `@sva-studio/security-team`) für kritische Domänen.
- **Maintainers Team:** Eine Gruppe von Kern-Entwicklern (`@sva-studio/maintainers`), die als Fallback für alle Pfade fungiert.
- **Admins:** Globale Administratoren für Notfälle und Infrastruktur-Änderungen.
- **Fruehphasen-Regel:** Wenn eine Rolle noch nicht als separates Team besetzt ist, uebernimmt die benannte Verantwortungsgruppe die Funktion kommissarisch, ohne dass das Zielmodell der Pfadverantwortung geaendert wird.

## 3. Fallback und Eskalation

- **Verwaiste Pfade:** Jeder Pfad, der nicht explizit einem Team zugewiesen ist, fällt automatisch in die Zuständigkeit des `@sva-studio/maintainers` Teams.
- **Eskalation:** Wenn innerhalb von 48 Stunden kein Review für einen kritischen Pfad erfolgt, kann das Review an das Maintainer-Team eskaliert werden.

## 4. Review-Anforderungen per Kategorie

| Kategorie | Mindestanzahl Reviews | Reviewer-Typ |
| --- | --- | --- |
| **KRITISCH** | Zielmodell 2 | Mind. 1 Mitglied der zuständigen Funktionsrolle; organisatorisch verbindlich als Vier-Augen-Prinzip ab verfuegbarer unabhaengiger Reviewer-Struktur |
| **WICHTIG** | 1 | Mitglied des Teams oder Maintainer |
| **OPTIONAL** | 1 | Beliebiger Maintainer |

## 5. CODEOWNERS Template (für T10)

Dieses Template dient als Basis für die spätere Implementierung der `.github/CODEOWNERS` Datei.

```text
# Fallback / Global Maintainers
*                                       @sva-studio/maintainers

# CI/CD & Security
.github/workflows/                      @sva-studio/infrastructure @sva-studio/security-team
.github/SECURITY.md                     @sva-studio/security-team
rules/                                  @sva-studio/core-maintainers

# Apps
/apps/                                  @sva-studio/frontend-leads

# Core Packages
/packages/core/                         @sva-studio/core-maintainers
/packages/auth-runtime/                 @sva-studio/security-team @sva-studio/core-maintainers
/packages/iam-admin/                    @sva-studio/security-team @sva-studio/core-maintainers
/packages/iam-governance/               @sva-studio/security-team @sva-studio/core-maintainers
/packages/instance-registry/            @sva-studio/security-team @sva-studio/core-maintainers
/packages/sdk/                          @sva-studio/core-maintainers

# Shared Packages
/packages/data/                         @sva-studio/data-team
/packages/routing/                      @sva-studio/core-maintainers
/packages/monitoring-client/            @sva-studio/infrastructure

# Infrastructure & Tooling
/nx.json                                @sva-studio/infrastructure
/package.json                           @sva-studio/infrastructure
/pnpm-workspace.yaml                    @sva-studio/infrastructure
/pnpm-lock.yaml                         @sva-studio/infrastructure
/tooling/                               @sva-studio/infrastructure

# Documentation
/docs/architecture/                     @sva-studio/core-maintainers
/docs/governance/                       @sva-studio/maintainers
```
