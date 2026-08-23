## ADDED Requirements

### Requirement: Die gemeinsame Inhaltsübersicht bietet kanonische Typ-Schnellfilter

Das System MUST häufig verwendete Inhaltstypen in der gemeinsamen Inhaltsübersicht direkt filterbar machen, ohne eine zweite Listenquelle oder typspezifische Paralleltabelle einzuführen.

#### Scenario: Redaktion filtert schnell nach Nachrichten

- **WENN** ein Benutzer Nachrichten lesen darf und den Schnellfilter `Nachrichten` auswählt
- **DANN** navigiert die gemeinsame Inhaltsübersicht auf `/admin/content` mit dem registrierten Nachrichten-`contentType` als `type`-Search-Parameter
- **UND** die führende serverseitige Listenquelle filtert den Gesamtbestand vor Pagination nach diesem Typ
- **UND** die aktuelle Seite wird auf `1` zurückgesetzt
- **UND** Statusfilter, Sortierung und Seitengröße bleiben erhalten

#### Scenario: Redaktion filtert schnell nach Veranstaltungen

- **WENN** ein Benutzer Veranstaltungen lesen darf und den Schnellfilter `Veranstaltungen` auswählt
- **DANN** verwendet die gemeinsame Inhaltsübersicht denselben kanonischen `type`-Search-Parameter und dieselbe führende serverseitige Listenquelle
- **UND** es wird keine separate Veranstaltungs-Liste geladen

#### Scenario: Redaktion kehrt zu allen Inhalten zurück

- **WENN** ein Benutzer den Schnellfilter `Alle` auswählt
- **DANN** entfernt die Inhaltsübersicht den expliziten Typfilter aus der kanonischen URL
- **UND** zeigt sie alle im aktuellen Kontext lesbaren Inhaltstypen

#### Scenario: Weitere Inhaltstypen bleiben im Dropdown erreichbar

- **WENN** ein Benutzer weitere lesbare Inhaltstypen wie POI, Umfragen, Generische Inhalte, FAQ, Kacheln oder Projekte besitzt
- **DANN** bietet das Typ-Dropdown diese Typen an
- **UND** enthält das Dropdown Nachrichten und Veranstaltungen nicht zusätzlich zu deren Schnellfiltern
- **UND** ein Wechsel auf einen weiteren Typ setzt die Seite auf `1` zurück und erhält Statusfilter, Sortierung und Seitengröße

#### Scenario: Nicht lesbarer Schnellfilter bleibt verborgen

- **WENN** dem Benutzer die typbezogene Read-Action für Nachrichten oder Veranstaltungen fehlt
- **DANN** zeigt die Inhaltsübersicht den entsprechenden Schnellfilter nicht an
- **UND** ein gespeicherter oder manuell gesetzter Typfilter erweitert die serverseitigen Leserechte nicht
