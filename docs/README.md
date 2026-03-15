# Dokumentationsübersicht

Diese Übersicht ist der zentrale Einstiegspunkt für die Projekt-Dokumentation von SVA Studio. Sie bündelt die wichtigsten Dokumente nach Zweck, damit Architektur-, Entwicklungs- und Betriebswissen schneller auffindbar bleibt.

## Schnellstart nach Rolle

| Wenn du ... | Lies zuerst | Danach meist relevant |
| --- | --- | --- |
| das System verstehen willst | `./architecture/README.md` | `./adr/README.md`, `./monorepo.md` |
| lokal entwickeln oder testen willst | `./development/playbook.md` | `./development/testing-coverage.md`, `./development/postgres-setup.md` |
| Deployment oder Betrieb vorbereitest | `./guides/swarm-deployment-guide.md` | `./guides/swarm-deployment-runbook.md`, `./development/monitoring-stack.md` |
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
| `reports/` | operative Reports, Checklisten und Verifikationen | `./reports/` |
| `staging/` | zeitlich abgelegte Zwischenstände und Analyse-Dokumente | `./staging/` |
| `pr/` | PR-bezogene Begleitdokumente | `./pr/` |

## Aktueller Workspace-Bezug

Der Workspace besteht aktuell aus einer App und acht Nx-Libraries:

- App: `sva-studio-react`
- Libraries: `auth`, `core`, `data`, `monitoring-client`, `plugin-example`, `routing`, `sdk`, `sva-mainserver`

Für die technische Einordnung dieser Projekte sind folgende Dokumente die primären Einstiege:

- Architektur und Paketgrenzen: `./monorepo.md`
- Qualitäts- und Testtargets: `./development/testing-coverage.md`
- System- und Bausteinsicht: `./architecture/05-building-block-view.md`

## Pflegehinweise

- Architektur- oder Systemänderungen müssen die betroffenen arc42-Abschnitte unter `./architecture/` aktualisieren.
- Neue oder geänderte Architekturentscheidungen werden unter `./adr/` dokumentiert und in `./architecture/09-architecture-decisions.md` referenziert.
- Historische ADR-Entwürfe unter `./architecture/decisions/` gelten nur als Altbestand und sind nicht der kanonische Ablageort.
