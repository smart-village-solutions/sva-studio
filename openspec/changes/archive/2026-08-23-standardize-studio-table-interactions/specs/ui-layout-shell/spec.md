## ADDED Requirements

### Requirement: Studio-Tabellen unterscheiden Aktionen, Status und anklickbare Informationen konsistent

Das Studio MUST für Tabellen drei gemeinsame Interaktionsmuster bereitstellen: Icon-Aktionen, Status-Badges und anklickbare Informationen. Die Muster MUST in `@sva/studio-ui-react` besessen werden und MUST ihre jeweilige Semantik, sichtbare Zustände und zugängliche Bedienung konsistent abbilden.

#### Scenario: Tabelle zeigt eine Icon-Aktion

- **WENN** eine Tabellenzeile eine Aktion wie Bearbeiten, Duplizieren, Löschen oder Öffnen eines Kalenders anbietet
- **DANN** verwendet die Aktion ein Icon mit zugänglichem Namen
- **UND** zeigt sie einen Tooltip bei Pointer-Hover und Tastaturfokus
- **UND** erhält sie bei Hover einen semantischen Aktionshintergrund
- **UND** behält sie die wirksame Mindestzielgröße des gemeinsamen Button-Vertrags
- **UND** wird ihr Tooltip nicht von scrollenden oder abgeschnittenen Tabellencontainern verdeckt

#### Scenario: Icon-Aktion erscheint in einer mobilen Tabellenkarte

- **WENN** eine nicht selbsterklärende Icon-Aktion ohne verlässlichen Hover in der mobilen Kartenansicht erscheint
- **DANN** erhält sie zusätzlich eine sichtbare Beschriftung
- **UND** bleibt ihr zugänglicher Name mit der Desktop-Aktion identisch
- **UND** wird eine fachlich komplexe Aktion nicht allein für visuelle Einheitlichkeit in ein mehrdeutiges Icon umgewandelt

#### Scenario: Tabelle zeigt anklickbare und reine Informationen

- **WENN** eine Zelle eine anklickbare Information neben nicht interaktiven Textzellen enthält
- **DANN** ist die anklickbare Information bereits im Ruhezustand durch semantische Aktionsfarbe und mindestens mittlere Schriftstärke unterscheidbar
- **UND** erhält sie bei Hover und Tastaturfokus eine Unterstreichung ohne Hintergrundwechsel
- **UND** besitzt sie einen sichtbaren Fokuszustand
- **UND** verwendet sie für Navigation einen Link und für Dialog- oder lokale Aktionen einen Button
- **UND** bleibt reiner Text ohne interaktive Darstellung und ohne Fokusziel

#### Scenario: Tabelle zeigt einen änderbaren Status

- **WENN** eine Zelle einen fachlichen Status darstellt
- **DANN** zeigt sie ein beschriftetes semantisches Status-Badge
- **UND** vermittelt sie den Status nicht ausschließlich durch Farbe
- **UND** öffnet ein änderbares Status-Badge über einen semantischen Button ein zugängliches Dialogmuster für Auswahl oder Bestätigung
- **UND** besitzt das änderbare Badge eine sichtbare Bearbeitungsaffordance
- **UND** schließt der Dialog nach einer Mutation nur bei Erfolg
- **UND** bleibt er bei einem Fehler mit verständlicher Fehlermeldung und nächstem Schritt geöffnet
- **UND** bleibt ein nicht änderbarer Status ohne irreführende Interaktivität sichtbar

#### Scenario: Primäre Zeilenidentität und Aktionsspalte führen zum selben Ziel

- **WENN** eine primäre anklickbare Information bereits das vorhandene Öffnen- oder Bearbeitungsziel einer Zeile anbietet
- **DANN** rendert die Aktionsspalte kein redundantes Icon für dasselbe Ziel
- **UND** bleiben eigenständige Aktionen mit abweichender Wirkung separat erreichbar

#### Scenario: Tabelle zeigt Beziehungen oder Metadaten

- **WENN** eine Zelle eine Beziehung oder Information wie Tour, Fraktion, Abholort oder Verschiebung darstellt
- **DANN** verwendet sie das Informationsmuster statt eines Status-Badges
- **UND** bleibt die fachliche Unterscheidung zwischen Zustand und Beziehung visuell eindeutig

### Requirement: Studio-Tabellen richten Body-Zellen einheitlich oben aus

Das Studio MUST alle Tabellen-Body-Zellen bei einheitlichem vertikalem Zell-Padding oben ausrichten. Controls MUST innerhalb ihrer eigenen Trefferfläche zentriert bleiben, ohne die Ausrichtung der umgebenden Zelle zu verändern.

#### Scenario: Zeile enthält unterschiedlich hohe Inhalte

- **WENN** eine Tabellenzeile einzeilige Werte, mehrzeilige Informationen, einen Status oder eine Aktionsgruppe enthält
- **DANN** beginnen alle Body-Zellen an derselben oberen Leselinie
- **UND** verwendet keine einzelne Body-Zelle aufgrund ihres Inhaltstyps eine abweichende vertikale Ausrichtung

#### Scenario: Oben ausgerichtete Zelle enthält ein Control

- **WENN** eine oben ausgerichtete Body-Zelle einen Button, ein Badge, eine Checkbox oder ein anderes Control enthält
- **DANN** bleibt das Control innerhalb seiner eigenen Trefferfläche zentriert
- **UND** bleibt die Trefferfläche als Ganzes an der oberen Zellkante ausgerichtet

#### Scenario: Tabelle rendert einen Tabellenkopf

- **WENN** eine Tabelle ihre Spaltenköpfe in einer festen Kopfhöhe rendert
- **DANN** dürfen die Inhalte der Kopfzellen innerhalb dieser Höhe mittig ausgerichtet werden
- **UND** ändert dies nicht den Top-Ausrichtungsstandard der Body-Zellen
