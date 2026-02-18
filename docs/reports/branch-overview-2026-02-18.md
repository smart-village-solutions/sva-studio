# Branch-Uebersicht (Stand: 2026-02-18)

## Ziel
Diese Uebersicht schafft Transparenz ueber alle aktuellen Remote-Branches (`origin/*`) und gibt eine konkrete Empfehlung:
- Was ist aktuell noetig und review-/merge-reif?
- Was ist eher Experiment/Altlast und kann geparkt oder geloescht werden?

## Kurzfazit
- Aktive Remote-Branches: **32**
- Davon mit offenem PR: **14**
- Basis-Branches: **2** (`main`, `develop`)
- Ohne offenen PR (Kandidaten fuer Parken/Aufraeumen): **16**

## A) Unbedingt noetig (aktiver Entscheidungs- oder Merge-Flow)

| Branch | PR | Zielbranch | Empfehlung |
|---|---:|---|---|
| `docs/adr-008-codecov-review` | #65 | `develop` | **Noetig**: ADR-Entscheidung zu Codecov pruefen und entscheiden |
| `feat/complete-monitoring-and-app-e2e-openspec` | #64 | `develop` | **Noetig**: CI/E2E-Integrationspaket abschliessen |
| `feat/monitoring-stack-ci` | #57 | `develop` | **Noetig**: Monitoring-CI validieren/merge |
| `chore/openspec-archive-coverage` | #56 | `develop` | **Noetig** fuer OpenSpec-Hygiene in `develop` |
| `chore/openspec-archive-coverage-tooling` | #63 | `main` | **Noetig** fuer OpenSpec-Hygiene in `main` |
| `feat/logging` | #45 | `main` | **Noetig** als Kern-PR fuer Monitoring/OTEL |
| `feat/logging-clean` | #49 | `main` | **Noetig** (Repo-/Build-Stabilisierung) |
| `feat/auth-clean` | #50 | `main` | **Noetig** (Auth-Integration) |
| `feat/sdk-split-clean` | #51 | `main` | **Noetig** (SDK-Split/Server-Boundaries) |
| `feat/monitoring-stack-clean` | #52 | `main` | **Noetig** (Monitoring-Stack + Wiring) |
| `feat/docs-observability-clean` | #53 | `main` | **Noetig** (Doku-Paket Observability) |
| `feat/openspec-iam-clean` | #54 | `main` | **Noetig** (OpenSpec IAM/Monitoring Deltas) |
| `feat/agents-meta-clean` | #55 | `main` | **Noetig** (Governance/Agent-Metadaten) |
| `builder-io` | #39 | `main` | **Noetig fuer Entscheidung**: WIP-PR bewusst annehmen oder schliessen |

## B) Fertig bzw. bereits in `develop` enthalten (danach Branch-Cleanup)

Diese Branches sind funktional weitgehend abgeschlossen und laut Historie bereits in `develop` enthalten. Wenn die zugehoerigen `main`-PRs gemerged sind, koennen die Branches entfernt werden.

- `feat/auth-clean`
- `feat/sdk-split-clean`
- `feat/monitoring-stack-clean`
- `feat/docs-observability-clean`
- `feat/openspec-iam-clean`
- `feat/agents-meta-clean`
- `feat/logging-clean`

## C) Eher Experiment/Altstand (kann vorerst geparkt bleiben)

| Branch | Einschaetzung | Empfehlung |
|---|---|---|
| `adr/codecov` | Vorlaeufer zu `docs/adr-008-codecov-review` | Parken oder loeschen nach PR #65 |
| `docs/arc42-setup` | Altere Doku-Arbeit, kein offener PR | Parken; bei Bedarf spaeter reaktivieren |
| `dev/milestone-1/auth` | Milestone-Altstand | Parken |
| `epic/milestone-1` | Sammel-/Planungsbranch | Parken |
| `experiment/nx-structure` | Expliziter Experiment-Branch | Parken |
| `feature/playbook` | Frueher Entwurfsbranch | Parken |
| `feature/redis-session-store-security` | Security-Teilstand | Parken |
| `feature/test-coverage-governance` | Historischer Governance-Stand | Parken |
| `proposal/add-redis-session-store` | Proposal-Branch | Parken |
| `proposal/milestone-1` | Proposal-Branch | Parken |
| `setup/nx` | Setup-Historie | Parken |
| `test/agents-dry-run` | Testbranch | Parken |
| `vibe-garden` | Experiment/WIP | Parken |
| `chore/agent-config-updates` | Einzelne Meta-Aenderungen ohne PR | Pruefen: in neuen PR uebernehmen oder parken |
| `chore/readme-badges` | Einzelner Doku/CI-Stand | Pruefen: in neuen PR uebernehmen oder parken |

## D) Basis-Branches

- `main`
- `develop`

## Empfohlener Aufraeum-Plan

1. Erst offene PRs mit fachlichem Nutzen priorisieren: `#65`, `#64`, `#57`.
2. Danach die auf `main` zielenden "clean"-PRs in definierter Reihenfolge mergen (z. B. #49 -> #50 -> #51 -> #52).
3. Nach jedem Merge den zugehoerigen Branch entfernen.
4. Geparkte/experimentelle Branches quartalsweise pruefen und konsequent aufraeumen.

## Hinweis zu Lokalen Branches

Lokal existieren zusaetzlich viele Backup-/Temp-Branches (z. B. `backup/*`, `tmp/*`, `pr64-merge-check`). Diese sind **nicht** auf `origin` sichtbar und sollten lokal separat bereinigt werden.
