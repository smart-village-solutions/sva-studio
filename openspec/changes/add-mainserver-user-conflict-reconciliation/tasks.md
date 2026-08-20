## 1. Vertrag und Architektur

- [ ] 1.1 Vier-Augen-Policy und Mainserver-Rebind-/Widerrufsvertrag fachlich freigeben.
- [ ] 1.2 ADR für die kontrollierte Übernahme historischer Mainserver-Identitäten erstellen und in arc42 Abschnitt 09 verlinken.
- [ ] 1.3 arc42 Abschnitte 04, 05, 06, 08 und 11 für die neue Trust Boundary aktualisieren.
- [ ] 1.4 OpenSpec-Deltas und Design nach finaler Produktentscheidung aktualisieren und strikt validieren.

## 2. Persistenz und Serververtrag

- [ ] 2.1 Tenantlokales Reconciliation-Ledger mit Zuständen, Operationsreferenz, Antrag/Bestätigung, redigierten Diagnosen und RLS modellieren.
- [ ] 2.2 Aktiven Vorgang pro Instanz und Zielaccount per Unique-Constraint und transaktionaler Sperre begrenzen.
- [ ] 2.3 Migration, Down-Migration, `studio-db-schema-final.sql` und Schema-Dokumentation ergänzen.
- [ ] 2.4 Read-only-Inspektionsvertrag mit redigierten Ergebnissen implementieren.
- [ ] 2.5 Request-, Approval- und Execute-Handler mit tenantlokaler `system_admin`-Autorisierung und getrennten Antragsteller-/Bestätigeridentitäten implementieren.
- [ ] 2.6 Dedizierten Mainserver-Rebind-Client mit Idempotency-Key, Timeout-, Fehler- und Outcome-Unknown-Behandlung implementieren.
- [ ] 2.7 Neue Keycloak-Credentials persistieren, DataProvider-Bindung verifizieren und Credential-Widerruf nur nach bestätigtem Upstream-Vertrag ausführen.
- [ ] 2.8 Fehlerzustände sicher auf `reconciliation_required` finalisieren; keine direkte SQL- oder Löschkompensation implementieren.

## 3. UI und Audit

- [ ] 3.1 Benutzer-Detailseite um Konfliktstatus, Prüfung, Antrag, Bestätigung und Ergebnisdarstellung ergänzen.
- [ ] 3.2 Bestätigungsdialog mit Wirkung, Begründung, Operationsreferenz und Vier-Augen-Information implementieren.
- [ ] 3.3 Übersetzungen für alle sichtbaren Zustände und Fehler ergänzen.
- [ ] 3.4 Audit-Ereignisse für Prüfung, Antrag, Bestätigung, Durchführung, Verifikation und Nacharbeitsfall ergänzen.
- [ ] 3.5 Sicherstellen, dass UI, Audit, Logs und API keine Secrets, Tokens, vollständigen E-Mails oder Upstream-Rohantworten enthalten.

## 4. Tests und Nachweis

- [ ] 4.1 Unit-Tests für Statusmaschine, Idempotenz, Redaction, Same-Tenant-Prüfung und unterschiedliche Freigabe-Accounts ergänzen.
- [ ] 4.2 Repository-/Integrationstests für Ledger-Sperre, RLS und aktive Vorgänge ergänzen.
- [ ] 4.3 Contract-Tests für Mainserver-Rebind, Credential-Ausstellung, Widerruf, Timeout und unklare Upstream-Ergebnisse ergänzen.
- [ ] 4.4 Auth-Runtime-/IAM-Admin-Tests für Berechtigung, abgelehnte Selbstbestätigung und `reconciliation_required` ergänzen.
- [ ] 4.5 E2E-Test für erfolgreiche Reconciliation und nachfolgenden Projektzugriff ergänzen.
- [ ] 4.6 `pnpm check:server-runtime`, relevante Nx-Targets, `pnpm test:pr`, OpenSpec-Strict, Placement-, Changelog- und Diff-Gates ausführen.
