## MODIFIED Requirements
### Requirement: Account-Profilseite

Das System MUST eine Account-Profilseite unter `/account` bereitstellen, auf der authentifizierte Nutzer ihre eigenen Basis-Daten einsehen und bearbeiten können.

#### Scenario: Profil anzeigen

- **WENN** ein authentifizierter Nutzer `/account` aufruft
- **DANN** werden Benutzername, Name, E-Mail, Telefon, Position, Abteilung, Sprache und Zeitzone angezeigt
- **UND** die aktuelle Rolle und der Account-Status sind sichtbar (read-only)
- **UND** ein Avatar oder Platzhalter-Bild wird angezeigt
- **UND** die Seite zeigt einen Loading-State (`aria-busy="true"`) während die Daten geladen werden
- **UND** bei einem Ladefehler wird eine Fehlermeldung mit Retry-Button angezeigt

#### Scenario: Basis-Daten bearbeiten

- **WENN** ein Nutzer seine Basis-Daten (Benutzername, Name, E-Mail, Telefon, Position, Abteilung, Sprache, Zeitzone) ändert
- **UND** das Formular absendet
- **DANN** werden die Änderungen in der IAM-Datenbank und in Keycloak gespeichert
- **UND** die Benutzerverwaltung zeigt bei der nächsten Datenladung den aktualisierten Anzeigenamen und die aktualisierte E-Mail
- **UND** Änderungen an Vor- und Nachname aktualisieren den `displayName`, sofern kein abweichender benutzerdefinierter Anzeigename gepflegt wurde
- **UND** eine Erfolgsbestätigung wird angezeigt (`role="status"`, `aria-live="polite"`)
- **UND** der `AuthProvider`-State wird aktualisiert
- **UND** der Fokus wird nach dem Speichern auf die Erfolgsbestätigung gesetzt

#### Scenario: Validierungsfehler bei Profilbearbeitung

- **WENN** ein Nutzer ungültige Daten eingibt (z. B. leerer Benutzername, leerer Name, ungültiges Telefonnummerformat oder ungültige E-Mail-Adresse)
- **DANN** werden feldspezifische Fehlermeldungen angezeigt (`aria-invalid="true"`, `aria-describedby`)
- **UND** eine Error-Summary wird am Formularanfang angezeigt
- **UND** der Fokus wird auf das erste fehlerhafte Feld gesetzt
- **UND** das Formular wird nicht abgesendet

### Requirement: IAM-Service-API

Das System MUST serverseitige API-Endpunkte unter `/api/v1/iam/` für User-CRUD, Rollen-Management und Profil-Updates bereitstellen, die IAM-DB und Keycloak synchron halten.

#### Scenario: Profil-Self-Service-Update

- **WENN** ein Nutzer `PATCH /api/v1/iam/users/me/profile` aufruft
- **DANN** werden nur die erlaubten Felder aktualisiert (Benutzername, Name, E-Mail, Telefon, Position, Abteilung, Sprache, Zeitzone)
- **UND** PII-Felder werden als `*_ciphertext` verschlüsselt gespeichert
- **UND** die Änderungen werden in IAM-DB und Keycloak User Attributes synchronisiert
- **UND** Felder wie Status oder Rollen können über diesen Endpunkt NICHT geändert werden
