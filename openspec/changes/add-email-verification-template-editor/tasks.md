## 1. Gemeinsamer Speicher

- [x] 1.1 Schema-Snapshot und vorhandene Speicher-/Vererbungs-/Sperrpfade prüfen.
- [x] 1.2 Migration mit datenbewahrender Übernahme und befristeter Kompatibilität der alten Instanzspalte, RLS und monotonen Revisionen absichern.
- [x] 1.3 Gemeinsamen Vorlagenvertrag und Repository-CAS-/Fehlerpersistenztests liefern.

## 2. Synchronisierung und Verbraucher

- [x] 2.1 Studio-Quelle zuerst committen, danach getrennten Sync mit Readback und dauerhaftem Status ausführen.
- [x] 2.2 Save-, Reset-, Tenant-, globale Vererbungs- und Kommunendatenpfade anschließen.
- [x] 2.3 Direkte Keycloak-Editorlogik ersetzen; Driftansicht, explizite Übernahme/Übertragung und Konfliktschutz liefern.
- [x] 2.4 Texte-/Theme-Write vor Versand entfernen und Versandblockade mit Erklärung und zuständigem Link testen.

## 3. Nachweise und Vorbereitung

- [x] 3.1 Gezielte Unit-/Handler-/UI-/DB-Gates sowie Type-, Runtime-, i18n- und Vertragsprüfungen ausführen.
- [x] 3.2 Aktuelle API-, Schema- und Architekturdokumentation berichtigen; alte direkte-Ablage-Beschreibungen ablösen.
- [x] 3.3 Staging zuerst mit Backup, Migration und kontrolliertem Bestandsabgleich vorbereiten; danach Havelland. Bereits gepflegte Absendernamen unverändert lassen.
- [ ] 3.4 Echte Deployments und Versandtests bleiben bis zur konkreten Freigabe offen.

## Lokale Evidenz am 30.10.2026

- Core: 14 gezielte Compiler-/Übernahmetests grün
- Repository: CAS-/Mutations-/Leseverträge grün; 5 echte PostgreSQL-Tests für Übernahme, paralleles Speichern, Fehlerstatus, RLS und Rückmigration grün
- Auth-Runtime: Abgleich, API-Autorisierung, Tenant-Editor, globale Vererbung und Kommunendaten sowie Initial-/Resend-Versand gezielt grün
- UI: Bestätigungsvorlage 8, Tenant-Einladung 3, Nutzerbearbeitung 47 Tests grün; globale Vorlagenverwaltung und bestehende Instanzdetailseite ebenfalls gezielt grün
- Routing: 42 Tests grün
- App-Typecheck einschließlich Server-Build-Abhängigkeiten grün
- Vollständiges Server-Runtime-Gate grün; nach weiteren lokalen Änderungen auf die fünf geänderten Server-Packages begrenzt erneut geprüft
- i18n, IAM-OpenAPI, Dateiplatzierung, Rollout-Dokumentation und strenge OpenSpec-Validierung grün
- Gezieltes ESLint: keine neuen Fehler; zwei vorhandene Architekturfehler in `packages/core/src/iam/account-management.ts:1` und `account-user-contract.ts:1` wegen des bestehenden Imports aus `@sva/iam-core` unverändert reproduziert, zusätzlich vorhandene Warnungen
- Keine Commits, Pushes, echten Deployments oder echten Versandtests ausgeführt

Die Migration behält die bisherige Instanzspalte als atomaren Kompatibilitätseingang;
die gemeinsame Quelle bleibt auch für alte Writes aktuell. Der neue SQL-Schreibpfad
sperrt zuerst die Elternzeile und prüft die monotone Quellrevision. Ein App-Rollback
benötigt kein Down. Der spätere Contract benötigt einen gesonderten Nachweis, dass
keine alten App- oder Rollback-Versionen mehr verwendet werden. Ein Rollback benötigt vorher die Sicherung der neuen
Bestätigungsvorlagen und Synchronisierungsmetadaten. Direkte parallele Keycloak-
Änderungen zwischen Prüfung und Write sind mangels atomarer Keycloak-CAS nicht
vollständig ausschließbar. Fremdes HTML wird nur verlustfrei in den Texteditor
übernommen; andernfalls bleibt es sichtbar und erfordert eine bewusste Übertragung.

