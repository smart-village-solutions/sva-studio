## Context

Alle Mainserver-basierten Inhalts-Edit-Routen lösen vor dem Rendern des Fach-Editors den zum bestehenden Inhalt gehörenden Ressourcenprincipal auf. Der gemeinsame Boundary-Zustand fasst `context_loading` und `context_unavailable` derzeit unter `unavailable` zusammen und rendert beide Zustände mit einer destruktiven Alert-Optik.

Der fachliche Sicherheitsvertrag ist korrekt: Bis zur eindeutigen Principal-Auflösung bleiben Schreibaktionen gesperrt. Nur die visuelle und semantische Darstellung des erwarteten Ladepfads ist falsch.

Die bestehende Startseite besitzt bereits unterschiedliche anonyme und authentifizierte Layouts. Sie verwendet bislang jedoch keine gemeinsame visuelle Erzählung für das modulare Studio. Die neue Motion-Sprache soll diese beiden Zustände über dieselbe Werkbank- und Baukastenanalogie verbinden.

## Goals / Non-Goals

- Goals:
  - Einen hochwertigen, wiederverwendbaren Studio-Ladezustand bereitstellen.
  - Erwartetes Laden klar von einem Fehler unterscheiden.
  - Eine charakteristische „Content Assembly“-Animation mit Anime.js umsetzen.
  - Die Studio- und Baukastenanalogie auf der Startseite vor und nach dem Login erlebbar machen.
  - Startseitenanimationen einmal je Zustandsvariante und Sitzung ausführlich, danach kompakt wiedergeben.
  - Login, Navigation, Fehlerhinweise und verfügbare Inhalte während jeder Animation bedienbar halten.
  - Den Inhalt unmittelbar anzeigen, sobald der fachliche Ladezustand beendet ist.
  - Reduced Motion, Screenreader-Semantik, Theme-Tokens und sauberes React-Cleanup gewährleisten.
- Non-Goals:
  - Keine Änderung an der Ressourcenprincipal- oder Berechtigungslogik.
  - Keine globale Ersetzung aller kompakten Inline-Ladehinweise.
  - Keine künstliche Fortschrittsanzeige oder Prozentangabe.
  - Keine garantierte Mindestdauer der Animation.
  - Keine vorgeschaltete Intro- oder Splash-Seite.
  - Keine dauerhaft laufende dekorative Hintergrundanimation.

## Decisions

### Gemeinsame Komponente im Design-System

`@sva/studio-ui-react` stellt einen neuen animierten Ladezustand bereit. Der bestehende kompakte `StudioLoadingState` bleibt für Inline- und kleinräumige Zustände unverändert. Die neue Komponente ist für seitenfüllende oder klar abgegrenzte Arbeitsflächen vorgesehen und kann von Host und Plugins wiederverwendet werden.

### Content-Assembly-Motiv

Ein kleines semantisch dekoratives SVG zeigt einen Seitenrahmen sowie abstrahierte Inhaltsbausteine für Überschrift, Text und Medium. Anime.js orchestriert das Einzeichnen des Rahmens und das zeitversetzte Erscheinen der Bausteine in einer ruhigen Schleife von ungefähr 1,6 bis 2 Sekunden. Farben und Kontraste stammen ausschließlich aus bestehenden Design-System-Tokens.

Das SVG ist für assistive Technologien verborgen. Der sichtbare, kontextbezogene Ladetext bleibt die einzige semantische Statusausgabe.

### Bedingtes Laden und React-Lebenszyklus

Anime.js wird nur geladen, wenn die animierte Komponente tatsächlich gemountet und Bewegung nicht reduziert ist. Die React-Integration kapselt die Animation in einem komponentenlokalen Scope. Beim Unmount werden Timer, Animationen und erzeugte Inline-Werte vollständig verworfen; ein verspätet abgeschlossener dynamischer Import darf keine Animation mehr starten.

