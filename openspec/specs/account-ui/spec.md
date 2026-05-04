# account-ui Specification

## Purpose
TBD - created by archiving change add-account-user-management-ui. Update Purpose after archive.
## Requirements
### Requirement: Auth-State-Provider

Das System MUST einen zentralen React-Context (`AuthProvider` in `sva-studio-react`) bereitstellen, der den Authentifizierungs-State anwendungsweit verfügbar macht und verteilte `/auth/me`-Aufrufe durch einen einheitlichen `useAuth()`-Hook ersetzt.

#### Scenario: Authentifizierter Nutzer lädt die Anwendung

- **WENN** ein authentifizierter Nutzer die Anwendung öffnet
- **DANN** lädt der `AuthProvider` die User-Daten über `/auth/me`
- **UND** stellt `{ user, isAuthenticated: true, isLoading: false }` über `useAuth()` bereit
- **UND** alle Komponenten, die `useAuth()` nutzen, erhalten denselben State ohne eigene API-Aufrufe

#### Scenario: Nicht-authentifizierter Nutzer

- **WENN** ein nicht-authentifizierter Nutzer die Anwendung öffnet
- **DANN** gibt der `AuthProvider` `{ user: null, isAuthenticated: false, isLoading: false }` zurück
- **UND** der `/auth/me`-Aufruf wird nicht wiederholt, bis ein expliziter Refetch ausgelöst wird

#### Scenario: Token-Refresh während der Session

- **WENN** der Access-Token während einer aktiven Session abläuft
- **UND** der Refresh-Token noch gültig ist
- **DANN** aktualisiert der `AuthProvider` die User-Daten automatisch nach dem Server-seitigen Token-Refresh
- **UND** die Anwendung zeigt keinen Ladeindikator während des stillen Refreshs

#### Scenario: Stale-Permissions-Erkennung

- **WENN** ein API-Call `403 Forbidden` zurückgibt und der Nutzer eigentlich berechtigt sein sollte
- **DANN** wird `invalidatePermissions()` aufgerufen
- **UND** `/auth/me` wird refetcht, um den aktuellen Berechtigungsstand zu aktualisieren

### Requirement: Protected-Route-Guard

Das System MUST einen generischen Route-Guard bereitstellen, der Routen basierend auf Authentifizierungsstatus und Rollenzugehörigkeit schützt.

#### Scenario: Unauthentifizierter Zugriff auf geschützte Route

- **WENN** ein nicht-authentifizierter Nutzer eine geschützte Route aufruft
- **DANN** wird der Nutzer zur Login-Seite weitergeleitet
- **UND** nach erfolgreicher Authentifizierung wird er zur ursprünglichen URL zurückgeleitet

#### Scenario: Authentifizierter Nutzer ohne ausreichende Rolle

- **WENN** ein authentifizierter Nutzer eine Route aufruft, die eine bestimmte Rolle erfordert (z. B. `system_admin`)
- **UND** der Nutzer diese Rolle nicht besitzt
- **DANN** wird der Nutzer auf die Startseite weitergeleitet
- **UND** eine verständliche Fehlermeldung wird angezeigt (`t('auth.insufficientRole')`)

#### Scenario: Admin-Route-Schutz

- **WENN** die Route `/admin/users` aufgerufen wird
- **DANN** prüft der Guard über den `routerContext`, ob der Nutzer die Rolle `system_admin` oder `app_manager` besitzt
- **UND** nur bei positiver Prüfung wird die Seite gerendert

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

### Requirement: User-Administrationsliste

Das System MUST eine User-Administrationsliste unter `/admin/users` bereitstellen, mit der Administratoren alle Benutzer-Accounts verwalten können.

#### Scenario: User-Liste laden

- **WENN** ein Administrator `/admin/users` aufruft
- **DANN** wird eine semantische Tabelle (`<table>` mit `<caption>` oder `aria-label`) aller Nutzer angezeigt
- **UND** die Spalten sind: Name, E-Mail, Rolle, Status, Letzter Login
- **UND** jede Tabellenkopfzelle hat `<th scope="col">`
- **UND** sortierbare Spalten haben `aria-sort` (ascending|descending|none)
- **UND** die Tabelle paginiert bei mehr als 25 Einträgen
- **UND** ein Loading-State (`aria-busy="true"`) wird angezeigt, bis die Daten geladen sind
- **UND** bei leerem Ergebnis wird ein Empty-State angezeigt (`t('admin.users.emptyState')`)

#### Scenario: Keycloak-Benutzer synchronisieren

- **WENN** ein Administrator in `/admin/users` die Aktion „Aus Keycloak synchronisieren" ausführt
- **DANN** lädt das System Keycloak-Benutzer für den aktuellen `instanceId`-Kontext
- **UND** importiert oder aktualisiert fehlende Benutzer in IAM idempotent
- **UND** zeigt nach Abschluss eine Ergebnisrückmeldung mit Anzahl importierter und aktualisierter Benutzer
- **UND** lädt die User-Liste anschließend neu

#### Scenario: User-Suche

- **WENN** ein Administrator einen Suchbegriff eingibt
- **DANN** werden die Ergebnisse nach Name, E-Mail und Organisation gefiltert
- **UND** die Filterung erfolgt in Echtzeit (Debounce 300ms)
- **UND** die Anzahl der Treffer wird über eine `aria-live="polite"`-Region angekündigt

#### Scenario: Status-Filter

- **WENN** ein Administrator den Status-Filter auf „Aktiv", „Inaktiv" oder „Ausstehend" setzt
- **DANN** zeigt die Tabelle nur Nutzer mit dem ausgewählten Status
- **UND** der Filter ist mit der Suche kombinierbar

#### Scenario: Status-Badge-Darstellung

- **WENN** ein Account-Status angezeigt wird (aktiv/inaktiv/ausstehend)
- **DANN** wird neben der Farbe immer ein Text-Label angezeigt (`t('admin.users.status.active')` etc.)
- **UND** optional ein differenzierendes Icon (z. B. Häkchen, Pause, Uhr)
- **UND** das Kontrastverhältnis beträgt mindestens 4.5:1 (WCAG 1.4.1 + 1.4.3)

#### Scenario: Bulk-Aktionen

