# Change: Wiederverwendbare Studio-Motion-Sprache ergänzen

## Why

Die Auflösung des Ressourcenprincipals vor dem Öffnen einer Inhalts-Detailseite ist ein erwarteter Ladezustand, wird derzeit aber wie ein Fehler in Rot dargestellt. Das erzeugt einen irreführenden Fehlerblitz, obwohl der Inhalt anschließend regulär geladen wird.

Das Studio soll für seitenfüllende, erwartbare Wartezeiten einen eigenständigen und wiederverwendbaren Ladezustand erhalten. Die Animation darf dabei niemals den Abschluss des eigentlichen Ladevorgangs künstlich verzögern.

Die Startseite vor und nach dem Login bietet zusätzlich einen geeigneten Ort, die Studio- und Baukastenanalogie als zusammenhängende Motion-Sprache erlebbar zu machen. Diese längeren Sequenzen sollen den Aufbau einer modularen Arbeitsfläche erzählen, ohne Login, Navigation, Fehlerhinweise oder bereits verfügbare Inhalte zu blockieren.

## What Changes

- `@sva/studio-ui-react` erhält einen wiederverwendbaren animierten Ladezustand mit einem reduzierten „Content Assembly“-Motiv aus Rahmen, Überschrift, Text und Medienfläche.
- Anime.js wird als lokale Runtime-Abhängigkeit des UI-Packages eingesetzt und ausschließlich bei tatsächlich gerendertem animiertem Ladezustand geladen.
- Der Ladezustand bleibt semantisch ein höflicher Status und wird nicht als Fehler oder Alarm ausgezeichnet.
- Bei `prefers-reduced-motion: reduce` erscheint das fertige Motiv statisch; die Animation wird nicht gestartet.
- Das Ende des fachlichen Ladevorgangs beendet den Ladezustand unmittelbar. Es gibt keine Mindestanzeigedauer und keine künstliche Abschlussverzögerung; eine optionale rein visuelle Übergangszeit darf 500 ms niemals überschreiten.
- Die Ressourcenprincipal-Auflösung vor Inhalts-Detailseiten verwendet den neuen Ladezustand. Erst eine tatsächlich fehlgeschlagene oder uneindeutige Auflösung wird weiterhin als dauerhafter Fehler dargestellt.
- `@sva/studio-ui-react` erhält außerdem eine wiederverwendbare „Studio Workbench“-Szene, mit der Seiten aus abstrahierten Inhalts-, Medien-, Organisations- und Erweiterungsbausteinen aufgebaut werden können.
- Die anonyme Startseite setzt die Bauklötze zu einer gemeinsamen Studio-Arbeitsfläche zusammen; Login, Entwicklungslogin und Fehlerhinweise bleiben währenddessen sofort sichtbar und bedienbar.
- Die authentifizierte Startseite setzt die tatsächlich verfügbaren Aktionskarten berechtigungsabhängig in die Werkbank ein und schiebt den Changelog als weitere Arbeitsfläche ein.
- Die vollständige Startseiten-Sequenz läuft je anonymem und authentifiziertem Zustand höchstens einmal pro Browser-Sitzung. Wiederholte Aufrufe verwenden nur eine verkürzte Bewegung von ungefähr 400 bis 500 ms.
- Die derzeit fest codierten deutschen Texte der anonymen Startseite werden in die deutschen und englischen Übersetzungsressourcen überführt.
- Unit- und Routing-Regressionstests sichern Semantik, Animation-Cleanup, Reduced Motion, Session-Wiederholung und unverzögerte Bedienbarkeit ab.

## Impact

- Betroffene Specs: `account-ui`, `content-management`
- Betroffener Code: `packages/studio-ui-react`, `apps/sva-studio-react/src/routing/app-route-bindings.tsx`, `apps/sva-studio-react/src/routes/-home-page.tsx`, `apps/sva-studio-react/src/routes/-home-action-cards.tsx`
- Neue Dependency: `animejs` im Package `@sva/studio-ui-react`
- Betroffene arc42-Abschnitte: `docs/architecture/08-cross-cutting-concepts.md` für den gemeinsamen UI-, Motion- und Accessibility-Vertrag
- Keine Änderung an Principal-Auflösung, Autorisierung oder Fail-closed-Sicherheitslogik
