## Context

`mapPoiItemToDetailFormValues` und `mapPoiDetailFormValuesToInput` bilden gemeinsam die produktive Übersetzungsgrenze zwischen Mainserver-POI und Editorformular. Die Änderung muss vorhandene Legacy- und Datenintegritätssemantik erhalten. Das unabhängige Review hat gezeigt, dass nur die Serialisierung im aktuellen Scope wirtschaftlich entflechtet werden kann; der Inbound-Mapper bleibt nach vollständiger Reversion produktiv unverändert.

## Goals / Non-Goals

- Goals:
  - Inbound-Mapping und Serialisierung separat charakterisieren
  - vorhandene Werte-, Clear-, Reihenfolge-, Fallback- und Filtersemantik erhalten
  - Komplexität der Serialisierung durch fachlich benannte, reine, pluginlokale Transformationen reduzieren
  - den Inbound-Vertrag charakterisieren und einen unwirtschaftlichen Refactor transparent stoppen
- Non-Goals:
  - keine Änderung am Mainserver-, Formular- oder Validierungsvertrag
  - keine UI-, React- oder Shared-Primitive-Änderung
  - keine gemeinsame Abstraktion mit Events oder News
  - keine rein metrische Zerlegung bereits kleiner Mapper

## Decisions

- Decision: Die beiden Transformationsrichtungen bleiben getrennt und pluginlokal.
  - Rationale: Sie besitzen unterschiedliche Eingabe- und Clear-Semantik; eine gemeinsame Engine würde Ownership und indirekte Verträge vergrößern.
- Decision: Characterization wird vor jeder produktiven Änderung gegen unveränderte Source ausgeführt.
  - Rationale: Legacy-Runtime-Werte, Teilobjekte und Referenzverhalten sind nicht vollständig aus den öffentlichen Typen ableitbar.
- Decision: Kleine Mapper werden nur geändert, wenn dies echte wiederholte Auswertung oder Ownership entfernt.
  - Rationale: Eine bloße Funktionszerlegung verschiebt den Fallow-Score, ohne Wartungswert zu schaffen.
- Decision: Der erprobte Inbound-Refactor wird vollständig revertiert und Plan 023 produktiv gestoppt.
  - Rationale: Die Datei stieg von 11 auf 16 Funktionen und von CC 96 auf 101; fünf Single-use-Mapper verteilten Entscheidungen nur über zusätzliche Grenzen. Die minimale Cognitive-Reduktion von 42 auf 41 rechtfertigt diese Ownership nicht.

## Risks / Trade-offs

- Versehentliche Änderung von Leerungs- oder Filtersemantik kann Daten beim Speichern verlieren.
  - Mitigation: getrennte Characterization-Matrizen für Inbound und Serialisierung sowie Roundtrip-Nachweise.
- Aktive Editor-Changes berühren dasselbe Paket.
  - Mitigation: Der Scope bleibt auf Mapping-/Serialisierungs-Source und reine Formvertragstests begrenzt; bei Datei-, Vertrag- oder Testinfrastrukturüberschneidung wird gestoppt.

## Migration Plan

1. Bestehende POI-Unit- und Type-Targets als Baseline ausführen.
2. Characterization für beide Transformationsrichtungen gegen unveränderte Produktionssource ergänzen und grün ausführen.
3. Die Serialisierung nach Review in kleinen Blöcken umsetzen.
4. Den Inbound-Ansatz anhand Datei- und Ownership-Metriken bewerten und bei negativem Nutzen-Aufwand-Verhältnis vollständig revertieren.
5. Workspace-Gates, Coverage und exakten Fallow-New-only-Audit ausführen.

## Open Questions

- Keine. Eine notwendige Vertragskorrektur beendet diesen Refactoring-Scope.
