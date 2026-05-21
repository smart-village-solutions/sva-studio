## 1. OpenSpec Scope und Validierung schärfen

- [ ] 1.1 `openspec validate add-studio-data-form-and-test-foundations --strict` vor der Überarbeitung ausführen und Baseline festhalten
- [ ] 1.2 Proposal, Design, Tasks und Delta-Specs auf verbindlichen Default-Standard statt vorsichtiger Pilot-Geltung umformulieren
- [ ] 1.3 Explizite Ausnahmen für rein lokale Logik ohne HTTP-Bezug, unveränderte Legacy-Flows und dokumentierte Spezialfälle in allen relevanten Artefakten verankern
- [ ] 1.4 Die vollständige Formular-Migrationsinventur für Host und Plugins als Pflichtartefakt des Changes verankern
- [ ] 1.5 Governance-, Review- und Exit-Kriterien so schärfen, dass Referenzimplementierungen den Standard validieren, aber keine Sonderzone bilden
- [ ] 1.6 `openspec validate add-studio-data-form-and-test-foundations --strict` nach der Überarbeitung erneut ausführen

## 2. Inventur und Governance-Artefakte bereitstellen

- [ ] 2.1 Eine vollständige Formular-Migrationsinventur für Host und Plugins mit Zweck, Muster, Validierung, Submit-Pfad, Primitiven, Teststand, RHF-Bedarf, `msw`-Bedarf, `fast-check`-Eignung, Priorität, Risiko, Legacy-Ausnahme und Zielzustand erstellen
- [ ] 2.2 Sicherstellen, dass die Inventur mindestens `admin/users`, `admin/groups`, `admin/organizations`, `admin/instances`, `admin/legal-texts`, `admin/roles`, `interfaces`, `content`, `plugin-poi` und die relevanten Formulare aus `plugin-waste-management` enthält
- [ ] 2.3 Review-Kriterien dokumentieren, mit denen Standardpfad, Ausnahmegrund und Migrationsstatus schnell geprüft werden können

## 3. Gemeinsame Integrationsbausteine bereitstellen

- [ ] 3.1 `react-hook-form` und `@hookform/resolvers` in den betroffenen Frontend-Projekten einführen
- [ ] 3.2 In `packages/studio-ui-react` gemeinsame Formularpatterns oder schlanke Adapter für `Input`, `Textarea`, `Select`, `Checkbox`, Fehler-Mapping und Summary-Fokus definieren
- [ ] 3.3 `msw` als gemeinsames Frontend-Test-Mocking-Setup für Browser- und Node-Testläufe mit Handler-Utilities und Reset-Regeln bereitstellen
- [ ] 3.4 `fast-check` als gezielte Test-Foundation für kritische Kern- und Routing-Hotspots vorbereiten

## 4. Referenzimplementierungen und Rollout

- [ ] 4.1 Referenz-Formulare in Account/Admin und Content auf `react-hook-form` plus `zodResolver` umstellen
- [ ] 4.2 HTTP-nahe Frontend-Tests mit direkten `fetch`- oder `fetchWithRequestTimeout`-Stubs in Referenzbereichen auf `msw` umstellen
- [ ] 4.3 Für definierte Kern-Hotspots erste gezielte `fast-check`-Properties ergänzen
- [ ] 4.4 Nach jedem Referenzblock betroffene Unit-, Type- und Frontend-Tests ausführen und den Rollout nur bei grünem Stand fortsetzen

## 5. Dokumentation und Exit

- [ ] 5.1 Betroffene arc42-Abschnitte `05`, `08`, `09` und `10` zur Formular- und Test-Foundation aktualisieren
- [ ] 5.2 ADR `Formular-Foundation mit react-hook-form und zodResolver` unter `docs/adr/` erstellen oder aktualisieren
- [ ] 5.3 ADR `Frontend-Test-Foundation mit MSW und selektivem fast-check` unter `docs/adr/` erstellen oder aktualisieren
- [ ] 5.4 Entwicklerdokumentation für Formularmuster, RHF-Adapter, `msw`-Setup, Migrationskriterien und Property-based Testing ergänzen
- [ ] 5.5 Vor Abschluss prüfen, dass Standardpfad, Ausnahmen, Inventur und Governance-Exit-Kriterien vollständig dokumentiert und reviewbar sind
