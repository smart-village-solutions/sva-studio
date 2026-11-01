# Change: Studio-UI iterativ an das überarbeitete Designsystem angleichen

## Why

Das überarbeitete Figma-Designsystem beschreibt Foundations, Komponenten,
Muster und Fachansichten. Der Code besitzt bereits gemeinsame Studio-Bausteine,
enthält aber weiterhin lokale Darstellungsvarianten und einzelne parallele
Editorpfade. Es fehlt der konkrete Abgleich zwischen Design, bestehenden
Funktionen und einer begrenzten Lieferreihenfolge.

Dieser Change liefert den Gesamtfahrplan und den konkretisierten Einstieg über
Foundations, Shell und das Nachrichten-Plugin. Er erweitert die vorhandene
UI-Architektur, statt eine zweite Komponentenbibliothek einzuführen.

## Auftrag und Status

- **Planungsauftrag:** Das neue Designsystem unter Erhalt sämtlicher Funktionen
  iterativ übernehmen, wiederkehrende Plugin-UI zentralisieren und die
  React-Komposition verbessern.
- **Referenzcode:** `cb7d1d0f3bc065d28e1662a0940a5a2e6f737ef6`, 1. November 2026.
- **Worktree:** `.worktrees/ui-design-system-migration`.
- **Branch:** `docs/ui-design-system-migration`.
- **Freigabe:** Nutzerauftrag „Setze das um“ am 1. November 2026; Umsetzung von
  Baseline, Foundations, Shell und News-Pilot in diesem Worktree.
- **Ziel dieses Code-Lieferabschnitts:** Die bestehenden zentralen UI-Bausteine,
  Shell und News-Ansichten am Figma-System ausrichten und lokale News-Tab-/Card-
  Parallelpfade unter Erhalt der bestehenden Bedien- und Speicherverträge ersetzen.
- **Grenzen:** maximal der unten genannte erste Implementierungsscope;
  übrige Plugins blieben zunächst nachgelagerte Iterationen und wurden in
  freigegebenen Folgeabschnitten bearbeitet. Commit, Push und Pull Request
  sind durch den Nutzerauftrag „Mach einen PR“ vom 1. November 2026 freigegeben;
  Merge und Rollout bleiben außerhalb dieses Auftrags. Die Gestaltung wurde anschließend ausdrücklich
  freigegeben; Bibliotheksveröffentlichung und Produktabnahme stehen aus.
- **Freigegebener Folgeabschnitt:** Sichere Speicherergebnisse und Wiederaufnahme
  des News-Pilots gemäß Design, Abschnitt 8. Forest wird vorerst zurückgestellt.

## What Changes

- Eine kompakte Inventur ordnet UI-Plugins und Hostoberflächen ihren bestehenden
  gemeinsamen Bausteinen, lokalen Restpfaden, Figma-Referenzen und Tests zu.
- Foundations, Shell und News erhalten einen konkreten Funktionsbestand,
  Implementierungsschritte und geplante Nachweise.
- Das Designsystem wird auf die vorhandenen semantischen Tokens und
  shadcn-/Radix-basierten Studio-Komponenten abgebildet.
- Die React-Komposition wird entlang bestehender Ownership verbessert:
  gemeinsame React-UI in `@sva/studio-ui-react`, frameworkfreie gemeinsame
  Verträge in `@sva/plugin-sdk`, Fachlogik im Plugin.
- News verwendet künftig die gemeinsamen Detail-Tabs. Eine optionale,
  standardmäßig ausgeschaltete Intent-Vorladung erhält das vorhandene
  Fokus-/Hover-Verhalten. Reine Card-Weiterleitungen werden entfernt.
- Lücken und offene Produktentscheidungen werden ausdrücklich von belegten
  Codeabweichungen sowie noch ausstehenden Laufzeitnachweisen unterschieden.
- Jede spätere Iteration aktualisiert ihren Scope am dann aktuellen Code und
  entfernt ersetzte lokale Implementierungen im selben Lieferabschnitt.

## Nicht-Ziele

- Keine Entfernung vorhandener Felder, Aktionen, Spalten, Zustände,
  Berechtigungsprüfungen oder unterstützter Theme-Varianten.
- Keine neuen Fachworkflows für Konfliktauflösung, Offline-Synchronisation,
  Freigaben oder versionierte Veröffentlichung. Die freigegebene technische
  Wiederaufnahme nutzt den bestehenden Anmeldeweg in einem neuen Tab.
- Keine Änderungen an externen Mainserver-/DB-Verträgen, Fachpayloads,
  Servervalidierung, Sanitizer-Policies, IAM-Regeln oder Plugin-Registrierung.
  Der freigegebene Folgeabschnitt ergänzt ausschließlich eine geschützte
  lesende News-Operationsroute und additive SDK-Metadaten im bestehenden Pfad.
- Keine neue UI-Laufzeit, Editor-Factory, generische Provider-Schicht,
  CI-Infrastruktur oder parallele Komponentenbibliothek.
- Keine mechanische Zerlegung von Komponenten nach Zeilenzahl und keine
  pauschale Zentralisierung fachlich unterschiedlicher Abschnitte.
- Keine Migration der öffentlichen Abfallkalender- oder Projektbericht-App.

## Abgrenzung zu bestehenden Changes

