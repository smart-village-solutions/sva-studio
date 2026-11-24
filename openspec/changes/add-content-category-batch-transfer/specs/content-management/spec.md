## ADDED Requirements

### Requirement: Inhaltsübersicht filtert nach zugeordneten Kategorien

Die Studio-Inhaltsübersicht SHALL einen Kategorienfilter mit den übrigen Listenfiltern kombinieren und vor der Pagination auf die für den Benutzer sichtbare Treffermenge anwenden. Maßgeblich SHALL die eindeutige direkte Zuordnung zur ausgewählten Kategorie sein.

#### Scenario: Die Kategorie trifft auch auf weiteren Seiten zu

- **GEGEBEN** die sichtbaren Inhalte mit einer ausgewählten Kategorie füllen mehrere Seiten
- **WENN** ein Benutzer nach dieser Kategorie filtert
- **DANN** enthalten alle Seiten nur berechtigte Inhalte mit dieser Zuordnung
- **UND** die Gesamtanzahl bezieht sich auf die gefilterte Treffermenge

#### Scenario: Zwei Kategorien tragen denselben Namen

- **GEGEBEN** zwei Kategorien tragen denselben Namen und unterscheiden sich in ID oder Geltungsbereich
- **WENN** ein Benutzer eine davon auswählt
- **DANN** erscheinen nur Inhalte, deren Zuordnung eindeutig auf die ausgewählte Kategorie verweist

### Requirement: Ein Inhaberwechsel verwendet die bestätigte Auswahl der Inhaltsübersicht

Studio SHALL einzelne ausgewählte Inhalte und eine Auswahl aller gefilterten Treffer über Seitengrenzen hinweg an einen gemeinsam gewählten Zielinhaber übertragen können. Der bestätigte Auftrag SHALL genau die im Dialog zugrunde gelegten eindeutigen Inhalte und das gewählte Ziel enthalten.

#### Scenario: Alle Treffer außer einem Inhalt werden übertragen

- **GEGEBEN** die gefilterte Trefferliste ist vollständig und umfasst mehrere Seiten
- **WENN** der Benutzer alle Treffer auswählt, einen Treffer ausschließt und den Wechsel bestätigt
- **DANN** verwendet Studio genau die bestätigten Inhalte ohne den ausgeschlossenen Treffer
- **UND** später hinzukommende Treffer gehören nicht zum bestätigten Auftrag

#### Scenario: Die Liste enthält erst einen Teil der Treffer

- **GEGEBEN** die Inhaltsübersicht zeigt einen unvollständigen Listenstand
- **WENN** der Benutzer Inhalte auswählt
- **DANN** kann er die bereits sichtbaren Inhalte einzeln auswählen
- **UND** Studio kennzeichnet die Auswahl aller Treffer als vorübergehend nicht verfügbar

#### Scenario: Derselbe Datensatz erscheint in zwei Ansichten

- **GEGEBEN** derselbe Mainserver-Datensatz erscheint unter zwei sichtbaren Inhaltsreferenzen
- **WENN** beide Referenzen zur Auswahl gehören
- **DANN** wird der Datensatz höchstens einmal übertragen

### Requirement: Ein gemeinsamer Transfer wahrt Berechtigungen und weist Einzelergebnisse aus

Studio SHALL für jeden ausgewählten Inhalt den bestehenden Transfervertrag mit aktueller inhaltsbezogener Autorisierung, Prüfung des Zielinhabers und unveränderter Inhaltsintegrität anwenden. Studio SHALL das Ergebnis pro Inhalt ausweisen und bestätigte Provider-Transfers beim Wiederanlauf vor erneuter Ausführung schützen.

#### Scenario: Ein Inhalt kann nach der Bestätigung nicht mehr übertragen werden

- **GEGEBEN** eine bestätigte Auswahl enthält mehrere Inhalte
- **WENN** bei einem Inhalt der Zugriff entfallen ist oder der aktuelle Quellinhaber zwischen Prüfung und Schreibzugriff wechselt
- **DANN** verändert Studio diesen Inhalt nicht und weist den Einzelfehler aus
- **UND** erfolgreich übertragene Inhalte bleiben beim neuen Inhaber

#### Scenario: Die Antwort eines Einzeltransfers geht verloren

- **GEGEBEN** Studio hat einen Einzeltransfer angestoßen und erhält keine eindeutige Antwort
- **WENN** der Auftragsstand erneut geladen wird
- **DANN** verwendet Studio die verfügbaren Transfer- und Abgleichinformationen
- **UND** ein weiterhin unklarer Transfer bleibt im Abgleich, ohne den Provider-Aufruf erneut auszulösen
