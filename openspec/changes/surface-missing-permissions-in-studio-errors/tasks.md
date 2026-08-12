## 1. Gemeinsamer Vertrag und Katalog

- [x] 1.1 Framework-agnostischen Permission-Denial-Vertrag für `required_permissions`, `requirement_mode` und sichere `denial_reason`-Werte ergänzen
- [x] 1.2 Parser, Normalisierung, Deduplizierung und Begrenzung für nicht vertrauenswürdige API- und Routingdaten implementieren
- [x] 1.3 Zentralen Display-Katalog für Host-/Core- und registrierte Plugin-Permissions mit Action-ID-Fallback bereitstellen
- [x] 1.4 Deutsche und englische Permission-Namen sowie Vollständigkeits- und Fallbacktests ergänzen

## 2. Routing und Seitenzugriff

- [x] 2.1 `allOf`-Guards auf tatsächlich fehlende Permissions und `anyOf`-Guards auf zulässige Alternativen abbilden
- [x] 2.2 Begrenzten, einmalig konsumierten Denial-Kontext durch den TanStack-Router-Redirectpfad transportieren
- [x] 2.3 Startseiten- und Route-Fehleranzeige an den gemeinsamen lokalisierten Formatter anbinden
- [x] 2.4 Degradierte Permission-Snapshots, Modul-Denials und Rollen-Denials ohne falsche Permission-Behauptung getrennt behandeln
- [x] 2.5 Routing-Unit- und App-Integrationstests für Redirect, Reload, Mehrtab- beziehungsweise Manipulationsgrenzen ergänzen

## 3. Server-Autorisierung und API-Vertrag

- [x] 3.1 Zentrale API-Fehler- und Autorisierungshelper um additive Permission-Denial-Details erweitern
- [x] 3.2 IAM- und Account-Management-Gates migrieren und serverseitig geprüfte Actions vertraglich testen
- [x] 3.3 Medien- und Mainserver-Gates migrieren und Scope-/Principal-/Fach-`403` weiterhin korrekt abgrenzen
- [x] 3.4 Waste-Management- und Plugin-Operations-Gates auf den gemeinsamen Vertrag migrieren
- [x] 3.5 Server-Runtime-Logging und öffentliche `safeDetails` auf unerlaubte Rollen-, Gruppen-, Grant- und Policy-Daten prüfen

## 4. Gemeinsame Studio-Darstellung

- [x] 4.1 Framework-agnostisches Darstellungsmodell und gemeinsame React-Anbindung über bestehende Studio-UI-Alert-Primitives implementieren
- [x] 4.2 Einzel-, `allOf`-, `anyOf`- und Scope-/ABAC-Texte lokalisiert und barrierefrei darstellen
- [x] 4.3 Bestehende generische Permission-Meldungen in Host-App und produktiven Fachplugins inventarisieren
- [x] 4.4 Lade-, Speicher-, Lösch-, Bulk-, Import- und sonstige Fachaktionen schrittweise auf den gemeinsamen Parser und Formatter migrieren
- [x] 4.5 Unbekannte Actions, alte Serverantworten und technische IAM-Ausfälle mit sicheren Fallbacks abdecken

## 5. Qualitätssicherung und Dokumentation

- [x] 5.1 Unit-, Typ-, Integration- und fokussierte E2E-Tests gemäß Teststrategie ergänzen
- [x] 5.2 Automatisierten Vertragscheck gegen verbleibende generische Permission-`403`-Pfade und unregistrierte Action-IDs ergänzen
- [x] 5.3 `pnpm check:server-runtime` für betroffene Server-Packages früh und nach der Migration ausführen
- [x] 5.4 Kleinste relevante Nx-Gates blockweise und vor Abschluss den gemessenen PR-Gate-Pfad ausführen
- [x] 5.5 `docs/architecture/05-building-block-view.md`, `06-runtime-view.md`, `08-cross-cutting-concepts.md` und `10-quality-requirements.md` aktualisieren
- [x] 5.6 Relevante Entwicklerdokumentation für den Permission-Denial-Vertrag und Plugin-Permission-Labels aktualisieren
