# Komplexitäts- und Qualitäts-Governance

## Ziel

Dieses Dokument beschreibt die verbindliche Governance für strukturelle Komplexität in zentralen und kritischen Modulen.

Die Komplexitäts-Policy ist bewusst breit angelegt: zentrale Produktivmodule in `apps/`, `packages/` sowie operative Skripte in `scripts/` werden standardmäßig überwacht. Nicht überwachte Bereiche und Ausschlüsse sind zu begründen und bleiben Ausnahmefälle.

Die Regeln ergänzen bestehende Lint-, Type- und Coverage-Gates um vier Metriken:

- Dateigröße
- Funktionslänge
- Cyclomatic Complexity
- Anzahl öffentlicher Exports

## Lokaler Workflow

```bash
pnpm complexity-gate
pnpm complexity-gate --update-baseline
```

`pnpm complexity-gate` bewertet nur die in der Policy registrierten Module. Die Policy soll den überwiegenden Teil des produktiven Codes abdecken. Neue Überschreitungen ohne Ticket schlagen fehl. Bereits bekannte Altlasten bleiben sichtbar, müssen aber im Ticket-Register hinterlegt sein.

Die Policy folgt einem Default-Overlay-Modell:

- Catch-all-Module decken neue Dateien in `apps/**/src`, `packages/**/src` und `scripts/**` automatisch ab
- spezifischere Hotspots werden über priorisierte Module mit strengeren Schwellen überlagert
- gleichrangige Überlappungen sind Konfigurationsfehler und blockieren das Gate

## Policy-Dateien

- Komplexitäts-Policy: `../../tooling/quality/complexity-policy.json`
- Komplexitäts-Baseline: `../../tooling/quality/complexity-baseline.json`
- Coverage-Policy für kritische Module: `../../tooling/testing/coverage-policy.json`

## Modulklassen

### `kritisch`

Für Sicherheits-, Routing- oder IAM-nahe Hotspots mit besonders hohem Änderungs- und Ausfallrisiko.

Pflichten:

- Messung in jedem PR-Lauf
- strengere Standards als für `zentral`
- jede Überschreitung braucht ein Refactoring-Ticket
- Coverage-Floors dürfen bei steigender Komplexität nicht abgesenkt werden

### `zentral`

Für Module mit hoher fachlicher Hebelwirkung, aber geringerer unmittelbarer Sicherheitskritikalität.

Pflichten:

- Messung in jedem PR-Lauf
- versionierte Schwellwerte
- neue Überschreitungen brauchen ebenfalls ein Ticket

## Ticket-Register

Bekannte Überschreitungen werden in `trackedFindings` der Komplexitäts-Policy gepflegt.

Pflichtfelder:

- `ticketSystem`
- `ticketId`
- `status`
- `summary`

Solange noch keine direkte Tracker-Integration existiert, ist dieses Register die verbindliche Nachweisspur für Refactoring-Folgearbeit. Neue Grenzwertüberschreitungen ohne Eintrag gelten als untracked Findings und blockieren das Gate.

Für initial eingetragene Bestandslasten darf temporär `ticketSystem: "policy-baseline"` genutzt werden, bis echte Backlog-Tickets nachgezogen sind. Das ist nur für bereits bestehende Überschreitungen zulässig, nicht für neue Findings.

## Ausschlussprinzip

Ausschlüsse sind restriktiv zu behandeln.

Erlaubte Regelausnahmen:

- Testdateien wie `**/*.test.ts` und `**/*.test.tsx`
- generierte Laufzeitartefakte wie `packages/sva-mainserver/src/generated/**/*.ts`

Weitere Ausschlüsse brauchen eine dokumentierte Begründung im PR und sollen nur eingeführt werden, wenn die Datei nicht sinnvoll nach denselben Wartbarkeitsmaßstäben bewertet werden kann.

## Review-Regeln

Bei Änderungen an überwachten Modulen müssen Reviewer prüfen:

- ob neue Findings entstanden sind
- ob bestehende Tickets weiterhin korrekt referenziert sind
- ob Komplexitätsanstieg feinere oder höhere Coverage-Floors erfordert

## Coverage-Kopplung für kritische Module

Die Coverage-Policy enthält für kritische Projekte zwei Ebenen:

- `minimumFloors`: projektweite Mindest-Floors
- `hotspotFloors`: Datei-spezifische Floors aus `lcov.info`

Damit gilt:

- hohe oder steigende Komplexität rechtfertigt keine Floor-Absenkung
- Hotspots können gezielt schärfer abgesichert werden als das restliche Projekt
- Komplexitäts- und Coverage-Gates müssen gemeinsam betrachtet werden

## Baseline-Prozess

Die Komplexitäts-Baseline wird nur nach bewusster Team-Entscheidung aktualisiert:

```bash
pnpm complexity-gate --update-baseline
```

Eine Baseline-Aktualisierung ersetzt kein Refactoring-Ticket. Sie dokumentiert nur den Referenzstand für Trendauswertung.

## Typische Änderungen

### Neues kritisches Modul aufnehmen

1. Prüfen, ob die Datei bereits von einem Catch-all-Modul abgedeckt ist
2. Nur bei Bedarf ein spezifisches priorisiertes Modul in `tooling/quality/complexity-policy.json` registrieren
3. Klasse, Owner, Review-Zyklus und Priorität festlegen
4. Coverage-Floors in `tooling/testing/coverage-policy.json` ergänzen
5. Gate lokal ausführen

### Neues Modul ohne Sonderregeln

1. Kein eigener Policy-Eintrag nötig, solange die Datei unter die Catch-all-Globs fällt
2. Nur bei echten Hotspots strengere Overlays ergänzen

### Priorisiertes Overlay ergänzen

1. Catch-all-Abdeckung beibehalten
2. Spezifischeres Modul mit höherer `priority` ergänzen
3. Ausschlüsse weiterhin auf Ausnahmefälle beschränken
4. Prüfen, dass keine gleichrangige Überlappung entsteht

### Neues Finding absichern

1. Ursache analysieren
2. Refactoring-Ticket anlegen
3. `trackedFindings` ergänzen
4. PR-Beschreibung um Ticket-Bezug erweitern
5. Prüfen, ob zusätzliche Hotspot-Coverage nötig ist
