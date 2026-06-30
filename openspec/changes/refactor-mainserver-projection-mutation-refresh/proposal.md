# Change: Refactor Mainserver Projection Mutation Refresh

## Why
Die aktuelle Studio-Projektion fuer Mainserver-Inhalte ersetzt nach jeder erfolgreichen News-, Event- oder POI-Mutation den kompletten Projektionsbestand des betroffenen Inhaltstyps.
Das ist fachlich zu breit und skaliert bei Instanzen mit vielen tausend Datensaetzen schlecht.

In der Praxis fuehrt das zu langen Wartezeiten zwischen erfolgreicher Mutation und sichtbarer Listenaktualisierung, obwohl fuer Create-, Update- und Delete-Vorgaenge nur ein einzelner Datensatz betroffen ist.
Der periodische Vollabgleich bleibt als Sicherheitsnetz sinnvoll, sollte aber nicht der Standardpfad fuer jede erfolgreiche Einzelmutation sein.

## What Changes
- Die mutationsgetriebene Mainserver-Projektionsaktualisierung wird von typweiten Vollrefreshes auf gezielte Einzeldatensatz-Aktualisierung umgestellt.
- Create- und Update-Pfade laden nach erfolgreicher Mainserver-Mutation nur den betroffenen Mainserver-Datensatz nach und aktualisieren genau dessen Projektionszeile.
- Delete-Pfade entfernen nur die betroffene Projektionszeile aus der fuehrenden Listenquelle, ohne alle Datensaetze dieses Typs neu aufzubauen.
- Der bestehende periodische Vollabgleich bleibt als Reconciliation-Pfad fuer externe Aenderungen, Drift und Fehlerfaelle erhalten.
- Bei nicht deterministisch aufloesbaren Fehlern im gezielten Nachladepfad darf das System auf einen spaeteren Vollabgleich zurueckfallen, ohne die erfolgreiche Mutation als fehlgeschlagen umzudeuten.

## Impact
- Affected specs: `content-management`, `sva-mainserver-integration`
- Affected code:
  - `apps/sva-studio-react/src/lib/mainserver-projection-refresh.server.ts`
  - `apps/sva-studio-react/src/lib/iam-content-list-projection.server.ts`
  - Mainserver-Detailadapter und zugehoerige Mapping-Layer in `@sva/sva-mainserver/server`
- Architektur-/Laufzeitwirkung:
  - deutlich weniger Last nach Einzelmutationen
  - schnellere Sichtbarkeit geaenderter Datensaetze in der Inhaltsliste
  - periodischer Vollabgleich bleibt als Hintergrundabgleich bestehen
- Risiken:
  - Delete-Pfade koennen den Datensatz nicht erneut vom Mainserver lesen und muessen deshalb die Projektionszeile anhand der bekannten Identitaet entfernen
  - Detail-Nachladen nach Mutation muss dieselben Feld- und Scope-Semantiken wie der Vollabgleich einhalten

## Scope
- Enthalten: gezielte Projektionsaktualisierung fuer News, Events und POI nach erfolgreichen Studio-initiierten Mainserver-Mutationen
- Enthalten: definierter Fallback auf periodische Reconciliation bei gezieltem Refresh-Fehler
- Nicht enthalten: Ersatz des periodischen Vollabgleichs fuer externe Mainserver-Aenderungen
- Nicht enthalten: neue Benutzeroberflaechen oder neue Mainserver-Fachobjekttypen
