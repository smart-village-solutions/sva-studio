## ADDED Requirements

### Requirement: Wiederverwendbarer animierter Studio-Ladezustand

Das System SHALL für seitenfüllende oder klar abgegrenzte erwartbare Wartezeiten einen gemeinsamen animierten Ladezustand aus `@sva/studio-ui-react` bereitstellen. Die Animation SHALL Design-System-Tokens verwenden, SHALL fachlichen Inhalt nicht imitieren und SHALL den Abschluss des zugrunde liegenden Ladevorgangs nicht künstlich verzögern.

#### Scenario: Erwarteter Ladevorgang zeigt Studio-Animation

- **WENN** eine Host- oder Plugin-Ansicht auf einen noch laufenden fachlichen Ladevorgang wartet
- **UND** der animierte Studio-Ladezustand für diese Arbeitsfläche gewählt wurde
- **DANN** zeigt die Oberfläche das abstrahierte Content-Assembly-Motiv zusammen mit einem kontextbezogenen Ladetext
- **UND** zeichnet sie den Zustand semantisch als höflichen Status und nicht als Fehler oder Alarm aus

#### Scenario: Ladevorgang ist abgeschlossen

- **WENN** der zugrunde liegende fachliche Ladevorgang abgeschlossen ist
- **DANN** entfernt die Oberfläche den animierten Ladezustand ohne Mindestanzeigedauer
- **UND** blockiert keine Animation das Rendern des Inhalts
- **UND** überschreitet eine technisch notwendige visuelle Übergangszeit niemals 500 ms

#### Scenario: Bewegung ist reduziert

- **WENN** der Nutzer `prefers-reduced-motion: reduce` aktiviert hat
- **DANN** startet die Oberfläche keine wiederholte Anime.js-Timeline
- **UND** zeigt stattdessen das fertige Motiv statisch zusammen mit demselben zugänglichen Ladetext

#### Scenario: Animierter Ladezustand wird entfernt

- **WENN** die Komponente während eines laufenden Imports oder einer laufenden Animation unmountet
- **DANN** startet keine verspätete Animation mehr
- **UND** werden alle komponentenlokalen Animationen, Timer und Inline-Änderungen bereinigt

### Requirement: Startseite verwendet eine modulare Studio-Werkbank

Das System SHALL die anonyme und die authentifizierte Startseite mit einer gemeinsamen Studio- und Baukastenanalogie inszenieren. Die Motion-Sprache SHALL eine modulare Arbeitsfläche aus Inhalts-, Medien-, Organisations- und Erweiterungsbausteinen darstellen, SHALL die fachlich verfügbaren Seitenelemente respektieren und SHALL keine Interaktion oder Inhaltsanzeige blockieren.

#### Scenario: Anonyme Startseite wird erstmals in einer Sitzung geöffnet

- **WENN** ein anonymer Benutzer die Startseite in einer Browser-Sitzung erstmals öffnet
- **DANN** baut die Oberfläche Raster und abstrakte Module in einer einmaligen Sequenz zu einer Studio-Arbeitsfläche zusammen
- **UND** bleiben Hero-Inhalt, Login, Entwicklungslogin und Fehleraktionen vom ersten Render an sichtbar, fokussierbar und bedienbar
- **UND** endet die Sequenz nach ungefähr 2 bis 2,5 Sekunden in einem ruhigen statischen Motiv

#### Scenario: Authentifizierte Startseite wird erstmals in einer Sitzung geöffnet

- **WENN** ein authentifizierter Benutzer die Startseite in einer Browser-Sitzung erstmals öffnet
- **DANN** öffnet die Oberfläche die Werkbank und setzt ausschließlich die tatsächlich gerenderten, berechtigungsabhängigen Aktionskarten als Module ein
- **UND** führt sie den Changelog als weitere Arbeitsfläche ein
- **UND** bleiben Karten, Links und Changelog während der ungefähr 1,5 bis 2 Sekunden langen Sequenz sichtbar, fokussierbar und bedienbar

#### Scenario: Startseitenzustand wurde in derselben Sitzung bereits aufgebaut

- **WENN** der Benutzer denselben anonymen oder authentifizierten Startseitenzustand in derselben Browser-Sitzung erneut öffnet
- **DANN** verwendet die Oberfläche nur eine kompakte Einrastbewegung von ungefähr 400 bis 500 ms
- **UND** wiederholt sie nicht die vollständige Sequenz
- **UND** speichert sie dafür ausschließlich eine lokale PII-freie Präsentationsmarkierung

#### Scenario: Sitzungsspeicher ist nicht verfügbar

- **WENN** `sessionStorage` nicht gelesen oder beschrieben werden kann
- **DANN** bleibt die Startseite vollständig funktionsfähig
- **UND** verwendet sie die kompakte, nicht blockierende Animationsvariante

#### Scenario: Startseite verwendet reduzierte Bewegung

- **WENN** der Nutzer `prefers-reduced-motion: reduce` aktiviert hat
- **DANN** zeigt die Startseite die vollständig zusammengesetzte Werkbank statisch
- **UND** startet sie keine Anime.js-Timeline
- **UND** bleiben Inhalt, Reihenfolge, Bedienbarkeit und Statussemantik unverändert
