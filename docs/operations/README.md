# Betrieb

## Bereichsvertrag

| Merkmal        | Festlegung                                                                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zweck          | Ausführungssichere Runbooks für Deployment, Diagnose, Incident Response, Recovery und fachliche Betriebsabläufe                                                                     |
| Zielgruppe     | Operatoren, On-Call-Verantwortliche, Release-Verantwortliche und technische Maintainer                                                                                              |
| Autorität      | Führend für konkrete Betriebsabläufe; der einzige normative reguläre Studio-Rollout bleibt dauerhaft [`docs/guides/studio-rollout-process.md`](../guides/studio-rollout-process.md) |
| Ownership      | Das Team, das den beschriebenen Dienst oder Betriebsablauf verantwortet                                                                                                             |
| Pflege-Trigger | Änderungen an Deployment, Runtime-Konfiguration, Infrastruktur, Alarmierung, Recovery, Backup oder operativen Fachabläufen                                                          |

Dieser Bereich wird in PR 4 befüllt. Bis dahin bleiben die verlinkten Dateien unter `docs/guides/` an ihren bisherigen Pfaden gültig.

## Aktuelle betriebliche Einstiege

- [Kanonischer Studio-Rollout](../guides/studio-rollout-process.md)
- [Deployment-Übersicht](../guides/deployment-overview.md)
- [Swarm-Runbook](../guides/swarm-deployment-runbook.md)
- [Incident Response](../guides/incident-response.md)
- [Troubleshooting](../guides/troubleshooting.md)
- [IAM-Deployment-Runbook](../guides/iam-deployment-runbook.md)
- [IAM-Acceptance-Runbook](../guides/iam-acceptance-runbook.md)
- [Studio-Instanz-MCP-Betrieb](../guides/studio-instance-mcp-betrieb.md)
- [Waste-Tenant-Datenbankbetrieb](../guides/waste-tenant-database-operations.md)

## Migrationsgrenze

- Keine Datei wird in PR 2 verschoben.
- Der [kanonische Studio-Rollout](../guides/studio-rollout-process.md) behält auch nach PR 4 seinen Pfad und seine alleinige normative Rolle.
- Überlappende Deployment- und Swarm-Dokumente werden vor dem Verschieben konsolidiert; sie dürfen keinen konkurrierenden regulären Rolloutpfad definieren.
- Das vollständige Alt-/Neu-Pfad-Inventar steht im [Migrationsinventar für `docs/guides/`](../guides/README.md).

## Benachbarte Bereiche

[Dokumentationsübersicht](../README.md) · [Entwicklung](../development/README.md) · [Referenz](../reference/README.md) · [Governance](../governance/README.md) · [Architektur](../architecture/README.md)
