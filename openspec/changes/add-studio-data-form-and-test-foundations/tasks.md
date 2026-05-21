## 1. Governance- und Basisartefakte vorbereiten

- [ ] 1.1 ADR `Formular-Foundation mit react-hook-form und zodResolver` unter `docs/adr/` erstellen oder aktualisieren, bevor Referenzimplementierungen beginnen
- [ ] 1.2 ADR `Frontend-Test-Foundation mit MSW und selektivem fast-check` unter `docs/adr/` erstellen oder aktualisieren, bevor Referenzimplementierungen beginnen
- [ ] 1.3 `docs/development/studio-form-migrationsinventur.md` anlegen und die Pflichtfelder Pfad, Zweck, heutiges Muster, Validierung, Submit-Pfad, Primitiven, Teststand, RHF-Bedarf, `msw`-Bedarf, `fast-check`-Eignung, Priorität, Risiko, Legacy-Ausnahme und Zielzustand verbindlich vorgeben
- [ ] 1.4 `docs/development/studio-foundations-governance.md` anlegen und dort Review-Kriterien, Ausnahmeregeln, Referenzscope und Exit-Nachweise bündeln

## 2. Inventur und Referenzscope festlegen

- [ ] 2.1 Die vollständige Formular-Migrationsinventur für Host und Plugins in `docs/development/studio-form-migrationsinventur.md` erstellen
- [ ] 2.2 Sicherstellen, dass die Inventur mindestens `admin/users`, `admin/groups`, `admin/organizations`, `admin/instances`, `admin/legal-texts`, `admin/roles`, `interfaces`, `content`, `plugin-poi` und die relevanten Formulare aus `plugin-waste-management` enthält
- [ ] 2.3 In `docs/development/studio-foundations-governance.md` klar dokumentieren, dass `/account`-Flows unter den repo-weiten Default-Standard fallen, in diesem Change aber keine initialen Referenzimplementierungen sind

## 3. Gemeinsame Integrationsbausteine bereitstellen

- [ ] 3.1 `react-hook-form` und `@hookform/resolvers` in den betroffenen Frontend-Projekten einführen
- [ ] 3.2 In `packages/studio-ui-react` den Integrationsrahmen für `Input`, `Textarea`, `Select` und `Checkbox` festlegen, inklusive Fehler-Mapping, Summary-Fokus und klarer `register`-/`Controller`-Aufteilung
- [ ] 3.3 `msw` als gemeinsames Frontend-Test-Mocking-Setup für Browser- und Node-Testläufe mit Handler-Utilities und Reset-Regeln bereitstellen
- [ ] 3.4 `fast-check` als gezielte Test-Foundation für die initiale Startmenge `packages/routing/src/route-search.ts`, `packages/routing/src/admin-resource-search-params.ts`, `packages/core/src/waste-management-location-tour-pickup-date-import.ts` und `packages/core/src/input-readers.ts` vorbereiten

## 4. Referenzimplementierungen umsetzen

- [ ] 4.1 Referenz-Formulare in Admin (`/admin/users`, `/admin/roles`) und Content auf `react-hook-form` plus `zodResolver` umstellen
- [ ] 4.2 HTTP-nahe Frontend-Tests mit direkten `fetch`- oder `fetchWithRequestTimeout`-Stubs in den definierten Referenzbereichen auf `msw` umstellen
- [ ] 4.3 Für die initiale Startmenge `route-search`, `admin-resource-search-params`, `waste-management-location-tour-pickup-date-import` und `input-readers` erste gezielte `fast-check`-Properties ergänzen oder eine eng begründete Verschiebung dokumentieren
- [ ] 4.4 Nach jedem Referenzblock betroffene Unit-, Type- und Frontend-Tests ausführen und den Rollout nur bei grünem Stand fortsetzen

## 5. Dokumentation und Exit absichern

- [ ] 5.1 Betroffene arc42-Abschnitte `05`, `08`, `09` und `10` zur Formular- und Test-Foundation aktualisieren
- [ ] 5.2 Entwicklerdokumentation für Formularmuster, RHF-Adapter, `msw`-Setup, Migrationskriterien und Property-based Testing ergänzen
- [ ] 5.3 Vor Abschluss prüfen, dass `docs/development/studio-form-migrationsinventur.md` und `docs/development/studio-foundations-governance.md` vollständig sind und Standardpfad, Ausnahmen, Referenzscope, Inventur und Governance-Exit-Kriterien reviewbar dokumentieren