- **WENN** ein Administrator mehrere Nutzer per Checkbox auswählt
- **UND** eine Bulk-Aktion ausführt (z. B. „Deaktivieren")
- **DANN** wird eine Bestätigungsmeldung in einem `role="alertdialog"` angezeigt
- **UND** die maximale Batch-Größe beträgt 50 Nutzer
- **UND** der aktuell angemeldete Nutzer wird automatisch aus der Auswahl ausgeschlossen (Self-Protection)
- **UND** der letzte aktive `system_admin` wird automatisch aus der Auswahl ausgeschlossen
- **UND** nach Bestätigung werden alle ausgewählten Nutzer aktualisiert
- **UND** ein Activity-Log-Eintrag (`user.bulk_deactivated`) wird pro betroffenem Nutzer erstellt
- **UND** die „Alle auswählen“-Checkbox zeigt den `indeterminate`-Zustand, wenn nur ein Teil der Nutzer ausgewählt ist

#### Scenario: Pagination-ARIA

- **WENN** die User-Tabelle paginiert dargestellt wird
- **DANN** MUST die Pagination als `<nav aria-label="Seitennavigation">` ausgezeichnet sein
- **UND** die aktuelle Seite MUST mit `aria-current="page"` markiert sein
- **UND** die Seitenanzahl MUST über eine `aria-live="polite"`-Region angekündigt werden bei Seitenwechsel
#### Scenario: Neuen Nutzer anlegen

- **WENN** ein Administrator auf „Nutzer anlegen" klickt
- **DANN** öffnet sich ein Formular-Dialog (`role="dialog"`, `aria-modal="true"`, Focus-Trap)
- **UND** Pflichtfelder sind markiert mit `aria-required="true"`: Name, E-Mail, Rolle
- **UND** nach dem Speichern wird der Nutzer in der IAM-DB und in Keycloak erstellt
- **UND** der Nutzer erhält eine Einladungs-E-Mail über Keycloak
- **UND** bei Escape oder Klick außerhalb wird der Dialog geschlossen

### Requirement: User-Bearbeitungsseite

Das System MUST eine User-Bearbeitungsseite unter `/admin/users/:userId` bereitstellen, die eine detaillierte Bearbeitung eines Benutzer-Accounts in einer Tab-Ansicht ermöglicht.

#### Scenario: Verwaltung – Status, Rollen und Mainserver-Credentials

- **WENN** ein Administrator den Tab „Verwaltung" öffnet
- **DANN** kann er den Account-Status ändern (aktiv/inaktiv/ausstehend)
- **UND** Rollen zuweisen oder entfernen (unter Beachtung des Privilege-Escalation-Schutzes)
- **UND** Sprach- und Zeitzone-Präferenzen setzen
- **UND** administrative Notizen hinterlegen (max. 2000 Zeichen)
- **UND** die Mainserver-Felder `mainserverUserApplicationId` und `mainserverUserApplicationSecret` bearbeiten
- **UND** das Secret-Feld wird nicht mit seinem aktuellen Klartextwert vorbefüllt
- **UND** die UI zeigt stattdessen an, ob bereits ein Secret hinterlegt ist

### Requirement: Rollen-Verwaltungsseite

Das System MUST eine Rollen-Verwaltungsseite unter `/admin/roles` bereitstellen, die das Anzeigen und Bearbeiten von System- und Custom-Rollen ermöglicht.

#### Scenario: Rollenansicht bleibt der zentrale Einstieg für Rechtepflege

- **WENN** ein Administrator `/admin/roles` öffnet
- **DANN** bleibt die Rollenliste mit Suche, Sortierung, Rollenmetadaten und Aktionen der primäre Einstiegspunkt
- **UND** Rollenrechte werden innerhalb derselben Seite oder desselben Bedienflusses vertieft statt in ein separates Top-Level-Modul ausgelagert
- **UND** die bestehende Expand-, Detail- oder gleichwertige Arbeitsbereichslogik bleibt mit vorhandenen Admin-Patterns konsistent

#### Scenario: Detailroute bleibt Teil desselben Rollenverwaltungsflusses

- **WENN** eine Rolle aus der Rollenliste in einen vertieften Arbeitsbereich geöffnet wird
- **DANN** ist eine dedizierte Detailroute wie `/admin/roles/$roleId` zulässig, sofern sie Teil desselben Rollenverwaltungsflusses bleibt
- **UND** die Rollenliste weiterhin der primäre Einstiegspunkt ist
- **UND** kein separates Top-Level-Admin-Modul für Rechtepflege entsteht

#### Scenario: Rollenmetadaten und Editierbarkeit sind eindeutig sichtbar

- **WENN** eine Rolle in der Rollenansicht dargestellt wird
- **DANN** sind mindestens `externalRoleName`, `managedBy`, `roleLevel`, Sync-Zustand und Mitgliederzahl sichtbar
- **UND** System-Rollen und extern verwaltete Rollen sind als read-only kenntlich
- **UND** destruktive oder fachlich nicht zulässige Aktionen sind nicht nur deaktiviert, sondern auch verständlich begründet

#### Scenario: Rollenrechte werden fachlich lesbarer dargestellt

- **WENN** ein Administrator die Rechte einer Rolle öffnet
- **DANN** priorisiert die UI fachliche Bezeichnungen, Gruppierungen oder Beschreibungen der Rechte
- **UND** technische Werte wie `permissionKey` bleiben höchstens ergänzende Detailinformation
- **UND** die Oberfläche zwingt Administratoren nicht zur ausschließlichen Interpretation roher technischer Schlüssel

#### Scenario: Rollenansicht verzahnt sich mit bestehender IAM-Prüfung

- **WENN** ein Administrator aus einer Rolle heraus eine Rechteentscheidung nachvollziehen möchte
- **DANN** bietet die Rollenansicht einen klaren Einstieg in die bestehende IAM-Rechteübersicht oder Szenario-Prüfung
- **UND** es wird kein davon losgelöster zweiter Prüfworkflow mit abweichender Logik eingeführt

#### Scenario: Cockpit-Einstieg genügt für die erste Ausbaustufe

- **WENN** die Rollenverwaltung eine bestehende IAM-Prüffunktion integriert
- **DANN** ist ein klarer Link- oder Deep-Link-Einstieg in das bestehende IAM-Cockpit für die erste Ausbaustufe ausreichend
- **UND** eine eingebettete Szenario-Prüfung innerhalb der Rollenansicht ist optional
- **UND** fehlende Inline-Prüfmasken machen den Rollenarbeitsbereich in diesem Change nicht unvollständig

### Requirement: Vollständige Internationalisierung der UI

Das System MUST alle sichtbaren Texte in Account- und Admin-Views über i18n-Keys rendern. Keine hardcodierten Strings in Komponenten.

#### Scenario: Profilseite wird gerendert

- **WENN** die Profilseite `/account` gerendert wird
- **DANN** stammen alle Labels, Titel, Buttons und Fehlermeldungen aus `t('account.*')`
- **UND** es gibt keine inline-hardcodierten UI-Texte in der Komponente

#### Scenario: Admin-Views werden gerendert

- **WENN** `/admin/users` oder `/admin/roles` gerendert wird
- **DANN** stammen alle sichtbaren Texte aus `t('admin.users.*')` bzw. `t('admin.roles.*')`
- **UND** fehlende Übersetzungskeys werden als Build-/Test-Fehler behandelt

### Requirement: Design-System-Konformität mit shadcn/ui

Das System MUST interaktive UI-Bausteine in Account- und Admin-Views auf Basis der bestehenden `shadcn/ui`-Patterns implementieren.

#### Scenario: Interaktive Komponenten werden umgesetzt

- **WENN** Dialoge, Tabs, Form Controls, Tabelleninteraktionen oder Dropdown-Menüs in `/account`, `/admin/users` oder `/admin/roles` implementiert werden
- **DANN** basieren diese auf den bestehenden `shadcn/ui`-Patterns der Anwendung
- **UND** es wird keine parallele, inkompatible Eigenimplementierung für dieselben Basisbausteine eingeführt

### Requirement: Barrierefreie Bedienbarkeit nach WCAG 2.1 AA / BITV 2.0

Das System MUST die Account- und Admin-Views so implementieren, dass alle Bedienflüsse per Tastatur und Screenreader nutzbar sind (WCAG 2.1 AA, BITV 2.0).

#### Scenario: Tastaturbedienung in Admin-Tabellen

- **WENN** ein Nutzer ohne Maus die User- oder Rollenansicht bedient
- **DANN** sind alle interaktiven Elemente (Filter, Sortierung, Bulk-Aktionen) per Tastatur erreichbar
- **UND** der Fokus ist jederzeit sichtbar und logisch geführt

#### Scenario: Formularvalidierung

- **WENN** ein Validierungsfehler in Profil- oder User-Formularen auftritt
- **DANN** wird der Fehler programmatisch dem Feld zugeordnet (`aria-invalid="true"`, `aria-describedby`)
- **UND** eine Error-Summary wird am Formularanfang angezeigt
- **UND** der Fokus wird auf das erste fehlerhafte Feld gesetzt
- **UND** der Fehlertext wird von Screenreadern verständlich vorgelesen

#### Scenario: Dialog-Barrierefreiheit

- **WENN** ein Modal-Dialog geöffnet wird (Bestätigung, Formular, Warnung)
- **DANN** hat der Dialog `role="dialog"` oder `role="alertdialog"` und `aria-modal="true"`
- **UND** ein Focus-Trap hält den Fokus im Dialog
- **UND** Escape schließt den Dialog
- **UND** der Fokus kehrt nach dem Schließen zum auslösenden Element zurück

#### Scenario: Loading- und Fehlerzustände

- **WENN** Daten geladen werden
- **DANN** wird `aria-busy="true"` auf dem Container gesetzt
- **UND** ein Skeleton/Spinner mit `role="status"` wird angezeigt
- **WENN** ein Ladefehler auftritt
- **DANN** wird eine Fehlermeldung mit Retry-Button angezeigt

#### Scenario: Skip-Navigation und Landmarks (WCAG 2.4.1)

- **WENN** ein Nutzer die Seite per Tastatur navigiert
- **DANN** MUST ein Skip-Link „Zum Hauptinhalt springen“ als erstes fokussierbares Element vorhanden sein
- **UND** die Seite MUST semantische Landmarks verwenden (`<main>`, `<nav>`, `<header>`, `<aside>`)
- **UND** jeder Landmark MUST einen eindeutigen `aria-label` haben, wenn mehrere desselben Typs existieren

#### Scenario: Sichtbare Fokusindikatoren (WCAG 2.4.7)

- **WENN** interaktive Elemente per Tastatur fokussiert werden
- **DANN** MUST ein deutlich sichtbarer Fokusindikator angezeigt werden (mindestens 2px solid, Kontrast >= 3:1 gegen den Hintergrund)
- **UND** der Fokusindikator darf nicht durch andere Elemente verdeckt werden

#### Scenario: autocomplete-Attribute (WCAG 1.3.5)

- **WENN** Formularfelder für persönliche Daten gerendert werden (Name, E-Mail, Telefon)
- **DANN** MUST die Felder passende `autocomplete`-Attribute haben (`name`, `email`, `tel`, `given-name`, `family-name`)

#### Scenario: Live-Region für Suchergebnisse (WCAG 4.1.3)

- **WENN** die User-Suche Ergebnisse aktualisiert
- **DANN** MUST eine `aria-live="polite"`-Region die Anzahl der Treffer ankündigen (z.B. „12 Nutzer gefunden“)
- **UND** Filteränderungen MUST ebenfalls über die Live-Region kommuniziert werden

#### Scenario: Überschriften-Hierarchie

- **WENN** eine Account- oder Admin-Seite gerendert wird
- **DANN** MUST die Überschriften-Hierarchie korrekt sein (`h1` → `h2` → `h3`, keine übersprungenen Ebenen)
- **UND** jede Seite MUST genau eine `h1` haben

#### Scenario: Session-Timeout-Warnung (WCAG 2.2.1)

- **WENN** die Session des Nutzers in Kürze abläuft (z.B. 2 Minuten vor Ablauf)
- **DANN** MUST eine Warnung angezeigt werden, die dem Nutzer ermöglicht, die Session zu verlängern
- **UND** die Warnung MUST als `role="alertdialog"` implementiert sein
- **UND** der Nutzer MUST mindestens 20 Sekunden Zeit haben, zu reagieren

#### Scenario: prefers-reduced-motion

- **WENN** der Nutzer `prefers-reduced-motion: reduce` im Betriebssystem aktiviert hat
- **DANN** MUST alle Animationen und Übergänge deaktiviert oder auf ein Minimum reduziert werden

#### Scenario: lang-Attribut

- **WENN** die Seite gerendert wird
- **DANN** MUST das `<html>`-Element ein korrektes `lang`-Attribut haben (`de` bzw. `en` je nach Spracheinstellung)
- **UND** bei fremdsprachigen Textfragmenten MUST `lang` auf dem entsprechenden Element gesetzt sein

### Requirement: Responsive Design

Alle Account- und Admin-Views MUST auf allen Gerätegrößen nutzbar sein.

#### Scenario: Desktop-Layout (>= 1024px)

- **WENN** der Viewport >= 1024px breit ist
- **DANN** wird das Standard-Tabellen-Layout mit voller Sidebar angezeigt

#### Scenario: Tablet-Layout (768px–1023px)

- **WENN** der Viewport zwischen 768px und 1023px breit ist
- **DANN** wird eine kompaktere Tabelle angezeigt
- **UND** optionale Spalten werden ausgeblendet (z. B. Letzter Login)

#### Scenario: Mobile-Layout (< 768px)

- **WENN** der Viewport < 768px breit ist
- **DANN** werden Tabellenzeilen als Cards dargestellt
- **UND** Tabs werden als horizontale Scroll-Leiste oder Dropdown angezeigt
- **UND** alle Touch-Targets sind mindestens 44x44px (WCAG 2.5.5)

#### Scenario: Reflow bei 320px Viewport-Breite (WCAG 1.4.10)

- **WENN** der Viewport auf 320px CSS-Pixel eingestellt ist
- **DANN** MUST der gesamte Inhalt ohne horizontalen Scrollbalken dargestellt werden
- **UND** kein Informationsverlust oder abgeschnittener Text darf auftreten

### Requirement: IAM-Service-API

Das System MUST serverseitige API-Endpunkte unter `/api/v1/iam/` für User-CRUD, Rollen-Management und Profil-Updates bereitstellen, die IAM-DB und Keycloak synchron halten.

#### Scenario: Admin aktualisiert Mainserver-Credentials eines Benutzers

- **WENN** ein authentifizierter Administrator `PATCH /api/v1/iam/users/:userId` mit `mainserverUserApplicationId` und/oder `mainserverUserApplicationSecret` aufruft
- **DANN** werden die Mainserver-Credentials in die Keycloak-User-Attribute des Zielbenutzers geschrieben
- **UND** `mainserverUserApplicationSecret` wird nicht im Response-Körper zurückgegeben
- **UND** leere Secret-Werte überschreiben ein bestehendes Secret nicht implizit
- **UND** die restlichen Benutzerdaten bleiben unverändert, sofern sie nicht ebenfalls im Payload enthalten sind

#### Scenario: Admin lädt Benutzerdetail mit Mainserver-Credential-Status

- **WENN** ein authentifizierter Administrator `GET /api/v1/iam/users/:userId` aufruft
- **DANN** enthält die Antwort `mainserverUserApplicationId`, falls in Keycloak gesetzt
- **UND** die Antwort enthält einen booleschen Status, ob `mainserverUserApplicationSecret` vorhanden ist
- **UND** der Klartext des Secrets wird nie an den Browser übertragen

### Requirement: Gruppenverwaltung im Admin-Bereich

Das System MUST im Admin-Bereich eine Oberfläche zur Verwaltung instanzgebundener Gruppen bereitstellen.

#### Scenario: Administrator verwaltet Gruppen

- **WENN** ein berechtigter Administrator die Gruppenverwaltung öffnet
- **DANN** kann er Gruppen anlegen, bearbeiten, deaktivieren und löschen
- **UND** sieht pro Gruppe mindestens Name, Beschreibung, Typ, Mitgliederzahl (`t('admin.groups.memberCount_one')` / `t('admin.groups.memberCount_other')`) und zugewiesene Rechtebündel
- **UND** alle sichtbaren Labels, Statuswerte und Aktionsbeschriftungen werden ausschließlich über i18n-Keys bezogen (kein Hardcoded-Text; Namespace `admin.groups.*`)
- **UND** die Listenansicht ist als semantische `<table>` mit `<caption>`, `scope`-Attributen auf Spaltenköpfen implementiert
- **UND** bei mehr als 50 Gruppen ist eine Paginierung vorhanden; die Liste ist über ein zugängliches Suchfeld filterbar (`role="search"`, `<label>`)
- **UND** die aktive Sortierung ist per `aria-sort` auf dem Spalten-`<th>` angezeigt
- **UND** destruktive Aktionen (Löschen) lösen einen Bestätigungsdialog mit `role="dialog"` und Focus-Trap aus

#### Scenario: Gruppenzuweisung zu Benutzerkonten

- **WENN** ein Administrator ein Benutzerkonto bearbeitet
- **DANN** kann er Gruppenmitgliedschaften zuweisen oder entziehen
- **UND** die UI zeigt bestehende Gruppenmitgliedschaften samt Gültigkeit und Herkunft korrekt an
- **UND** alle Formular-Labels sind über `<label>`-Elemente programmatisch verknüpft

#### Scenario: Gruppenansicht zeigt Rollenbündel und Mitgliedschaften gemeinsam

- **WENN** ein Administrator die Detailansicht einer Gruppe öffnet
- **DANN** sieht er mindestens Stammdaten, zugewiesene Rollen, aktuelle Mitglieder und Gültigkeitsinformationen in einem konsistenten Arbeitsbereich
- **UND** deaktivierte oder gelöschte Gruppen werden eindeutig als nicht wirksam markiert

### Requirement: Sichtbare Gruppenherkunft in IAM-Transparenzdaten

Das System MUST gruppenbasierte Herkunft von Berechtigungen in den relevanten IAM-Ansichten sichtbar machen.

#### Scenario: Effektive Berechtigung stammt aus einer Gruppe

- **WENN** eine effektive Berechtigung eines Benutzers aus einer Gruppenmitgliedschaft stammt
- **DANN** zeigt die UI diese Herkunft explizit als lesbaren Namen direkt in der Listenansicht an (z. B. „Gruppe: Presseteam") — ohne zusätzlichen Klick oder Hover
- **UND** Herkunftsbeschriftungen verwenden lesbare Namen statt interner IDs
- **UND** falls Tooltip-Darstellung genutzt wird, ist diese per Tastatur erreichbar (`role="tooltip"`, `aria-describedby`)

#### Scenario: Rollen- und Rechteansicht verdichtet Mehrfachherkunft nachvollziehbar

- **WENN** eine effektive Berechtigung gleichzeitig aus direkter Rolle und aus einer oder mehreren Gruppen stammt
- **DANN** zeigt die UI die Berechtigung nur einmal als fachliches Ergebnis
- **UND** listet die gesamte Herkunft in lesbarer Form nach Quelle auf
- **UND** direkte Rollen- und Gruppenherkunft bleiben visuell unterscheidbar

### Requirement: Organisations-Verwaltungsseite

Das System MUST eine Organisations-Verwaltungsseite unter `/admin/organizations` bereitstellen, auf der berechtigte Administratoren Organisationen instanzgebunden pflegen können.

#### Scenario: Organisationsliste laden

- **WENN** ein Administrator `/admin/organizations` aufruft
- **DANN** wird eine Liste oder Tabelle der Organisationen der aktiven Instanz angezeigt
- **UND** die Oberfläche zeigt Name, Parent, Anzahl untergeordneter Organisationen und Anzahl zugeordneter Accounts
- **UND** ein Loading-State wird angezeigt, bis die Daten geladen sind

#### Scenario: Organisation suchen und filtern

- **WENN** ein Administrator einen Suchbegriff oder Filter setzt
- **DANN** werden die sichtbaren Organisationen nach Name, Key oder Status gefiltert
- **UND** die Trefferzahl wird über eine `aria-live="polite"`-Region aktualisiert

#### Scenario: Organisationen nach Typ filtern

- **WENN** ein Administrator einen Typfilter wie `municipality`, `district` oder einen äquivalenten unterstützten Organisationstyp setzt
- **DANN** werden nur Organisationen des gewählten Typs angezeigt
- **UND** die aktive Filterung bleibt in der Oberfläche eindeutig erkennbar

### Requirement: Organisation anlegen und bearbeiten

Das System MUST Administratoren eine einfache UI zum Anlegen und Bearbeiten von Organisationen bereitstellen.

#### Scenario: Organisation anlegen

- **WENN** ein Administrator auf „Organisation anlegen" klickt
- **DANN** öffnet sich ein Formular-Dialog oder eine Detailansicht mit mindestens Name, Key, Typ und Parent-Auswahl
- **UND** bei erfolgreichem Speichern erscheint die neue Organisation direkt in der Liste

#### Scenario: Parent-Validierungsfehler anzeigen

- **WENN** ein Administrator eine ungültige Parent-Zuordnung speichert
- **DANN** zeigt die Oberfläche eine verständliche Fehlermeldung an
- **UND** das Formular bleibt geöffnet, damit die Eingabe korrigiert werden kann

#### Scenario: Organisationspolicy bearbeiten

- **WENN** ein Administrator in der Organisationsbearbeitung eine Basispolicy wie `content_author_policy` ändert
- **DANN** zeigt die Oberfläche ein dafür vorgesehenes Eingabeelement mit verständlicher Beschreibung
- **UND** die Änderung wird nach erfolgreichem Speichern im Detailbereich sichtbar

### Requirement: Organisationszuordnungen für Accounts verwalten

Das System MUST in der Organisationsverwaltung die Zuordnung von Accounts zu Organisationen unterstützen.

#### Scenario: Account einer Organisation zuordnen

- **WENN** ein Administrator in der Organisationsdetailansicht einen Account auswählt und zuordnet
- **DANN** wird die Zuordnung gespeichert
- **UND** die Mitgliederliste der Organisation aktualisiert sich ohne vollständigen Seitenwechsel

#### Scenario: Account-Zuordnung entfernen

- **WENN** ein Administrator eine bestehende Organisationszuordnung entfernt
- **DANN** wird die Zuordnung nach Bestätigung gelöscht
- **UND** die UI zeigt den aktualisierten Stand der Organisation an

#### Scenario: Default-Kontext einer Mitgliedschaft setzen

- **WENN** ein Administrator für einen Account innerhalb der Organisationszuordnungen einen Default-Kontext setzt
- **DANN** visualisiert die Oberfläche eindeutig, welche Zuordnung aktuell als Default gilt
- **UND** konkurrierende Default-Markierungen werden verhindert oder vor dem Speichern aufgelöst

#### Scenario: Mitgliedschaft als intern oder extern kennzeichnen

- **WENN** ein Administrator eine Organisationszuordnung erstellt oder bearbeitet
- **DANN** kann er die Zuordnung als intern oder extern kennzeichnen
- **UND** die Kennzeichnung ist in der Mitgliederliste sichtbar

### Requirement: Org-Kontextwechsel für Multi-Org-Accounts

Das System MUST Benutzern mit mehreren Organisationszuordnungen eine kleine, zugängliche UI zum Wechsel des aktiven Organisationskontexts bereitstellen.

#### Scenario: Org-Kontextwechsel anzeigen

- **WENN** ein authentifizierter Benutzer mehreren Organisationen derselben Instanz zugeordnet ist
- **DANN** zeigt die Oberfläche einen Org-Switcher mit den verfügbaren Organisationen an
- **UND** der aktuell aktive Organisationskontext ist eindeutig markiert

#### Scenario: Org-Kontext erfolgreich wechseln

- **WENN** ein Benutzer im Org-Switcher eine andere zulässige Organisation auswählt
- **DANN** wird der aktive Organisationskontext über den vorgesehenen IAM-Contract aktualisiert
- **UND** die Oberfläche aktualisiert kontextabhängige Daten ohne inkonsistenten Zwischenzustand

#### Scenario: Deaktivierte Organisation wird im Org-Switcher nicht als aktive Zieloption angeboten

- **WENN** eine einem Benutzer zugeordnete Organisation deaktiviert ist
- **DANN** wird sie nicht als regulär auswählbare aktive Zieloption angeboten
- **UND** die Oberfläche verhindert einen inkonsistenten Wechsel in einen deaktivierten Kontext

#### Scenario: Org-Kontextwechsel per Tastatur

- **WENN** ein Benutzer den Org-Switcher ausschließlich per Tastatur bedient
- **DANN** ist der Wechsel vollständig ohne Maus möglich
- **UND** Statusänderungen werden für assistive Technologien verständlich angekündigt

#### Scenario: Org-Kontextwechsel schlägt fehl

- **WENN** der Wechsel des Organisationskontexts serverseitig abgewiesen oder technisch unterbrochen wird
- **DANN** zeigt die Oberfläche eine verständliche, internationalisierte Fehlermeldung an
- **UND** der zuvor aktive Organisationskontext bleibt in der UI konsistent sichtbar

### Requirement: Accessibility und i18n für Organisations-UI

Das System MUST die Organisationsverwaltung vollständig internationalisiert und tastaturbedienbar bereitstellen.

#### Scenario: Organisationsverwaltung wird per Tastatur bedient

- **WENN** ein Administrator die Organisationsverwaltung ohne Maus nutzt
- **DANN** sind Liste, Filter, Dialoge und Zuordnungsaktionen vollständig per Tastatur erreichbar
- **UND** Fokusführung, Dialog-Beschriftung und Statusmeldungen entsprechen den bestehenden Accessibility-Mustern

#### Scenario: Keine hardcodierten UI-Texte in Organisations-Views

- **WENN** die Organisationsverwaltung gerendert wird
- **DANN** stammen alle sichtbaren Texte aus i18n-Keys
- **UND** die Komponenten enthalten keine hardcodierten Nutzertexte

### Requirement: Responsives Organisations-UI

Das System MUST die Organisationsverwaltung und den Org-Switcher auf den definierten Projekt-Breakpoints funktionsfähig halten.

#### Scenario: Organisationsverwaltung auf 320 px

- **WENN** die Organisationsverwaltung auf einem 320-px-Viewport genutzt wird
- **DANN** bleiben Liste, Filter, Detaildialoge und Mitgliedschaftsaktionen ohne horizontalen Pflicht-Scroll für Kernaktionen bedienbar
- **UND** der Org-Switcher bleibt erreichbar und verständlich beschriftet

#### Scenario: Organisationsverwaltung auf 768 px und 1024 px

- **WENN** die Organisationsverwaltung auf 768 px oder 1024 px dargestellt wird
- **DANN** bleiben Hierarchieinformationen, Typfilter und Zuordnungsaktionen vollständig nutzbar
- **UND** Layoutwechsel führen nicht zu Fokusverlust oder unzugänglichen Aktionen

### Requirement: IAM-Transparenz-Cockpit für Administratoren

Das System MUST unter `/admin/iam` ein tab-basiertes Transparenz-Cockpit bereitstellen, das strukturierte Rechteinformationen, Governance-Vorgänge und Betroffenenrechtsfälle aufgabengerecht sichtbar macht.

#### Scenario: Rechte-Tab zeigt strukturierte Effective Permissions

- **WENN** ein Administrator den Tab `Rechte` in `/admin/iam` öffnet
- **DANN** werden effektive Berechtigungen mit `action`, `resourceType`, optionaler `resourceId`, `effect`, `organizationId`, `scope` und `sourceRoleIds` angezeigt
- **UND** ein Authorize-Check zeigt `reason` und vorhandene Diagnoseinformationen ohne Roh-JSON-Zwang im Standardzustand

#### Scenario: Governance-Tab zeigt operative Freigabe- und Delegationsdaten

- **WENN** ein Administrator den Tab `Governance` öffnet
- **DANN** sieht er Listen und Detailansichten für Permission-Change-Requests, Delegationen, Impersonation-Sitzungen und Legal-Text-Akzeptanzen
- **UND** pro Eintrag sind mindestens Status, beteiligte Identitäten, Ticketbezug und relevante Zeitstempel sichtbar

#### Scenario: Betroffenenrechte-Tab zeigt Compliance-relevante Fälle

- **WENN** ein Administrator den Tab `Betroffenenrechte` öffnet
- **DANN** sieht er Requests, Export-Jobs, Legal Holds, Profilkorrekturen und Empfängerbenachrichtigungen
- **UND** pro Fall sind Status, Frist-/Zeitinformationen und Blockierungsgründe nachvollziehbar

#### Scenario: Transparenz-Cockpit bleibt barrierefrei und fokussiert

- **WENN** Datenmengen groß oder Teilbereiche leer sind
- **DANN** bietet das Cockpit Filter, klare Empty-States, Loading-States und Fehlerzustände
- **UND** Tabs, Tabellen und Detailpanels sind vollständig tastaturbedienbar und screenreader-tauglich
- **UND** Fokuswechsel sind deterministisch (Tab/Panel/Dialog setzt Fokus zielgerichtet; beim Schließen erfolgt Fokus-Restore)
- **UND** asynchrone Statusmeldungen sind als Live-Regionen für assistive Technologien wahrnehmbar

#### Scenario: Zugriff auf Admin-Cockpit wird rollenbasiert begrenzt

- **WENN** ein Benutzer ohne ausreichende Berechtigung `/admin/iam` oder einen sensiblen Tab aufruft
- **DANN** erhält er einen verweigerten Zustand ohne Leckage sensitiver Felder
- **UND** die UI zeigt eine verständliche Meldung mit nächstem sicheren Schritt
- **UND** die Route selbst bleibt auf `iam_admin`, `support_admin`, `system_admin`, `security_admin` und `compliance_officer` begrenzt
- **UND** der Tab `Governance` ist zusätzlich für `security_admin` und `compliance_officer` lesbar, ohne DSR- oder Rechte-Details freizuschalten

#### Scenario: Große Datenmengen werden performanzstabil angezeigt

- **WENN** Governance- oder DSR-Listen hohe Datenmengen enthalten
- **DANN** werden serverseitige Pagination, Filter und Sortierung verwendet
- **UND** initial lädt nur der aktive Tab; Detaildaten werden on-demand nachgeladen

### Requirement: Datenschutz-Self-Service im Account-Bereich

Das System MUST unter `/account/privacy` eine eigenständige Self-Service-Oberfläche für Datenschutz- und Betroffenenrechtsvorgänge bereitstellen.

#### Scenario: Benutzer sieht eigene Datenschutzvorgänge

- **WENN** ein authentifizierter Benutzer `/account/privacy` aufruft
- **DANN** sieht er seine Betroffenenanfragen, Export-Jobs und deren Statushistorie
- **UND** blockierende Zustände wie Legal Holds oder Verarbeitungseinschränkungen werden verständlich erklärt
- **UND** die Seite akzeptiert keine fremden Subjekt-IDs oder Admin-Drill-downs im Client

#### Scenario: Benutzer steuert optionale Verarbeitung

- **WENN** ein Benutzer gegen optionale Verarbeitung widersprechen oder deren Status prüfen möchte
- **DANN** zeigt die UI den aktuellen Opt-out-/Restriktionsstatus
- **UND** die Aktion ist mit einer nachvollziehbaren Statusrückmeldung verbunden

#### Scenario: Erstaufruf ohne bestehende Datenschutzvorgänge ist geführt

- **WENN** ein authentifizierter Benutzer `/account/privacy` ohne bestehende Anträge oder Export-Jobs öffnet
- **DANN** zeigt die UI einen klaren Empty-State mit primärem CTA für den nächsten sinnvollen Schritt
- **UND** nach Ausführung wird der neue Status ohne manuelle Rohdateninterpretation sichtbar

### Requirement: Lokalisierung und klare Inhaltsführung in IAM-UI

Das System MUST alle neu eingeführten sichtbaren UI-Texte in IAM- und Privacy-Ansichten über Translation-Keys bereitstellen und konsistent in `de` und `en` ausliefern.

#### Scenario: Keine hardcoded Strings in neuen IAM-Ansichten

- **WENN** neue Labels, Statusmeldungen, Tabellenköpfe oder Fehlermeldungen in den betroffenen Views angezeigt werden
- **DANN** werden diese ausschließlich über Translation-Keys gerendert
- **UND** es existieren korrespondierende Übersetzungen in `de` und `en`

### Requirement: Vertiefte IAM-Metadaten in bestehenden Admin-Ansichten

Das System MUST heute verdeckte IAM-Metadaten in den bestehenden Benutzer-, Rollen-, Organisations- und Kontextansichten sichtbar machen, soweit dies fachlich sinnvoll und sicher ist.

#### Scenario: Benutzerdetail zeigt Profil- und Rollenmetadaten

- **WENN** ein Administrator `/admin/users/:userId` öffnet
- **DANN** wird ein vorhandener Avatar verwendet, andernfalls ein Platzhalter
- **UND** Rollen-Gültigkeitsfenster und andere zuweisungsbezogene Metadaten sind sichtbar
- **UND** die Historie zeigt echte IAM-Aktivitäten statt eines statischen Empty-States, sofern Daten vorhanden sind

#### Scenario: Rollenansicht zeigt externe Abbildung und Sync-Interna

- **WENN** ein Administrator `/admin/roles` öffnet
- **DANN** sind pro Rolle neben Name und Beschreibung auch `externalRoleName`, `managedBy`, `roleLevel` sowie relevante Sync-Informationen sichtbar
- **UND** Fehlerzustände des Rollen-Syncs sind in der UI nachvollziehbar

#### Scenario: Organisationsansicht zeigt Hierarchie- und Membership-Details

- **WENN** ein Administrator `/admin/organizations` oder den Membership-Dialog öffnet
- **DANN** sind Hierarchiepfad, Kindorganisationen, Metadata sowie Membership-Zeitpunkte sichtbar
- **UND** Default-Kontext und Sichtbarkeit einer Membership bleiben klar erkennbar

#### Scenario: Organisationskontext-Switcher zeigt mehr als nur den Anzeigenamen

- **WENN** ein Benutzer mehrere Organisationskontexte zur Auswahl hat
- **DANN** zeigt der globale Kontext-Switcher zusätzliche Kontextinformationen wie Organisationstyp, Schlüssel oder Standardkontext-Markierung
- **UND** die Shell bleibt dabei kompakt und responsiv

### Requirement: Fachliche Rechtstext-Verwaltung im Admin-Bereich

Das System MUST im Admin-Bereich Rechtstexte als fachliche Inhalte mit UUID, Name, Versionsnummer, Sprachzuordnung, Status, Veröffentlichungsdatum sowie Erstell- und Änderungsdatum darstellen und bearbeiten.

#### Scenario: Rechtstext-Liste zeigt fachliche Metadaten

- **WENN** ein berechtigter Administrator die Rechtstext-Verwaltung öffnet
- **DANN** zeigt die Liste für jeden Rechtstext mindestens UUID, Name, Versionsnummer, Sprache, Status, Veröffentlichungsdatum, Erstellungsdatum und Änderungsdatum
- **UND** der Name darf mehrfach vorkommen, ohne dass die UI einen Konflikt meldet

#### Scenario: Rechtstext mit HTML-Inhalt anlegen

- **WENN** ein berechtigter Administrator einen neuen Rechtstext anlegt
- **DANN** vergibt das System die UUID automatisch
- **UND** die UI bietet Felder für Name, Versionsnummer, Sprache, Status, Veröffentlichungsdatum und HTML-Inhalt
- **UND** der HTML-Inhalt ist über einen Rich-Text-Editor bearbeitbar

#### Scenario: Rechtstext mit HTML-Inhalt bearbeiten

- **WENN** ein berechtigter Administrator einen bestehenden Rechtstext bearbeitet
- **DANN** kann er Name, Versionsnummer, Sprache, Status, Veröffentlichungsdatum und HTML-Inhalt ändern
- **UND** die Oberfläche zeigt nach erfolgreichem Speichern den serverseitig persistierten Inhalt erneut an

#### Scenario: Keine irreführenden Speicherhinweise

- **WENN** die Rechtstext-Erstellung oder -Bearbeitung angezeigt wird
- **DANN** enthält die UI keinen Hinweis, dass der Textkörper nicht serverseitig gespeichert werde

### Requirement: Blockierender Rechtstext-Akzeptanzflow

Das System MUST im Frontend einen blockierenden Akzeptanzflow für offene Pflicht-Rechtstexte bereitstellen.

#### Scenario: Nutzer landet nach Login im Akzeptanz-Interstitial

- **WENN** ein Nutzer mit offener Pflicht-Akzeptanz die Anwendung öffnet oder nach dem Login zurückkehrt
- **DANN** sieht er einen dedizierten Akzeptanzscreen vor allen geschützten Fachansichten
- **UND** reguläre Navigation, Deep-Links und geschützte Admin-Routen bleiben bis zur Entscheidung gesperrt
- **UND** der Interstitial-Container hat `role="dialog"`, `aria-modal="true"`, `aria-labelledby` und `aria-describedby`
- **UND** der Fokus wird beim Erscheinen auf den Heading-Knoten des Dialogs gesetzt (Focus-Trap bleibt bis zur Entscheidung aktiv)
- **UND** ESC schließt den Dialog **nicht** (blockierender Pflichtflow ist kein schließbares Modal)
- **UND** eine `aria-live="assertive"`-Region kündigt den Übergang nach Akzeptanz an

#### Scenario: Rechtstext-Akzeptanz ist barrierefrei und eindeutig

- **WENN** der Akzeptanzscreen angezeigt wird
- **DANN** sind Version, Gültigkeit, Pflichtcharakter und die auslösbare Aktion eindeutig sichtbar
- **UND** der Flow ist vollständig tastatur- und screenreader-bedienbar (WCAG 2.1 AA)
- **UND** alle UI-Texte (Buttons, Hinweise, Statuszeilen) verwenden ausschließlich i18n-Keys aus dem Namespace `legalTexts.acceptance.*`
- **UND** der rechtliche Inhalt des Rechtstexts selbst wird über die Content-API geliefert und ist kein i18n-Key

#### Scenario: Nutzer lehnt Rechtstext ab oder verlässt den Flow ohne Entscheidung

- **WENN** ein Nutzer den Rechtstext ablehnt oder den Akzeptanzscreen ohne Entscheidung verlässt (Tab schließen, Browser-Back)
- **DANN** wird die Session beendet (Logout) und der Nutzer landet auf der Login-Seite mit einem lokalisierten, erklärenden Hinweis (`t('legalTexts.acceptance.status.rejected')`)
- **UND** es gibt keine Endlosschleife und keinen stillen Fehlzustand

#### Scenario: Akzeptanz-Endpunkt antwortet mit Fehler

- **WENN** der Nutzer die Akzeptanz bestätigt und der Server einen Fehler zurückgibt
- **DANN** zeigt die UI eine programmatisch verknüpfte Fehlermeldung über `role="alert"`
- **UND** der Fokus wird auf die Fehlermeldung gesetzt
- **UND** eine Retry-Aktion ist per Tastatur erreichbar
- **UND** der blockierende Zustand bleibt bestehen (kein impliziter Durchlass bei Fehler)
- **UND** alle Fehlermeldungen verwenden i18n-Keys (`t('legalTexts.acceptance.errors.submitFailed')`, `t('legalTexts.acceptance.errors.versionExpired')`)

#### Scenario: Rückkehr nach Akzeptanz zur ursprünglichen Route

- **WENN** der Nutzer nach erfolgreicher Akzeptanz weitergeleitet wird
- **DANN** landet er auf der ursprünglich aufgerufenen Route (Deep-Link-Preservation via Session-State)
- **UND** nach der Weiterleitung wird der Fokus auf den Seitenbereich der Zielroute gesetzt

### Requirement: Admin-Oberfläche für Rechtstext-Nachweise

Das System MUST Administratoren eine explizite UI für Nachweis, Filterung und Export von Rechtstext-Akzeptanzen bereitstellen.

#### Scenario: Admin exportiert Akzeptanznachweise

- **WENN** ein berechtigter Administrator (mit Permission `legal-consents:export`) die Rechtstext-Verwaltung unter `/admin/iam/legal-texts` öffnet
- **DANN** kann er Akzeptanzen nach Benutzer, Text, Version und Zeitraum filtern
- **UND** sieht vor dem Export eine Vorschau mit Trefferanzahl und Spaltenübersicht
- **UND** wählt das Exportformat (JSON oder CSV)
- **UND** erhält nach dem Export eine barrierefreie Statusankündigung per `aria-live="polite"` (z. B. „Export als CSV gestartet.")
- **UND** alle Tabellenspalten-Überschriften und Filterbezeichner verwenden i18n-Keys (`t('legalTexts.audit.columns.*')`)

#### Scenario: Nachweis-Tabelle ist barrierefrei

- **WENN** die Nachweistabelle angezeigt wird
- **DANN** ist sie als semantische `<table>` mit `<caption>`, `<th scope="col">` für Spalten und `<th scope="row">` für Zeilenidentifikatoren implementiert
- **UND** aktive Sortierung ist per `aria-sort` kommuniziert
- **UND** leere Filterergebnisse werden programmatisch angekündigt

#### Scenario: Unberechtigter Nutzer sieht keine Nachweisdaten

- **WENN** ein Nutzer ohne die Permission `legal-consents:export` eine Nachweis- oder Exportansicht aufruft
- **DANN** werden keine sensitiven Akzeptanzdaten offengelegt
- **UND** die UI zeigt einen sicheren verweigerten Zustand

### Requirement: Inkrementeller Berechtigungsarbeitsbereich für Rollen

Das System MUST die bestehende Rollenverwaltung um einen inkrementellen Berechtigungsarbeitsbereich erweitern, der auf den vorhandenen Rollen- und Permission-Daten aufsetzt.

#### Scenario: Arbeitsbereich baut auf vorhandenem Rollenmodell auf

- **WENN** die Rechtepflege einer Rolle erweitert wird
- **DANN** verwendet die UI weiterhin die bestehenden Rollen-APIs, Rollenmetadaten und Permission-Zuordnungen als Grundlage
- **UND** die erste Version verlangt kein neues Ownership-, Transfer- oder Override-Modell
- **UND** die Umsetzung bleibt kompatibel zu den aktuellen Create/Edit/Delete- und Reconcile-Flows

#### Scenario: Fachliche und technische Sicht ergänzen sich

- **WENN** eine Rolle Berechtigungen mit technischen Referenzen enthält
- **DANN** kann die UI diese in eine fachlich lesbare Darstellung übersetzen oder gruppieren
- **UND** technische Referenzen bleiben für Debugging, Support oder Migration erreichbar
- **UND** sichtbare UI-Bezeichnungen werden lokalisiert statt aus technischen IDs direkt abgeleitet

#### Scenario: Read-only-Rollen bleiben sicher und nachvollziehbar

- **WENN** eine System-Rolle oder extern verwaltete Rolle geöffnet wird
- **DANN** bleiben Bearbeitungs- und Löschaktionen gesperrt
- **UND** der read-only-Zustand wird in Detail- und Berechtigungsdarstellungen konsistent fortgeführt
- **UND** die UI suggeriert keine Bearbeitbarkeit, die serverseitig nicht vorgesehen ist

#### Scenario: Serverseitiger Konflikt überschreibt optimistische Bearbeitbarkeit

- **WENN** eine Rolle in der UI zunächst bearbeitbar wirkt
- **UND** der Server die Änderung wegen zwischenzeitlicher Externverwaltung, Systemschutz oder Konfliktzustand verweigert
- **DANN** zeigt die Oberfläche einen verständlichen Fehler- oder Konflikthinweis statt eines generischen Fehlers
- **UND** der Rollenarbeitsbereich synchronisiert sich auf den serverseitig gültigen Zustand zurück
- **UND** irreführende Editierhinweise werden entfernt

#### Scenario: Rechtepflege bleibt responsiv und zugänglich

- **WENN** der Berechtigungsarbeitsbereich auf 320 px, 768 px oder 1024 px verwendet wird
- **DANN** bleiben Rollenliste, Detailbereich, Dialoge und Prüfeinstiege ohne unverständlichen Horizontal-Overflow nutzbar
- **UND** alle Interaktionen sind per Tastatur erreichbar
- **UND** Status, Fehlermeldungen und read-only-Hinweise sind für Screenreader semantisch verständlich

### Requirement: Rechtebewusste Fach-UI in priorisierten Modulen

Das System MUST in priorisierten Fachmodulen sichtbare und konsistente Zustände für erlaubte, deaktivierte und serverseitig verweigerte Aktionen verwenden.

#### Scenario: Inhaltsmodul vermeidet unverständliche Rechtefehler

- **WENN** ein Nutzer Listen- oder Detailansichten für Inhalte verwendet
- **DANN** sind Aktionen wie Anlegen oder Bearbeiten möglichst an die wirksamen Rechte gebunden
- **UND** serverseitige Verweigerungen werden verständlich dargestellt
- **UND** die Oberfläche reduziert blind sichtbare Aktionen ohne realistische Ausführbarkeit

#### Scenario: Zustände folgen einer konsistenten Zustandslogik

- **WENN** eine Aktion in einer Fach- oder Admin-UI nicht uneingeschränkt verfügbar ist
- **DANN** unterscheidet die UI nachvollziehbar mindestens zwischen `erlaubt`, `deaktiviert`, `read-only` und `serverseitig verweigert`
- **UND** die Zustandslogik wird in priorisierten Modulen konsistent angewendet

#### Scenario: Fehlende oder unvollständige Rechteinformationen führen nicht zu Scheinsicherheit

- **WENN** einer Fach- oder Admin-UI für eine Aktion keine belastbare Rechte- oder Diagnosedatenbasis vorliegt
- **DANN** zeigt die Oberfläche keine unbegründete Freigabe an
- **UND** sie verwendet einen defensiven Zustand mit verständlichem Hinweis statt technischer Rohdaten
- **UND** eine serverseitige Prüfung bleibt die maßgebliche Entscheidungsinstanz

### Requirement: Verifizierbare Rechteverwaltungs-UI

Das System MUST für den inkrementellen Rollenarbeitsbereich und die angrenzenden Fach-UI-Flächen eine umsetzungsnahe Verifikationsstrategie definieren.

#### Scenario: Unit- und Integrationsprüfungen decken Zustandslogik ab

- **WENN** die Rechteverwaltungs-UI umgesetzt oder geändert wird
- **DANN** decken Unit- oder Integrationstests mindestens fachliche Berechtigungsdarstellung, technische Detailumschaltung, Read-only-Zustände und serverseitige Verweigerungen ab
- **UND** die Tests prüfen lokalisierte UI-Texte statt hartcodierter Strings

#### Scenario: E2E- und Responsive-Prüfungen sichern den Bedienfluss ab

- **WENN** End-to-End-Prüfungen für `/admin/roles` oder priorisierte Fachseiten ausgeführt werden
- **DANN** verifizieren sie mindestens den Rollenarbeitsbereich, den Prüfeinstieg und die Zustände auf 320 px, 768 px und 1024 px
- **UND** sie prüfen, dass keine kritischen Bedienpfade durch Layout-Brüche oder unverständlichen Horizontal-Overflow unbenutzbar werden

#### Scenario: Accessibility- und i18n-Prüfungen sind Teil der Umsetzung

- **WENN** Komponenten oder Flows für die Rechteverwaltung geändert werden
- **DANN** umfassen die Verifikationsschritte Tastaturbedienung, Screenreader-Semantik, Statuskommunikation sowie die Prüfung, dass sichtbare UI-Bezeichnungen aus i18n-Keys stammen
- **UND** fehlende Übersetzungen oder verletzte Accessibility-Grundanforderungen gelten als Umsetzungsdefekte

### Requirement: Admin-CRUD-Ressourcen nutzen kanonische Seitenrouten

Die Account-UI SHALL CRUD-artige Admin-Ressourcen ueber kanonische Listen-, Erstellungs- und Detailrouten bereitstellen.

#### Scenario: Listenansicht einer Admin-Ressource

- **WHEN** ein berechtigter Nutzer eine CRUD-artige Admin-Ressource oeffnet
- **THEN** die Liste ist unter `/admin/<resource>` erreichbar
- **AND** die Liste zeigt tabellarische Eintraege, Filter und Listenaktionen
- **AND** Create- und Edit-Flows werden nicht als Modal ueber lokalen Seitenspeicher geoeffnet

#### Scenario: Erstellungsansicht einer Admin-Ressource

- **WHEN** ein berechtigter Nutzer eine neue Ressource anlegen will
- **THEN** die UI navigiert auf `/admin/<resource>/new`
- **AND** die Erstellungsmaske wird als eigenstaendige Seite mit Ruecklink zur Liste angezeigt

#### Scenario: Detailansicht einer Admin-Ressource

- **WHEN** ein berechtigter Nutzer einen bestehenden Eintrag oeffnen oder bearbeiten will
- **THEN** die UI navigiert auf `/admin/<resource>/$id`
- **AND** Bearbeitung und ressourcenspezifische Sekundaeraktionen erfolgen auf dieser Detailseite

### Requirement: UI nutzt denselben Diagnosekern in Self-Service und Admin

Die UI SHALL denselben classification-basierten Diagnosekern in Self-Service- und Admin-Ansichten verwenden und daraus kontextabhängige, aber fachlich konsistente Fehler- und Statusbilder ableiten.

#### Scenario: Neue Diagnoseklassen werden konsistent angezeigt

- **WHEN** IAM-Fehler als `auth_resolution`, `oidc_discovery_or_exchange`, `frontend_state_or_permission_staleness` oder `legacy_workaround_or_regression` klassifiziert werden
- **THEN** zeigt die UI eine lokalisierte Diagnoseklasse an
- **AND** bleibt die Anzeige sicher, wenn ein Client eine noch unbekannte Klassifikation erhält

#### Scenario: Recovery wird nicht als gesund dargestellt

- **WHEN** ein Fehler den Status `recovery_laeuft`, `degradiert` oder `manuelle_pruefung_erforderlich` trägt
- **THEN** zeigt die UI diesen Status nachvollziehbar an
- **AND** reduziert den Zustand nicht auf eine vollständig gesunde Darstellung

### Requirement: Handlungsleitende IAM-Fehler- und Statusanzeigen

Die UI SHALL IAM-Fehler und degradierte Zustände so darstellen, dass Benutzer und Operatoren zwischen Sitzungsproblemen, Berechtigungsproblemen, Infrastrukturfehlern, Drift und Dateninkonsistenzen unterscheiden können, ohne unsichere Interna offenzulegen.

#### Scenario: Self-Service-Fehlerbild bleibt verständlich und sicher

- **WHEN** in Self-Service-Flows wie `/account` oder vergleichbaren IAM-nahen Ansichten ein IAM-Fehler auftritt
- **THEN** zeigt die UI eine verständliche, auf den Benutzerkontext zugeschnittene Meldung mit passender Folgeaktion wie Re-Login, Retry oder Support-Hinweis
- **AND** kann die UI eine Request-ID und freigegebene Diagnosedetails ausgeben, sofern diese für die Bearbeitung nötig sind
- **AND** werden keine sensitiven Interna oder technische Rohdaten angezeigt

#### Scenario: Admin-UI kann Ursachenklassen unterscheiden

- **WHEN** in Admin-Flows ein IAM-Fehler mit sicherer Diagnose auftritt
- **THEN** unterscheidet die UI mindestens zwischen Auth-/Session-Problemen, fehlender Actor-/Membership-Auflösung, Keycloak-Abhängigkeit, Datenbank-/Schema-Drift und Registry-/Provisioning-Drift
- **AND** zeigt für diese Klassen unterschiedliche Hinweise oder Folgeschritte an
- **AND** reduziert strukturierte Diagnosedetails nicht pauschal auf eine generische Standardmeldung

#### Scenario: Erfolgreiches Recovery wird nicht mit gesundem Zustand verwechselt

- **WHEN** die UI einen temporären IAM-Fehler über einen stillen Recovery- oder Refetch-Pfad überbrückt
- **THEN** bleibt der Zwischenzustand für Diagnose und Statuskommunikation nachvollziehbar
- **AND** Benutzer erhalten keine irreführende Darstellung eines vollständig gesunden Systems, wenn weiterhin degradierte Bedingungen vorliegen

#### Scenario: Self-Service und Admin teilen denselben Diagnosekern

- **WHEN** Self-Service- und Admin-Ansichten denselben IAM-Fehlerklassifikationskern verarbeiten
- **THEN** verwenden beide Pfade dieselbe Fehlerklasse, denselben handlungsleitenden Status und dieselbe `requestId`
- **AND** unterscheiden sich nur in Sprache, Detailtiefe und empfohlenen Folgeschritten passend zum jeweiligen Kontext

### Requirement: Admin-Ressourcen werden ueber einen deklarativen Registrierungsvertrag beschrieben

Die Account-UI SHALL CRUD-artige Admin-Flaechen nicht mehr nur als lose Einzelrouten behandeln, sondern ueber einen expliziten Registrierungsvertrag fuer Admin-Ressourcen materialisieren.

#### Scenario: Host materialisiert kanonische Admin-Flaechen aus einer Ressourcendefinition

- **WHEN** eine Workspace-Erweiterung eine Admin-Ressource registriert
- **THEN** enthaelt der Beitrag mindestens eine Ressourcen-ID, einen Titel-Key, eine Guard-Anforderung und UI-Bindings fuer Liste und Detail
- **AND** die Account-UI kann daraus die zugehoerigen kanonischen Admin-Flaechen ohne separate Sonderverdrahtung pro Ressource aufbauen

#### Scenario: Erstellungsansicht bleibt Teil derselben registrierten Ressource

- **WHEN** eine Ressourcendefinition einen Create-Beitrag liefert
- **THEN** materialisiert die Account-UI die Erstellungsansicht als Teil derselben registrierten Admin-Ressource
- **AND** Liste, Erstellen und Detail bleiben ueber denselben Ressourcenvertrag miteinander verknuepft

### Requirement: Admin-Ressourcen bleiben hostkontrollierte UI-Bausteine

Die Account-UI SHALL Packages fuer Admin-Ressourcen nur deklarative UI-Beitraege erlauben; Guard-Anwendung, Routenform und Shell-Integration bleiben Host-Verantwortung.

#### Scenario: Package liefert nur deklarative Flaechenbeitraege

- **WHEN** ein Package eine Admin-Ressource fuer den Host bereitstellt
- **THEN** beschreibt es Liste, Detail, Erstellen und optionale Historie ueber deklarative Bindings
- **AND** es fuehrt keine eigene zweite Admin-Shell oder parallele Top-Level-Navigation ausserhalb des Host-Vertrags ein

#### Scenario: Host erzwingt konsistente Shell-Integration

- **WHEN** mehrere Admin-Ressourcen registriert sind
- **THEN** integriert die Account-UI diese innerhalb derselben Admin-Shell und derselben Interaktionsmuster
- **AND** Guard-, Titel- und Navigationsdarstellung folgen den hostseitigen Regeln statt ressourcenspezifischer Sonderlogik

### Requirement: Studio Keycloak Admin UI

The Studio admin UI SHALL allow authorized platform and tenant admins to use Studio as an alternative UI for Keycloak user and role administration.

#### Scenario: Complete user list with edit affordances
- **WHEN** ein Admin `/admin/users` öffnet
- **THEN** zeigt die UI alle im aktiven Scope relevanten Keycloak-User mit Such-, Status-, Rollen- und Mapping-Filtern
- **AND** zeigt pro User, ob Bearbeitung, Deaktivierung und Rollenzuordnung möglich, read-only oder blockiert ist

#### Scenario: Complete role list with edit affordances
- **WHEN** ein Admin `/admin/roles` öffnet
- **THEN** zeigt die UI alle im aktiven Scope relevanten Keycloak-Rollen mit Such-, Typ- und Bearbeitbarkeitsfiltern
- **AND** unterscheidet Built-in-, externe und Studio-managed Rollen sichtbar

#### Scenario: Sync diagnostics are actionable
- **WHEN** ein Sync oder Reconcile `partial_failure`, `blocked` oder `failed` meldet
- **THEN** zeigt die UI Zähler, Diagnosecodes und betroffene User/Rollen
- **AND** bietet nur Aktionen an, die im aktiven Scope und laut Bearbeitbarkeitsmatrix erlaubt sind

### Requirement: Shared Studio UI React Package
The system SHALL provide `@sva/studio-ui-react` as the shared React UI package for host pages and plugin custom views.

#### Scenario: Host page uses shared UI
- **GIVEN** a host-owned overview or detail page is implemented
- **WHEN** the page needs reusable Studio layout, controls, actions, or state components
- **THEN** it imports them from `@sva/studio-ui-react`
- **AND** it does not import reusable Studio UI from app-internal component paths

#### Scenario: Plugin custom view uses shared UI
- **GIVEN** a plugin provides a custom React view
- **WHEN** the view renders Studio page structure, form controls, actions, or feedback states
- **THEN** it uses `@sva/studio-ui-react` components
- **AND** it does not define a parallel basis control system for buttons, inputs, tables, tabs, dialogs, or alerts

#### Scenario: Plugin uses domain wrapper around shared UI
- **GIVEN** a plugin needs a domain-specific field, action, or status component
- **WHEN** the component is implemented
- **THEN** it composes primitives from `@sva/studio-ui-react`
- **AND** it does not redefine shared visual variants, focus behavior, ARIA semantics, or design tokens

### Requirement: Studio UI React Overview and Detail Templates
The system SHALL provide reusable overview and detail templates that encode the Studio page standards for headings, resource identity, actions, navigation, work surfaces, and state handling.

#### Scenario: Overview page renders with standard structure
- **GIVEN** a host or plugin overview page uses `StudioOverviewPageTemplate`
- **WHEN** the page is rendered
- **THEN** the visible structure contains page heading, optional primary action, toolbar slot, content slot, and pagination or result-state slot
- **AND** loading, empty, error, and forbidden states are rendered through shared Studio state components

#### Scenario: Detail page renders with standard structure
- **GIVEN** a host or plugin detail page uses `StudioDetailPageTemplate`
- **WHEN** the page is rendered
- **THEN** the visible structure contains return or breadcrumb context, page heading, primary action slot, resource header slot, detail navigation slot, and active work surface
- **AND** resource identity, status badges, metadata, and destructive actions follow shared Studio patterns

### Requirement: Studio UI React Form Controls
The system SHALL provide form composition primitives that standardize labels, required markers, descriptions, validation states, and accessible field relationships.

#### Scenario: Field with validation error
- **GIVEN** a Studio form field has a validation error
- **WHEN** the field is rendered
- **THEN** the control exposes `aria-invalid`
- **AND** the field error is associated through `aria-describedby`
- **AND** the visual state is consistent across host and plugin forms

#### Scenario: Plugin form uses specialized field
- **GIVEN** a plugin needs a specialized editor such as upload, rich text, media, color, icon, rating, or geo selection
- **WHEN** the specialized editor is implemented
- **THEN** it is wrapped as a Studio component or composed from `@sva/studio-ui-react` primitives
- **AND** it preserves label, description, validation, disabled, and read-only semantics

### Requirement: Plugin Custom Views Preserve Studio UX Contracts
The system SHALL allow plugin custom views only when they preserve Studio shell, layout, accessibility, action, and state contracts through `@sva/studio-ui-react`.

#### Scenario: Plugin custom view is accepted
- **GIVEN** a plugin registers or exports a custom admin view
- **WHEN** the host validates or reviews the view integration
- **THEN** the view uses `@sva/studio-ui-react` for common layout, controls, actions, and states
- **AND** any deviation from shared Studio UI is documented as an architecture decision

#### Scenario: Plugin custom view imports app internals
- **GIVEN** a plugin custom view imports from `apps/sva-studio-react/src/components`
- **WHEN** lint, boundary, or CI checks run
- **THEN** the check fails with a message that directs the plugin to `@sva/studio-ui-react`

#### Scenario: Plugin defines duplicate basis control
- **GIVEN** a plugin defines or exports a reusable basis control that duplicates an available Studio UI component
- **WHEN** lint, CI, or review checks run
- **THEN** the contribution is rejected or changed to compose `@sva/studio-ui-react`
- **AND** domain-specific wrappers remain allowed when they preserve shared Studio UI semantics

### Requirement: Tenant-IAM-Betriebsblock auf der Instanz-Detailseite

Das System MUST auf `/admin/instances/:instanceId` einen eigenen Tenant-IAM-Betriebsblock bereitstellen, der Konfiguration, Rechteprobe und Reconcile fuer die gewaehlte Instanz getrennt darstellt und sich in eine progressive Seitenstruktur einordnet.

#### Scenario: Instanz-Detailseite zeigt getrennte Tenant-IAM-Abschnitte

- **WENN** ein berechtigter Operator die Detailseite einer Instanz oeffnet
- **DANN** zeigt die Seite einen separaten Tenant-IAM-Bereich oder eine gleichwertige drill-down-faehige Tenant-IAM-Sicht
- **UND** sind dort mindestens `Konfiguration`, `Rechteprobe`, `Reconcile` und ein zusammengefasster Gesamtzustand sichtbar
- **UND** bleibt dieser Bereich vom bestehenden Keycloak-Setup- und Provisioning-Bereich unterscheidbar
- **UND** konkurriert er in der Standardansicht nicht gleichrangig mit Konfigurationsformularen, Historie und technischer Schrittliste

#### Scenario: Tenant-IAM-Befund enthaelt Diagnose und Korrelation

- **WENN** die Detailseite einen degradierten oder blockierten Tenant-IAM-Zustand zeigt
- **DANN** enthaelt die UI verstaendliche Diagnoseinformationen wie Fehlercode, letzten Prueflauf oder `requestId`
- **UND** kann ein Operator den Befund ohne Wechsel in eine andere Admin-Seite einordnen

#### Scenario: Tenant-IAM erscheint als Betriebsachse statt als konkurrierender Hauptblock

- **WENN** die Standardansicht der Instanz geladen wird
- **DANN** ist Tenant-IAM als eigenstaendige Betriebsachse sichtbar
- **UND** bleibt klar unterscheidbar, ob der Befund `Konfiguration`, `Zugriff` oder `Reconcile` betrifft
- **UND** konkurriert dieser Befund in der Uebersicht nicht gleichrangig mit Formularen, Vollhistorie und technischen Rohlisten

### Requirement: Tenant-IAM-Aktionen bleiben kontextbezogen und begrenzt

Das System MUST auf der Instanz-Detailseite nur fachlich sinnvolle Tenant-IAM-Aktionen anbieten, diese dem sichtbaren Befund zuordnen und sie gegenueber der primaeren Seitenaktion klar als Spezial- oder Folgeaktionen abstufen.

#### Scenario: Detailseite verknuepft bestehende Reparaturpfade gezielt

- **WENN** ein sichtbarer Tenant-IAM-Befund durch eine bestehende Aktion adressierbar ist
- **DANN** bietet die Detailseite genau diese Aktion kontextbezogen an
- **UND** kann sie dafuer bestehende Provisioning-, Secret-, Reset- oder Reconcile-Pfade nutzen
- **UND** werden irrelevante oder nicht wirksame Aktionen nicht vorgeschlagen

#### Scenario: Rechteprobe ist als eigene Operator-Aktion verfuegbar

- **WENN** ein Operator die tenantlokale IAM-Betriebsfaehigkeit gezielt pruefen moechte
- **DANN** bietet die Detailseite eine explizite Aktion fuer die Tenant-IAM-Rechteprobe an
- **UND** zeigt nach Abschluss den aktualisierten Access-Zustand im Tenant-IAM-Bereich

#### Scenario: Detailseite bleibt trotz Rechteprobe reaktionsfaehig

- **WENN** ein Operator die Instanz-Detailseite oeffnet, ohne eine Rechteprobe anzustossen
- **DANN** rendert die Seite den vorhandenen Tenant-IAM-Befund ohne blockierende Zusatzpruefung
- **UND** zeigt bei Bedarf klar an, dass die Rechteprobe gezielt ausgeloest werden kann

#### Scenario: UI zeigt unbestimmte Access-Lage ehrlich an

- **WENN** fuer `access` noch keine belastbare Rechteprobe oder aequivalente Access-Evidenz vorliegt
- **DANN** zeigt die Detailseite diesen Teilzustand als `unknown` oder fachlich gleichwertig an
- **UND** suggeriert nicht, dass aus einer gruenen Strukturpruefung bereits betriebliche Tenant-IAM-Rechte folgen

### Requirement: Progressive Informationsarchitektur auf der Instanz-Detailseite

Das System MUST die Instanz-Detailseite unter `/admin/instances/:instanceId` so strukturieren, dass aktuelle Betriebsbewertung, Konfiguration, technische Diagnose und Historie nicht mehr als gleichrangiger Lang-Scrollbereich konkurrieren.

#### Scenario: Standardansicht priorisiert den aktuellen Operator-Kontext

- **WENN** ein berechtigter Operator die Detailseite einer Instanz oeffnet
- **DANN** zeigt die Seite zuerst eine kompakte Uebersicht mit aktuellem Gesamtzustand, den wichtigsten offenen Befunden und der naechsten primaeren Aktion
- **UND** enthaelt diese Uebersicht nicht mehrere gleichrangige Wiederholungen desselben Zustands in verschiedenen Card-Gruppen
- **UND** muss der Operator nicht zuerst Preflight, Keycloak-Status, Run-Historie und Formulare gleichzeitig interpretieren

#### Scenario: Uebersicht funktioniert wie ein operatives Cockpit

- **WENN** ein berechtigter Operator die Detailseite einer Instanz oeffnet
- **DANN** zeigt die Uebersicht mindestens Identitaet der Instanz, Gesamtstatus, Frische der dominanten Evidenz und den aktuell wichtigsten Handlungsaufruf
- **UND** ordnet die Seite Befunde vor Steuerung und Steuerung vor Historie an
- **UND** folgt der Erstblick dem Prinzip `overview first, anomalies second, controls third, history last`

#### Scenario: Sekundaerbereiche folgen progressiver Offenlegung

- **WENN** ein Operator tiefer in Konfiguration, Diagnose oder Historie einsteigen moechte
- **DANN** sind diese Informationen in klar getrennten Arbeitsbereichen wie Tabs, Panels oder gleichwertigen Sektionen erreichbar
- **UND** bleibt der aktuelle Uebersichtsblock visuell von diesen Sekundaerbereichen unterscheidbar
- **UND** fuehrt die Seite kein zweites konkurrierendes Gesamtlayout fuer dieselbe Instanz ein

#### Scenario: Historische Fehl-Laeufe wirken nicht wie ein aktueller Gesamtblocker

- **WENN** eine Instanz aktuell betriebsbereit oder strukturell gruen ist, aber aeltere fehlgeschlagene Provisioning-Laeufe besitzt
- **DANN** trennt die Detailseite den aktuellen Zustand klar von der historischen Run-Historie
- **UND** darf ein aelterer Fehl-Lauf nicht denselben visuellen Rang wie ein aktueller blockierender Befund erhalten
- **UND** bleibt die Historie fuer Diagnosezwecke explizit oeffenbar

#### Scenario: Aktionen sind hierarchisiert statt gleich laut

- **WENN** die Detailseite mehrere moegliche Bedienhandlungen anbietet
- **DANN** hebt die Seite genau eine Primaeraktion deutlich hervor
- **UND** gruppiert Spezial- oder Folgeaktionen sichtbar nachgeordnet
- **UND** vermeidet in der Standardansicht mehrere gleichgewichtete Aktionsbuttons ohne erkennbare Prioritaet

#### Scenario: Optische Gimmicks steigern Freude ohne Unruhe

- **WENN** die Detailseite visuelle Gimmicks oder Mikrointeraktionen einsetzt
- **DANN** unterstuetzen diese Blickfuehrung, Statusfeedback oder die wahrgenommene Hochwertigkeit der Bedienung
- **UND** bleiben sie dezent genug, um Incident- und Betriebsarbeit nicht zu stoeren
- **UND** uebersteuern sie weder Statusfarben noch Fokusindikatoren noch zentrale Textlesbarkeit

#### Scenario: Motion bleibt ruhig und zugaenglich

- **WENN** die Detailseite Animationen fuer laufende Prozesse, Statuswechsel oder Hover-Zustaende einsetzt
- **DANN** sind diese kurz, ruhig und fachlich begruendet
- **UND** respektieren sie bestehende Accessibility-Anforderungen wie reduzierte Bewegung oder gleichwertige statische Rueckmeldung

