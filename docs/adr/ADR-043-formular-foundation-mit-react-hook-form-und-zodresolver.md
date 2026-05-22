# ADR-043: Formular-Foundation mit react-hook-form und zodResolver

**Datum:** 2026-05-22
**Status:** ✅ Accepted
**Kontext:** Studio-UI- und Plugin-Formulare
**Entscheider:** Studio-Architektur und Frontend-Governance

---

## Entscheidung

Neue oder grundlegend überarbeitete Formular-Flows im Studio verwenden verbindlich `react-hook-form` als Formularzustands- und Submit-Grundlage sowie `zodResolver` als Standardbrücke zur schema-basierten Validierung.

## Kontext und Problem

Die bestehende Formularlandschaft im Host und in Plugins ist heterogen. Lokale `useState`-Formulare, manuelle Submit-Mapper und verteilte Validierungslogik erschweren konsistente Fehlerdarstellung, Accessibility, Dirty-State-Behandlung und testbare Migrationen. Ohne einen klaren Standard drohen weitere Einzelfallmuster.

Gleichzeitig muss die Lösung in ein Monorepo mit Host- und Plugin-Views passen. Der Standard darf deshalb nicht nur Bibliothekswahl sein, sondern muss mit Review-Regeln, Ausnahmen und einer Migrationsinventur verknüpft sein.

## Betrachtete Optionen

| Option | Kriterien | Bewertung | Kommentar |
| --- | --- | --- | --- |
| **`react-hook-form` + `zodResolver` als Default-Standard** | Typsicherheit, Wiederverwendbarkeit, Validierungsintegration, Migrationsfähigkeit | 9/10 | Deckt Formularzustand, Resolver-Pattern und testbare Standardisierung gut ab. |
| Lokale `useState`-Formulare pro Flow | Einfacher Einstieg, geringe Zusatzbibliothek | 4/10 | Führt bei größeren Flows schnell zu Drift, doppelter Validierungslogik und inkonsistentem Submit-Verhalten. |
| Andere Formularbibliothek als Standard | Konsistenz, Ökosystem, Schulungsaufwand | 5/10 | Würde zusätzlichen Einführungsaufwand erzeugen, ohne im Projektkontext klaren Mehrwert gegenüber RHF zu liefern. |

### Warum die gewählte Option?

- ✅ `react-hook-form` ist für komplexe, mehrteilige Host- und Plugin-Formulare gut geeignet, ohne unnötige Framework-Kopplung in die Kernlogik zu tragen.
- ✅ `zodResolver` verbindet UI-Validierung mit bereits etablierten schema-nahen Patterns und reduziert manuelle Feld-/Submit-Checks.
- ✅ Der Standard lässt sich sauber mit Inventur-, Review- und Ausnahme-Governance koppeln.

## Trade-offs & Limitierungen

### Pros

- ✅ Einheitlicher Standard für neue und überarbeitete Formular-Flows
- ✅ Bessere Konsistenz bei Fehlern, Defaults, Dirty-State und Submit-Status
- ✅ Gute Grundlage für gemeinsame UI-Bridges in `@sva/studio-ui-react`

### Cons

- ❌ Kleine oder bestehende Legacy-Formulare müssen bewusst eingeordnet statt einfach beiläufig weitergeführt werden.
- ❌ Spezialeditoren wie tabellarische Bulk-Editoren passen nicht immer vollständig in ein klassisches RHF-Feldmodell.

## Implementierung / Ausblick

- [x] Governance-Regeln für RHF-Pflicht, Ausnahmen und Review unter `docs/development/studio-foundations-governance.md` dokumentieren
- [x] Formularinventur als Pflichtartefakt für Host- und Plugin-Flows fortführen
- [ ] Gemeinsame Formular-Bridge und Referenzmigrationen in `@sva/studio-ui-react` und betroffenen Views konsequent nachziehen

## Migration / Exit-Strategie

Bestehende Legacy-Flows werden nicht rückwirkend blind umgestellt. Der Exit aus einer Ausnahme erfolgt, sobald ein Flow grundlegend überarbeitet wird oder neue fachliche Validierungs-/Submit-Komplexität hinzukommt. Falls ein späterer Standardwechsel nötig wird, bleibt `zod` die maßgebliche Validierungsquelle; die UI-Brücke könnte dann kontrolliert ersetzt werden.

---

**Links:**
- [Studio-Foundations-Governance](../development/studio-foundations-governance.md)
- [Formular-Migrationsinventur](../development/studio-form-migrationsinventur.md)
- [Testing-Strategie](../development/testing-strategy.md)
- [05 Bausteinsicht](../architecture/05-building-block-view.md)
- [08 Querschnittliche Konzepte](../architecture/08-cross-cutting-concepts.md)