## Ergänzung: allgemeine Bestätigungsvorlage

- [x] 4.1 Bestehenden globalen Vorlagenbestand um Bestätigung erweitern; Einladung, Rechte und Daten erhalten
- [x] 4.2 Allgemeiner Standard mit CAS und optionalen Instanz-Overrides; Reset verwendet die aktuelle allgemeine Vorlage
- [x] 4.3 Nur erbende Instanzen unter ihrer Sperre synchronisieren; bei Fehlern allgemeine Quelle erhalten
- [x] 4.4 Allgemeinen und instanzbezogenen Editor gemeinsam verwenden und Herkunft/Synchronisierungsfehler anzeigen
- [x] 4.5 Gezielte DB-, Vererbungs-, HTTP-, UI-, Type- und Runtime-Gates sowie Rollout-Unterlagen abschließen

Die erneute Nutzerklärung vom 30.10.2026 bestätigt die Vererbung ausdrücklich für
beide Anlässe. Die zuvor fehlende bearbeitbare allgemeine Bestätigung wurde ergänzt;
die eingebauten Texte dienen nur noch als Fallback unterhalb des allgemeinen Standards.

### Nachweise für die ergänzte Vererbung

- 7 Repository-Unit-Tests und 7 echte PostgreSQL-Tests grün, einschließlich Erhalt der allgemeinen Einladung, allgemeiner Bestätigung, CAS, Reset, RLS und Rückmigration
- 16 Synchronisierungstests grün, einschließlich allgemeiner Bestätigung, Instanz-Override, Wiederherstellen der Vererbung, gespeichertem Standard trotz Ausfall und Überspringen eines zwischenzeitlichen Overrides
- Allgemeine Vorlagen-API und bestehende Instanz-API gezielt grün; Root-Operationen einschließlich neuer GET/PATCH-Bindung an `instance.update` grün
- 15 UI-Tests für Bestätigungseditor und zentrale Templates-Seite sowie 43 Routing-Tests grün
- Auth-Runtime- und App-Typecheck samt Server-Build-Abhängigkeiten grün
- Runtime-Prüfung der vier geänderten Server-Packages grün
- Gezieltes ESLint ohne Fehler, eine unveränderte Warnung in einem bestehenden Routing-Test
- i18n, IAM-OpenAPI, Rollout-Dokumentation und strenge OpenSpec-Validierung grün
- Staging-Vererbungsnachweis mit isolierten Testinstanzen und Havelland-Pilot über Instanz-Override vorbereitet; keine Live-Änderungen oder echten Versandtests

## Release-Prüfung: kompatibler Versionswechsel

- 10 echte PostgreSQL-Fälle grün: Migration, alte/neue Zugriffe, parallele Writes, Reset-CAS, RLS, getrennte Metadaten und Down
- 43 Repository-Unit-Fälle und 11 Bestätigungseditor-Fälle grün, einschließlich Entwurfserhalt nach fehlgeschlagenem Speichern und Wiederöffnen
- Der bestehende Seed-Integrationstest führt die PostgreSQL-Datei jetzt regulär über das ungecachte Nx-Integrationstarget aus; kein zusätzliches Opt-in im CI erforderlich
- Alle Migrationen bis 0111 in einem leeren PostgreSQL-16-Testcontainer angewendet und kanonischen Schema-Snapshot regeneriert
- Staging-Auslieferung, echte Vererbungsprüfung und Havelland bleiben bis zum jeweiligen erfolgreichen Nachweis offen
