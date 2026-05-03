## 1. Specification and Contract Alignment

- [x] 1.1 Deltas fuer instanzbezogene Modulzuweisung, Zuweisungs-/Entzugssemantik und IAM-Baseline-Seeding vervollstaendigen
- [x] 1.2 Konflikt zum bestehenden Instanz-Detailseiten-Vertrag aufloesen und den Reparaturpfad fuer `IAM-Basis zugewiesener Module` als kompatible Bestands- oder explizite neue Studio-Admin-Aktion spezifizieren
- [x] 1.3 Berechtigungsvertrag fuer `instance-registry.assignModule`, `instance-registry.revokeModule` und `instance-registry.seedIamBaseline` als fully-qualified Actions mit Bindung an `studio.admin`-Rolle und `instanceId`-Scope spezifizieren; Confirmation-Anforderung fuer Entzug serverseitig absichern
- [x] 1.4 Betroffene Capability-Deltas fuer Routing, `plugin-actions` sowie fachliche Host-/Integrationspfade (`content-management` und/oder `sva-mainserver-integration`) ergaenzen, damit fail-closed-Gating normativ vollstaendig ist
- [x] 1.5 Rollout-, Bestandsinstanz- und Seed-Vertrag fuer initial leere Modulsaetze, lokale Fixtures und Testinstanzen spezifizieren
- [x] 1.6 `openspec validate add-instance-module-activation --strict` ausfuehren

## 2. Canonical Module Contract and Persistence

- [x] 2.1 Persistente Instanz-Modul-Zuordnung in Datenmodell, Repository und oeffentlichen Lesevertraegen einfuehren
- [x] 2.2 Default-Verhalten fuer Bestandsinstanzen ohne Modulzuordnung fail-closed umsetzen, ohne implizite Aktivierung aus Registry, `featureFlags` oder Integrationsdaten
- [x] 2.3 Lokale Seeds, Fixtures und Testdaten fuer zugewiesene, leere und negativ geblockte Instanz-Modul-Saetze anpassen
- [x] 2.4 Auditierbare Mutations- und Lesekontexte fuer Instanz-Modul-Aenderungen mit `instanceId`, Actor (`studio.admin`), Ergebnis und Korrelation ergaenzen; normativen Audit-Event-Feldkatalog aus der Spec implementieren

## 3. Assignment, Revocation and IAM Baseline

- [x] 3.1 Service-Operationen fuer `assignModule`, `revokeModule` und `seedIamBaseline` mit klaren Ein-/Ausgabe- und Fehlervertraegen implementieren; Zugriff auf `studio.admin`-Rolle beschraenken
- [x] 3.2 Soll-Ist-Ableitung fuer `Core + zugewiesene Module` und idempotentes IAM-Baseline-Seeding implementieren; kanonischen `plugin-sdk`-Vertrag fuer modulbezogene IAM-Artefakte auswerten und sicherstellen, dass IAM-Seeding keine Rollenmitgliedschaften des aufrufenden Actors veraendert
- [x] 3.3 Harte Entfernung modulbezogener Permissions, `role_permissions` und systemischer Rollenerweiterungen bei Entzug implementieren
- [x] 3.4 Replay-, Parallelitaets- und Teilfehlerverhalten fuer Zuweisung, Entzug und Reseeding deterministisch absichern; Rollback bei Seeding-Fehler implementieren
- [x] 3.5 Drift-Erkennung fuer fehlende Permissions, Systemrollen und `role_permissions` zugewiesener Module in einem konsistenten Diagnosemodell zusammenfuehren

## 4. Runtime, Authorization and Integration Gating

- [x] 4.1 Admin-Routen, UI-Navigation und modulbezogene Einstiege pro Instanz gegen den zugewiesenen Modulsatz fail-closed absichern; Modulsatz-Cache nach Zuweisungsmutation invalidieren
- [x] 4.2 Plugin-Actions und hostseitige Autorisierung nur fuer zugewiesene Module wirksam werden lassen
- [x] 4.3 Fachliche Content-, Mainserver- und weitere Integrationspfade nicht zugewiesener Module fail-closed blockieren
- [x] 4.4 Modulspezifische Permission- und Rollenauflosung an den zugewiesenen Modulsatz koppeln, ohne Core-Rechte oder fremde Namespaces unbeabsichtigt zu beeinflussen
- [x] 4.5 Negative und Integrations-Tests fuer nicht zugewiesene Module, geblockte Laufzeitnutzung, harte Rechteentfernung und Defense-in-Depth (Routing-Guard + IAM-Layer) ergaenzen

## 5. UI and Studio-Admin Workflows

- [x] 5.1 Zentralen Bereich `Module` auf Studio-Root-Ebene implementieren (nur fuer `studio.admin` zugaenglich); Zuweisung und Entzug von Modulen zu Instanzen umsetzen
- [x] 5.2 Zuweisungs-Flow mit sichtbarer IAM-Seeding-Folge, Ergebnisrueckmeldung und auditierbarer Mutation umsetzen
- [x] 5.3 Entzugs-Flow mit Vorschau betroffener Systemrollen (Name) und Permissions-Anzahl, expliziter Bestaetigung (`confirmation: "REVOKE"`) und klarer Hard-Removal-Kommunikation umsetzen
- [x] 5.4 Instanz-Cockpit um den Befund `IAM-Basis zugewiesener Module` (zweizeilig: technisches Label + Klartextzeile), Empty-State fuer Bestandsinstanzen und den Reparaturpfad erweitern (nur fuer Studio-Admin sichtbar)
- [x] 5.5 i18n-Keys im Namespace `instanceModules.*` fuer de und en vollstaendig anlegen; `pnpm check:i18n` muss gruen bleiben; Accessibility-Details und UI-Tests fuer Modulverwaltung, Entzugsdialog und Cockpit-Befund ergaenzen

## 6. Documentation and Verification

- [x] 6.1 Betroffene arc42-Abschnitte aktualisieren: `05-building-block-view.md`, `06-runtime-view.md`, `08-cross-cutting-concepts.md`, `09-architecture-decisions.md` (ADR-038 eintragen), `11-risks-and-technical-debt.md`, `12-glossary.md` (neue Terme: Modulvertrag, IAM-Baseline, Instanz-Modul-Zuordnung)
- [x] 6.2 Betriebsdoku erstellen: `docs/guides/instance-module-management.md` (Studio-Admin-Runbook: Zuweisen, Entziehen, Reparaturpfad, Bestandsinstanz-Erstbefuellung); `docs/development/iam-baseline-seeding.md` (lokale Seed-Ablaeufe fuer Entwickler)
- [x] 6.3 ADR-038 unter `docs/adr/` anlegen: Entscheidung fuer kanonische Instanz-Modul-Zuordnung, Hard-Remove statt Soft-Remove, Fail-Closed-Strategie, Transaktionsmodell
- [x] 6.4 Relevante Unit-, Type-, Lint- und betroffene Integrationschecks ausfuehren
- [x] 6.5 Gezielte Verifikationsmatrix gruenziehen: Bestandsinstanz ohne Modulsatz, explizite Zuweisung, Drift, harter Entzug, Seed-Failure-Rollback, Parallelitaetsfall, Idempotenz-Reseed
