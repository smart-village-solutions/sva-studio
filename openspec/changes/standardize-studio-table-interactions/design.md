## Context

`@sva/studio-ui-react` besitzt bereits die zentrale Button-, Badge-, Dialog- und Datentabellenbasis. Die konkreten Tabelleninteraktionen werden jedoch an vielen Aufrufstellen durch lokale Klassenkombinationen zusammengesetzt. Dadurch erhalten semantisch gleiche Aktionen unterschiedliche Hover-Flächen, Schriftstärken, Tooltips, Fokuszustände und Ausrichtungen.

Die Waste-Tourenliste macht diese Unterschiede besonders sichtbar: Fraktionen erscheinen als klickbare Badges, Abholortanzahlen und Verschiebungen verwenden verschiedene Unterstreichungszustände, der Status ist ein kompakter Switch und die Aktionsspalte besitzt eine lokale Icon-Button-Abstraktion. Die Tourenbezeichnung ist trotz ihrer Rolle als primäre Zeilenidentität nicht interaktiv.

Die zentrale Inhaltstabelle verwendet bereits `StudioDataTable` und ein Badge-Dialog-Muster für Statusänderungen, stellt den Inhaltstitel aber als reinen Text dar und dupliziert das Öffnen-/Bearbeitungsziel in der Aktionsspalte. Ihre Migration prüft, dass die neuen Primitives sowohl in einer Custom-Tabelle als auch in der kanonischen responsiven Datentabelle funktionieren.

## Goals / Non-Goals

### Goals

- Drei klar unterscheidbare Interaktionsmuster für Tabellen bereitstellen.
- Reine Textzellen und anklickbare Informationen bereits im Ruhezustand unterscheidbar machen.
- Link- und Button-Semantik trotz gemeinsamer visueller Sprache erhalten.
- Statusdarstellung und Statusänderung trennen: Badge als Zustand, Dialog als kontrollierte Änderung.
- Body-Zellen durchgängig oben ausrichten und dadurch eine stabile Leselinie bei unterschiedlich hohen Inhalten schaffen.
- Die Muster in `@sva/studio-ui-react` besitzen und zuerst vollständig in der Waste-Tourenliste anwenden.
- Die Muster zusätzlich in der zentralen Inhaltstabelle einschließlich ihrer mobilen Kartenansicht nachweisen.

### Non-Goals

- Keine neue Tabellen-Engine und keine sofortige repositoryweite Migration.
- Keine fachliche Umdeutung vorhandener Aktionen oder Beziehungen.
- Keine verkleinerten Touch-Ziele für eine höhere visuelle Dichte.
- Keine rein farbbasierte Kennzeichnung von Interaktivität oder Status.

## Decisions

### Decision: Drei gemeinsame Tabellenmuster statt eines universellen Zell-Controls

Die Shared-UI stellt drei getrennte Muster bereit:

- `StudioTableActionButton` für kompakte Icon-Aktionen,
- `StudioTableValueAction` für anklickbare Informationen,
- `StudioStatusBadge` für semantisch beschriftete Zustände.

Die Komponenten besitzen nur Darstellung und zugängliche Interaktionssemantik. Fachliche Navigation, Mutation, Berechtigung, Dialogzustand und Fehlermeldung bleiben beim Verbraucher. Dadurch entsteht keine generische Fachlogik im Design-System.

### Decision: Icon-Aktionen bauen auf dem bestehenden Button-Vertrag auf

Icon-Aktionen verwenden den gemeinsamen `Button`, semantische Action-Tokens, einen zugänglichen Namen und den vorhandenen Tooltip bei Pointer-Hover und Tastaturfokus. Das Icon bleibt klein, die wirksame Interaktionsfläche erfüllt weiterhin den bestehenden 44-Pixel-Vertrag. Destruktive Aktionen verwenden keine fest verdrahtete Farbe oder Fläche, sondern einen expliziten destruktiven Zustand innerhalb des gemeinsamen Musters.

Der Tooltip wird außerhalb abschneidender Tabellencontainer gerendert und berücksichtigt verfügbare Viewport-Fläche. In der mobilen Kartenansicht darf seine Information nicht die einzige sichtbare Erklärung einer nicht selbsterklärenden Aktion sein. Das gemeinsame Muster unterstützt deshalb eine sichtbare mobile Beschriftung. Fachlich komplexe Aktionen wie Aktivieren, Sperren, Archivieren oder Reprovisionieren werden nicht allein wegen ihrer Position in einer Tabelle in mehrdeutige Icons umgewandelt.

