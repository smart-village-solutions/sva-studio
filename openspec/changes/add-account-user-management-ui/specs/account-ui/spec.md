# Account UI Specification

## ADDED Requirements

### Requirement: Auth State Provider

The system SHALL provide a central React context (`AuthProvider`) that makes authentication state available application-wide and replaces distributed API calls to `/auth/me` with a unified `useAuth()` hook.

#### Scenario: Authentifizierter Nutzer lädt die Anwendung

- **WHEN** ein authentifizierter Nutzer die Anwendung öffnet
- **THEN** lädt der `AuthProvider` die User-Daten über `/auth/me`
- **AND** stellt `{ user, isAuthenticated: true, isLoading: false }` über `useAuth()` bereit
- **AND** alle Komponenten, die `useAuth()` nutzen, erhalten denselben State ohne eigene API-Aufrufe

#### Scenario: Nicht-authentifizierter Nutzer

- **WHEN** ein nicht-authentifizierter Nutzer die Anwendung öffnet
- **THEN** gibt der `AuthProvider` `{ user: null, isAuthenticated: false, isLoading: false }` zurück
- **AND** der `/auth/me`-Aufruf wird nicht wiederholt, bis ein expliziter Refetch ausgelöst wird

#### Scenario: Token-Refresh während der Session

- **WHEN** der Access-Token während einer aktiven Session abläuft
- **AND** der Refresh-Token noch gültig ist
- **THEN** aktualisiert der `AuthProvider` die User-Daten automatisch nach dem Server-seitigen Token-Refresh
- **AND** die Anwendung zeigt keinen Ladeindikator während des stillen Refreshs

### Requirement: Protected Route Guard

The system SHALL provide a generic route guard that protects routes based on authentication status and role membership.

#### Scenario: Unauthentifizierter Zugriff auf geschützte Route

- **WHEN** ein nicht-authentifizierter Nutzer eine geschützte Route aufruft
- **THEN** wird der Nutzer zur Login-Seite weitergeleitet
- **AND** nach erfolgreicher Authentifizierung wird er zur ursprünglichen URL zurückgeleitet

#### Scenario: Authentifizierter Nutzer ohne ausreichende Rolle

- **WHEN** ein authentifizierter Nutzer eine Route aufruft, die eine bestimmte Rolle erfordert (z. B. `admin`)
- **AND** der Nutzer diese Rolle nicht besitzt
- **THEN** wird der Nutzer auf die Startseite weitergeleitet
- **AND** eine verständliche Fehlermeldung wird angezeigt

#### Scenario: Admin-Route-Schutz

- **WHEN** die Route `/admin/users` aufgerufen wird
- **THEN** prüft der Guard, ob der Nutzer die Rolle `system_admin` oder `app_manager` besitzt
- **AND** nur bei positiver Prüfung wird die Seite gerendert

### Requirement: Account Profile Page

The system SHALL provide an account profile page at `/account` where authenticated users can view and edit their own basic data.

#### Scenario: Profil anzeigen

- **WHEN** ein authentifizierter Nutzer `/account` aufruft
- **THEN** werden Name, E-Mail, Telefon, Position, Abteilung, Sprache und Zeitzone angezeigt
- **AND** die aktuelle Rolle und der Account-Status sind sichtbar (read-only)
- **AND** ein Avatar oder Platzhalter-Bild wird angezeigt

#### Scenario: Basis-Daten bearbeiten

- **WHEN** ein Nutzer seine Basis-Daten (Name, Telefon, Position, Abteilung, Sprache, Zeitzone) ändert
- **AND** das Formular absendet
- **THEN** werden die Änderungen in der IAM-Datenbank und in Keycloak gespeichert
- **AND** eine Erfolgsbestätigung wird angezeigt
- **AND** der `AuthProvider`-State wird aktualisiert

#### Scenario: Sicherheits-Einstellungen ändern

- **WHEN** ein Nutzer auf „Passwort ändern", „E-Mail ändern" oder „Zwei-Faktor-Authentifizierung" klickt
- **THEN** wird er zur Keycloak Account Console weitergeleitet (`{issuer}/realms/{realm}/account/`)
- **AND** nach Abschluss kehrt er über einen konfigurierten Redirect zum Studio zurück

