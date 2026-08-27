# Betrieb

## Bereichsvertrag

| Merkmal        | Festlegung                                                                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zweck          | Ausführungssichere Runbooks für Deployment, Diagnose, Incident Response, Recovery und fachliche Betriebsabläufe                                                                     |
| Zielgruppe     | Operatoren, On-Call-Verantwortliche, Release-Verantwortliche und technische Maintainer                                                                                              |
| Autorität      | Führend für konkrete Betriebsabläufe; der einzige normative reguläre Studio-Rollout bleibt dauerhaft [`docs/guides/studio-rollout-process.md`](../guides/studio-rollout-process.md) |
| Ownership      | Das Team, das den beschriebenen Dienst oder Betriebsablauf verantwortet                                                                                                             |
| Pflege-Trigger | Änderungen an Deployment, Runtime-Konfiguration, Infrastruktur, Alarmierung, Recovery, Backup oder operativen Fachabläufen                                                          |

Die Dokumente unterscheiden bewusst zwischen Überblick, technischer Infrastruktur, ausführbaren Runbooks und historisch gekennzeichneten Recovery-Pfaden. Keines dieser Dokumente ersetzt den kanonischen regulären Studio-Rollout.

## Aktuelle betriebliche Einstiege

- [Kanonischer Studio-Rollout](../guides/studio-rollout-process.md)
- [Deployment-Übersicht](./deployment-overview.md)
- [Swarm-Runbook](./swarm-deployment-runbook.md)
- [Incident Response](./incident-response.md)
- [Troubleshooting](./troubleshooting.md)
- [IAM-Deployment-Runbook](./iam-deployment-runbook.md)
- [IAM-Acceptance-Runbook](./iam-acceptance-runbook.md)
- [Studio-Instanz-MCP-Betrieb](./studio-instance-mcp-betrieb.md)
- [Waste-Tenant-Datenbankbetrieb](./waste-tenant-database-operations.md)

## Weitere Runbooks und Betriebsverträge

- [Betriebsnachweise Datenschutz und Compliance](./datenschutz-compliance-betriebsnachweise.md)
- [IAM-Konten-Löschregeln](./iam-account-deletion-rules-runbook.md)
- [IAM-Alerting-Konzept](./iam-alerting-konzept.md)
- [IAM Data Subject Rights](./iam-data-subject-rights-runbook.md)
- [IAM Retention-Automation](./iam-retention-automation.md)
- [Instanzverwaltung als Keycloak-Control-Plane](./instance-keycloak-provisioning.md)
- [Keycloak-Sonderrollen-Sync und Reconcile](./keycloak-rollen-sync-runbook.md)
- [Keycloak Service-Account Setup für IAM](./keycloak-service-account-setup-iam.md)
- [Keycloak-Tenant-Realm-Bootstrap](./keycloak-tenant-realm-bootstrap.md)
- [Public-Waste-Web-Release](./public-waste-web-release-runbook.md)
- [Docker-Swarm- und Planetary-Quantum-Infrastruktur](./swarm-deployment-guide.md)
- [Tenant-Admin-Client-Rollback (historisch)](./tenant-admin-client-swarm-rollback-runbook.md)
- [Tenant-Admin-Client-Cutover (historisch)](./tenant-admin-client-swarm-rollout-runbook.md)
- [Waste-Cutover auf die Tenant-Datenbank](./waste-postgresql-cutover.md)
- [Portainer-Ansatz ohne Monitoring (historisch)](./portainer-deployment-ohne-monitoring.md)

Der [kanonische Studio-Rollout](../guides/studio-rollout-process.md) behält dauerhaft seinen Pfad und seine alleinige normative Rolle. Die vollständige Alt-/Neu-Pfadzuordnung und die Konsolidierungsentscheidungen stehen im [Migrationsnachweis](../governance/dokumentationsmigration.md).

## Benachbarte Bereiche

[Dokumentationsübersicht](../README.md) · [Entwicklung](../development/README.md) · [Referenz](../reference/README.md) · [Governance](../governance/README.md) · [Architektur](../architecture/README.md)
