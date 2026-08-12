## ADDED Requirements

### Requirement: Studio-Buttons bilden eine zugängliche Aktionshierarchie ab

Das Studio MUST für neutrale Aktionen die eindeutig benannten Buttonvarianten `primary`, `secondary` und `tertiary` bereitstellen. Primary MUST die wichtigste fachliche Aktion eines Bereichs kennzeichnen, Secondary MUST unterstützende sichtbare Aktionen abbilden und Tertiary MUST nachrangige oder kompakte Aktionen darstellen. Risikobehaftete Aktionen MUST über eine separate `destructive`-Variante erkennbar bleiben.

#### Scenario: Seite zeigt abgestufte Aktionen

- **WENN** eine Studioseite eine primäre, eine unterstützende und eine nachrangige Aktion gemeinsam rendert
- **DANN** verwendet sie dafür Primary, Secondary und Tertiary
- **UND** die Varianten bleiben ohne Kenntnis ihrer technischen Implementierungsnamen fachlich unterscheidbar
- **UND** die Seite erzeugt keine konkurrierende lokale Button-Hierarchie

#### Scenario: Buttonvariante wird ausgelassen

- **WENN** ein Studio-Button keine explizite Variante erhält
- **DANN** wird er als Primary gerendert
- **UND** diese Voreinstellung ist im Variantentyp und in automatisierten Tests eindeutig abgesichert

#### Scenario: Aktion ist destruktiv

- **WENN** eine Aktion eine risikobehaftete Wirkung wie Löschen, Deaktivieren oder Entziehen besitzt
- **DANN** verwendet sie die Destructive-Variante statt einer neutralen Hierarchiestufe
- **UND** bestehende Bestätigungs-, Berechtigungs- und Fehlerverträge bleiben erhalten

### Requirement: Buttonfarben sind theme-, modus- und zustandsübergreifend kontrastreich

Das Studio MUST Buttonfarben über zentrale semantische Action-State-Tokens für Default- und Forest-Theme sowie Light- und Dark-Mode auflösen. Aktiver Buttontext MUST in Default-, Hover-, Active-, Focus- und Loading-Zustand mindestens 4,5:1 Kontrast gegen seine unmittelbare Fläche erreichen. Fokusindikatoren und relevante nicht-textliche Zustandsinformationen MUST mindestens 3:1 Kontrast gegen angrenzende Farben erreichen.

#### Scenario: Theme oder Modus wechselt

- **WENN** ein Benutzer zwischen Light- und Dark-Mode wechselt oder das Studio Default- beziehungsweise Forest-Theme aktiviert
- **DANN** lösen Primary, Secondary, Tertiary und Destructive ihre Vordergrund-, Flächen- und Fokusfarben aus demselben semantischen Action-Tokenvertrag auf
- **UND** jede aktive Textkombination erreicht mindestens 4,5:1 Kontrast
- **UND** der Forest-Dark-Primary verwendet auf seiner hellen grünen Fläche einen ausreichend kontrastreichen Vordergrund

#### Scenario: Buttonzustand ändert sich

- **WENN** ein Button in Hover, Active, Focus oder Loading wechselt
- **DANN** verwendet der Zustand eine explizit definierte Tokenkombination
- **UND** der Zustand hängt nicht von einer transparenten Farbmischung mit dem unbekannten Untergrund ab
- **UND** die normativen Kontrastschwellen bleiben erfüllt

#### Scenario: Button liegt auf unterschiedlichen Studioflächen

- **WENN** derselbe Button auf Page-, Card-, Dialog- oder Popover-Flächen gerendert wird
- **DANN** bleiben Text, Zustand und Fokusindikator zugänglich erkennbar
- **UND** automatisierte Browserprüfungen decken die relevanten Untergründe ab

#### Scenario: Button ist deaktiviert

- **WENN** eine Aktion nicht ausführbar ist und der Button deaktiviert wird
- **DANN** verwendet er definierte Disabled-Farben statt ausschließlich die gesamte aktive Darstellung pauschal halbtransparent zu machen
- **UND** der Zustand ist visuell und semantisch als nicht bedienbar erkennbar

### Requirement: Studio-Buttons besitzen zugängliche Zielgrößen und Zustände

Das Studio MUST für Standard-, kompakte und Icon-Buttons eine wirksame Interaktionsfläche von mindestens 44 x 44 Pixel bereitstellen. Reine Icon-Buttons MUST einen zugänglichen Namen besitzen und ihren ergänzenden Tooltip bei Pointer-Hover und Tastaturfokus anzeigen. Lade- und Fokuszustände MUST semantisch und visuell erkennbar sein.

#### Scenario: Benutzer bedient einen Icon-Button

- **WENN** ein Benutzer einen reinen Icon-Button mit Pointer, Touch oder Tastatur erreicht
- **DANN** beträgt seine wirksame Interaktionsfläche mindestens 44 x 44 Pixel
- **UND** der Button besitzt einen zugänglichen Namen
- **UND** sein Tooltip erscheint bei Pointer-Hover und Tastaturfokus
- **UND** der Tooltip ersetzt den zugänglichen Namen nicht

#### Scenario: Button zeigt einen Ladezustand

- **WENN** eine Buttonaktion läuft
- **DANN** ist der Button gegen Doppelauslösung gesperrt
- **UND** stellt er den Ladezustand über `aria-busy` bereit
- **UND** bleibt sein sichtbarer Text- und Fokuskontrast innerhalb des aktiven Buttonvertrags

#### Scenario: Benutzer navigiert per Tastatur

- **WENN** ein Benutzer einen Button per Tastatur fokussiert und auslöst
- **DANN** ist ein mindestens 2 Pixel starker Fokusindikator mit mindestens 3:1 Kontrast sichtbar
- **UND** Hover-, Tooltip- oder Ladeverhalten verursacht keinen Fokusverlust

#### Scenario: Benutzer reduziert Bewegung

- **WENN** das Betriebssystem reduzierte Bewegung anfordert
- **DANN** verzichtet der Button auf nicht notwendige Zustandsanimationen
- **UND** alle Zustände bleiben ohne Bewegung erkennbar
