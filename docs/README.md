# Dokumentationsübersicht

Diese Seite ist der zentrale Einstieg in die lokale Projekt- und Betriebsdokumentation des SVA Studios. Sie führt zu den aktuell maßgeblichen Quellen und grenzt diese von zeitgebundenen Nachweisen, generierten Artefakten und der separat veröffentlichten Anwenderdokumentation ab.

## Schnellstart nach Rolle

| Wenn du ...                                         | Lies zuerst                                                         | Danach meist relevant                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| das System verstehen willst                         | [Architekturübersicht](./architecture/README.md)                    | [ADRs](./adr/README.md), [Monorepo-Struktur](./monorepo.md)                                                                                      |
| lokal entwickeln oder testen willst                 | [Bereich Entwicklung](./development/README.md)                      | [Runtime-Profile](./development/runtime-profile-betrieb.md), [Testing-Strategie](./development/testing-strategy.md)                              |
| Dev, Staging oder Production ausrollen willst       | [Kanonischer Studio-Rollout](./guides/studio-rollout-process.md)    | [Bereich Betrieb](./operations/README.md), [Deployment-Übersicht](./guides/deployment-overview.md)                                               |
| Swarm-Infrastruktur oder einen Incident bearbeitest | [Bereich Betrieb](./operations/README.md)                           | [Monitoring-Stack](./development/monitoring-stack.md), [Incident Response](./guides/incident-response.md)                                        |
| Security oder Datenschutz prüfst                    | [Bereich Governance](./governance/README.md)                        | [Security Policy](./guides/security-policy.md), [Datenschutz-Compliance](./guides/datenschutz-compliance-evidence-playbook.md)                   |
| IAM-spezifische Abläufe oder Verträge suchst        | [Bereich Referenz](./reference/README.md)                           | [IAM-Service-API](./guides/iam-service-api-dokumentation.md), [IAM-Service-Architektur](./architecture/iam-service-architektur.md)               |
| Architekturentscheidungen nachvollziehen willst     | [Kanonischer ADR-Index](./adr/README.md)                            | [arc42-Abschnitt 9](./architecture/09-architecture-decisions.md)                                                                                 |
| einen PR oder Review vorbereitest                   | [Review-Agent-Governance](./development/review-agent-governance.md) | [Merge- und Review-Gates](./governance/merge-review-gates.md), [Evidenz- und Abnahmeprotokoll](./governance/evidence-and-acceptance-protocol.md) |

## Aktuelle Wissensbasis

| Bereich                   | Zweck                                                             | Maßgeblicher Einstieg                                       |
| ------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| Architektur               | arc42-Systemdokumentation und architekturspezifische Vertiefungen | [Architekturübersicht](./architecture/README.md)            |
| Architekturentscheidungen | kanonische Architecture Decision Records                          | [ADR-Index](./adr/README.md)                                |
| Entwicklung               | lokales Setup, Testing, Monitoring und Entwicklungsstandards      | [Bereichsindex Entwicklung](./development/README.md)        |
| Betrieb und Runbooks      | Deployment, Diagnose, Recovery und fachliche Betriebsabläufe      | [Bereichsindex Betrieb](./operations/README.md)             |
| Technische Referenz       | stabile Verträge, Datenmodelle und Nachschlagewerke               | [Bereichsindex Referenz](./reference/README.md)             |
| API-Referenz              | maschinenlesbare Schnittstellenverträge                           | [IAM API v1](./api/iam-v1.yaml)                             |
| Governance                | Delivery-, Review- und Projektregeln                              | [Bereichsindex Governance](./governance/README.md)          |
| Monorepo und Routing      | Paketgrenzen, Workspace-Struktur und Routingkonzept               | [Monorepo-Struktur](./monorepo.md), [Routing](./routing.md) |