### Kein künstliches Verzögern

Der fachliche Ladezustand ist die einzige Quelle für die Sichtbarkeit. Sobald er endet, wird die Komponente entfernt und der Inhalt kann im selben React-Aktualisierungspfad erscheinen. Es gibt keine Mindestanzeigedauer und keinen Timer, der den Editor zurückhält.

Eine kurze Eintrittsverzögerung darf sehr schnelle Requests vor unnötigem Flackern schützen. Sie wird auf höchstens 150 ms begrenzt. Eine optionale rein visuelle Austrittsbewegung darf den Inhalt nicht blockieren; falls ein blockierender Übergang technisch erforderlich würde, dürfte er 500 ms nicht überschreiten. Der Zielpfad verwendet keinen blockierenden Austritt.

### Lade- und Fehlerzustand trennen

Die Ressourcenprincipal-Auflösung erhält unterscheidbare Zustände für `loading`, `ready` und `error`. `loading` rendert den animierten Status. `error` behält die dauerhafte destruktive Meldung und den Fail-closed-Vertrag bei. Der eigentliche Editor wird ausschließlich in `ready` gerendert.

### Gemeinsame Studio-Workbench-Szene

Das UI-Package stellt neben dem Ladezustand eine wiederverwendbare `StudioWorkbenchScene` bereit. Sie komponiert ein dekoratives Arbeitsraster und abstrahierte Bauklötze für Inhalt, Medium, Organisation und Erweiterung. Aufrufer können vorhandene Seitenelemente als Module markieren, ohne deren Semantik, Reihenfolge oder Bedienbarkeit an die Animationsbibliothek zu koppeln.

Die Szene und ihre dekorativen Elemente sind für assistive Technologien verborgen. Überschriften, Texte, Links, Buttons, Karten und Statusmeldungen bleiben normales semantisches HTML.

### Anonyme Startseite

Beim ersten anonymen Aufruf einer Browser-Sitzung entsteht hinter dem vorhandenen Hero ein abstraktes Raster. Die vier Bauklotztypen werden in ungefähr 2 bis 2,5 Sekunden zu einer gemeinsamen Studio-Arbeitsfläche zusammengesetzt und durch kurze Linienbewegungen visuell verbunden.

Hero-Text, Login-Button, Entwicklungslogin und Authentifizierungsfehler sind ab dem ersten Render sichtbar und bedienbar. Die Animation läuft ausschließlich parallel und darf weder einen Overlay noch eine Focus-Falle erzeugen. Fest codierte sichtbare Texte werden in die vorhandenen deutschen und englischen Home-Ressourcen verschoben.

### Authentifizierte Startseite

Nach erfolgreichem Login öffnet sich das Raster als Werkbank. Die aufgrund der effektiven Berechtigungen tatsächlich gerenderten Aktionskarten erhalten eine kleine zeitversetzte Einrastbewegung; nicht gerenderte oder nicht erlaubte Karten werden auch durch die Animation nicht erfunden. Der Changelog wird als darunterliegende Arbeitsfläche mit derselben Motion-Grammatik eingeführt.

Die erste authentifizierte Sequenz dauert ungefähr 1,5 bis 2 Sekunden. Karten und Changelog bleiben währenddessen im DOM, fokussierbar und bedienbar. Berechtigungsauflösung, Card-Reihenfolge und Changelog-Laden bleiben fachlich unverändert.

### Sitzungsabhängige Wiederholung

Die Anwendung merkt die vollständige Wiedergabe anonym und authentifiziert getrennt in `sessionStorage`. Dadurch erhält der Nutzer vor dem Login und nach einem erfolgreichen Login jeweils einmal die vollständige Sequenz. Weitere Besuche desselben Zustands innerhalb derselben Browser-Sitzung verwenden nur eine kompakte Einrastbewegung von ungefähr 400 bis 500 ms.