#### Scenario: Validierungsfehler bei Profilbearbeitung

- **WHEN** ein Nutzer ungültige Daten eingibt (z. B. leerer Name, ungültiges Telefonnummerformat)
- **THEN** werden feldspezifische Fehlermeldungen angezeigt
- **AND** das Formular wird nicht abgesendet

### Requirement: User Administration List

The system SHALL provide a user administration list view at `/admin/users` that enables administrators to manage all user accounts.

#### Scenario: User-Liste laden

- **WHEN** ein Administrator `/admin/users` aufruft
- **THEN** wird eine Tabelle aller Nutzer angezeigt mit Spalten: Name, E-Mail, Rolle, Status, Letzter Login
- **AND** die Tabelle unterstützt Sortierung nach jeder Spalte
- **AND** die Tabelle paginiert bei mehr als 25 Einträgen

#### Scenario: User-Suche

- **WHEN** ein Administrator einen Suchbegriff eingibt
- **THEN** werden die Ergebnisse nach Name, E-Mail und Organisation gefiltert
- **AND** die Filterung erfolgt in Echtzeit (Debounce 300ms)

#### Scenario: Status-Filter

- **WHEN** ein Administrator den Status-Filter auf „Aktiv", „Inaktiv" oder „Ausstehend" setzt
- **THEN** zeigt die Tabelle nur Nutzer mit dem ausgewählten Status
- **AND** der Filter ist mit der Suche kombinierbar

#### Scenario: Bulk-Aktionen

- **WHEN** ein Administrator mehrere Nutzer per Checkbox auswählt
- **AND** eine Bulk-Aktion ausführt (z. B. „Deaktivieren", „Löschen")
- **THEN** wird eine Bestätigungsmeldung angezeigt
- **AND** nach Bestätigung werden alle ausgewählten Nutzer aktualisiert
- **AND** ein Activity-Log-Eintrag wird pro betroffenem Nutzer erstellt

#### Scenario: Neuen Nutzer anlegen

- **WHEN** ein Administrator auf „Nutzer anlegen" klickt
- **THEN** öffnet sich ein Formular mit Pflichtfeldern: Name, E-Mail, Rolle
- **AND** nach dem Speichern wird der Nutzer in der IAM-DB und in Keycloak erstellt
- **AND** der Nutzer erhält eine Einladungs-E-Mail über Keycloak

### Requirement: User Edit Page

The system SHALL provide a user edit page at `/admin/users/:userId` that enables detailed editing of a user account in a tabbed view.

#### Scenario: Tab-Navigation

- **WHEN** ein Administrator die User-Bearbeitungsseite aufruft
- **THEN** werden 4 Tabs angezeigt: „Persönliche Daten", „Verwaltung", „Berechtigungen", „Historie"
- **AND** der erste Tab ist standardmäßig ausgewählt
- **AND** der Tab-Wechsel erfolgt ohne Seitenneuladung

#### Scenario: Persönliche Daten bearbeiten

- **WHEN** ein Administrator den Tab „Persönliche Daten" öffnet
- **THEN** kann er Name, E-Mail, Telefon, Position, Abteilung und Adresse des Nutzers bearbeiten
- **AND** Änderungen werden in IAM-DB und Keycloak synchronisiert

#### Scenario: Verwaltung – Status und Rollen

- **WHEN** ein Administrator den Tab „Verwaltung" öffnet
- **THEN** kann er den Account-Status ändern (aktiv/inaktiv/ausstehend)
- **AND** Rollen zuweisen oder entfernen
- **AND** Sprach- und Zeitzone-Präferenzen setzen
- **AND** administrative Notizen hinterlegen

#### Scenario: Berechtigungen einsehen

- **WHEN** ein Administrator den Tab „Berechtigungen" öffnet
- **THEN** werden die effektiven Berechtigungen des Nutzers angezeigt (aggregiert aus allen zugewiesenen Rollen)
- **AND** die Anzeige ist gruppiert nach Ressourcentyp (Inhalte, Medien, Benutzer, Module, Design, Einstellungen)

#### Scenario: Historie einsehen

- **WHEN** ein Administrator den Tab „Historie" öffnet
- **THEN** werden die letzten Activity-Log-Einträge des Nutzers chronologisch angezeigt
- **AND** jeder Eintrag zeigt: Datum, Aktion, Beschreibung, Ausführender
- **AND** die Liste ist scrollbar und paginiert

