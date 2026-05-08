## 1. Abhängigkeiten und Runtime-Foundation

- [ ] 1.1 `react-hook-form` und `@hookform/resolvers` für formularintensive Host- und Plugin-Views einführen
- [ ] 1.2 `msw` als gemeinsames Frontend-Test-Mocking-Setup für Browser- und Node-Testläufe verdrahten
- [ ] 1.3 `fast-check` als Dev-Dependency für kritische Kern- und Routing-Pakete einführen
- [ ] 1.4 Eine dokumentierte Hotspot-Liste für Phase-1-Formulare, HTTP-Testpiloten und erste `fast-check`-Kandidaten festlegen

## 2. Gemeinsame Integrationsbausteine bereitstellen

- [ ] 2.1 In `packages/studio-ui-react` gemeinsame Formularpatterns oder schlanke Adapter für `Input`, `Textarea`, `Select`, `Checkbox`, Fehler-Mapping und Summary-Fokus definieren
- [ ] 2.2 Ein gemeinsames `msw`-Test-Setup mit Handler-Utilities, Reset-Regeln und klarer Node-/Browser-Abgrenzung bereitstellen
- [ ] 2.3 Leitlinien dokumentieren, wann `msw` statt Modul-Mock verpflichtend ist und wann nicht

## 3. Pilotmigrationen durchführen

- [ ] 3.1 Pilot-Formulare in Account/Admin schrittweise auf `react-hook-form` plus `zodResolver` umstellen, beginnend mit überschaubaren Create/Edit-Flows
- [ ] 3.2 Den Host-Content-Editor oder einen gleichwertigen Content-Flow auf dieselben Formularprimitiven und Validierungsmuster ausrichten
- [ ] 3.3 HTTP-nahe Frontend-Tests mit direkten `fetch`- oder `fetchWithRequestTimeout`-Stubs auf `msw` umstellen, beginnend mit klar begrenzten Pilottests
- [ ] 3.4 Für definierte Kern-Hotspots erste gezielte `fast-check`-Properties ergänzen
- [ ] 3.5 Nach jedem Pilotblock betroffene Unit-, Type- und Frontend-Tests ausführen und den Rollout nur bei grünem Stand fortsetzen

## 4. Auswertung und Governance

- [ ] 4.1 Exit-Kriterien für Formular-, MSW- und `fast-check`-Piloten dokumentiert prüfen, bevor weitere Flows verpflichtend migriert werden
- [ ] 4.2 Validierungs- und Test-Dokumentation für die neuen Foundations ergänzen
- [ ] 4.3 Dokumentieren, dass bestehende stabile Alt-Flows erst bei neuer Funktionalität oder grundlegender Überarbeitung verpflichtend migriert werden

## 5. Dokumentation

- [ ] 5.1 Betroffene arc42-Abschnitte `05`, `08`, `09` und `10` zur Formular- und Test-Foundation aktualisieren
- [ ] 5.2 ADR `Formular-Foundation mit react-hook-form und zodResolver` unter `docs/architecture/` erstellen oder aktualisieren
- [ ] 5.3 ADR `Frontend-Test-Foundation mit MSW und selektivem fast-check` unter `docs/architecture/` erstellen oder aktualisieren
- [ ] 5.4 Entwicklerdokumentation für Formularmuster, RHF-Adapter, MSW-Setup, Migrationskriterien und Property-based Testing ergänzen
