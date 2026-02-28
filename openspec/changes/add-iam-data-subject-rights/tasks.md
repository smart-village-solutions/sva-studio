# Tasks: add-iam-data-subject-rights

## 1. Datenexport (Art. 15 + Art. 20 DSGVO)

- [x] 1.1 API-Endpunkt `GET /iam/me/data-export` implementieren (JSON, CSV, XML)
- [x] 1.2 Vollständige Datenerfassung sicherstellen (Account, Orgs, Rollen, IAM-interne Einwilligungs-/Opt-out-Flags sofern vorhanden)
- [x] 1.3 Admin-Endpunkt für Auskunftsanfragen implementieren
- [x] 1.4 Export-Format-Tests (Vollständigkeit, Schema-Validierung)
- [x] 1.5 Asynchronen Export-Request mit Statusmodell (`queued|processing|completed|failed`) implementieren

## 2. Löschung (Art. 17 DSGVO)

- [x] 2.1 Soft-Delete-Mechanismus für Accounts implementieren
- [x] 2.2 Konfigurierbare Karenzzeit bis zur endgültigen Löschung
- [x] 2.3 Löschkaskaden für abhängige IAM-Daten implementieren
- [x] 2.4 Audit-Log-Pseudonymisierung bei Account-Löschung
- [x] 2.5 Legal-Hold-Prüfung vor Löschung implementieren
- [x] 2.6 Background-Job für fristgerechte endgültige Löschung
- [x] 2.7 Eskalation bei Fristüberschreitung implementieren
- [x] 2.8 48h-SLA-Messung (Antrag angenommen -> Soft-Delete) inklusive Alerting implementieren

## 3. Berichtigung (Art. 16 DSGVO)

- [x] 3.1 Self-Service-Profildaten-Korrektur implementieren
- [x] 3.2 Änderungshistorie mit Audit-Trail

## 4. Einschränkung + Mitteilungspflicht (Art. 18 + Art. 19 DSGVO)

- [x] 4.1 Verarbeitungsstatus für eingeschränkte Datensätze modellieren und durchsetzen
- [x] 4.2 Nicht zwingende Verarbeitungsprozesse bei aktiver Einschränkung blockieren
- [x] 4.3 Empfängerermittlung für Berichtigung/Löschung/Einschränkung implementieren
- [x] 4.4 Nachweis-Logging für erfolgte oder begründet entfallene Benachrichtigungen implementieren

## 5. Widerspruch (Art. 21 DSGVO)

- [x] 5.1 Opt-Out-Mechanismen für nicht-essenzielle Datenverarbeitung

## 6. Tests

- [x] 6.1 Integrationstests für vollständige Löschkaskaden
- [x] 6.2 Negativtests: Löschung bei aktivem Legal Hold
- [x] 6.3 Audit-Log-Pseudonymisierung nach Löschung verifizieren
- [x] 6.4 Export-Vollständigkeitstests (alle IAM-Daten enthalten)
- [x] 6.5 Fristüberschreitungs-Eskalationstests
- [x] 6.6 Tests für Art.-18-Restriktion (Verarbeitung blockiert)
- [x] 6.7 Tests für Art.-19-Nachweis (Benachrichtigungsstatus vollständig)
- [x] 6.8 SLA-Tests: Soft-Delete innerhalb von 48h nach gültigem Löschantrag
- [x] 6.9 Export-Status-Tests: asynchroner Flow (`queued|processing|completed|failed`)

## 7. Dokumentation

- [x] 7.1 `design.md` vorhanden und mit Löschkaskaden-/Pseudonymisierungs-/Legal-Hold-Flow gepflegt
- [x] 7.2 arc42-Referenzen ergänzen
- [x] 7.3 Betriebsdokumentation für Löschanfragen-Handling
- [x] 7.4 Backup-Retention + Restore-Sanitization-Prozess für DSR dokumentieren
