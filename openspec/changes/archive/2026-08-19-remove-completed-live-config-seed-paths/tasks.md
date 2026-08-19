## 1. Aktive Seed-Pfade deaktivieren

- [x] 1.1 Seed-Modus- und Run-Referenz-Eingaben aus `workflow_dispatch` und `workflow_call` entfernen.
- [x] 1.2 Prepare-, Authorize-, Recheck-, Stop- und Seed-Deploy-Zweige aus dem aktiven Workflow entfernen.
- [x] 1.3 Standard- und Recovery-Pfade auf denselben regulären Phasen- und Gategraphen reduzieren.
- [x] 1.4 Evidence v2 für neue Promotes mit `seedPreparation: null` und `seedAuthorization: null` erzeugen.

## 2. Verträge und Dokumentation

- [x] 2.1 Workflow-Vertragstests auf Unerreichbarkeit der Seed-Implementierung und unveränderte reguläre Gates umstellen.
- [x] 2.2 Evidence- und Fail-closed-Verträge für null Seed-Felder und fehlende beziehungsweise ungültige Live-Config-Revision absichern.
- [x] 2.3 H4/H5 aus der kanonischen Bedienungsanleitung entfernen und die neue STOP-Grenze dokumentieren.
- [x] 2.4 Arc42 Deployment View und Cross-Cutting Concepts auf den nicht mehr erreichbaren Seed-Pfad aktualisieren.

## 3. Lokale Validierung und erster Rollout

- [x] 3.1 `tooling-testing:test:unit`, Skript-Typecheck, `tooling-testing:lint`, Complexity-, Placement-, Rollout-Docs-, Changelog- und OpenSpec-Gates ausführen.
- [x] 3.2 Vor dem initialen Code-Push `pnpm test:pr` erfolgreich ausführen.
- [x] 3.3 Finalen PR-Head, vollständige GitHub-Gates und null offene Review-Threads nachweisen.
- [x] 3.4 Merge und Build/Dev vollständig abwarten; denselben Digest mit `assert-none` erfolgreich nach Staging und Production promoten.
- [x] 3.5 Run-IDs, SHA, Digest, Config-Revision, Rollback-Paar und Health-Nachweise dokumentieren: PR #1092 (`08e5e6b6b29a86457d90960fb986bd9016bddf1d`) und das darauf aufbauende Runner-Hardening aus PR #1093 (`c0f054d693fc0957a13095cad8993113ffbf312d`) liefen über Build/Dev #32284542187, Staging #32285717884 und Production #32286734802. Production bestätigt Digest `sha256:27a688cd513a6066dd6532c3b82fc22e10defda3cf432d13757e656ec9da408f`, Config-Revision `a6349d63cc858bdc1713ffeb6c5bf4c886aac3ef2826ab4de0a6d0bfb3d6175e`, Rollback-Paar `sha256:b1e40b32b8135581cd381dca6a670b9a5cd6dc01ea62374b27b8e1d659ec23b8` plus dieselbe Config-Revision sowie `/health/live` und `/health/ready` jeweils HTTP 200.

## 4. Tote Implementierung entfernen

- [x] 4.1 Erst nach erfolgreichem Production-Nachweis Seed-Verifier, Parser, IO-Helfer, Overlays und Tests löschen.
- [x] 4.2 Seed-spezifische Gate-Namen, Autorisierungstypen, Fehlercodes und Controller-Kopien entfernen, Evidence v2 aber null-kompatibel halten.
- [x] 4.3 Aktive Architektur-, Risiko- und Entwicklerdokumentation bereinigen; Archive und historische Reports unverändert lassen.
- [x] 4.4 Vollständige lokale Gates und finalen PR-/Review-Nachweis erbringen: PR #1094 (`7765e45ac64aaed93c8d1d9f9fc41f36c001d027`) hatte vollständige grüne GitHub-Gates, null offene Review-Threads und wurde als `d2a460871c1f57986d8a3fa61ef71d4fb4008531` gemergt.
- [x] 4.5 Zweiten Build/Dev-, Staging- und Production-Nachweis mit demselben Digest und `assert-none` erbringen: Build und Dev #32296813462, Staging #32298029757 und Production #32298325921 bestätigten `d2a460871c1f57986d8a3fa61ef71d4fb4008531` und Digest `sha256:5beab0dfa5cd6c7c5a30c84e66511491b8add7bcc8324c15322e2c49498d51e2`. Production blieb bei Config-Revision `a6349d63cc858bdc1713ffeb6c5bf4c886aac3ef2826ab4de0a6d0bfb3d6175e`; das Rollback-Paar ist Digest `sha256:27a688cd513a6066dd6532c3b82fc22e10defda3cf432d13757e656ec9da408f` plus dieselbe Config-Revision. `/health/live` und `/health/ready` lieferten jeweils HTTP 200.

## 5. Abschluss

- [x] 5.1 Beide Production-Nachweise im Change dokumentieren und alle Tasks nur anhand tatsächlicher Live-Evidenz schließen: erster Nachweis Production #32286734802, zweiter Nachweis Production #32298325921.
- [x] 5.2 `remove-completed-live-config-seed-paths` in einem separaten reinen Dokumentations-PR archivieren.
