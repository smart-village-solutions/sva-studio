# Production-IAM-Restore vom 1. August 2026

## Ergebnis

Die Production-Datenbank wurde erfolgreich aus dem ausgewählten Dump wiederhergestellt und die fehlenden Runtime-ACLs wurden repariert. Nach dem abschließenden Recovery-Promote war `bb-prignitz.studio.smart-village.app` wieder erreichbar. Eine angemeldete Sitzung bestätigte anschließend:

- `permissionStatus: ok`
- fachliche Rollen und Gruppen geladen
- `permissionActions` nicht leer
- zugewiesene Module geladen

Keycloak wurde nicht zurückgesetzt oder wiederhergestellt.

## Ausgangslage und Ursache

Nach einem vorherigen Restore lieferte `/auth/me` für `bb-prignitz` einen degradierten Berechtigungszustand mit leeren effektiven Rollen und Aktionen. Der verwendete PostgreSQL-Custom-Dump enthielt Schema und Daten, aber keine ACL- beziehungsweise Default-ACL-Einträge für den Runtime-Principal. Dadurch fehlte der laufenden Anwendung insbesondere der Zugriff auf das Schema `iam`.

Die nachhaltige Reparatur wurde in PR [#884](https://github.com/smart-village-solutions/sva-studio/pull/884) umgesetzt: Der Backup-Agent rekonstruiert nach `pg_restore` die fest allowlisteten Rechte für `sva_app` und `iam_app` und prüft sie datenbanknah. PR [#885](https://github.com/smart-village-solutions/sva-studio/pull/885) korrigierte den authentifizierten Permission-Smoke und entkoppelte Staging- und Production-Restores vollständig voneinander.

## Verwendetes Restore-Artefakt

- Zielumgebung: `prod`
- Objekt: `prod/2026-07-30T22-20-55-899Z/753275384b5943c19a5e78eab1ff33adb6ad02c6f0412e43c04ecf726a170f0f/gha-30586702874-1.dump`
- SHA-256: `f4d61a20057aa949a70ed12ed354cf5bb3c068b8904d8bb3e2256c669cf89007`
- Wartungsfensterreferenz: `incident-bb-prignitz-iam-acl-repair-2026-08-01`
- Gebundenes Production-Image: `ghcr.io/smart-village-solutions/sva-studio@sha256:cef8afab475f8eb6e9b0b24b1229b7b80e2e7c09e6d9ef7eeb629866f2142312`
- OCI-Revision des Images: `9f17413bdef95339b68de32d45baa3e719ef7d2b`

## Erfolgreiche Reihenfolge

1. Der aktualisierte Backup-Agent wurde ausgerollt und seine Restore-Verträge wurden geprüft.
2. Die GitHub-Environments erhielten getrennte, nicht protokollierte Zugangsdaten für den authentifizierten Restore-Smoke.
3. Die expliziten Tenant-Ingress-Hosts wurden auf Staging validiert. Diese Staging-Arbeit war für die Ingress-Fehleranalyse hilfreich, ist seit PR #885 aber keine Voraussetzung für einen Production-Restore.
4. **Controlled Database Restore** wurde ausschließlich für `prod` mit exaktem Objekt, SHA-256, Wartungsfenster, Live-Image und OCI-Revision gestartet: [Run 30720498548](https://github.com/smart-village-solutions/sva-studio/actions/runs/30720498548).
5. Im Run waren Stilllegung, Sicherheitsdump, `pg_restore`, Migration, Runtime-Principal-Reconciliation, Principal-Probe, Bootstrap und App-Neustart erfolgreich.
6. Der allgemeine Runtime-Smoke scheiterte erst am zusätzlich erwarteten Host `bb-ahrensfelde.studio.smart-village.app`, weil das gebundene ältere Production-Image diesen neuen expliziten Host noch nicht enthielt. Der Workflow stellte Production daraufhin korrekt fail-closed wieder ab. Der authentifizierte IAM-Smoke wurde deshalb in diesem Run nicht mehr ausgeführt.
7. Ein **Promote** desselben unveränderten Production-Images mit `migration_mode=assert-none`, `bootstrap_mode=assert-none` und derselben Wartungsfensterreferenz startete Production ohne erneute Datenbankmutation: [Run 30720914988](https://github.com/smart-village-solutions/sva-studio/actions/runs/30720914988).
8. Der Recovery-Promote, Runtime-Verifikation und Digest-Abgleich waren erfolgreich. `health/live`, `health/ready` und der Login-Pfad von `bb-prignitz` antworteten anschließend mit HTTP 200.
9. Die abschließende manuelle Sitzung bestätigte `permissionStatus: ok` und eine nicht leere Menge vollständig qualifizierter `permissionActions`.

## Fehlversuche und ihre Bedeutung

- Frühere Staging-Restore-Läufe scheiterten an fehlendem Routing eines Tenant-Hosts. Das war ein Ingress- und kein Datenbankfehler.
- Ein Production-Restore vor PR #885 wurde vor jeder Mutation durch die damals obligatorische Staging-Evidenz blockiert. Production blieb dabei unverändert.
- Der erfolgreiche Production-Restore-Run wurde erst nach allen Datenbankarbeiten durch einen Image-/Smoke-Versatz rot. Die erfolgreiche ACL-Reconciliation durfte deshalb nicht durch einen unnötigen zweiten Restore ersetzt werden.
- Ein erster Recovery-Promote ohne `maintenance_window` scheiterte vor dem Deployment. Der erfolgreiche Wiederholungslauf verwendete die revisionsfähige Incident-Referenz.
- Der lokal konfigurierte automatische IAM-Smoke konnte den vorhandenen Testzugang nicht erfolgreich durch Keycloak anmelden. Die bestehende menschliche Sitzung erbrachte den abschließenden Nachweis; Zugangsdaten wurden weder protokolliert noch in diese Dokumentation übernommen.

## Wiederholung und Abbruchkriterien

Der normative Ablauf steht im Abschnitt [Wiederholbarer Restore-Ablauf für fehlende Runtime-ACLs](../guides/swarm-deployment-runbook.md#wiederholbarer-restore-ablauf-für-fehlende-runtime-acls).

Vor jeder Wiederholung müssen Dump, SHA-256, Zielumgebung, Live-Digest und OCI-Revision erneut bestimmt werden. Werte aus diesem Bericht dürfen nur wiederverwendet werden, wenn sie weiterhin exakt dem beabsichtigten Restore entsprechen.

Ein neuer Restore ist nicht die Standardreaktion, wenn bereits `pg_restore`, Migration und Principal-Reconciliation grün waren. In diesem Zustand zuerst die nachgelagerte Fehlerklasse untersuchen und Production gegebenenfalls mit demselben Digest und ohne One-shot-Mutationen wieder hochfahren.
