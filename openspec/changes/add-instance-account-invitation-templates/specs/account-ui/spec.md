## ADDED Requirements

### Requirement: Instanzdetail verwaltet die Account-Einladungsvorlage

Die Instanzdetailseite SHALL berechtigten Plattformadministratoren erlauben,
eine deutsche Account-Einladungsvorlage für genau diese Studio-Instanz zu
bearbeiten, vorzuschauen und auf den SVA-Standard zurückzusetzen. Die
Oberfläche SHALL die bestehende Autorisierung der Instanzverwaltung verwenden
und keine parallele Administrationsroute oder neue Rollenabkürzung einführen.

#### Scenario: Individualvorlage bearbeiten

- **WHEN** ein berechtigter Plattformadministrator die Aktion „Account-Einladung anpassen“ auf einer Instanzdetailseite öffnet
- **THEN** zeigt die UI Betreff, Nachrichtentext und die Beschriftungen für Passwort- und Startseitenlink
- **AND** erklärt sie die vier erlaubten Platzhalter `{{tenantName}}`, `{{passwordSetupLink}}`, `{{tenantHomepageLink}}` und `{{linkExpiresIn}}`
- **AND** zeigt sie die aktuelle Vorlagenrevision und den Projektionszustand des zugeordneten Realm
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
- **THEN** zeigt die UI den versionierten SVA-Standardtext als wirksame Vorlage
- **AND** weist sie einen noch nicht bestätigten oder fehlgeschlagenen Realm-Readback sichtbar aus
- **AND** entfernt sie keine anderen Realm-Lokalisierungen

#### Scenario: Konkurrierende Bearbeitung erkennen

- **WHEN** die beim Speichern mitgesendete Revision nicht mehr der aktuellen Vorlagenrevision entspricht
- **THEN** überschreibt die UI den neueren Zustand nicht
- **AND** fordert sie zum Neuladen der aktuellen Vorlage auf
- **AND** setzt sie den Fokus auf eine wahrnehmbare Konfliktmeldung

#### Scenario: Statusmeldungen bleiben barrierefrei

- **WHEN** Speichern, Projektion oder Reset erfolgreich ist oder fehlschlägt
- **THEN** zeigt die UI eine lokalisierte Rückmeldung mit `role="status"` und `aria-live="polite"`
- **AND** unterscheidet sie gespeicherten Sollzustand, bestätigte Projektion, Drift und Keycloak-Nichtverfügbarkeit verständlich

