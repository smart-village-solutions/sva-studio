# Dokumentationsübersicht

Diese Übersicht ist der zentrale Einstiegspunkt für die Projekt-Dokumentation von SVA Studio. Sie bündelt die wichtigsten Dokumente nach Zweck, damit Architektur-, Entwicklungs- und Betriebswissen schneller auffindbar bleibt.

## Schnellstart nach Rolle

| Wenn du ... | Lies zuerst | Danach meist relevant |
| --- | --- | --- |
| das System verstehen willst | `./architecture/README.md` | `./adr/README.md`, `./monorepo.md` |
| lokal entwickeln oder testen willst | `./development/runtime-profile-betrieb.md` | `./development/playbook.md`, `./development/testing-coverage.md` |
| Dev, Staging oder Production ausrollen willst | `./guides/studio-rollout-process.md` | `./guides/deployment-overview.md`, `./guides/swarm-deployment-runbook.md` |
| Swarm-Infrastruktur oder einen Incident bearbeitest | `./guides/swarm-deployment-runbook.md` | `./guides/swarm-deployment-guide.md`, `./development/monitoring-stack.md` |
| Security oder Incident-Prozesse prüfen willst | `./guides/security-policy.md` | `./guides/incident-response.md`, `./guides/troubleshooting.md` |
| IAM-spezifische Abläufe suchst | `./guides/iam-service-api-dokumentation.md` | `./guides/iam-deployment-runbook.md`, `./architecture/iam-service-architektur.md` |
| Architekturentscheidungen nachvollziehen willst | `./adr/README.md` | `./architecture/09-architecture-decisions.md` |
| einen PR oder Review vorbereitest | `./reports/PR_CHECKLIST.md` | `./development/review-agent-governance.md` |

## Struktur

| Bereich | Inhalt | Einstieg |
| --- | --- | --- |
| `architecture/` | arc42-Systemdokumentation und architekturspezifische Deep Dives | `./architecture/README.md` |
| `adr/` | kanonische Architecture Decision Records | `./adr/README.md` |
| `development/` | Entwicklungsrichtlinien, Testing, Monitoring, lokale Setups | `./development/playbook.md` |
| `guides/` | Runbooks, Betriebs- und Fachleitfäden | `./guides/` |
| `api/` | API-Spezifikationen | `./api/iam-v1.yaml` |
| `reports/` | zeitgebundene Evidenz und Verifikationen; nicht normativ | `./reports/` |
| `staging/` | zeitlich abgelegte Zwischenstände; nicht normativ | `./staging/` |
| `pr/` | PR-bezogene Begleitdokumente; nicht normativ | `./pr/` |

## Aktueller Workspace-Bezug

Der Workspace besteht aktuell aus einer App und acht Nx-Libraries:

- App: `sva-studio-react`
- Libraries: `auth`, `core`, `data`, `monitoring-client`, `plugin-news`, `routing`, `sdk`, `sva-mainserver`

Für die technische Einordnung dieser Projekte sind folgende Dokumente die primären Einstiege:

- Architektur und Paketgrenzen: `./monorepo.md`
- Testing-Strategie: `./development/testing-strategy.md`
- Qualitäts- und Testtargets: `./development/testing-coverage.md`
- System- und Bausteinsicht: `./architecture/05-building-block-view.md`

## Kanonische Leitfäden

Die folgenden Dokumente sind die primären Einstiege für übergreifende Governance- und Betriebsfragen:

- Studio-Rollout: `./guides/studio-rollout-process.md`
- Deployment-Profile: `./guides/deployment-overview.md`
- Runtime-Profile und Betriebsmodi: `./development/runtime-profile-betrieb.md`
- Security Policy: `./guides/security-policy.md`
- Incident Response: `./guides/incident-response.md`
- Troubleshooting: `./guides/troubleshooting.md`
- Testing-Strategie: `./development/testing-strategy.md`
- Content-Guidelines: `./guides/content-guidelines.md`
- Accessibility: `./guides/accessibility.md`
- Studio-Seitenstandard: `./development/studio-uebersichts-und-detailseiten-standard.md`

## Pflegehinweise

- Architektur- oder Systemänderungen müssen die betroffenen arc42-Abschnitte unter `./architecture/` aktualisieren.
- Neue oder geänderte Architekturentscheidungen werden unter `./adr/` dokumentiert und in `./architecture/09-architecture-decisions.md` referenziert.
- Historische ADR-Dateien unter `./architecture/decisions/` gehören zu einer älteren Serie mit überschneidenden Nummern; neue oder aktualisierte Referenzen müssen auf `./adr/` zeigen.
- Historische Reports, Staging-/PR-Unterlagen, Pläne und archivierte OpenSpec-Changes sind keine Bedienanleitungen. Für Dev, Staging und Production gilt ausschließlich `./guides/studio-rollout-process.md` zusammen mit den versionierten Workflows.
