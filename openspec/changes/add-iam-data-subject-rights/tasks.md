# Tasks: add-iam-data-subject-rights

## 1. Datenexport (Art. 15 + Art. 20 DSGVO)

- [ ] 1.1 API-Endpunkt `GET /iam/me/data-export` implementieren (JSON, CSV, XML)
- [ ] 1.2 Vollständige Datenerfassung sicherstellen (Account, Orgs, Rollen, Einwilligungen)
- [ ] 1.3 Admin-Endpunkt für Auskunftsanfragen implementieren
- [ ] 1.4 Export-Format-Tests (Vollständigkeit, Schema-Validierung)

## 2. Löschung (Art. 17 DSGVO)

- [ ] 2.1 Soft-Delete-Mechanismus für Accounts implementieren
- [ ] 2.2 Konfigurierbare Karenzzeit bis zur endgültigen Löschung
- [ ] 2.3 Löschkaskaden für abhängige IAM-Daten implementieren
- [ ] 2.4 Audit-Log-Pseudonymisierung bei Account-Löschung
- [ ] 2.5 Legal-Hold-Prüfung vor Löschung implementieren
- [ ] 2.6 Background-Job für fristgerechte endgültige Löschung
- [ ] 2.7 Eskalation bei Fristüberschreitung implementieren

## 3. Berichtigung (Art. 16 DSGVO)

- [ ] 3.1 Self-Service-Profildaten-Korrektur implementieren
- [ ] 3.2 Änderungshistorie mit Audit-Trail

## 4. Einschränkung + Mitteilungspflicht (Art. 18 + Art. 19 DSGVO)

- [ ] 4.1 Verarbeitungsstatus für eingeschränkte Datensätze modellieren und durchsetzen
- [ ] 4.2 Nicht zwingende Verarbeitungsprozesse bei aktiver Einschränkung blockieren
- [ ] 4.3 Empfängerermittlung für Berichtigung/Löschung/Einschränkung implementieren
- [ ] 4.4 Nachweis-Logging für erfolgte oder begründet entfallene Benachrichtigungen implementieren

## 5. Widerspruch (Art. 21 DSGVO)

- [ ] 5.1 Opt-Out-Mechanismen für nicht-essenzielle Datenverarbeitung

## 6. Tests

- [ ] 6.1 Integrationstests für vollständige Löschkaskaden
- [ ] 6.2 Negativtests: Löschung bei aktivem Legal Hold
- [ ] 6.3 Audit-Log-Pseudonymisierung nach Löschung verifizieren
- [ ] 6.4 Export-Vollständigkeitstests (alle IAM-Daten enthalten)
- [ ] 6.5 Fristüberschreitungs-Eskalationstests
- [ ] 6.6 Tests für Art.-18-Restriktion (Verarbeitung blockiert)
- [ ] 6.7 Tests für Art.-19-Nachweis (Benachrichtigungsstatus vollständig)

## 7. Dokumentation

- [x] 7.1 `design.md` vorhanden und mit Löschkaskaden-/Pseudonymisierungs-/Legal-Hold-Flow gepflegt
- [ ] 7.2 arc42-Referenzen ergänzen
- [ ] 7.3 Betriebsdokumentation für Löschanfragen-Handling