| Bestehender Change                                                                                         | Übernommener Bestand / Grenze                                                                                                             |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `add-studio-data-form-and-test-foundations`                                                                | RHF/Zod, Formular-Bridge, MSW-Konventionen und vorhandene Formularinventur bleiben Grundlage; keine erneute Foundation-Migration.         |
| `refactor-events-detail-content-tab`                                                                       | Bereits gelieferte gemeinsame Editor-/Media-/Map-Verträge wiederverwenden; erledigte Zentralisierungen nicht erneut planen.               |
| `add-content-create-onepagers`                                                                             | Bestehende Feldreihenfolge, Create-Komposition und genau eine fixierte Speicheraktion erhalten.                                           |
| `harden-studio-access-resilience`                                                                          | Laufende Auth-/Organisations- und Entwurfsschutzarbeit nicht nachbauen; Konflikte bei gemeinsam berührten Dateien vor Umsetzung auflösen. |
| `refactor-sva-studio-react-package-boundaries`                                                             | Öffentliche Package-Grenzen beibehalten; keine nebenläufige Host-/SDK-Neuordnung.                                                         |
| `extend-media-editor-and-metadata`, `extend-media-management-governance`, `add-content-ownership-transfer` | Medien- und Ownership-Verträge konsumieren; keine Änderung ihrer fachlichen Wirkung.                                                      |
| `add-central-app-translations`, `normalize-waste-tour-fractions`                                           | Katalog- beziehungsweise Waste-Iteration vor Beginn mit dem dann aktuellen Stand abgleichen.                                              |

## Impact

- **Affected specs:** `ui-layout-shell`.
- **Maximaler erster Implementierungsscope:** UI-Tokens, App-Shell und bestehende
  UI-Primitives der Studio-App; `packages/studio-ui-react`; News-UI und ihre
  Tests; direkte Verbraucherprüfungen geänderter Shared-Komponenten.
- **Spätere Implementierungsslices:** die in der Inventur benannten Plugins
  und Hostoberflächen, jeweils mit vorher konkretisierter Grenze.
- **SDK:** Bestandteil des Ownership-Abgleichs; für den Pilot ist keine neue
  SDK-Schnittstelle vorgesehen.
- **Architektur:** relevante Abschnitte
  [05 – Bausteinsicht](../../../docs/architecture/05-building-block-view.md),
  [08 – Querschnittliche Konzepte](../../../docs/architecture/08-cross-cutting-concepts.md)
  und [10 – Qualitätsanforderungen](../../../docs/architecture/10-quality-requirements.md)
  bei tatsächlicher Umsetzung abgleichen und soweit betroffen aktualisieren.
- **Nachweise und Stopps:** im [Design](./design.md),
  [Lieferfolge](./tasks.md) und [Spec-Delta](./specs/ui-layout-shell/spec.md).

## Referenzen

- [Überarbeitetes Figma-Designsystem](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio)
- [UI-Shell und Theming](../../../docs/development/ui-shell-theming.md)
- [Listenstandard](../../../docs/development/studio-list-page-standard.md)
- [Übersichts- und Detailseiten](../../../docs/development/studio-uebersichts-und-detailseiten-standard.md)
- [Bestehende Formularinventur](../../../docs/development/studio-form-migrationsinventur.md)

## Artefaktbilanz

Dieser Planungsschritt ergänzt vier Markdown-Dateien im bestehenden
OpenSpec-Pfad. Er ergänzt keine produktiven Komponenten, Dependencies,
Ausführungspfade oder Kontrollschichten. Inventur, Lücken und Nachweisplanung
stehen gemeinsam in `design.md`; dafür werden keine weiteren Dokumente angelegt.


## PR-Auftrag vom 1. November 2026

**Ziel:** Die im dedizierten Migrationsworktree umgesetzte Angleichung von
Studio-Foundations, gemeinsamen UI-Bausteinen, Host und bestehenden Plugins
unter Erhalt ihrer Bedien- und Speicherverträge als Entwurfs-PR nach `main`
veröffentlichen; dazu gehören der freigegebene News-Recovery-Abschnitt,
Kalenderstatus L15/L19 und die lokalen Dev-Auth-Anmeldefixes.

**Maximal betroffene Bereiche:** `apps/sva-studio-react`, die bestehenden
UI-/Plugin-Packages, die bereits geänderten Auth-/Repository-/SDK-/Mainserver-
Pfade für News-Recovery sowie deren Tests, Dokumentation und Lockfile.
Keine neuen Packages oder Dienste. Temporäre Laufzeit-/Browser-Artefakte
bleiben außerhalb des Commits; erwartete Playwright-Referenzbilder gehören
zu den versionierten Regressionstests.

**Nicht-Ziele:** keine Änderung des Fax-Eastereggs, keine neuen Fachregeln,
Datenbankmigrationen, produktiven Auth-/Berechtigungsverträge, öffentliche
Abfallkalender-Migration, Figma-Bibliotheksveröffentlichung, Merge oder Rollout.

Die vollständige manuelle Sprach-/Accessibility-Matrix und fachliche
Produktabnahme bleiben offen. Lokale Prüfergebnisse sind im Design und im
L19-Entwicklungsbriefing dokumentiert; GitHub-Gates werden erst dem späteren
PR-HEAD zugeordnet. Der Entwurfsstatus ist keine Merge-Freigabe.
