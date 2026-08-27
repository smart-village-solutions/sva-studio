## 1. Vertrag und Architektur

- [ ] 1.1 Normalisierung der E-Mail-Adresse sowie atomaren Mainserver-Rebind-, Ergebnisabfrage- und Credential-Replay-Vertrag fachlich und technisch festlegen.
- [ ] 1.2 ADR für den E-Mail-basierten administrativen Mainserver-Rebind erstellen und in arc42 Abschnitt 09 verlinken.
- [ ] 1.3 Arc42-Abschnitte 04, 05, 06 und 08 prüfen sowie die tatsächlich betroffenen Abschnitte 03, 05, 06 und 08 aktualisieren.
- [ ] 1.4 Inspect- und Execute-Verträge einschließlich Fehlercodes, Fresh Reauth und Idempotenz in `docs/api/iam-v1.yaml` dokumentieren.

## 2. Serverpfad

- [ ] 2.1 Read-only-Inspektion mit identischer E-Mail-Normalisierung und redigiertem Ergebnis implementieren.
- [ ] 2.2 Direkten Execute-Handler mit `iam.reconcileMainserverUserConflict`, tenantlokaler `system_admin`-Begrenzung, CSRF, Fresh Reauth und expliziter Bestätigung implementieren.
- [ ] 2.3 Bestehende Benutzer-/DataProvider-Sperre für konkurrierende Mutationen wiederverwenden.
- [ ] 2.4 Mainserver-Rebind-Client mit deterministischer Operationsreferenz, Idempotenz, Timeout-, Ergebnisabfrage- und Credential-Replay-Behandlung implementieren.
- [ ] 2.5 Neue Keycloak-Credentials persistieren und die bestehende DataProvider-Bindung verifizieren.
- [ ] 2.6 Teilfehler über bestehende Provisioning-/Binding-Zustände als `reconciliation_required` behandeln; keine neue Reconciliation-Tabelle anlegen.

## 3. UI und Audit

- [ ] 3.1 Benutzer-Detailseite um redigierten Konfliktbefund, direkte Reconcile-Aktion und verständliche Ergebnisdarstellung ergänzen.
- [ ] 3.2 Bestätigungsdialog mit Wirkung, E-Mail-Zuordnung und Fresh-Reauth-Anforderung implementieren.
- [ ] 3.3 Übersetzungen und barrierefreie Lade-, Erfolgs- und Fehlerkommunikation ergänzen.
- [ ] 3.4 Bestehendes IAM-Audit für Prüfung, Ausführung und Ergebnis verwenden und Secrets, Tokens, vollständige E-Mail-Adressen sowie Upstream-Rohantworten ausschließen.
- [ ] 3.5 IAM-Runbook um Voraussetzungen, Wiederholung nach Timeout und Behandlung von `reconciliation_required` ergänzen.

## 4. Tests und Nachweis

- [ ] 4.1 Unit-Tests für E-Mail-Normalisierung, Gleichheit, Abweichung, Autorisierung, Fresh Reauth und Redaction ergänzen.
- [ ] 4.2 Contract-Tests für atomaren Rebind, Idempotenz, Ergebnisabfrage, Credential-Replay und Timeout ergänzen.
- [ ] 4.3 Integrationstests für Sperre, Keycloak-Persistenz, DataProvider-Verifikation und sichere Wiederholung nach lokalem Teilfehler ergänzen.
- [ ] 4.4 UI-/E2E-Tests für erfolgreiche Reconciliation, abweichende E-Mail, fehlende Fresh Reauth, barrierefreie Statuskommunikation und nachfolgenden Projektzugriff ergänzen.
- [ ] 4.5 `pnpm check:server-runtime`, relevante Nx-Targets, `pnpm test:pr`, OpenSpec-Strict, Placement-, Changelog- und Diff-Gates ausführen.
