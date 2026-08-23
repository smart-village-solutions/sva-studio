## 1. Tokenvertrag im Contracts-Package zentralisieren

- [x] 1.1 Golden-Test und Negativfälle für das bestehende `v1`-Format unter `packages/waste-management-contracts/tests/**` ergänzen
- [x] 1.2 framework-agnostische Create-, Read- und Verify-Funktionen in einem serverseitigen Contracts-Modul implementieren
- [x] 1.3 Funktionen über `@sva/waste-management-contracts/unsubscribe-token` mit Node-ESM-konformer, leichter Laufzeitgrenze bereitstellen
- [x] 1.4 `waste-management-contracts:test:unit`, `test:types`, `build` und `check:runtime` unmittelbar nach diesem Änderungsblock grün ausführen

## 2. Studio-Consumer migrieren

- [x] 2.1 Studio-Reminder-Dispatcher auf `createWasteManagementUnsubscribeToken` aus `@sva/waste-management-contracts/unsubscribe-token` umstellen
- [x] 2.2 Studio-Integrationstest auf Read und Verify aus demselben Package umstellen und Tokenkompatibilität beibehalten
- [x] 2.3 app-lokale Studio-Tokenimplementierung entfernen
- [x] 2.4 betroffene Studio-Unit-Tests und den fokussierten Studio-Typecheck grün ausführen

## 3. Public-Waste-Consumer migrieren

- [x] 3.1 `@sva/waste-management-contracts` als `workspace:*`-Dependency der Public-Waste-App ergänzen und Lockfile aktualisieren
- [x] 3.2 Public-Waste-Reminder-Handler und -Tests auf Create, Read und Verify aus dem Package umstellen
- [x] 3.3 app-lokale Public-Waste-Tokenimplementierung entfernen
- [x] 3.4 fokussierte Public-Waste-Unit-Tests, Typecheck und Build grün ausführen

## 4. Cross-App-Boundary dauerhaft absichern

- [x] 4.1 fokussierten Repository-Check `scripts/ci/check-app-boundaries.ts` ergänzen und vorhandene Import-Parsing-Logik nur ohne Plugin-spezifische Kopplung wiederverwenden
- [x] 4.2 direkte statische Imports, dynamische Imports und Re-Exports zwischen unterschiedlichen Apps unter `apps/` blockieren
- [x] 4.3 Regressionstests für verbotene Cross-App-Quellimporte sowie erlaubte app-interne und Package-Imports ergänzen
- [x] 4.4 Root-Skript `check:app-boundaries` in die bestehenden ESLint-/CI-Gates aufnehmen
- [x] 4.5 Boundary- und Lint-Gates grün ausführen

## 5. Architektur und Dokumentation synchronisieren

- [x] 5.1 `docs/architecture/04-solution-strategy.md` um die Ownership gemeinsamer serverseitiger Fachverträge ergänzen
- [x] 5.2 `docs/architecture/05-building-block-view.md` auf die beiden App-zu-Runtime-Abhängigkeiten ohne App-zu-App-Kante aktualisieren
- [x] 5.3 `docs/architecture/10-quality-requirements.md` um Tokenkompatibilitäts- und Cross-App-Boundary-Nachweise ergänzen
- [x] 5.4 `docs/architecture/package-gesamtuebersicht.md` und `docs/architecture/package-zielarchitektur.md` aktualisieren

## 6. Abschlussvalidierung

- [x] 6.1 `pnpm check:server-runtime` grün ausführen
- [x] 6.2 Nx-Graph maschinenlesbar prüfen: keine Kante `sva-studio-react -> public-waste-calendar-web`, beide Apps hängen von `waste-management-contracts` ab
- [x] 6.3 `pnpm nx run sva-studio-react:test:types --skip-nx-cache` grün ausführen und nachweisen, dass `public-waste-calendar-web:build` nicht mehr im Taskgraphen enthalten ist
- [x] 6.4 Public-Waste-Build separat grün ausführen und unveränderte fail-closed Konfigurationsvalidierung bestätigen
- [x] 6.5 kleinsten relevanten PR-Gate-Pfad gemäß `DEVELOPMENT_RULES.md` ausführen; ausgelassene breite Gates transparent dokumentieren
- [x] 6.6 `pnpm check:file-placement` und `git diff --check` grün ausführen
- [x] 6.7 `openspec validate centralize-waste-unsubscribe-token-boundary --strict` grün ausführen
- [x] 6.8 Public-Waste-Produktions-Deploy prüfen: kein `@sva/plugin-waste-management`, `@sva/studio-ui-react`, `exceljs` oder `react-hook-form` im deployten `node_modules`
