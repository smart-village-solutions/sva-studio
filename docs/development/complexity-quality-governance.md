# Komplexitäts- und Qualitäts-Governance

## Ziel

Dieses Dokument beschreibt die verbindliche Governance für strukturelle Komplexität in zentralen und kritischen Modulen.

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

`pnpm complexity-gate` bewertet nur die in der Policy registrierten Module. Neue Überschreitungen ohne Ticket schlagen fehl. Bereits bekannte Altlasten bleiben sichtbar, müssen aber im Ticket-Register hinterlegt sein.

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

Die Komplexitäts-Baseline wird nur nach bewusstem Team-Entscheid aktualisiert:

```bash
pnpm complexity-gate --update-baseline
```

Eine Baseline-Aktualisierung ersetzt kein Refactoring-Ticket. Sie dokumentiert nur den Referenzstand für Trendauswertung.

## Typische Änderungen

### Neues kritisches Modul aufnehmen

1. Modul in `tooling/quality/complexity-policy.json` registrieren
2. Klasse, Owner und Review-Zyklus festlegen
3. Coverage-Floors in `tooling/testing/coverage-policy.json` ergänzen
4. Gate lokal ausführen

### Neues Finding absichern

1. Ursache analysieren
2. Refactoring-Ticket anlegen
3. `trackedFindings` ergänzen
4. PR-Beschreibung um Ticket-Bezug erweitern
5. Prüfen, ob zusätzliche Hotspot-Coverage nötig ist
