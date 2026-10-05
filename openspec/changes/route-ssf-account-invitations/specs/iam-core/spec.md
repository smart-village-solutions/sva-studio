## ADDED Requirements

### Requirement: Account-Einladungen verwenden einen vertrauenswürdigen Einladungszweck

Das System SHALL den Zweck `studio` oder `ssf` bei der Nutzeranlage aus einer autorisierten Auswahl oder einem serverseitigen Standard bestimmen und am Account speichern. Eine fehlende Einstellung und bestehende Accounts ohne Zweck SHALL `studio` verwenden. Der erneute Versand SHALL den gespeicherten Zweck verwenden.

#### Scenario: Studio-Einladung bleibt am Instanz-Callback

- **WHEN** ein Account mit Zweck `studio` neu eingeladen oder erneut angeschrieben wird
- **THEN** übergibt der Server den bestehenden Studio-Client und die Instanz-URI `/auth/callback` an Keycloak

#### Scenario: SSF-Einladung führt zum KasselDIALOG

- **WHEN** ein Account mit Zweck `ssf` neu eingeladen oder erneut angeschrieben wird
- **THEN** übergibt der Server `ssf-frontend` und exakt das konfigurierte HTTPS-Origin mit dem Pfad `/login` an Keycloak
- **AND** erzeugt und versendet Keycloak weiterhin den ablaufenden `UPDATE_PASSWORD`-Aktionslink

#### Scenario: Ungültige SSF-Konfiguration verhindert den Versand

- **WHEN** SSF-Plugin, Client oder gültiges Ziel für den zugeordneten Realm fehlen
- **THEN** versendet der Server keine irreführende Einladung und meldet den Fehler sichtbar

#### Scenario: Standardänderung überschreibt keinen Accountzweck

- **WHEN** der systemweite Standard nach einer Accountanlage geändert wird
- **THEN** verwendet der erneute Versand weiterhin den gespeicherten Zweck
- **AND** leitet das System den Zweck weder aus E-Mail-Adresse noch aus SSF-Rollen ab
