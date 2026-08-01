## Context

Der zentrale Backup-Agent führt kontrollierte Vollrestores für Staging und Production aus. PostgreSQL-Custom-Dumps sichern Datenbankobjekte und Daten, garantieren aber nicht, dass clusterweite Rollen, Role-Memberships und notwendige Runtime-ACLs im Zielcluster wirksam sind. Der untersuchte Production-Dump enthält keine ACL- oder Default-ACL-Einträge; das Schema `iam` und seine Objekte gehören `sva`. Nach dem Restore griff die Anwendung als nicht privilegierter Runtime-Principal auf `iam` zu und erhielt `permission denied for schema iam`.

Der vorhandene Workflow führt nach dem Restore einen separaten Bootstrap-One-shot-Job aus. Dessen erfolgreicher Task-Exit und die anschließenden allgemeinen Health-Prüfungen bewiesen jedoch nicht, dass der tatsächlich konfigurierte Runtime-Principal auf IAM-Tabellen zugreifen konnte.

## Goals / Non-Goals

### Goals

- Ein Restore darf nur dann als erfolgreich gelten, wenn der fest konfigurierte Runtime-Principal die erforderlichen IAM-Rechte tatsächlich besitzt.
- ACLs werden nach jedem Restore deterministisch und idempotent rekonstruiert, unabhängig davon, ob der Dump ACLs enthält.
- Die Prüfung bleibt innerhalb des bestehenden gehärteten Restore-Deployments und erzeugt persistente, redigierte Evidenz.
- Der reale Anwendungspfad wird nach dem Neustart zusätzlich geprüft.

### Non-Goals

- Keine allgemeine Remote-Shell, frei formulierbare SQL-Schnittstelle oder frei wählbare Datenbankziele.
- Keine Übergabe von Principal-Namen, Rollen, Grants oder SQL über den Restore-Request.
- Keine Speicherung oder Ausgabe von App-Passwörtern beziehungsweise vollständigen Datenbank-URLs.
- Kein erneuter Restore und keine fachliche Änderung der IAM-Rollen oder Benutzerzuordnungen.

## Decisions

### Decision: Der Restore-Agent ist für restore-spezifische ACL-Konvergenz verantwortlich

Nach erfolgreichem `pg_restore` und vor der terminalen Erfolgsevidenz validiert der Agent die Existenz des fest allowlisteten Runtime-Principals und der Rolle `iam_app`. Im bestehenden, fest konfigurierten Schema-Owner-Kontext führt er ausschließlich statisch definierte Grants für Datenbankzugriff, `iam`-Schema, vorhandene IAM-Tabellen und vorhandene IAM-Sequenzen aus.

Die Reconciliation ist idempotent. Fehlende Rollen, abweichende Zielidentität oder unzureichende Restore-Privilegien führen zu einem terminalen Fehler; der Agent erzeugt keine Rollen dynamisch und erweitert keine Request-Oberfläche.

### Decision: Direkte Objekt-Grants bleiben erforderlich

Der Runtime-Principal kann `NOINHERIT` verwenden. Eine Mitgliedschaft in `iam_app` ist deshalb kein ausreichender Nachweis. Der Agent setzt und prüft zusätzlich direkte Schema-, Tabellen- und Sequenzrechte für den fest konfigurierten Runtime-Principal.

### Decision: Datenbankprobe und Anwendungssmoke sind getrennte Gates

Der Agent prüft mit PostgreSQL-Prädikaten mindestens:

- Runtime-Principal und Zielrollen existieren,
- `CONNECT` auf die feste Zieldatenbank,
- `USAGE` auf `iam`,
- erwartete Mitgliedschaft in `iam_app`,
- repräsentative `SELECT`-Rechte auf `iam.instances`, `iam.permissions` und `iam.accounts`,
- benötigte Sequenzrechte.

Danach führt er repräsentative read-only Abfragen im Zielkontext aus. Nach dem App-Neustart verlangt der Workflow zusätzlich einen authentifizierten IAM-Smoke, der für den Testbenutzer einen nicht degradierten Berechtigungszustand und einen erfolgreichen Permissions-Endpunkt nachweist.

### Decision: Restore-Freigaben sind umgebungsautark

Staging und Production verwenden denselben gehärteten Workflowvertrag, werden aber ausschließlich durch das GitHub Environment, die Secrets, Buckets, Präfixe, Datenbankziele und Nachprüfungen ihrer jeweiligen Zielumgebung autorisiert. Ein erfolgreicher Lauf oder ein Evidenzartefakt aus der anderen Umgebung ist keine Voraussetzung. Damit können environment-spezifische Ingress-, Daten- oder Zugangszustände keinen Restore einer anderen Umgebung blockieren.