### Decision: Anklickbare Informationen sind ohne Hover erkennbar

Reiner Zelltext verwendet normale Textfarbe und reguläre Schriftstärke. Anklickbare Informationen verwenden im Ruhezustand eine semantische Aktionsfarbe und mindestens `font-medium`; die primäre Zeilenidentität darf `font-semibold` verwenden. Bei Hover und Tastaturfokus erscheint eine Unterstreichung, jedoch keine Hover-Fläche.

Zahlenwerte verwenden tabellarische Ziffern. Das visuelle Muster unterstützt sowohl echte Links als auch Buttons. Navigation wird als Link gerendert, damit Browserfunktionen wie neuer Tab, Cmd-/Ctrl-Klick und Kopieren des Ziels erhalten bleiben. Dialoge und lokale Aktionen werden als Button gerendert.

Externe Ziele beziehungsweise Ziele, die ausdrücklich in einem neuen Tab öffnen, erhalten eine zusätzliche visuelle und zugängliche Kennzeichnung. Das Zielverhalten wird nicht allein durch Farbe vermittelt.

### Decision: Badges sind Status vorbehalten

Badges kennzeichnen Zustände, nicht beliebige Beziehungen oder Metadaten. Fraktionen, Touren, Abholorte und Verschiebungen werden daher als Informationen und nicht als Status-Badges dargestellt.

Ein Status-Badge enthält immer einen lesbaren Statuswert; Farbe ist nur eine ergänzende Tonalität. Wenn der Status änderbar ist, liegt das Badge in einem semantischen Button-Trigger mit sichtbarem Fokuszustand. Die Änderung erfolgt über die vorhandene `Dialog`- beziehungsweise `StudioConfirmDialog`-Basis. Für diesen Scope wird kein neues Popover-Primitive und keine zusätzliche Dependency eingeführt.

Ein änderbares Status-Badge besitzt zusätzlich eine sichtbare Bearbeitungsaffordance und unterscheidet sich damit auch ohne Hover von einem rein informativen Badge. Während einer asynchronen Statusmutation bleibt der Dialog gesperrt. Er schließt nur nach Erfolg; bei einem Fehler bleibt er geöffnet und zeigt eine verständliche Fehlermeldung mit nächstem Schritt.

### Decision: Alle Tabellen-Body-Zellen sind oben ausgerichtet

Alle Tabellen-Body-Zellen verwenden einheitlich `vertical-align: top` und dasselbe vertikale Zell-Padding. Dadurch beginnen reine Texte, mehrzeilige Informationen, Status und Aktionsflächen an einer stabilen oberen Leselinie, auch wenn einzelne Zellen eine Zeile durch Listen, Beschreibungen oder hierarchische Adressen vergrößern.

Buttons, Badges, Checkboxen und andere Controls bleiben innerhalb ihrer eigenen Trefferfläche zentriert. Diese interne Zentrierung ändert nicht die obere Ausrichtung der umgebenden Tabellenzelle. Tabellenköpfe dürfen innerhalb ihrer festen Kopfhöhe weiterhin mittig ausgerichtet werden.

### Decision: Waste-Tourenliste und Inhaltstabelle sind die ersten vollständigen Verbraucher

Die Tourenliste migriert in einem zusammenhängenden Slice:

- Tourenname als primäre anklickbare Information zum bestehenden Bearbeitungsziel,
- Fraktionen als anklickbare Informationen statt klickbarer Badges,
- Verschiebungen und Abholortanzahl im gemeinsamen Informationsmuster,
- Aktiv/Inaktiv als Status-Badge mit kontrolliertem Dialog,
- Kalender, Duplizieren und Löschen als gemeinsame Icon-Aktionen; Bearbeiten entfällt als redundante Aktion,
- durchgängige Top-Ausrichtung aller Body-Zellen bei einheitlichem Padding.

Die bestehende Regel bleibt erhalten, dass sowohl `0` als auch positive Abholortanzahlen anklickbar sind. Die bisherige Create-/Edit-Verzweigung für Zuordnungen ändert sich nicht.

Die zentrale Inhaltstabelle migriert in demselben ersten Durchgang:

