## Context

FAQ, Kacheln und Featured Projects sind technisch Mainserver-GenericItems, besitzen aber zusätzlich fachliche Plugins mit engeren Verträgen. Der generische Mainserver-Endpunkt unterstützt bereits das Lesen und Bearbeiten beliebiger `genericType`-Werte. Dagegen schließen Inhaltsprojektionsadapter einzelne Fachtypen aus. Dadurch hängt die Sichtbarkeit vom verwendeten Adaptermodus ab und der technische Vollzugriff ist nicht konsistent abgebildet.

## Goals / Non-Goals

- Goals:
  - ein einheitlicher generischer Lese- und Schreibvertrag für alle GenericItems
  - identisches Projektionsverhalten im schlanken und im Legacy-Adapter
  - klare Trennung zwischen technischem Vollzugriff und fachlich validierten Standardwegen
  - explizite Dokumentation der Berechtigungs- und Betriebsfolgen
- Non-Goals:
  - keine Zusammenlegung der Fachplugins mit `@sva/plugin-generic-items`
  - keine zusätzliche Fachvalidierung im generischen Editor
  - keine automatische umgebungsabhängige Rollenmutation
  - keine Änderung der fachlichen Action-Namespaces oder Mainserver-Diskriminatoren

## Decisions

### Generische Pfade filtern nicht nach `genericType`

Generische Listen, Projektionen, Details und Mutationen behandeln jeden Mainserver-Datensatz vom Typ `GenericItem` gleich. Der `genericType` bleibt ein editierbares technisches Feld. Filter auf bekannte Fachtypen werden aus beiden Projektionsadaptern entfernt.

### Der Action-Namespace bestimmt den gewählten Zugriffspfad

Der generische Pfad verlangt ausschließlich `generic-items.read`, `generic-items.create`, `generic-items.update` beziehungsweise `generic-items.delete`. Ein zusätzlicher Nachweis von `faq.*`, `cockpit-cards.*` oder `projects.*` ist nicht erforderlich. Fachpfade prüfen weiterhin ausschließlich ihren eigenen Namespace und erzwingen ihre fachlichen Verträge.

### Mehrere autorisierte Repräsentationen sind zulässig

Besitzt eine Person sowohl generische als auch fachliche Leserechte, darf derselbe Mainserver-Datensatz in der gemeinsamen Inhaltsübersicht als generischer und als fachlicher Inhalt erscheinen. Beide Projektionszeilen verwenden unterschiedliche `contentType`- und Scope-Schlüssel; eine fachübergreifende Deduplizierung findet nicht statt.

### Live-Nutzung wird durch Rollenvergabe begrenzt

`generic-items.*` ist ein technischer Vollzugriff und kann fachliche Validierung umgehen. Reguläre Live-Rollen sollen diese Actions nicht erhalten. Diese Betriebsgrenze wird dokumentiert, aber nicht über umgebungsabhängige Codepfade erzwungen.

## Risks / Trade-offs

- Fachlich ungültige Änderungen sind über den generischen Editor möglich. Mitigation: restriktive Vergabe von `generic-items.*` und deutliche Dokumentation des Vollzugriffs.
- Bei kombinierten Rechten können doppelte Darstellungen entstehen. Mitigation: Repräsentationen bleiben durch Content-Type und Modulkontext unterscheidbar; das Verhalten wird getestet und dokumentiert.
- Änderungen am `genericType` können einen Datensatz aus einer Fachansicht entfernen oder einer anderen zuordnen. Mitigation: Der generische Editor bleibt bewusst ein technisches Werkzeug; Fachplugins erzwingen weiterhin feste Diskriminatoren.

## Migration Plan

1. Projektionsfilter und Tests in beiden Adapterpfaden angleichen.
2. Spezifikationen sowie Architektur- und Betriebsdokumentation aktualisieren.
3. Bestehende Rollen unverändert lassen; Live-Rollenzuweisungen werden außerhalb dieses Changes geprüft.

## Open Questions

Keine.

