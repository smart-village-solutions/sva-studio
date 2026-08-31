## 1. Verträge

- [x] 1.1 Lifecycle-Capabilities und namespaced Operationen im Plugin-SDK definieren
- [x] 1.2 Gemeinsamen Readiness-, Fehler- und Retry-Vertrag festlegen
- [x] 1.3 Generation-, Claim- und Idempotenzmodell dokumentieren

## 2. Host-Orchestrierung

- [x] 2.1 Lifecycle-Beiträge in den hostvalidierten Plugin-Snapshot aufnehmen
- [x] 2.2 Provision, Reconcile, Suspend und Reactivate über Plugin-Operations verdrahten
- [x] 2.3 Atomaren Claim und Schutz gegen veraltete Jobabschlüsse implementieren
- [x] 2.4 Aktivierungsstatus, Jobstatus und Plugin-Readiness korrelieren
- [x] 2.5 Audit-, Logging-, Progress- und Cancellation-Verträge integrieren

## 3. Instanzverwaltung

- [x] 3.1 Generisches Plugin-Readiness-Read-Modell pro Instanz bereitstellen
- [x] 3.2 Instanz-Cockpit um Pluginstatus und Reparaturaktionen erweitern
- [x] 3.3 Fail-closed Fachzugriff bei blockierter Pflicht-Readiness umsetzen
- [x] 3.4 Accessibility-, i18n- und Deep-Link-Tests der generischen Anzeige ergänzen

## 4. Bestehenden Verbraucher migrieren

- [x] 4.1 Waste-Provisionierungsjob über einen Lifecycle-Adapter registrieren
- [x] 4.2 Waste-Datenbanktopologie und Fachmigrationen unverändert plugin-owned lassen
- [x] 4.3 Regressionstests für Claim, Reconcile, Readiness und Fehlerzustände ergänzen

## 5. Dokumentation und Abnahme

- [x] 5.1 Studio-Schema-Snapshot und Schema-Dokumentation bei Persistenzänderungen aktualisieren
- [x] 5.2 Betroffene arc42-Abschnitte und Lifecycle-ADR aktualisieren
- [ ] 5.3 Unit-, Type-, Server-Runtime-, Integrations-, Migrations- und E2E-Gates ausführen
- [x] 5.4 `openspec validate add-plugin-tenant-lifecycle --strict`, Dokumentations- und Platzierungschecks ausführen
- [x] 5.5 Zustands-, Boundary-, Crash- und Evidenzmatrizen im System-Assurance-Vertrag festlegen
- [x] 5.6 System-Assurance-Vertrag menschlich freigeben; Folgepläne 038 bis 041 bis dahin nicht beginnen
