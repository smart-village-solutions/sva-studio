## MODIFIED Requirements

### Requirement: Account-Profilseite

Das System MUST eine Account-Profilseite unter `/account` bereitstellen, auf der authentifizierte Nutzer ihre eigenen Basis-Daten einsehen und bearbeiten koennen. Credential-bezogene Aenderungen wie Passwort und E-Mail gehoeren nicht in dieses Formular, sondern werden ueber Keycloak-gestuetzte Self-Service-Flows gestartet.

#### Scenario: Profil anzeigen

- **WENN** ein authentifizierter Nutzer `/account` aufruft
- **DANN** werden Benutzername, Name, E-Mail, Telefon, Position, Abteilung, Sprache und Zeitzone angezeigt
- **UND** die aktuelle Rolle und der Account-Status sind sichtbar (read-only)
- **UND** ein Avatar oder Platzhalter-Bild wird angezeigt
- **UND** die Seite zeigt einen Loading-State (`aria-busy="true"`) waehrend die Daten geladen werden
- **UND** bei einem Ladefehler wird eine Fehlermeldung mit Retry-Button angezeigt

#### Scenario: Basis-Daten bearbeiten

- **WENN** ein Nutzer seine Basis-Daten wie Name, Telefon, Position, Abteilung, Sprache oder gleichwertige nicht-credential-bezogene Profilfelder aendert
- **UND** das Formular absendet
- **DANN** werden die Aenderungen in der IAM-Datenbank gespeichert
- **UND** Keycloak wird nur fuer die dafuer vorgesehenen Profilfelder synchronisiert, sofern der bestehende Profilpfad dies verlangt
- **UND** Aenderungen an Vor- und Nachname aktualisieren den `displayName`, sofern kein abweichender benutzerdefinierter Anzeigename gepflegt wurde
- **UND** eine Erfolgsbestaetigung wird angezeigt (`role="status"`, `aria-live="polite"`)
- **UND** der `AuthProvider`-State wird aktualisiert
- **UND** der Fokus wird nach dem Speichern auf die Erfolgsbestaetigung gesetzt

#### Scenario: E-Mail- und Passwortaenderung sind nicht Teil des Profilformulars

- **WENN** ein authentifizierter Nutzer `/account` verwendet
- **DANN** bietet das Profilformular keine lokalen Eingabefelder fuer Passwort oder neue E-Mail-Adresse an
- **UND** werden solche Credential-Aenderungen ueber die dafuer vorgesehenen Menue- oder Self-Service-Einstiege des Studios gestartet

## ADDED Requirements

### Requirement: Header-Kontomenue bietet Credential-Self-Service-Einstiege

Das System SHALL die bereits vorgesehenen Menueeintraege fuer Passwort- und E-Mail-Aenderung im Header-Kontomenue aktivieren und direkt an den serverseitigen Account-Action-Pfad anbinden.

#### Scenario: Passwort-Menueeintrag ist aktiv

- **WENN** ein authentifizierter Nutzer das Kontomenue in der Kopfzeile oeffnet
- **DANN** ist der Eintrag `Passwort aendern` aktiv und nicht deaktiviert
- **UND** fuehrt direkt auf einen klaren Self-Service-Pfad des Studios, der die Keycloak-Aktion serverseitig initialisiert

#### Scenario: E-Mail-Menueeintrag ist aktiv

- **WENN** ein authentifizierter Nutzer das Kontomenue in der Kopfzeile oeffnet
- **DANN** ist der Eintrag `E-Mail aendern` aktiv und nicht deaktiviert
- **UND** fuehrt direkt auf einen klaren Self-Service-Pfad des Studios, der die Keycloak-Aktion serverseitig initialisiert

### Requirement: Rueckkehrstatus wird auf der Account-Seite angezeigt

Das System SHALL nach Rueckkehr aus einem ueber das Studio gestarteten Keycloak-Credential-Flow auf `/account` eine verstaendliche Statusmeldung fuer Erfolg oder Abbruch anzeigen.

#### Scenario: Passwortaenderung war erfolgreich

- **WENN** ein Nutzer nach erfolgreicher Passwortaenderung zu `/account` zurueckkehrt
- **DANN** zeigt die Seite eine verstaendliche Erfolgsbestaetigung
- **UND** bleibt das Profilformular normal nutzbar

#### Scenario: E-Mail-Aenderung war erfolgreich

- **WENN** ein Nutzer nach erfolgreicher E-Mail-Aenderung zu `/account` zurueckkehrt
- **DANN** zeigt die Seite eine verstaendliche Erfolgsbestaetigung
- **UND** bleibt das Profilformular normal nutzbar

#### Scenario: Nutzer hat die Aktion abgebrochen

- **WENN** ein Nutzer einen ueber das Studio gestarteten Credential-Flow in Keycloak abbricht und zu `/account` zurueckkehrt
- **DANN** zeigt die Seite eine neutrale Abbruchmeldung
- **UND** bleibt das Profilformular normal nutzbar
