## Context

Die aktuelle Plugin-Plattform v2 erlaubt bereits Katalog, Manifest, Loader und host-owned Runtime-Bausteine. Gleichzeitig existieren noch historische oder pragmatische Abkuerzungen, ueber die Plugins interne Host-Pakete oder hostnahe Strukturmuster verwenden koennen. Die bestehenden Gates decken vor allem UI-Boundaries und allgemeine Package-Grenzen ab, aber nicht den engeren Plugin-Vertrag.

## Goals / Non-Goals

- Goals:
  - einen klaren Happy Path fuer normale Plugin-Autoren definieren
  - Sonderfaelle ausdruecklich als Advanced Path statt als Zufallsimport modellieren
  - neue Drift sofort blockieren, ohne den gesamten Bestand in einem Big Bang umzubauen
  - Dateinamen und Dateistruktur als fruehes Architektursignal operationalisieren
- Non-Goals:
  - in demselben Change alle Brownfield-Plugins umbauen
  - `@sva/plugin-sdk` zur Sammelfassade fuer jede Host-Faehigkeit machen
  - bestehende host-owned Runtime-Bausteine aus `auth-runtime`, `routing` oder App-Code sofort neu schneiden

## Decisions

### Entscheidung: Zweistufiger Plugin-Vertrag

Plugins folgen standardmaessig dem Standard Path mit `@sva/plugin-sdk` und optional `@sva/studio-ui-react`. Erweitere Faehigkeiten laufen ueber einen Advanced Path, der explizite oeffentliche Host-Vertraege verlangt.

Alternativen:

- nur ein einziger restriktiver Plugin-Pfad
  - verworfen, weil Runtime-, Job- und Integrationsbeitraege weiterhin moeglich bleiben sollen
- freie Plugin-Regel mit reiner Review-Kontrolle
  - verworfen, weil die bisherige Erfahrung zeigt, dass Drift dann zu spaet sichtbar wird

### Entscheidung: Brownfield-Baseline statt Bestandsstillstand

Bestehende Verstosse werden in einer maschinenlesbaren Baseline dokumentiert. Der neue Check toleriert nur exakt diese Altfaelle und blockiert jede neue Abweichung.

Alternativen:

- sofortige Null-Baseline
  - verworfen, weil der Bestand nicht in demselben Schritt risikofrei bereinigt werden kann
- gar keine Baseline
  - verworfen, weil neue Drift dann nur review-seitig und damit zu spaet erkannt wuerde

### Entscheidung: Path-Signals als zusaetzliche Regelklasse

Dateinamen wie `mainserver-*`, `plugin-catalog-*` oder `route-binding*` sind in Plugins ein klares Host-Signal und werden hart blockiert. Weitere Signale wie `server.ts` oder `plugin-operations.ts` bleiben review-pflichtig und brauchen im Altbestand eine Baseline-Ausnahme.

## Risks / Trade-offs

- Ein strenger Default kann Brownfield-Plugins zunaechst haeufig rot machen. Das wird bewusst ueber die Baseline abgefedert.
- Dateinamensregeln liefern Heuristiken und koennen Fehlalarme erzeugen. Deshalb gibt es getrennte Klassen fuer harte Verbote und review-pflichtige Signale.
- Die Tag-Schlupfloch-Problematik rund um `@sva/studio-module-iam` wird in diesem Change sichtbar gemacht, aber nicht vollständig aufgeloest.

## Migration Plan

1. Vertragsaenderung in OpenSpec und Doku festziehen.
2. Neuen Boundary-Check mit Tests einfuehren.
3. Bestehende Ausnahmen in der Baseline dokumentieren.
4. Folgechange fuer gemischte Package-Rollen wie `@sva/studio-module-iam` separat verfolgen.

## Open Questions

- Ob spaeter ein eigener maschinenlesbarer Allowlist-Mechanismus fuer genehmigte Advanced-Path-Pakete noetig wird.
- Ob die Erweiterungstiefen aus `add-p3-plugin-extension-tier-governance` spaeter direkt in den Boundary-Check einfliessen sollen.
