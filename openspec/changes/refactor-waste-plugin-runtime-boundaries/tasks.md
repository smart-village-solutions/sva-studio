## 1. Baseline und Scope

- [x] 1.1 Code-Baseline aus `design.md` gegen den aktuellen Implementierungs-HEAD prüfen; direkte und transitive Imports, App-Operations, konkrete Settings-/History-Verbraucher und externe bekannte API-Verträge inventarisieren. Offene Waste-Fachchanges auf Überschneidung prüfen; fachfremde Änderungen nicht übernehmen.
- [x] 1.2 Bestehende HTTP-/Job-/Fixture-Tests und relevante DB-Nachweise als Verhalten-Baseline ausführen; 62 aktuelle Methodenbindungen und konkrete Sicherheits-/Datenverträge festhalten. Ziel, Nicht-Ziele und maximale Bereiche des ersten Lieferabschnitts dokumentieren.

## 2. Fachoperationen in bestehender Waste-Runtime

- [x] 2.1 App-Operationen für Migrationen, Import/Export, Seed/Reset, Sync, Reminder, Datenbankbereitstellung und Readiness mit direkt benötigten Helfern/Tests nach `waste-management-runtime` verschieben; verbleibende App-Bindung auf technische Dienste reduzieren. Alte Fachdateien im selben Abschnitt löschen.
- [x] 2.2 Unit-/Type-Gates nach jedem Block ausführen; verschobene DB-/Transaktions-/Idempotenzpfade mit echter PostgreSQL-Integration prüfen. Sync-/Mail-Transporte mit Testdoubles absichern, keine produktiven Nebenwirkungen.

## 3. Deklarative Job- und Servergrenze

- [x] 3.1 Waste-Job-Entry und Runtimeanforderung über vorhandenes Manifest/Loader/Snapshot binden; nur unmittelbar benötigte Start-/Download-/Abbruch-/Lane-Metadaten ergänzen, inklusive Validierung und sicherer Defaults. Host behält Privilegierungsentscheidung.
- [x] 3.2 Waste-ID-Sonderregistrierung, jobId-Policies und fachliche Start-/Downloadbranches aus allgemeinem Host entfernen; bisherige Sicherheitssemantik durch Positiv-/Negativ-Contracttests nachweisen.
- [x] 3.3 Server-Entry nutzt benötigte öffentliche Host-Fähigkeiten über bestehenden SDK-/Execution-Vertrag; direkte Auth-Imports und doppelte Kontextauflösung abbauen. Fachabhängige Zusatzrechte, CSRF, Tenantbindung, Audit und Fehlersemantik erhalten.
- [x] 3.4 Reale Server-/Job-Entry-Tests für Workspace und installiertes Paket; fehlendes Plugin, fehlende Bindung, doppelte/undeclarierte Handler und unzulässige Privilegierung fail-closed prüfen. Abschnitt nur bei grünen gezielten Tests, Typen und Server-Runtime-Gates abschließen.

## 4. Plattform-Fachkopplung und physische Optionalität

- [x] 4.1 Generisches Instanzdetail von Waste-Typen und Lade-/Speicherdependencies lösen; belegte Verbraucher koordiniert auf vorhandene Waste-Settings-Pfade umstellen. Unverbrauchte Legacy-Helper nach Export-/Verbraucherprüfung entfernen; externe inkompatible Verbraucher vor Cutover klären.
- [x] 4.2 Waste-Datenquellen-/Provisionierungsadapter und Audit-Interpretation in Waste-Runtime verschieben; vorhandene Tabellen, RLS, historische Daten, Secrets und Transaktionsgrenzen beibehalten. Allgemeine Host-Fassade von Waste-Fachmethoden bereinigen.
- [x] 4.3 Waste-Host-Ausnahmen aus bestehendem Architekturchecker entfernen; fachinterne Contracts/Runtime-Kanten erlauben und gezielte blockierende Regressionstests ergänzen. Transitive Host-Abhängigkeiten und Paketierung prüfen, nicht nur leere JSON-Allowlist.
- [x] 4.4 Bestehende Distributions-/Pruning-/Artefaktprüfungen so erweitern, dass das SSF-Artefakt ohne Waste-Contracts/Runtime startet und generische Instanz-/Jobpfade ausführt. Studio mit Waste, Public-Waste-Direktimporte und automatisierten Browser-Smoke prüfen; keine neue Distribution/Test-App.

## 5. Abschluss ohne manuelle Routinetests

- [ ] 5.1 A1–A9 am exakten finalen HEAD mit Tests/CI-/Artefaktevidenz belegen; KI erstellt kompakte Ergebnistabelle mit PASS/FAIL/BLOCKED und prüft Diff, entfernte Pfade, Security-/DB-Invarianten und Anti-Overengineering. Keine fehlenden Nachweise als erledigt markieren.
- [x] 5.2 Betroffene arc42-/Plugin-/Package-Dokumentation auf den tatsächlich implementierten Code nachziehen; historische Changes nicht als aktuellen Zustand umdeuten.
- [ ] 5.3 OpenSpec strikt validieren, File-Placement und relevante Pflicht-Gates prüfen; finale CI für denselben HEAD bis zum terminalen Ergebnis beobachten. Deployment und produktive manuelle Abnahme sind nicht Teil dieses Refactor-Abschlusses.
