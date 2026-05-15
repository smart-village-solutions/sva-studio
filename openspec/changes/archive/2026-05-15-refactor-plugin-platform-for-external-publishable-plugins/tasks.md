## 1. Specification

- [x] 1.1 Neue Capability `plugin-platform` für Authoring-, Manifest-, Katalog-, Loader- und Runtime-Verträge spezifizieren
- [x] 1.2 `routing` auf host-owned Materialisierung aus einem kanonischen Plugin-Snapshot fortschreiben
- [x] 1.3 `iam-access-control` für host-owned Permission- und Guard-Entscheidungen bei pluginseitigen Server- und Job-Beiträgen fortschreiben
- [x] 1.4 `iam-auditing` für host-owned Audit-Emission pluginseitiger Server-, Job- und Integrationspfade fortschreiben
- [x] 1.5 `architecture-documentation` für Plugin-Plattform-v2, Loader, Katalog, Deployment- und Risikoauswirkungen fortschreiben
- [x] 1.6 `openspec validate refactor-plugin-platform-for-external-publishable-plugins --strict` ausführen

## 2. Architecture and ADR

- [x] 2.1 ADR-034 fortschreiben oder neue ADR für Plugin-Plattform v2 anlegen und das Verhältnis zu ADR-034 explizit dokumentieren
- [x] 2.2 `docs/architecture/package-zielarchitektur.md` um Zielrollen für `plugin-sdk`, Manifest-, Loader- und Runtime-Bausteine ergänzen
- [x] 2.3 arc42-Abschnitte 04, 05, 06, 07, 08, 09, 10 und 11 für das Zielbild der extern publizierbaren Plugin-Plattform aktualisieren

## 3. Platform Contracts

- [x] 3.1 `@sva/plugin-sdk` auf generische Authoring-Verträge begrenzen und plugin-spezifische Fachhelfer aus dem generischen SDK herauslösen
- [x] 3.2 Serialisierbaren Plugin-Manifest-Vertrag für veröffentlichte Plugins definieren
- [x] 3.3 Kanonischen Plugin-Katalog-Vertrag für lokale und installierte Plugins definieren
- [x] 3.4 Kanonischen Loader-/Snapshot-Vertrag definieren, der lokale und installierte Plugins auf denselben Host-Snapshot materialisiert
- [x] 3.5 Host-Kontexte für pluginseitige Request-, Job- und Integrationsausführung definieren

## 4. Host Integration

- [x] 4.1 App-lokale statische Plugin-Registrierung auf einen konfigurierten Plugin-Katalog und Loader umstellen
- [x] 4.2 `routing` nur noch den validierten Plugin-Snapshot statt app-lokaler Plugin-Arrays konsumieren lassen
- [x] 4.3 `auth-runtime` und angrenzende Runtime-Pakete für pluginseitige Server- und Job-Entry-Points über host-owned Execution-Contexts anbinden
- [x] 4.4 Guard-, Audit-, Job- und Import-Registrierung aus denselben Snapshot-Daten ableiten, ohne parallele Registries in App oder Plugins

## 5. Development and Distribution Workflow

- [x] 5.1 Lokalen Dev-Workflow für Workspace- und lokal verlinkte Plugins ohne Core-Codeänderung definieren und implementieren
- [x] 5.2 Publish-/Installationsworkflow für Manifest plus gebaute Artefakte definieren und dokumentieren
- [x] 5.3 Kompatibilitätsprüfung, Aktivierung/Deaktivierung und deterministische Fehlermeldungen für inkompatible Plugins implementieren

## 6. Reference Migration

- [x] 6.1 `plugin-waste-management` als Referenzplugin auf den neuen Plattformvertrag zuschneiden
- [x] 6.2 app-interne Waste-Job- oder Host-Verdrahtung in den kanonischen Plugin-Runtime-Vertrag überführen
- [x] 6.3 bestehende Standard-Content-Plugins mindestens auf Katalog-/Snapshot-Kompatibilität prüfen und dokumentieren

## 7. Tests and Documentation

- [x] 7.1 Contract-Tests für Manifest, Katalog, Loader, Snapshot und Execution-Contexts ergänzen
- [x] 7.2 Integrations-Tests für lokalen Development-Load und installierten Plugin-Load ergänzen
- [x] 7.3 `docs/guides/plugin-development.md` für Authoring, lokalen Dev-Load, Publish und Install aktualisieren
- [x] 7.4 Risiken, Migrationsgrenzen und verbleibende technische Schulden der Plattform explizit dokumentieren