Fehlender oder nicht beschreibbarer Session-Speicher fällt auf die kompakte, nicht blockierende Variante zurück. Der gespeicherte Wert enthält ausschließlich eine lokale Präsentationsmarkierung und keine Account-, Tenant- oder sonstigen personenbezogenen Daten.

### Sofortige Bedienbarkeit der Startseite

Die Workbench-Sequenz kontrolliert niemals, ob Seitenelemente gerendert werden. Sie animiert nur kleine Translationen, Linienfortschritt und Opazitätsakzente bereits vorhandener Elemente. Login- und Fehleraktionen werden nicht animiert oder verdeckt. Fokus, Pointer Events und Navigation bleiben während der gesamten Sequenz aktiv.

Bei `prefers-reduced-motion: reduce` zeigt die Startseite das vollständig zusammengesetzte statische Motiv und markiert die jeweilige Sitzungsvariante als gesehen, ohne eine Anime.js-Timeline zu starten.

## Alternatives considered

- Reine CSS-Animation: weniger Runtime-Code, aber eingeschränktere Orchestrierung und geringerer Wiedererkennungswert. Für das abgestimmte wiederverwendbare Motiv verworfen.
- Animiertes Studio-Logo: stärker gebrandet, aber für häufige Ladezustände zu dominant und von einer konkreten Wortmarke abhängig.
- Skeleton der gesamten Detailseite: reduziert Layoutsprünge, bildet aber den vorgelagerten Principal-Request nicht präzise ab und ist weniger gut als universeller Studio-Status einsetzbar.
- Mindestanzeigedauer: vermeidet sehr kurze Darstellungen, verzögert aber bewusst den Inhalt und widerspricht der Nutzeranforderung.
- Kontinuierlich bewegter Baukasten-Hintergrund: atmosphärisch, aber bei häufiger Nutzung unnötig ablenkend.
- Vorgeschaltete Startseiten-Intro-Sequenz: visuell stark, würde Login und Arbeitsbeginn aber künstlich verzögern.

## Risks / Trade-offs

- Zusätzliche Frontend-Dependency und Download-Größe → gezielter dynamischer Import, Dependency- und Lizenzprüfung sowie Messung des Build-Artefakts.
- Animation startet bei sehr kurzen Requests möglicherweise gar nicht → beabsichtigt; Geschwindigkeit hat Vorrang vor Sichtbarkeit der Animation.
- Wiederholte Bewegung kann ablenken → ruhige Timeline, kleine Fläche, keine hektischen Rotationen sowie statische Reduced-Motion-Variante.
- Verspäteter Import nach Unmount → Abbruchmarkierung und Scope-Cleanup verhindern nachträgliche DOM-Manipulation.
- Wiederholte Startseiteninszenierung kann bei häufiger Navigation ermüden → vollständige Sequenz getrennt für anonym und authentifiziert nur einmal pro Browser-Sitzung, danach kompakte Variante.
- Animierte Aktionskarten könnten kurzzeitig unbedienbar wirken → DOM, Fokus und Pointer Events bleiben vollständig aktiv; Fehler- und Login-Aktionen werden nicht animiert.

## Migration Plan

1. Gemeinsame Komponente und Tests im UI-Package ergänzen.
2. Ressourcenprincipal-Boundary auf getrennte Lade- und Fehlerzustände umstellen.
3. Routing-Regressionstests für sofortigen Inhaltsübergang ergänzen.
4. Gemeinsame Workbench-Szene und sitzungsabhängige Sequenzwahl ergänzen.
5. Anonyme und authentifizierte Startseite anbinden und sichtbare Texte vollständig internationalisieren.
6. Bundle- und Qualitätsprüfungen ausführen.
7. Weitere Ladeflächen nur separat und gezielt migrieren.

## Open Questions

Keine. Ladezustand, Workbench-Motiv, Sitzungswiederholung, sofortige Bedienbarkeit und maximale Verzögerungsgrenze sind abgestimmt.