`docs/guides/` ist ein befristeter Übergangsbereich. Das [vollständige Migrationsinventar](./guides/README.md) benennt für jede dortige Datei Zielbereich, geplanten Zielpfad und Konsolidierungsbedarf. [Der kanonische Studio-Rollout](./guides/studio-rollout-process.md) bleibt dort dauerhaft die einzige verbindliche Bedienanleitung für reguläre Rollouts nach Dev, Staging und Production.

## Nicht Teil der aktuellen Wissensbasis

Die folgenden Bereiche bleiben aus Nachweis-, Automations- oder historischen Gründen versioniert, sind aber keine aktuellen Bedien-, Entwicklungs- oder Architekturhandbücher:

- `changelog/`: generierte Delivery-Daten
- `reports/`: zeitgebundene Analysen und Verifikationen
- `pr/`: PR-bezogene Begleitunterlagen
- `staging/`: historische Zwischenstände
- `superpowers/`: historische Arbeits- und Implementierungspläne
- `architecture/decisions/`: Legacy-ADR-Serie mit überschneidenden Nummern; maßgeblich ist ausschließlich der [kanonische ADR-Index](./adr/README.md)

Diese Bereiche werden nicht in die lokale Wiki-Wissensbasis übernommen. Aktuelle Dokumentation darf sie als Evidenz referenzieren, aber nicht als führende normative Quelle verwenden.

## Externe Anwenderdokumentation

`user-documentation/` enthält den Studio-seitigen Katalog-, Übergabe- und Synchronisationsvertrag für das eigenständige Repository der Anwenderdokumentation. Die dortigen Startermaterialien und der Seitenkatalog gehören nicht zur lokalen Projekt-Wissensbasis und werden über einen separaten Dokumentationsprozess gepflegt. Technische Details stehen im [Integrationsvertrag der Anwenderdokumentation im Repository](https://github.com/smart-village-solutions/sva-studio/blob/main/docs/user-documentation/README.md).

## Kanonische übergreifende Leitfäden

- [Studio-Rollout](./guides/studio-rollout-process.md)
- [Runtime-Profile und Betriebsmodi](./development/runtime-profile-betrieb.md)
- [Security Policy](./guides/security-policy.md)
- [Incident Response](./guides/incident-response.md)
- [Troubleshooting](./guides/troubleshooting.md)
- [Testing-Strategie](./development/testing-strategy.md)
- [Testing und Coverage](./development/testing-coverage.md)
- [Plugin-Entwicklung](./guides/plugin-development.md)
- [Accessibility](./guides/accessibility.md)
- [Studio-Seitenstandard](./development/studio-uebersichts-und-detailseiten-standard.md)

## Pflegehinweise

- Neue aktuelle Dokumentation wird einem der Bereichsindizes [Entwicklung](./development/README.md), [Betrieb](./operations/README.md), [Referenz](./reference/README.md), [Governance](./governance/README.md), [Architektur](./architecture/README.md) oder [ADRs](./adr/README.md) zugeordnet.
- `docs/guides/` nimmt außer Aktualisierungen bestehender Übergangsdokumente und des stabilen Rolloutpfads keine neuen allgemeinen Dokumente auf.
- Architektur- oder Systemänderungen aktualisieren die betroffenen arc42-Abschnitte unter [Architektur](./architecture/README.md).
- Neue oder geänderte Architekturentscheidungen liegen ausschließlich unter `adr/` und werden im [ADR-Index](./adr/README.md) sowie in [arc42 Abschnitt 9](./architecture/09-architecture-decisions.md) referenziert.
- Der [kanonische Studio-Rollout](./guides/studio-rollout-process.md) bleibt die einzige normative Bedienanleitung für reguläre Studio-Rollouts.
- Flüchtige Workspace-Bestandszahlen gehören nicht in diesen Einstieg. Die aktuelle Projektliste wird bei Bedarf mit `pnpm nx show projects` ermittelt.
- Historische Dokumente werden nicht stillschweigend zu aktuellen Anleitungen erklärt; weiterhin gültige Aussagen werden in die zuständige aktuelle Quelle übernommen.
