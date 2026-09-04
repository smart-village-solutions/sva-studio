## 1. Verträge und Regressionstests

- [x] 1.1 Den bestehenden Tenant-IAM-Statusvertrag um eindeutige Serviceidentität, Evidenzquelle und konservative Fehlerklassifikation ergänzen.
- [x] 1.2 Die aktuelle Falschmeldung als Regressionstest abbilden: vorhandener Login-Client, aber fehlende Sichtbarkeit darf nicht `AUTH_CLIENT_MISSING` ergeben.
- [x] 1.3 Tabellengetestete Regeln für `missing`, `forbidden`, `unknown`, `unavailable` und `misconfigured` ergänzen.
- [x] 1.4 Den exakten Keycloak-Rollensollvertrag für Tenant-IAM (`view-clients`, kein `manage-clients`) und Provisioner festlegen.

## 2. Serviceidentitäten und Probe-Pfade

- [x] 2.1 Struktur-, Access- und Reconcile-Probe in getrennte, typisierte Fachpfade überführen oder vorhandene Pfade entsprechend schärfen.
- [x] 2.2 Interaktive Instanzdetail- und Doctor-Pfade so verdrahten, dass Strukturevidenz vom Provisioner und Access-Evidenz von Tenant-IAM stammt.
- [x] 2.3 Stille Credential-Fallbacks zwischen Provisioner und Tenant-IAM entfernen und fehlende Konfiguration fail-closed melden.
- [x] 2.4 Ein leeres Keycloak-Client-Suchergebnis nur bei nachgewiesener Lesecapability als `missing` auswerten.
- [x] 2.5 Sicherstellen, dass sämtliche Probe-Pfade read-only bleiben und Reparaturen separat autorisiert werden.

## 3. Keycloak-Berechtigungen und Bestandsmigration

- [x] 3.1 `view-clients` in den Provisioning- und Reconcile-Sollvertrag des Tenant-IAM-Service-Accounts aufnehmen.
- [x] 3.2 Clientmutationen und Secret-Rotation ausschließlich auf den Provisioner-Pfad begrenzen.
- [ ] 3.3 Bestehende Tenant-IAM-Service-Accounts zunächst um `view-clients` ergänzen und den neuen Access-Probe-Vertrag nachweisen.
- [ ] 3.4 Erst nach erfolgreichem Staging-Nachweis `manage-clients` explizit aus Tenant-IAM-Service-Accounts entfernen.
- [ ] 3.5 Negativtests für Tenant-IAM-Clientmutationen und Positivtests für autorisierte Provisioner-Mutationen ergänzen.

## 4. Doctor, UI und MCP

- [x] 4.1 `configuration`, `access`, `reconcile` und `overall` mit konsistenter Evidenzprojektion an UI und MCP ausliefern.
- [x] 4.2 Lokalisierte, handlungsorientierte Meldungen ergänzen, die fehlendes Objekt, fehlendes Recht und fehlende Evidenz unterscheiden.
- [x] 4.3 Reparaturempfehlungen dem zuständigen Service zuordnen und keine automatische Mutation aus einer Gesundheitsprüfung auslösen.
- [x] 4.4 UI- und E2E-Tests für gemischte Achsenzustände, Tastaturbedienung und zugängliche Statusdarstellung ergänzen.

## 5. Dokumentation und Qualität

- [x] 5.1 Eine ADR zur Trennung von Provisioning-, Tenant-IAM- und Diagnoseevidenz erstellen und in `docs/architecture/09-architecture-decisions.md` verlinken.
- [x] 5.2 Die betroffenen arc42-Abschnitte 04, 05, 06, 07, 08, 10 und 11 an den umgesetzten Service- und Evidenzvertrag anpassen.
- [x] 5.3 `docs/architecture/keycloak-serviceidentitaeten-und-berechtigungen.md` gegen die tatsächliche Implementierung prüfen und präzisieren.
- [x] 5.4 Den kleinsten relevanten Nx-Testscope messen und ausführen; für Server-Packages zusätzlich `pnpm check:server-runtime` und vor dem initialen PR-Push bevorzugt `pnpm test:pr` ausführen.
- [x] 5.5 `openspec validate fix-tenant-iam-doctor-evidence --strict`, Dokumentations- und File-Placement-Checks ausführen.

## 6. Staging und Production

- [ ] 6.1 Rollenänderung, echte Probes, negative Clientmutation und getrennte Fehlerklassen auf Staging nachweisen.
- [ ] 6.2 Bei einem Gate-, Bootstrap-, Probe- oder Berechtigungsfehler den Rollout abbrechen und keine Production-Freigabe erteilen.
- [ ] 6.3 Regulären Build-once-Rollout mit identischem Image-Digest gemäß `docs/guides/studio-rollout-process.md` durchführen.
- [ ] 6.4 In Production mindestens einen realen Tenant prüfen und Evidenzquelle, Serviceidentität, Statusachsen und Live-Digest dokumentieren.
