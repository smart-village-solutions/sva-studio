## Kontext

`apps/sva-studio-react` ist die Host-App des Studios und darf App-spezifische Zusammensetzung enthalten. Gleichzeitig existieren im Workspace bereits Zielpackages mit klarer Ownership fuer wiederverwendbare UI, fachliche Sanitizer und Mainserver-Serververtraege. Ein Teil dieser Verantwortungen wurde trotzdem app-lokal implementiert oder dupliziert.

Die Folge ist kein einzelner Laufzeitfehler, sondern Boundary-Drift:

- dieselben Studio-UI-Bausteine existieren sowohl in der App als auch in `@sva/studio-ui-react`
- Legal-Text-Sanitizing existiert sowohl in der App als auch in `@sva/iam-governance`
- Mainserver-Inhaltsrouten fuer News, Events und POI enthalten in der App umfangreiche Parse-, Validierungs- und Mutationslogik statt duenne Host-Einstiege

## Ziele

- `apps/sva-studio-react` auf App-Komposition und framework-nahe Entry-Points begrenzen
- wiederverwendbare Studio-UI zentral aus `@sva/studio-ui-react` bereitstellen
- kanonische Domain-Helper nur im owning Package pflegen
- Mainserver-Host-Logik in serverseitigen Packages statt in App-Libs verankern
- Doku, Tests und Imports auf denselben Boundary-Vertrag ausrichten

## Nicht-Ziele

- keine Verlagerung host-spezifischer Route-Bindings in generische Packages
- keine Herausloesung plugin-spezifischer Feld- oder Editorlogik aus den Fachplugins
- kein grossflaechiges Re-Themeing oder funktionales UI-Redesign
- keine neue Sammelfassade, die bestehende Zielpackages erneut verdeckt

## Entscheidungen

- `@sva/studio-ui-react` ist der kanonische Ort fuer wiederverwendbare Studio-Primitives, Listen-Templates, Tabellen und vergleichbare Verwaltungs-UI.
- `apps/sva-studio-react/src/components/ui/**` darf nur noch App-spezifische Spezialbausteine enthalten, fuer die kein geteilter Vertrag benoetigt wird.
- `@sva/iam-governance` ist die kanonische Ownership fuer Legal-Text-HTML-Sanitizing. Die App konsumiert diese Funktion, statt eine zweite Implementierung zu pflegen.
- `@sva/sva-mainserver/server` oder eng dazugehoerige serverseitige Zielmodule tragen die Ownership fuer host-owned News-, Events- und POI-Request-Parsing, Validierung und Mutations-Delegation.
- `apps/sva-studio-react` behaelt framework-spezifische Server-Einstiege, Request-Matching und Route-Assemblierung, delegiert aber fachliche Serverlogik an Packages.
- `appRouteBindings`, `appAdminResources` und vergleichbare Host-Assemblierung bleiben im App-Layer, solange sie keine generische Wiederverwendung ueber mehrere Consumer beanspruchen.

## Architektur-Schnitt

### 1. Studio-UI

Die App darf Seiten zusammensetzen, aber keine zweite kanonische Verwaltungs-UI aufbauen. Lokale Duplikate von `StudioDataTable`, Listen-Templates und geteilten Basis-Primitives werden entweder entfernt oder in Package-Exporte ueberfuehrt. Dadurch konsumieren App und Plugins dieselbe UI-Oberflaeche.

### 2. Domain-Helper

Sanitizer und vergleichbare fachlich sensible Helper duerfen nicht parallel in App und Package weiterentwickelt werden. Wenn ein owning Package bereits existiert, wird die App auf dessen API zurueckgefuehrt. Das vermeidet Drift bei Security- und Governance-Regeln.

### 3. Mainserver-Host-Adapter

Die App soll Requests empfangen und an Zielpackages delegieren, nicht selbst den fachlichen Serververtrag definieren. News-, Events- und POI-Handler werden deshalb so geschnitten, dass Parsing, Fehlerabbildung und Upstream-Mutationslogik ausserhalb der App testbar und wiederverwendbar liegen. Die App behaelt nur den TanStack-Start- oder Nitro-spezifischen Einstieg.

## Risiken / Trade-offs

- Das Refactoring kann kurzfristig mehr Package-API-Arbeit in `@sva/studio-ui-react` und `@sva/sva-mainserver` erzeugen.
  - Minderung: nur reale Duplikate und nachweisbare Boundary-Verstosse in den Scope aufnehmen.
- Beim Zusammenziehen von UI kann eine bestehende App-Variante leicht andere Props oder i18n-Annahmen haben.
  - Minderung: Ziel-API zuerst inventarisieren und dann kontrolliert auf gemeinsame Exporte heben.
- Das Verlagern von Serverlogik kann Package-Grenzen oder Runtime-Abhaengigkeiten beruehren.
  - Minderung: `pnpm check:server-runtime` frueh und gezielt laufen lassen und keine browsernahen Abhaengigkeiten in Server-Packages ziehen.

## Migrationsplan

1. Kandidaten inventarisieren und den owning Packages zuordnen.
2. Fehlende Package-APIs schaffen, bevor App-Imports umgestellt werden.
3. App-Komponenten und App-Servereinstiege auf Package-Vertraege umstellen.
4. Verbleibende App-spezifische Spezialfaelle explizit dokumentieren.
5. Architektur- und Entwicklerdokumentation auf die neuen Ziel-Boundaries synchronisieren.

## Offene Fragen

- Ob die Mainserver-Host-Handler direkt in `@sva/sva-mainserver/server` aufgehen oder ein eng gekoppeltes serverseitiges Teilmodul benoetigen, wird waehrend der Implementierung anhand der vorhandenen Runtime-Abhaengigkeiten entschieden.
