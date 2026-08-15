## Context

`mapPoiItemToDetailFormValues` und `mapPoiDetailFormValuesToInput` bilden gemeinsam die produktive Übersetzungsgrenze zwischen Mainserver-POI und Editorformular. Die Änderung muss vorhandene Legacy- und Datenintegritätssemantik erhalten, darf aber wiederholte Normalisierung und verzweigte Orchestrierung lokal reduzieren.

## Goals / Non-Goals

- Goals:
  - Inbound-Mapping und Serialisierung separat charakterisieren
  - vorhandene Werte-, Clear-, Reihenfolge-, Fallback- und Filtersemantik erhalten
  - Komplexität durch fachlich benannte, reine, pluginlokale Transformationen reduzieren
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

## Risks / Trade-offs

- Versehentliche Änderung von Leerungs- oder Filtersemantik kann Daten beim Speichern verlieren.
  - Mitigation: getrennte Characterization-Matrizen für Inbound und Serialisierung sowie Roundtrip-Nachweise.
- Aktive Editor-Changes berühren dasselbe Paket.
  - Mitigation: Der Scope bleibt auf Mapping-/Serialisierungs-Source und reine Formvertragstests begrenzt; bei Datei-, Vertrag- oder Testinfrastrukturüberschneidung wird gestoppt.

## Migration Plan

1. Bestehende POI-Unit- und Type-Targets als Baseline ausführen.
2. Characterization für beide Transformationsrichtungen gegen unveränderte Produktionssource ergänzen und grün ausführen.
3. Erst nach Review des Changes die produktive Implementierung in kleinen Blöcken umsetzen.
4. Workspace-Gates, Coverage und exakten Fallow-New-only-Audit ausführen.

## Open Questions

- Keine. Eine notwendige Vertragskorrektur beendet diesen Refactoring-Scope.
