## 1. Restore-Vertrag und Agent

- [ ] 1.1 Effektiven Runtime-Principal für Staging und Production read-only bestätigen und als interne, nicht request-steuerbare Allowlist festlegen.
- [x] 1.2 Failing Integrationstest für einen Restore ohne IAM-ACLs ergänzen.
- [x] 1.3 Idempotente, statische ACL-Reconciliation für Datenbank, `iam`-Schema, vorhandene Tabellen, Sequenzen und `iam_app`-Mitgliedschaft implementieren.
- [x] 1.4 Datenbanknahe Principal-Probes und fail-closed Fehlerklassifikation implementieren.
- [x] 1.5 Restore-Evidenz um redigierte Reconciliation- und Probe-Ergebnisse erweitern.
- [ ] 1.6 Negativtests für fehlende Rollen, abweichende Zielkonfiguration, unzureichende Restore-Rechte und unvollständige ACLs ergänzen.

## 2. Workflow und Laufzeitprüfung

- [x] 2.1 `database-restore.yml` auf die Reihenfolge Restore-Reconciliation → Principal-Probe → App-Neustart → authentifizierter IAM-Smoke härten.
- [x] 2.2 Einen bestehenden sicheren Testzugang beziehungsweise Session-Probe-Vertrag für `/auth/me` und `/iam/me/permissions` wiederverwenden; keine Secrets oder PII protokollieren.
- [x] 2.3 Workflow-Contract-Tests und Restore-Evidenztests für den neuen Gate-Pfad ergänzen.
- [x] 2.4 Sicherstellen, dass jeder Fehler die App stillgelegt lässt und keinen automatischen Gegenrestore auslöst.

## 3. Dokumentation und Architektur

- [x] 3.1 ADR-048 um die restore-spezifische ACL-Reconciliation und deren Trust-Boundary ergänzen.
- [x] 3.2 `docs/guides/swarm-deployment-runbook.md` und `docs/guides/studio-rollout-process.md` aktualisieren.
- [x] 3.3 `docs/architecture/06-runtime-view.md`, `07-deployment-view.md`, `08-cross-cutting-concepts.md` und `09-architecture-decisions.md` aktualisieren.
- [x] 3.4 Prüfen und dokumentieren, dass keine Änderung am fachlichen DB-Schema-Snapshot erforderlich ist; bei abweichendem Befund `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` fortschreiben.

## 4. Verifikation und Rollout

- [x] 4.1 Betroffene Unit-, Type-, Server-Runtime-, File-Placement- und Workflow-Contract-Tests nach jedem Änderungsblock ausführen.
- [ ] 4.2 Staging-Restore-Drill mit ACL-losem Dump erfolgreich durchführen und Evidenz prüfen.
- [ ] 4.3 Agent-Deployment gemäß bestehendem geschütztem Betriebsvertrag durchführen.
- [ ] 4.4 Production-Recovery ausdrücklich freigeben, Rechtezustand reparieren und `/auth/me` sowie `/iam/me/permissions` verifizieren.
- [ ] 4.5 Vor PR-Freigabe den kleinsten relevanten Gate-Pfad und nach Möglichkeit `pnpm test:pr` ausführen.
