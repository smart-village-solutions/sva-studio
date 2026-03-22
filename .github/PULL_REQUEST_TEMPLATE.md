## Ziel

<!--
Kurz beschreiben:
- Was wird geändert?
- Warum ist die Änderung notwendig?
- Welches Problem oder welcher Kontext wird adressiert?
-->

## Umfang

- [ ] Feature
- [ ] Bugfix
- [ ] Refactoring
- [ ] Dokumentation
- [ ] Architektur-/Systemänderung
- [ ] Betriebs-/Deployment-Änderung

## Änderungen

<!--
Die wichtigsten Änderungen knapp und konkret auflisten.
Keine Commit-Chronologie, sondern fachliche Zusammenfassung.
-->

- 

## Test & Verifikation

<!--
Alle tatsächlich ausgeführten Befehle eintragen.
Wenn etwas bewusst nicht ausgeführt wurde, transparent begründen.
-->

Ausgeführt:

- [ ] `pnpm test:unit`
- [ ] `pnpm test:types`
- [ ] `pnpm test:eslint`
- [ ] `pnpm test:e2e`

Zusätzlich ausgeführt:

- [ ] `pnpm nx affected --target=test:unit --base=origin/main`
- [ ] `pnpm nx affected --target=test:types --base=origin/main`
- [ ] Weitere gezielte Nx-/Vitest-/Playwright-Checks:

Nicht ausgeführt / Abweichungen:

- 

## Risiken & Rollback

<!--
Nur echte Risiken nennen:
- fachliche Regressionen
- Migrationen
- Runtime-/Deployment-Risiken
- Feature-Flags / Fallbacks / Rollback-Pfad
-->

- Risiko:
- Rollback:

## Dokumentation

<!--
Pflicht bei relevanten Änderungen.
Links relativ zu docs/ angeben.
-->

- [ ] Keine Doku-Anpassung erforderlich
- [ ] Produkt-/Entwicklerdoku aktualisiert:
- [ ] Architektur-Doku aktualisiert:

Relevante Links:

- 

## Architektur & OpenAPI

- [ ] Keine Architekturänderung
- [ ] Relevante arc42-Abschnitte unter `docs/architecture/` wurden aktualisiert
- [ ] API-/Vertragsänderungen dokumentiert
- [ ] Breaking Change vorhanden

Details:

- 

## Checkliste

- [ ] Keine hardcodierten UI-Texte eingeführt; user-facing Texte laufen über das Übersetzungssystem
- [ ] Logging im Server-Code nutzt keine `console.*`-Statements
- [ ] Input-Validierung und PII-Schutz berücksichtigt
- [ ] UI-/Styling-Änderungen folgen Design-System / `shadcn/ui`
- [ ] Accessibility-Auswirkungen geprüft
- [ ] Tests wurden ergänzt oder angepasst, falls Verhalten geändert wurde
- [ ] `pnpm check:file-placement` ist berücksichtigt

## Review-Hinweise

<!--
Optional: Reviewer auf kritische Pfade, Migrationsreihenfolge, bekannte Tradeoffs oder offene Punkte hinweisen.
-->

- 
