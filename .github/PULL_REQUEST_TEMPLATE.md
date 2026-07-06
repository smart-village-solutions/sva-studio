## Ziel

<!--
Kurz beschreiben:
- Was wird geändert?
- Warum ist die Änderung notwendig?
- Welches Problem oder welcher Kontext wird adressiert?
-->

## Anforderung / Kontext

<!--
Pflicht für jede funktionale, technische oder betriebliche Änderung:
- Welche Anforderung, welches Problem oder welches Ziel wird adressiert?
- Falls vorhanden: Link zu Issue, OpenSpec-Change, Ticket oder ADR
-->

- Referenz:
- Kontext:

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
- Studio-Changelog:
  `docs/changelog/entries/pr-<nummer>.json` angelegt und Nutzertext geprüft

## Betroffene Projekte / Packages

<!--
Explizit benennen, damit Scope, Risiko und Testtiefe schnell beurteilbar bleiben.
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
- [ ] `pnpm test:pr`

Zusätzlich ausgeführt:

- [ ] `pnpm test:unit:affected`
- [ ] `pnpm test:types:affected`
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

## Risikoklasse

<!--
Genau eine Option auswaehlen.
Wenn mehrere Projekte betroffen sind, gilt die hoechste Risikoklasse.
-->

- [ ] hoch
- [ ] mittel
- [ ] normal

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

- [ ] Ziel, Kontext und betroffene Projekte/Packages sind im PR klar beschrieben
- [ ] Studio-Changelog-Datei unter `docs/changelog/entries/pr-<nummer>.json` ist vorhanden und für Nutzer verständlich formuliert
- [ ] Keine hardcodierten UI-Texte eingeführt; user-facing Texte laufen über das Übersetzungssystem
- [ ] Logging im Server-Code nutzt keine `console.*`-Statements
- [ ] Input-Validierung und PII-Schutz berücksichtigt
- [ ] UI-/Styling-Änderungen folgen Design-System / `shadcn/ui`
- [ ] Accessibility-Auswirkungen geprüft
- [ ] Testdaten, Fixtures, Seeds und Snapshots enthalten keine echten personenbezogenen Daten
- [ ] Tests wurden ergänzt oder angepasst, falls Verhalten geändert wurde
- [ ] `pnpm check:file-placement` ist berücksichtigt

## Review-Hinweise

<!--
Optional: Reviewer auf kritische Pfade, Migrationsreihenfolge, bekannte Tradeoffs oder offene Punkte hinweisen.
-->

- 
