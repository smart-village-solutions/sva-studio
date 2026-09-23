## ADDED Requirements

### Requirement: Instanzdetail verwaltet die Account-Einladungsvorlage

Die Instanzdetailseite SHALL berechtigten Plattformadministratoren erlauben,
eine deutsche Account-Einladungsvorlage für genau diese Studio-Instanz zu
bearbeiten, vorzuschauen und auf die Servervorlage zurückzusetzen. Die
Oberfläche SHALL die bestehende Autorisierung der Instanzverwaltung verwenden
und keine parallele Administrationsroute oder neue Rollenabkürzung einführen.

#### Scenario: Individualvorlage bearbeiten

- **WHEN** ein berechtigter Plattformadministrator die Aktion „Account-Einladung anpassen“ auf einer Instanzdetailseite öffnet
- **THEN** zeigt die UI Betreff, Nachrichtentext und die Beschriftungen für Passwort- und Startseitenlink
- **AND** erklärt sie die vier erlaubten Platzhalter `{{tenantName}}`, `{{passwordSetupLink}}`, `{{tenantHomepageLink}}` und `{{linkExpiresIn}}`
- **AND** zeigt sie die aktuelle Vorlagenrevision und die Quelle `Instanzvorlage`, `Servervorlage` oder `SVA-Standard`
- **AND** verwendet sie keine echten Empfänger-, Token- oder Aktionslinkdaten

#### Scenario: Sichere Vorschau anzeigen

- **WHEN** der Administrator gültige Vorlagenwerte in der Bearbeitung ändert
- **THEN** zeigt die UI eine Plaintext- oder HTML-nahe Vorschau mit ausdrücklich nicht produktiven Beispieldaten
- **AND** leitet sie Tenantname und Startseite aus der aktuellen Instanz ab
- **AND** rendert sie keinen frei eingegebenen HTML-Code und ruft keinen Keycloak-Aktionslink ab

#### Scenario: Ungültige Vorlage ablehnen

- **WHEN** die Nachricht den Passwortlink nicht genau einmal enthält oder unbekannte Platzhalter, Markup oder freie Ziel-URLs verwendet
- **THEN** zeigt die UI den konkreten Validierungsfehler am betroffenen Feld
- **AND** behauptet sie weder Speicherung noch aktive Projektion

#### Scenario: Vorlage auf Standard zurücksetzen

- **WHEN** ein berechtigter Administrator die Individualvorlage nach verständlicher Bestätigung zurücksetzt
- **THEN** entfernt das System ausschließlich den Instanz-Override
- **AND** zeigt die UI die Servervorlage oder, falls diese fehlt, den SVA-Standard als wirksame Vorlage
- **AND** führt die Rücksetzung keinen Keycloak-Write aus

#### Scenario: Konkurrierende Bearbeitung erkennen

- **WHEN** die beim Speichern mitgesendete Revision nicht mehr der aktuellen Vorlagenrevision entspricht
- **THEN** überschreibt die UI den neueren Zustand nicht
- **AND** fordert sie zum Neuladen der aktuellen Vorlage auf
- **AND** setzt sie den Fokus auf eine wahrnehmbare Konfliktmeldung

#### Scenario: Statusmeldungen bleiben barrierefrei

- **WHEN** Speichern oder Reset erfolgreich ist oder fehlschlägt
- **THEN** zeigt die UI eine lokalisierte Rückmeldung mit `role="status"` und `aria-live="polite"`
- **AND** unterscheidet sie die gespeicherte Quelle und Validierungs- oder Konfliktfehler verständlich

### Requirement: Systembereich verwaltet die Servervorlage

Das System SHALL berechtigten Plattformadministratoren unter
`System -> Templates` erlauben, die serverweite Account-Einladungsvorlage zu
bearbeiten, vorzuschauen und auf den eingebauten SVA-Standard zurückzusetzen.
Der erste Lieferabschnitt SHALL dort keinen Editor für weitere oder freie
Vorlagentypen vortäuschen.

#### Scenario: Servervorlage bearbeiten

- **WHEN** ein berechtigter Plattformadministrator `System -> Templates` öffnet
- **THEN** zeigt die Seite den Eintrag „Account-Einladung“ mit Betreff, Nachricht und beiden Linkbeschriftungen
- **AND** verwendet sie dieselbe Validierung, Platzhalterhilfe und sichere Vorschau wie die Instanzvorlage
- **AND** zeigt sie die aktuelle Revision und die Quelle `Servervorlage` oder `SVA-Standard`

#### Scenario: Servervorlage speichern

- **WHEN** der Administrator eine gültige Servervorlage mit der aktuell gelesenen Revision speichert
- **THEN** persistiert das System genau diesen Servertext
- **AND** verändert es weder Instanz-Overrides noch Keycloak-Realms
- **AND** verwenden Instanzen ohne Override den neuen Text automatisch beim nächsten Einladungsversand

#### Scenario: Servervorlage zurücksetzen

- **WHEN** der Administrator die Servervorlage nach verständlicher Bestätigung zurücksetzt
- **THEN** entfernt das System den Server-Override
- **AND** zeigt die Seite den eingebauten SVA-Standard als wirksame Vorlage
- **AND** bleiben alle Instanz-Overrides unverändert

#### Scenario: Unberechtigter Zugriff bleibt verborgen

- **WHEN** ein Aufrufer die bestehende Plattformberechtigung `instance.registry.manage` nicht besitzt
- **THEN** zeigt die Navigation den Menüpunkt `Templates` nicht
- **AND** lehnen Read und Mutation den Zugriff serverseitig ab