#### Scenario: Unsaved-Changes-Warnung

- **WHEN** ein Administrator ungespeicherte Änderungen hat
- **AND** versucht, die Seite zu verlassen oder den Tab zu wechseln
- **THEN** wird eine Warnmeldung angezeigt
- **AND** der Nutzer kann wählen, ob er speichern, verwerfen oder abbrechen möchte

### Requirement: Roles Management Page

The system SHALL provide a roles management page at `/admin/roles` that enables viewing and editing of system and custom roles.

#### Scenario: Rollen-Übersicht

- **WHEN** ein Administrator `/admin/roles` aufruft
- **THEN** werden alle Rollen in einer Tabelle angezeigt mit: Name, Typ (System/Custom), Beschreibung, Anzahl zugewiesener Nutzer
- **AND** System-Rollen (7 Personas) sind als nicht-löschbar gekennzeichnet

#### Scenario: Berechtigungs-Matrix einer Rolle

- **WHEN** ein Administrator eine Rolle expandiert oder anklickt
- **THEN** wird eine Berechtigungs-Matrix angezeigt
- **AND** die Matrix zeigt pro Ressourcentyp die Aktionen: Lesen, Erstellen, Bearbeiten, Löschen, Konfigurieren
- **AND** für System-Rollen ist die Matrix read-only

#### Scenario: Custom-Rolle erstellen

- **WHEN** ein Administrator eine neue Custom-Rolle erstellt
- **THEN** kann er einen Namen, eine Beschreibung und Berechtigungen aus der Matrix auswählen
- **AND** die Rolle wird in der IAM-DB gespeichert
- **AND** die Rolle ist sofort für User-Zuweisungen verfügbar

#### Scenario: Custom-Rolle löschen

- **WHEN** ein Administrator eine Custom-Rolle löschen möchte
- **AND** die Rolle noch Nutzern zugewiesen ist
- **THEN** wird eine Warnung angezeigt mit der Anzahl betroffener Nutzer
- **AND** der Administrator muss die Löschung explizit bestätigen
- **AND** die Rollenzuweisung wird von allen betroffenen Nutzern entfernt

### Requirement: IAM Service API

The system SHALL provide server-side API endpoints for user CRUD, role management, and profile updates that keep the IAM database and Keycloak in sync.

#### Scenario: User auflisten

- **WHEN** ein authentifizierter Administrator `GET /api/iam/users` aufruft
- **THEN** werden alle User-Accounts aus der IAM-DB zurückgegeben
- **AND** die Antwort enthält Pagination-Metadaten (`total`, `page`, `pageSize`)
- **AND** Query-Parameter für Filter (`status`, `role`, `search`) werden unterstützt

#### Scenario: User erstellen mit Keycloak-Sync

- **WHEN** ein Administrator `POST /api/iam/users` aufruft
- **THEN** wird der Nutzer zunächst in Keycloak erstellt (über Admin API)
- **AND** anschließend in der IAM-DB mit der Keycloak-ID als Referenz gespeichert
- **AND** bei einem Fehler in einem der Schritte wird ein Rollback ausgeführt

#### Scenario: Profil-Self-Service-Update

- **WHEN** ein Nutzer `PATCH /api/iam/users/me/profile` aufruft
- **THEN** werden nur die erlaubten Felder aktualisiert (Name, Telefon, Position, Abteilung, Sprache, Zeitzone)
- **AND** die Änderungen werden in IAM-DB und Keycloak User Attributes synchronisiert
- **AND** Felder wie E-Mail, Status oder Rollen können über diesen Endpunkt NICHT geändert werden

#### Scenario: JIT-Account-Erstellung beim Erst-Login

- **WHEN** ein Nutzer sich erstmals über Keycloak authentifiziert
- **AND** kein Eintrag in `iam.accounts` für die Keycloak-ID existiert
- **THEN** wird automatisch ein Account erstellt mit den Daten aus dem JWT (email, name)
- **AND** der Account erhält den Status `pending` bis ein Administrator ihn aktiviert
- **AND** ein Activity-Log-Eintrag wird geschrieben
