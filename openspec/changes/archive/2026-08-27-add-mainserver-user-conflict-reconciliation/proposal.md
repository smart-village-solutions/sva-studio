# Change: Mainserver-Identitätskonflikte operativ auflösen

## Why

Die persönliche Mainserver-Provisionierung beendet einen Konflikt, bei dem eine E-Mail-Adresse im Mainserver bereits mit einem anderen Keycloak-Subject existiert, korrekt fail-closed mit `local_user_conflict`. Wiederholte Reprovisionierung löst diesen Konflikt nicht. Eine vollautomatische Auflösung im Studio würde jedoch einen neuen, sicherheitskritischen Mainserver-Vertrag erfordern und steht für die seltene operative Ausnahme nicht in einem angemessenen Verhältnis zum Nutzen.

## What Changes

- Studio erklärt `mainserver_user_conflict` ausdrücklich als nicht durch Wiederholung lösbaren Identitätskonflikt und verweist mit der bereits angezeigten Request-ID an den Mainserver-Betrieb.
- Die normalisierte E-Mail-Adresse ist für die kontrollierte operative Zuordnung das ausreichende fachliche Identifikationsmerkmal.
- Das Mainserver-Runbook beschreibt Prüfung, begrenzte Korrektur und Nachweis. Es unterscheidet veraltete Keycloak-Verknüpfungen vom Fall eines noch existierenden historischen Accounts.
- Nach der operativen Korrektur verwendet der Administrator die bestehende Reprovisionierung, um persönliche Credentials erneut serverseitig in Keycloak zu speichern.
- Der vorhandene Mainserver-Code und seine API bleiben unverändert.

## Non-Goals

- Keine neue Mainserver-API, kein Rebind-Service und keine Mainserver-Codeänderung.
- Keine automatische oder durch Studio ausgeführte Identitätsverknüpfung.
- Keine neue Studio-Action, kein Fresh-Reauth-Dialog, keine zweite Freigabe und kein Reconciliation-Ledger.
- Kein allgemeiner Account-Merge, keine Bulk-Reconciliation aus dem Studio und keine Content-Ownership-Umschreibung.
- Kein direkter Mainserver-Datenbankzugriff aus dem Studio.

## Product Decision

Die normalisierte E-Mail-Adresse ist für diesen begrenzten operativen Konfliktfall das maßgebliche und ausreichende Identifikationsmerkmal. Die Auflösung bleibt eine kontrollierte Tätigkeit des Mainserver-Betriebs. Studio bleibt fail-closed und führt selbst keinen Rebind aus.

## Impact

- Affected specs: `account-ui`, `sva-mainserver-integration`
- Affected code: Übersetzungsressourcen der Benutzerverwaltung in `apps/sva-studio-react`
- Affected docs: `docs/development/runbook-sva-mainserver.md`
- Architecture: keine neue Schnittstelle, Persistenz oder Systemverantwortung; die bestehende Grenze zwischen Studio und Mainserver bleibt unverändert