- Inhaltstitel als primäre anklickbare Information zum bestehenden, bereits berechtigungsabhängig aufgelösten Öffnen-/Bearbeitungsziel,
- reiner Titeltext ohne irreführende Interaktivität, wenn das Element nicht lesbar ist,
- Content-Status über das gemeinsame Status-Badge bei Beibehaltung des vorhandenen Statusdialogs, der Principal-Auflösung und der Berechtigungsprüfung,
- Entfernen der redundanten Öffnen-/Bearbeiten-Icon-Aktion, wenn der Titel dasselbe Ziel anbietet,
- Löschen als gemeinsame destruktive Icon-Aktion mit unveränderter Berechtigungs- und Bestätigungslogik,
- sichtbare Aktionsbeschriftung in der mobilen Kartenansicht, wo ein Hover-Tooltip nicht verfügbar ist.

Die Migration ändert weder Projection, Sortierung, Pagination, Content-Typ-Auflösung noch Mainserver-Mutationsverträge.

## Alternatives considered

### Nur lokale Waste-Klassen vereinheitlichen

Dies wäre der kleinste Diff, würde aber dieselbe visuelle Logik erneut im Fachplugin besitzen und spätere Tabellenmigrationen wiederholen. Da `@sva/studio-ui-react` bereits Owner gemeinsamer UI-Primitives ist, liegt das Muster dort langfristig günstiger.

### Tourenliste vollständig auf `StudioDataTable` migrieren

Die gemeinsame Datentabelle würde zusätzlich Auswahl, Sortierung und mobile Kartenansicht vereinheitlichen. Sie löst die Semantik und Darstellung einzelner Zellinteraktionen jedoch nicht automatisch. Die Migration vergrößert den Scope und wird deshalb separat bewertet.

### Statusänderung in einem Dropdown oder Popover

Ein kleines Auswahl-Popover wäre visuell kompakter. Das Projekt besitzt dafür derzeit kein gemeinsames Primitive. Dialoge decken Fokusführung, mobile Nutzung, asynchrone Fehler und Bestätigung bereits ab und verursachen keine neue Dependency oder parallele Overlay-Logik.

### Alle anklickbaren Informationen dauerhaft unterstreichen

Eine dauerhafte Unterstreichung maximiert die Erkennbarkeit, erzeugt in dichten Tabellen aber erhebliche visuelle Unruhe. Die Kombination aus semantischer Aktionsfarbe, höherer Schriftstärke sowie Unterstreichung bei Hover und Fokus bleibt auch ohne Pointer erkennbar und bewahrt die Tabellenhierarchie.

## Risks / Trade-offs

- Aktionsfarbe und Schriftgewicht müssen im Theme ausreichend von normalem Text unterscheidbar sein, ohne ausschließlich Farbe als Merkmal zu verwenden. Komponenten- und Browsertests prüfen die relevanten Zustände.
- Die 44-Pixel-Zielgröße kann Aktionsspalten verbreitern. Layout und Anzahl sichtbarer Aktionen werden angepasst, nicht die Zielgröße verkleinert.
- Ein Statusdialog erzeugt einen zusätzlichen Schritt gegenüber einem sofortigen Switch. Dafür werden Zustand, Zielwert und laufende Mutation eindeutig, und die Darstellung entspricht dem bestehenden Content-Statusmuster.
- Die auf Touren- und Inhaltetabelle begrenzte Erstmigration lässt vorübergehend andere Tabellen im alten Muster. Die gemeinsamen Primitives ermöglichen kleine, getrennt prüfbare Folgemigrationen.

## Migration Plan

1. Shared-Primitives und deren Unit-Tests in `@sva/studio-ui-react` ergänzen.
2. Die Waste-Tourenliste einschließlich Statusdialog und vertikaler Ausrichtung migrieren.
3. Bestehende Touren-, Navigations-, Übersetzungs- und Accessibility-Tests anpassen beziehungsweise ergänzen.
4. Die zentrale Inhaltstabelle einschließlich mobiler Kartenansicht migrieren.
5. Bekannte lokale Abweichungen vom Top-Ausrichtungsstandard entfernen und den Tabellenstandard in der Entwicklungsdokumentation festhalten.
6. Fokussierte Unit-, Type-, Lint- und Diff-Gates ausführen.

Ein Rollback entfernt die neuen Primitives und stellt die lokalen Tourenstile wieder her. Fachliche Daten oder Serververträge werden nicht migriert.

## Open Questions

- Keine. Interaktionsklassen, Ruhezustand, Statusdialog und Ausrichtungsregel sind fachlich abgestimmt.