### Decision: Der allgemeine Bootstrap bleibt getrennt

Der bestehende Bootstrap behält seine Verantwortung für normale Deployments und weitere Umgebungsreconciliation. Restore-spezifische ACL-Konvergenz ist jedoch Bestandteil des atomaren Restore-Erfolgsvertrags und darf nicht allein von einem späteren Bootstrap abhängen.

## Alternatives considered

- **Nur validieren:** sicher, lässt den bereits bekannten, deterministisch reparierbaren ACL-Zustand aber als manuellen Incident zurück und erhöht die Wiederherstellungszeit.
- **Nur den nachgelagerten Bootstrap verwenden:** geringere Änderung am Agenten, konnte den fehlerhaften Production-Zustand jedoch nicht verhindern und erzeugte keine belastbare Principal-Evidenz.
- **App-Zugangsdaten an den Agenten geben:** ermöglicht eine echte Passwortanmeldung, vergrößert aber Secret-Scope und Blast Radius ohne Notwendigkeit. Der reale App-Pfad wird stattdessen nach dem Neustart separat geprüft.
- **Production weiterhin an eine Staging-Restore-Evidenz koppeln:** liefert einen zusätzlichen fremden Nachweis, blockiert aber durch environment-spezifische Fehler und beweist den Zustand der Production-Zielumgebung nicht. Die vollständigen Production-Gates sind der maßgebliche Nachweis.

## Security and failure handling

- Request-Version und bestehende OIDC-/HMAC-Prüfungen bleiben unverändert eng.
- Umgebung, Datenbank, Owner-Rolle, Runtime-Principal und Grants stammen ausschließlich aus interner Konfiguration.
- Evidenz enthält nur Rollennamen, boolesche Prüfergebnisse, Fehlerklassen und Zeitpunkte; keine URLs, Passwörter, SQL-Ergebnisse oder Datenbankinhalte.
- Jeder Fehler nach Beginn der Mutation markiert den Restore als fehlgeschlagen und hält die App stillgelegt.
- Der Agent führt keine automatische Wiederholung und keinen Gegenrestore aus.

## Test strategy

- Contract-Tests lehnen zusätzliche Request-Felder für Principal, Rolle oder SQL weiterhin ab.
- Unit-Tests prüfen die statische Allowlist, idempotente Grant-Erzeugung, Redaction und Fehlerklassifikation.
- PostgreSQL-Integrationstests stellen einen ACL-losen Dumpzustand nach und beweisen zuerst den fehlenden Zugriff, danach erfolgreiche Reconciliation und read-only Probes.
- Negativtests decken fehlende Rollen, falsche Datenbank, unzureichende Owner-Rechte und unvollständige Grants ab.
- Workflow-Contract-Tests erzwingen die Reihenfolge Restore → ACL-Reconciliation → Principal-Probe → App-Neustart → authentifizierter IAM-Smoke → Erfolgsevidenz.

## Documentation

ADR-048 wird um die eng begrenzte ACL-Reconciliation ergänzt. Laufzeit-, Deployment- und Security-Sichten beschreiben die neue Restore-Phasengrenze und die getrennten Datenbank-/Anwendungsgates. Das Betriebsrunbook dokumentiert Diagnose, Evidenz und fail-closed Verhalten, ohne einen zweiten kanonischen Rolloutpfad einzuführen.

## Migration Plan

1. Reconciliation und Datenbankprobe im Agenten implementieren und lokal gegen einen ACL-losen Restore testen.
2. Staging-Restore-Drill mit einem verifizierten Dump durchführen.
3. Nachweise für Grants, Principal-Probe und authentifizierten IAM-Smoke prüfen.
4. Agent-Deployment mit unveränderter enger Request-Oberfläche nach Production befördern.
5. Den bestehenden Production-Incident über einen ausdrücklich freigegebenen Recovery-Lauf beheben und anschließend `/auth/me` sowie `/iam/me/permissions` verifizieren.

Rollback des Agent-Codes erfolgt über den vorherigen Image-Digest. Bereits gesetzte additive Grants werden nicht automatisch entfernt, weil ihre Entfernung den Runtime-Zugriff erneut unterbrechen würde.

## Open Questions

- Der effektive Production-Runtime-Principal muss vor Implementierung aus der laufenden Konfiguration beziehungsweise `pg_stat_activity` bestätigt werden; `sva_app` ist derzeit die erwartete, aber noch zu belegende Identität.
- Der authentifizierte Restore-Smoke benötigt einen bestehenden, nicht-personenbezogen protokollierten Testzugang oder einen vorhandenen sicheren Session-Probe-Vertrag.
