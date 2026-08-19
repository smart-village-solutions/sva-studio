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
- [ ] 3.3 Finalen PR-Head, vollständige GitHub-Gates und null offene Review-Threads nachweisen.
- [ ] 3.4 Merge und Build/Dev vollständig abwarten; denselben Digest mit `assert-none` erfolgreich nach Staging und Production promoten.
- [ ] 3.5 Run-IDs, SHA, Digest, Config-Revision, Rollback-Paar und Health-Nachweise dokumentieren.

## 4. Tote Implementierung entfernen

- [ ] 4.1 Erst nach erfolgreichem Production-Nachweis Seed-Verifier, Parser, IO-Helfer, Overlays und Tests löschen.
- [ ] 4.2 Seed-spezifische Gate-Namen, Autorisierungstypen, Fehlercodes und Controller-Kopien entfernen, Evidence v2 aber null-kompatibel halten.
- [ ] 4.3 Aktive Architektur-, Risiko- und Entwicklerdokumentation bereinigen; Archive und historische Reports unverändert lassen.
- [ ] 4.4 Vollständige lokale Gates und finalen PR-/Review-Nachweis erbringen.
- [ ] 4.5 Zweiten Build/Dev-, Staging- und Production-Nachweis mit demselben Digest und `assert-none` erbringen.

## 5. Abschluss

- [ ] 5.1 Beide Production-Nachweise im Change dokumentieren und alle Tasks nur anhand tatsächlicher Live-Evidenz schließen.
- [ ] 5.2 `remove-completed-live-config-seed-paths` in einem separaten reinen Dokumentations-PR archivieren.
