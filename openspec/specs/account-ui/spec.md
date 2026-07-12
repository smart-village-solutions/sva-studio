# account-ui Specification

## Purpose

TBD - created by archiving change add-account-user-management-ui. Update Purpose after archive.
## Requirements
### Requirement: Auth-State-Provider

Das System MUST einen zentralen React-Context (`AuthProvider` in `sva-studio-react`) bereitstellen, der den Authentifizierungs-State anwendungsweit verfügbar macht, verteilte `/auth/me`-Aufrufe durch einen einheitlichen `useAuth()`-Hook ersetzt und Auth-Unterbrechungen strukturiert diagnostizierbar macht.

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

#### Scenario: Session expired notice keeps correlated diagnostics

- **WENN** ein Benutzer nach fehlgeschlagener stiller Session-Recovery auf `/?auth=session-expired` geleitet wird
- **DANN** bleibt ein lokaler, tab-bezogener Auth-Diagnosepfad für den Vorfall erhalten
- **UND** die Oberfläche darf mindestens `requestId` und `authFlowId` sichtbar machen
- **UND** der Diagnosepfad enthält keine Tokens und keine PII

### Requirement: Protected-Route-Guard
Das System MUST einen generischen Route-Guard bereitstellen, der Routen basierend auf Authentifizierungsstatus und der kanonischen tenantseitigen Rollen- oder Permission-Sicht schützt. Rohe Keycloak-Rollen dürfen nur dort direkt ausgewertet werden, wo eine ausdrückliche technische Sonderrolle oder ein Plattform-Scope betroffen ist.

#### Scenario: Unauthentifizierter Zugriff auf geschützte Route
- **WHEN** ein nicht-authentifizierter Nutzer eine geschützte Route aufruft
- **THEN** wird der Nutzer zur Login-Seite weitergeleitet
- **AND** nach erfolgreicher Authentifizierung wird er zur ursprünglichen URL zurückgeleitet

#### Scenario: Authentifizierter Nutzer ohne ausreichende fachliche Autorisierung
- **WHEN** ein authentifizierter Nutzer eine Route aufruft, für die eine bestimmte kanonische Rolle oder Permission erforderlich ist
- **AND** der Nutzer diese fachliche Freigabe im IAM-Modell nicht besitzt
- **THEN** wird der Nutzer auf die Startseite weitergeleitet
- **AND** eine verständliche Fehlermeldung wird angezeigt (`t('auth.insufficientRole')`)

#### Scenario: Admin-Route-Schutz folgt kanonischer Tenant-Sicht
- **WHEN** die Route `/admin/users` aufgerufen wird
- **THEN** prüft der Guard über den `routerContext`, ob der Nutzer die dafür vorgesehene kanonische Tenant-Freigabe besitzt, etwa `system_admin` oder die entsprechende Verwaltungs-Permission
- **AND** verlässt sich diese Entscheidung nicht auf rohe Legacy-Keycloak-Rollen wie `app_manager`

### Requirement: Account-Profilseite
Das System MUST eine Account-Profilseite unter `/account` bereitstellen, auf der authentifizierte Nutzer ihre eigenen Basis-Daten einsehen und bearbeiten können.

#### Scenario: Profil anzeigen
- **WHEN** ein authentifizierter Nutzer `/account` aufruft
- **THEN** werden Benutzername, Name, E-Mail, Telefon, Position, Abteilung, Sprache und Zeitzone angezeigt
- **AND** die kanonischen Rollen und der Account-Status sind sichtbar (read-only)
- **AND** eine getrennte technische Ansicht für rohe Keycloak-Rollen ist verfügbar
- **AND** ein Avatar oder Platzhalter-Bild wird angezeigt
- **AND** die Seite zeigt einen Loading-State (`aria-busy="true"`) während die Daten geladen werden
- **AND** bei einem Ladefehler wird eine Fehlermeldung mit Retry-Button angezeigt

#### Scenario: Basis-Daten bearbeiten
- **WHEN** ein Nutzer seine Basis-Daten (Benutzername, Name, E-Mail, Telefon, Position, Abteilung, Sprache, Zeitzone) ändert
- **AND** das Formular absendet
- **THEN** werden die identitätsbezogenen Änderungen in der IAM-Datenbank und in Keycloak gespeichert
- **AND** die Benutzerverwaltung zeigt bei der nächsten Datenladung den aktualisierten Anzeigenamen und die aktualisierte E-Mail
- **AND** Änderungen an Vor- und Nachname aktualisieren den `displayName`, sofern kein abweichender benutzerdefinierter Anzeigename gepflegt wurde
- **AND** eine Erfolgsbestätigung wird angezeigt (`role="status"`, `aria-live="polite"`)
- **AND** der `AuthProvider`-State wird aktualisiert
- **AND** der Fokus wird nach dem Speichern auf die Erfolgsbestätigung gesetzt

### Requirement: User-Administrationsliste

Das System MUST eine User-Administrationsliste unter `/admin/users` bereitstellen, mit der Administratoren alle Benutzer-Accounts verwalten können.

#### Scenario: Neuen Nutzer anlegen

- **WENN** ein Administrator auf „Nutzer anlegen" klickt
- **DANN** öffnet sich ein Formular-Dialog oder Arbeitsbereich (`role="dialog"` oder gleichwertig zugänglicher Formularfluss)
- **UND** Pflichtfelder sind markiert mit `aria-required="true"`: Name und E-Mail
- **UND** die UI bietet eine primäre Auswahl für initiale Gruppenmitgliedschaften an
- **UND** die direkte Rollenwahl bleibt als optionale erweiterte Einstellung verfügbar
- **UND** nach dem Speichern wird der Nutzer in der IAM-DB und in Keycloak erstellt
- **UND** ausgewählte Gruppen werden dem Nutzer initial zugewiesen
- **UND** optional ausgewählte direkte Rollen werden zusätzlich zugewiesen
- **UND** der Nutzer erhält auf Wunsch eine Einladungs-E-Mail über Keycloak
- **UND** bei Escape oder Klick außerhalb wird der Dialog nur geschlossen, sofern der verwendete UI-Pattern dies zulässt und keine ungespeicherten Pflichtdaten verloren gehen

### Requirement: User-Bearbeitungsseite

Das System MUST eine User-Bearbeitungsseite unter `/admin/users/:userId` bereitstellen, die eine detaillierte Bearbeitung eines Benutzer-Accounts in einer Tab-Ansicht ermöglicht und direkte, gruppenbasierte sowie vererbte Berechtigungsursachen nachvollziehbar darstellt.

#### Scenario: Verwaltung zeigt nachvollziehbare Berechtigungsherkunft

- **WENN** ein Administrator den Benutzer-Detailbereich mit Rollen- und Rechteinformationen öffnet
- **DANN** zeigt die UI direkte Rollen, Gruppenherkünfte und effektive Berechtigungen in lesbarer Form an
- **UND** markiert sie sichtbar, ob ein Eintrag instanzweit, datensatzbezogen oder organisationskontextbezogen ausgewertet wird
- **UND** bleibt erkennbar, ob ein Eintrag direkt zugewiesen, über eine Gruppe wirksam oder über Organisations- bzw. Geo-Hierarchien vererbt ist
- **UND** bleiben blockierte oder fachlich unwirksame Einträge als solche erkennbar statt still ausgeblendet zu werden

#### Scenario: Benutzerbearbeitung löscht fachlich unveränderte Assignment-Metadaten nicht

- **WENN** ein Administrator einen Benutzer speichert, ohne eine bestehende Rollen- oder Gruppenzuordnung fachlich zu ändern
- **DANN** bleiben vorhandene Metadaten wie Herkunft und Gültigkeitsfenster erhalten
- **UND** erstellt die UI keinen Bedienfluss, der diese Metadaten implizit zurücksetzt, nur weil derselbe Benutzer erneut gespeichert wurde

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
- **DANN** genügt ein klarer Einstieg in das bestehende IAM-Cockpit oder eine gleichwertige Transparenzfunktion
- **UND** fehlende eingebettete Prüfformen machen die Rollenverwaltung in dieser Ausbaustufe nicht unvollständig

#### Scenario: Bestätigtes Löschen weist auf Kaskadeneffekt hin

- **WENN** ein Administrator eine löschbare Custom-Rolle aus der Rollenliste löschen möchte
- **DANN** erklärt der Bestätigungsdialog vor dem Absenden, dass bestehende Benutzer- und Gruppenzuordnungen der Rolle ebenfalls entfernt werden
- **UND** der Administrator kann den Löschvorgang an dieser Stelle noch abbrechen

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

#### Scenario: Benutzertabelle warnt bei unvollständigen Mainserver-Credentials

- **WENN** die bereits geladene Keycloak-Benutzerprojektion eine fehlende Mainserver Application-ID, ein fehlendes Mainserver Application-Secret oder vollständig fehlende Mainserver-Credentials enthält
- **DANN** zeigt die Benutzertabelle am betroffenen Konto eine zugängliche, ursachenspezifische Warnung
- **UND** ein nicht bestimmbarer Credential-Status wird nicht als fehlende Credentials dargestellt
- **UND** die Prüfung erzeugt keine zusätzlichen Keycloak-Aufrufe pro Tabellenzeile
- **UND** weder Application-ID noch Secret werden dafür an den Browser übertragen

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

Das System MUST gruppenbasierte Herkunft von Berechtigungen in den relevanten IAM-Ansichten sichtbar machen und zusätzlich Vererbungs- und Restriktionsgründe strukturiert anzeigen.

#### Scenario: Geo-Vererbung mit untergeordneter Restriktion bleibt nachvollziehbar

- **WENN** eine Parent-Freigabe über eine Geo-Hierarchie grundsätzlich wirksam wäre, aber auf einer untergeordneten Einheit eine Restriktion greift
- **DANN** zeigt die UI sowohl die geerbte Herkunft als auch den blockierenden Restriktionsgrund
- **UND** bleibt erkennbar, aus welcher Gruppe oder Rolle die ursprüngliche Freigabe stammt
- **UND** modelliert die UI diese Restriktion nicht als fachliche `deny`-Permission

#### Scenario: Inaktive Gruppen- oder Membership-Zustände bleiben sichtbar

- **WENN** eine Berechtigung wegen deaktivierter Gruppe, abgelaufener Membership oder noch nicht begonnenem Gültigkeitsfenster fachlich nicht wirksam ist
- **DANN** zeigt die UI den Eintrag weiterhin mit einem lesbaren Inaktivitätsgrund
- **UND** muss ein Administrator nicht zwischen mehreren Ansichten springen, um die Ursache zu verstehen

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

Das System MUST unter `/admin/iam` ein tab-basiertes Transparenz-Cockpit bereitstellen, das strukturierte Rechteinformationen, Governance-Vorgänge und Betroffenenrechtsfälle aufgabengerecht sichtbar macht. Die Tabs SHALL das etablierte Waste-Management-Muster für Trigger-Leiste, mobile Alternativauswahl und gemeinsame Panel-Hülle übernehmen.

#### Scenario: Rechte-Tab zeigt strukturierte Effective Permissions

- **WENN** ein Administrator den Tab `Rechte` in `/admin/iam` öffnet
- **DANN** werden effektive Berechtigungen tabellarisch mit `action`, `resourceType`, optionaler `resourceId`, optionaler `organizationId`, `scope`, `sourceRoleIds` und Rollen-/Gruppen-Provenienz angezeigt
- **UND** enthält die Ansicht keine fachliche `effect`-Unterscheidung zwischen Allow und Deny
- **UND** die Tabelle besitzt eine semantische `caption` oder ein gleichwertiges Tabellenlabel
- **UND** ein Authorize-Check zeigt `reason` und vorhandene Diagnoseinformationen ohne Roh-JSON-Zwang im Standardzustand

#### Scenario: Governance-Tab zeigt tabellarische Übersicht und separate Detailseiten

- **WENN** ein Administrator den Tab `Governance` öffnet
- **DANN** sieht er eine tabellarische Übersicht für Permission-Change-Requests, Delegationen, Impersonation-Sitzungen und Legal-Text-Akzeptanzen
- **UND** pro Eintrag sind mindestens Status, beteiligte Identitäten, Ticketbezug und relevante Zeitstempel sichtbar
- **UND** die Übersicht rendert keine konkurrierende Inline-Detailkarte
- **UND** die Navigation zu einem Eintrag führt auf eine separate Detailseite innerhalb des IAM-Bereichs

#### Scenario: Betroffenenrechte-Tab zeigt tabellarische Übersicht und separate Detailseiten

- **WENN** ein Administrator den Tab `Betroffenenrechte` öffnet
- **DANN** sieht er Requests, Export-Jobs, Legal Holds, Profilkorrekturen und Empfängerbenachrichtigungen in einer tabellarischen Übersicht
- **UND** pro Fall sind Status, Frist-/Zeitinformationen und Blockierungsgründe nachvollziehbar
- **UND** die Übersicht rendert keine konkurrierende Inline-Detailkarte
- **UND** die Navigation zu einem Fall führt auf eine separate Detailseite innerhalb des IAM-Bereichs

#### Scenario: Transparenz-Cockpit bleibt barrierefrei und fokussiert

- **WENN** Datenmengen groß oder Teilbereiche leer sind
- **DANN** bietet das Cockpit Filter, klare Empty-States, Loading-States und Fehlerzustände
- **UND** Tabs, Tabellen und Detailseiten sind vollständig tastaturbedienbar und screenreader-tauglich
- **UND** Fokuswechsel sind deterministisch (Tab/Panel/Detailseite/Dialog setzt Fokus zielgerichtet; beim Schließen erfolgt Fokus-Restore)
- **UND** asynchrone Statusmeldungen sind als Live-Regionen für assistive Technologien wahrnehmbar

#### Scenario: Große Datenmengen werden performanzstabil angezeigt

- **WENN** Governance- oder DSR-Listen hohe Datenmengen enthalten
- **DANN** werden serverseitige Pagination, Filter und Sortierung verwendet
- **UND** initial lädt nur der aktive Tab
- **UND** Detaildaten werden on-demand erst auf der jeweiligen Detailseite nachgeladen

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

Das System MUST Tenant-IAM-Befunde im Bestandsbetrieb sichtbar halten, ohne die
Bestandsseite wieder in mehrere gleichrangige technische Hauptbloecke zu
zerlegen. Tenant-IAM-Konfiguration, Rechteprobe und Reconcile sollen im
Bestandsbetrieb und im Doctor-Modus konsistent auffindbar sein.

#### Scenario: Tenant-IAM bleibt im Betrieb sichtbar, aber nicht als zweites Cockpit

- **WENN** die Bestandsseite im Modus `Betrieb` geladen wird
- **DANN** bleibt ein Tenant-IAM-Befund als betriebliche Achse sichtbar
- **UND** ist weiterhin unterscheidbar, ob ein Befund `Konfiguration`,
  `Zugriff` oder `Reconcile` betrifft
- **UND** tritt dieser Befund nicht als konkurrierende zweite
  Langscroll-Diagnoseflaeche neben Modulverwaltung und Stammdaten auf

### Requirement: Tenant-IAM-Aktionen bleiben kontextbezogen und begrenzt

Das System MUST einen dauerhaft sichtbaren Einstieg `Doctor öffnen` auf der
Bestandsseite bereitstellen. Diagnose- und Reparaturaktionen werden ueber einen
gefuehrten Doctor-Modus angeboten, statt als ungeordnete Menge gleichrangiger
Buttons im Bestandsbetrieb aufzutreten.

#### Scenario: Doctor-Einstieg ist immer sichtbar

- **WENN** ein berechtigter Operator eine Bestandsinstanz oeffnet
- **DANN** ist `Doctor öffnen` immer an derselben Stelle sichtbar
- **UND** kann der Operator Diagnose auch dann aktiv starten, wenn das System
  keinen Befund automatisch erkannt hat

#### Scenario: Erkanntes Problem verstaerkt denselben Doctor-Einstieg

- **WENN** das System selbst einen degradierten oder blockierten Befund erkennt
- **DANN** darf die Bestandsseite im Kopf einen Warnkontext fuer denselben
  Einstieg `Doctor öffnen` anzeigen
- **UND** bleibt der Einstieg an derselben Position
- **UND** muss der Operator kein neues Interaktionsmuster fuer Fehlerfaelle
  lernen

#### Scenario: Doctor fuehrt durch Diagnose und Reparatur

- **WENN** ein Operator den Modus `Doctor` oeffnet
- **DANN** zeigt die Oberflaeche einen gefuehrten Ablauf aus `Überblick`,
  `Empfohlene Maßnahme`, `Reparatur ausführen` und `Validieren`
- **UND** enthaelt der Schritt `Überblick` bewusst auch gruene Vorbedingungen
- **UND** wird der Operator nicht direkt in tiefe Reparaturaktionen geworfen

### Requirement: Progressive Informationsarchitektur auf der Instanz-Detailseite

Das System MUST die Instanz-Detailoberflaeche entlang von Lebensphase und
Arbeitsmodus strukturieren. Nach abgeschlossenem Setup darf die
Bestandsverwaltung nicht mehr als fortgesetztes Setup erscheinen. Fuer
vollstaendig eingerichtete Instanzen besteht die Hauptoberflaeche aus einem
kompakten Kopf und den drei dauerhaften Modi `Betrieb`, `Doctor` und
`Einstellungen`.

#### Scenario: Bestandsinstanz oeffnet standardmaessig im Betrieb

- **WENN** eine Instanz fachlich fertig eingerichtet ist
- **UND** ein berechtigter Operator `/admin/instances/:instanceId` oeffnet
- **DANN** oeffnet die Seite standardmaessig im Modus `Betrieb`
- **UND** bleibt die Modulverwaltung der primäre Happy Path
- **UND** konkurrieren Konfigurationsformular, Vollhistorie und
  Setup-Steuerung nicht gleichrangig im Erstblick

#### Scenario: Bestandsseite besitzt dauerhafte Modi statt gemischter Langseite

- **WENN** ein berechtigter Operator die Bestandsseite einer Instanz oeffnet
- **DANN** zeigt der Kopf mindestens Instanzidentitaet, `Setup-Status`,
  `Betriebsstatus` und einen festen Einstieg `Doctor öffnen`
- **UND** sind die Modi `Betrieb`, `Doctor` und `Einstellungen` dauerhaft
  erreichbar
- **UND** ist die technische Historie kein gleichrangiger Hauptmodus mehr

#### Scenario: Betrieb bleibt ruhig und fokussiert

- **WENN** die Bestandsseite im Modus `Betrieb` angezeigt wird
- **DANN** priorisiert die Oberflaeche Modulzuweisung, Modulentzug und
  alltaegliche Betriebsaktionen
- **UND** bleibt Diagnose nur ueber denselben festen Einstieg `Doctor öffnen`
  schnell erreichbar
- **UND** dominiert die Diagnoseansicht den Happy Path nicht dauerhaft

### Requirement: Zentraler Admin-Bereich fuer instanzbezogene Modulzuweisung auf Studio-Root-Ebene

Das System SHALL einen zentralen Bereich `Module` auf Studio-Root-Ebene bereitstellen, der ausschliesslich fuer den Studio-Admin zugaenglich ist und ueber den Module Instanzen zugewiesen oder entzogen werden.

#### Scenario: Studio-Admin weist einer Instanz ein Modul zu

- **GIVEN** ein Studio-Admin oeffnet den zentralen Bereich `Module` auf Studio-Root-Ebene
- **WHEN** er eine konkrete Instanz auswaehlt und ein Modul zuweist
- **THEN** zeigt die UI verfuegbare und bereits zugewiesene Module getrennt oder gleichwertig filterbar an
- **AND** bietet sie pro Modul eine explizite Aktion zum Zuweisen oder Entziehen an
- **AND** ist dieser Bereich von der operativen Instanz-Detailseite getrennt und nur fuer den Studio-Admin erreichbar
- **AND** haben Instanz-Operatoren keinen Zugriff auf diese Verwaltung

### Requirement: Modulzuweisung zeigt integrierten IAM-Seeding-Effekt

Das System SHALL in der Modulverwaltung klar kommunizieren, dass die Zuweisung eines Moduls zu einer Instanz die noetige IAM-Basis in derselben Operation herstellt.

#### Scenario: Zuweisung zeigt fachliche Folge

- **GIVEN** ein Modul ist einer Instanz noch nicht zugewiesen
- **WHEN** der Studio-Admin die Zuweisung bestaetigt
- **THEN** macht die UI sichtbar, dass das Modul fuer die Instanz fachlich freigeschaltet und die zugehoerige IAM-Basis in derselben Operation geseedet wird
- **AND** zeigt sie nach Abschluss eine verstaendliche Ergebnisrueckmeldung

### Requirement: Modulentzug zeigt Hard-Removal und fordert Bestaetigung

Das System SHALL den Entzug eines Moduls von einer Instanz als harte, fachlich wirksame Entfernung mit Vorschau und expliziter Bestaetigung darstellen.

#### Scenario: Entzug warnt vor Rechteentzug

- **GIVEN** ein Modul ist einer Instanz zugewiesen
- **WHEN** der Studio-Admin den Entzug ausloest
- **THEN** zeigt die UI eine Bestaetigung mit Hinweis auf die harte Entfernung modulbezogener Permissions und Rollenbeziehungen
- **AND** SHALL sie betroffene Systemrollen (Name), Permissions-Anzahl und einen Hinweis auf moegliche Auswirkungen auf aktive Nutzersitzungen in einer Vorschau sichtbar machen
- **AND** wird der Entzug ohne explizite Bestaetigung des Studio-Admins nicht ausgefuehrt

### Requirement: Instanz-Cockpit zeigt Befund fuer IAM-Basis aktiver Module

Das System SHALL auf der Instanz-Detailseite einen expliziten Befund fuer die IAM-Basis aktiver Module anzeigen und dem Studio-Admin eine direkte Reparaturaktion anbieten.

#### Scenario: Cockpit zeigt Reparaturpfad fuer IAM-Basis-Drift

- **GIVEN** die Instanz hat aktive Module mit unvollstaendiger IAM-Basis
- **WHEN** der Studio-Admin die Instanz-Detailseite oeffnet
- **THEN** zeigt das Cockpit einen degradierten Befund fuer die IAM-Basis aktiver Module
- **AND** enthaelt der Befund eine verstaendliche Klartextzeile (nicht nur das technische Label `IAM-Basis aktiver Module`)
- **AND** ordnet die Seite diesen Befund als operativen Handlungsbedarf ein
- **AND** bietet sie eine direkte Aktion zum Neu-Seeden von Berechtigungen und Systemrollen an
- **AND** ist diese Aktion nur fuer den Studio-Admin sichtbar und ausfuehrbar

#### Scenario: Cockpit zeigt Empty-State fuer Bestandsinstanz ohne zugewiesene Module

- **GIVEN** eine Bestandsinstanz hat nach Einfuehrung des Modulvertrags noch keine zugewiesenen Module
- **WHEN** der Studio-Admin die Instanz-Detailseite oeffnet
- **THEN** erklaert das Cockpit, dass fuer diese Instanz noch keine Module zugewiesen wurden
- **AND** weist es darauf hin, dass die Zuweisung im zentralen Bereich `Module` erfolgt
- **AND** wertet es den leeren Modulsatz nicht als Fehler, sondern als erwarteten Ausgangszustand

### Requirement: Instanz-Detailseite zeigt Modultransparenz fuer alle global bekannten Module

Das System SHALL auf der Instanz-Detailseite alle global bekannten Module in einer lesenden Uebersicht anzeigen. Der Status wird pro Modul ausschliesslich aus der Root-Modulzuordnung der Instanz abgeleitet; die Seite fuehrt keine zweite Aktivierungslogik ein. Die Beschreibung eines Moduls stammt aus pluginseitig gepflegter Metadatenauflosung.

#### Scenario: Instanz zeigt aktive und deaktivierte Module

- **GIVEN** eine Instanzdetailseite kennt die global bekannte Modulliste und den aktuell zugewiesenen Modulsatz der Instanz
- **WHEN** der Studio-Admin die Detailseite oeffnet
- **THEN** zeigt die UI alle global bekannten Module in einer Tabelle oder gleichwertigen Listenansicht an
- **AND** markiert sie Module aus `assignedModules` als aktiv
- **AND** markiert sie global bekannte, aber nicht zugewiesene Module als deaktiviert
- **AND** zeigt sie pro Modul eine pluginseitig gepflegte Beschreibung an

#### Scenario: Fehlende Modulbeschreibung nutzt Fallback ohne die Tabelle zu verbergen

- **GIVEN** ein global bekanntes Modul liefert keine aufloesbare Beschreibung
- **WHEN** der Studio-Admin die Detailseite oeffnet
- **THEN** bleibt das Modul in der Uebersicht sichtbar
- **AND** rendert die UI fuer dieses Modul einen definierten Fallbacktext statt einer leeren Beschreibung
- **AND** bleibt die Modultransparenz der restlichen Eintraege unveraendert lesbar

### Requirement: Instanz-Anlage-Flow fuehrt einen gefuehrten Admin-Bootstrap-Abschnitt

Das System SHALL die Instanz-Anlage klar von der spaeteren Bestandsverwaltung
trennen. Nach erfolgreicher Anlage fuehrt der primaere naechste Schritt in
einen separaten einmaligen Flow `Setup abschliessen`, statt direkt in die
normale Bestandsseite zu springen.

#### Scenario: Erfolgreiche Anlage fuehrt zuerst in den Setup-Abschluss

- **GIVEN** eine Instanz wurde erfolgreich angelegt
- **WHEN** der Studio-Admin den primaeren naechsten Schritt ausloest
- **THEN** fuehrt die UI zuerst in einen separaten Flow
  `Setup abschliessen`
- **AND** ist die normale Bestandsseite noch nicht der primaere Zielbildschirm

#### Scenario: Stammdaten bleiben im Bestand nachgeordnet

- **GIVEN** das Setup einer Instanz wurde erfolgreich abgeschlossen
- **WHEN** ein Operator spaeter Vertrags- oder Stammdaten aendern moechte
- **THEN** findet er diese Aenderungen im Modus `Einstellungen`
- **AND** nicht mehr in der Hauptarbeitsflaeche des Bestandsbetriebs

### Requirement: Initiale Admin-Struktur wird mit editierbaren Rollen aufgebaut

Das System SHALL ueber den Bootstrap-Abschnitt eine initiale Gruppe `Admins` sowie sprechend benannte Initialrollen fuer `Core` und optional ausgewaehlte Module anlegen. Diese Rollen sind Startartefakte und duerfen spaeter im IAM-UI bearbeitet werden.

#### Scenario: Bootstrap ohne Module erzeugt editierbare Core-Struktur

- **GIVEN** der Studio-Admin fuehrt den Bootstrap-Abschnitt ohne Modulauswahl aus
- **WHEN** die Aktion erfolgreich abgeschlossen wird
- **THEN** legt die UI-seitig beschriebene Mutation die Gruppe `Admins` und die Rolle `Core Admin` an
- **AND** sind diese Artefakte spaeter im IAM-UI sichtbar und bearbeitbar

#### Scenario: Bootstrap mit Modulen erzeugt sprechend benannte Modul-Admin-Rollen

- **GIVEN** der Studio-Admin hat im Bootstrap-Abschnitt Module ausgewaehlt
- **WHEN** die Aktion erfolgreich abgeschlossen wird
- **THEN** erzeugt das System zusaetzlich pro ausgewaehltem Modul eine sprechend benannte Modul-Admin-Rolle
- **AND** verknuepft es diese Rollen zusammen mit `Core Admin` mit der Gruppe `Admins`
- **AND** bleiben die erzeugten Rollen spaeter im IAM-UI bearbeitbar

### Requirement: Mainserver-Credentials in der Organisationsdetailansicht pflegen

Das System MUST in der Organisationsverwaltung eine abgesicherte Pflege organisationsgebundener Mainserver-Credentials bereitstellen. Die Organisationsdetailansicht zeigt dafür ein Feld für `Mainserver Application-ID`, ein write-only Feld für `Mainserver Application-Secret` und einen Status, ob bereits ein Secret hinterlegt ist.

#### Scenario: Organisationsdetail zeigt write-only Credential-Felder

- **WENN** ein Administrator die Detailansicht einer Organisation öffnet
- **DANN** sieht er die aktuelle `Mainserver Application-ID`, falls vorhanden
- **UND** das Secret-Feld ist nie mit einem bestehenden Klartextwert vorbefüllt
- **UND** die UI zeigt stattdessen an, ob bereits ein Secret hinterlegt ist

#### Scenario: Administrator aktualisiert organisationsgebundene Mainserver-Credentials

- **WENN** ein Administrator in der Organisationsdetailansicht eine `Mainserver Application-ID` und optional ein neues Secret speichert
- **DANN** sendet die UI nur die eingegebenen Änderungswerte an den vorgesehenen Organisations-Endpunkt
- **UND** ein leer gelassenes Secret-Feld wird nicht als Löschsignal gesendet, sondern bedeutet „bestehendes Secret beibehalten"
- **UND** nach erfolgreichem Speichern zeigt die Oberfläche den aktualisierten Application-ID-Wert und den Secret-Status an
- **UND** kein Klartext-Secret wird im UI-State oder in Responses angezeigt

#### Scenario: UI bietet keinen impliziten Secret-Revoke-Pfad an

- **WENN** ein Administrator die Organisationsdetailansicht ohne neues Secret absendet
- **DANN** behandelt die UI dies nicht als Secret-Löschung
- **UND** die Oberfläche sendet keinen leeren oder `null`-basierten Secret-Wert als impliziten Revoke-Request

### Requirement: Rollen-Detailseite pflegt Assignment-Scopes fuer scope-faehige Rechte

Das System SHALL in der Rollen-Detailseite fuer scope-faehige Datensatzrechte neben der Zuweisung auch den Assignment-Scope pflegbar machen.

#### Scenario: Scope-Selector erscheint nur fuer geeignete Rechte

- **WHEN** ein Administrator den Permissions-Tab einer editierbaren Rolle oeffnet
- **THEN** zeigt die UI fuer scope-faehige Rechte einen Selector fuer `all`, `own` und `organization`
- **AND** nicht scope-faehige Rechte bleiben binaer zuweisbar

#### Scenario: Speichern sendet strukturierte Permission-Assignments

- **WHEN** ein Administrator Rechte- oder Scope-Aenderungen speichert
- **THEN** sendet die UI `permissionAssignments[]` mit `permissionId` und `accessScope`
- **AND** neu zugewiesene scope-faehige Rechte erhalten standardmaessig `all`

### Requirement: Nutzeransicht zeigt effektive Permission-Scopes transparent an

Das System SHALL in der Nutzer-Berechtigungsansicht den effektiven Assignment-Scope rollen- oder gruppenvermittelter Datensatzrechte sichtbar machen.

#### Scenario: Effektiver Scope wird im Permission Trace dargestellt

- **WHEN** ein Administrator den Tab `Berechtigungen` einer Nutzerdetailseite betrachtet
- **THEN** enthalten effektive Permission-Trace-Eintraege den wirksamen Assignment-Scope
- **AND** die Darstellung bleibt read-only

### Requirement: Separate IAM-Detailseiten für Governance- und DSR-Fälle

Das System SHALL innerhalb des IAM-Bereichs eigenständige Detailseiten für Governance- und Betroffenenrechtsfälle bereitstellen, damit Übersichten und Bearbeitungskontext nicht in derselben Oberfläche konkurrieren.

#### Scenario: Governance-Detailseite strukturiert den Fallkontext

- **WENN** ein berechtigter Administrator einen Governance-Eintrag aus der Übersicht öffnet
- **DANN** landet er auf einer dedizierten Governance-Detailseite
- **UND** die Seite zeigt mindestens Titel, Status, Typ, beteiligte Identitäten, Ticketbezug und relevante Zeitstempel in einer Kopfsektion
- **UND** weitere Metadaten und Zusammenhänge werden in strukturierten Inhaltsblöcken statt in einer einzelnen Inline-Karte dargestellt

#### Scenario: DSR-Detailseite strukturiert den Fallkontext

- **WENN** ein berechtigter Administrator einen DSR-Fall aus der Übersicht öffnet
- **DANN** landet er auf einer dedizierten DSR-Detailseite
- **UND** die Seite zeigt mindestens Titel, Status, Typ, betroffene Person, Antragsteller und relevante Zeitstempel in einer Kopfsektion
- **UND** weitere Metadaten, Blocker und Fallzusammenhänge werden in strukturierten Inhaltsblöcken statt in einer einzelnen Inline-Karte dargestellt

#### Scenario: Rücknavigation erhält den fachlichen Übersichtskontext

- **WENN** ein Administrator von einer Governance- oder DSR-Detailseite zur Übersicht zurückkehrt
- **DANN** führt die Navigation deterministisch zurück in den passenden IAM-Tab
- **UND** die Rückkehr bleibt ohne manuelles Neuwählen des Fachbereichs verständlich und erwartbar

### Requirement: Tenant-Rollenverwaltung zeigt keine Root-Plattformrolle als tenantlokales Artefakt

Das System SHALL in tenantlokalen Rollen- und Benutzerverwaltungsansichten die Plattformrolle `instance_registry_admin` nicht als zuweisbare Tenant-Rolle darstellen.

#### Scenario: Tenant-Rollenliste blendet Root-Plattformrolle aus

- **WHEN** ein Administrator die tenantlokale Rollenverwaltung unter `/admin/roles` öffnet
- **THEN** erscheint `instance_registry_admin` dort nicht als tenantseitig verwaltbare Rolle
- **AND** die Ansicht bleibt auf tenantlokale Rollen des aktiven Tenant-Realm beschränkt

#### Scenario: Tenant-Benutzerbearbeitung bietet keine Root-Plattformrolle an

- **WHEN** ein Administrator im Tenant-Realm Rollen für einen Benutzer bearbeitet
- **THEN** ist `instance_registry_admin` nicht als auswählbare Rollenzuweisung verfügbar
- **AND** die UI behandelt tenantlokale und Root-Rollen nicht als gemeinsamen Katalog

### Requirement: Tenant-Rollenverwaltung erlaubt individuelle Rechtezuschnitte ohne Standardrollenpflicht

Das System SHALL in der tenantlokalen Rollenverwaltung die Zuordnung von Rechten zu individuellen Rollen unterstützen, ohne kanonische Standardrollen als Primärmodell vorauszusetzen.

#### Scenario: Individuelle Rolle erhält modulbezogene Rechte

- **WHEN** ein Administrator eine editierbare tenantlokale Rolle erstellt oder bearbeitet
- **THEN** kann er modulbezogene und tenantlokale Rechte direkt über die Rollenverwaltung zuweisen
- **AND** die UI verlangt dafür keine Auswahl oder Kopplung an Rollen wie `editor`, `designer` oder `app_manager`

### Requirement: UI-Gates behandeln system_admin als vollständigen Tenant-Vollzugriff

Das System SHALL tenantlokale Navigations-, Aktions- und Verwaltungs-Gates so auswerten, dass ein Benutzer mit `system_admin` die vollständigen vorgesehenen Tenant-Admin-Funktionen nutzen kann, ohne zusätzliche versteckte Rollen- oder Gruppenabhängigkeiten.

#### Scenario: Sidebar und Admin-Funktionen bleiben für system_admin sichtbar

- **WHEN** ein Benutzer im Tenant-Realm ausschließlich `system_admin` besitzt
- **THEN** bleiben die für Tenant-Administratoren vorgesehenen Navigationspunkte, Verwaltungsseiten und Aktionen sichtbar und nutzbar
- **AND** ihre Verfügbarkeit hängt nicht zusätzlich von Gruppen wie `admins` oder Rollen wie `core_admin` ab

### Requirement: GUI-gestuetzter Authorize-Performance-Lauf im Monitoring

Das System MUST im bestehenden Monitoring-Bereich unter `/monitoring` einen bedienbaren Bereich fuer einen sessiongebundenen Authorize-Performance-Lauf bereitstellen.

#### Scenario: Berechtigter Administrator findet den Lauf im Monitoring-Menue

- **WHEN** ein berechtigter Administrator den Monitoring-Bereich der Anwendung oeffnet
- **THEN** ist dort ein eigener IAM-bezogener Einstieg `Authorize Performance` erreichbar
- **AND** ist der Einstieg nicht nur als Unterfunktion des IAM-Cockpits versteckt
- **AND** bleibt das IAM-Cockpit unter `/admin/iam` von dieser Platzierung fachlich getrennt

#### Scenario: Berechtigter Administrator startet den Lauf

- **WHEN** ein berechtigter Administrator den Monitoring-Einstieg `Authorize Performance` nutzt
- **THEN** kann er einen serverseitigen Benchmark fuer `POST /iam/authorize` mit seiner aktuellen Session starten
- **AND** die UI bietet Eingaben fuer mindestens `action`, `resourceType`, optionale `resourceId` und optionales `organizationId`
- **AND** die UI zeigt waehrend des Laufs einen klaren Status statt stiller Hintergrundaktivitaet

#### Scenario: Ergebnis wird lesbar ausgewertet

- **WHEN** der Benchmark erfolgreich abgeschlossen wurde
- **THEN** zeigt die UI die Szenarien `cache-hit`, `cache-miss` und `recompute`
- **AND** zeigt pro Szenario mindestens `Samples`, `p50`, `p95`, `p99` und eine fachliche Bewertung
- **AND** macht die UI klar kenntlich, dass die Messung serverseitig und nicht als Browser-Timing erhoben wurde

#### Scenario: Lauf scheitert sicher und verstaendlich

- **WHEN** Session, Berechtigung, Invalidation oder Servermessung fehlschlagen
- **THEN** zeigt die UI einen verstaendlichen Fehlerzustand ohne Stacktrace- oder Geheimnisleck
- **AND** suggeriert keinen gueltigen Performance-Nachweis aus einem unvollstaendigen Lauf

### Requirement: Tenant-Löschregeln im IAM-Admin-Cockpit

Das System MUST unter `/admin/iam?tab=deletion-rules` einen tenantgebundenen Admin-Tab für Löschregeln bereitstellen. Der Tab zeigt und bearbeitet ausschließlich die Regeln der aktiven `instanceId` und ist nicht für Root- oder Plattform-Administration ohne Tenant-Scope vorgesehen.

#### Scenario: Tenant-Admin bearbeitet Löschregeln der aktiven Instanz

- **WENN** ein berechtigter Tenant-Admin `/admin/iam?tab=deletion-rules` öffnet
- **DANN** zeigt die UI die aktuellen Werte für `deactivateAfterDays`, `pseudonymizeAfterDays`, `deleteAfterDays`, die tenantweite Default-Inhaltsstrategie und den Tenant-Schalter `Nutzer dürfen die Standardregel für eigene Inhalte überschreiben`
- **UND** zeigt die UI die Baseline-Defaults/Fallbacks `90 / 180 / 365` getrennt von tenant-spezifischen Werten an
- **UND** zeigt die UI bei unkonfigurierten Tenants die Baseline-Defaults `90 / 180 / 365`, die geerbte Default-Inhaltsstrategie `beibehalten` und den Override-Schalter standardmäßig deaktiviert als wirksamen Zustand
- **UND** können die Werte in einer validierten Bearbeitungsmaske geändert werden
- **UND** ist die auswählbare Strategiemenge auf `beibehalten` und `mit Eigentümer-Lifecycle mitbehandeln` begrenzt
- **UND** wird klar angezeigt, dass sich die Regeln nur auf Tenant-Accounts der aktiven `instanceId` beziehen

#### Scenario: Speichern erzeugt oder aktualisiert explizite Tenant-Konfiguration

- **WENN** ein berechtigter Tenant-Admin im Tab `deletion-rules` Werte speichert
- **DANN** erzeugt das System für zuvor unkonfigurierte Tenants eine explizite Tenant-Konfiguration
- **UND** aktualisiert das System für bereits konfigurierte Tenants die bestehende Tenant-Konfiguration
- **UND** zeigt die UI nach dem Speichern die gespeicherten tenant-spezifischen Werte statt nur geerbter Baseline-Defaults
- **UND** bleibt die Speicheraktion ausschließlich mit `iam.deletionRules.manage` verfügbar

#### Scenario: Entfernen einer expliziten Tenant-Konfiguration kehrt zum geerbten Zustand zurück

- **WENN** ein berechtigter Tenant-Admin eine bestehende explizite Tenant-Konfiguration entfernt
- **DANN** zeigt die UI wieder die wirksamen Baseline-Defaults `90 / 180 / 365` und die geerbte Strategie `beibehalten`
- **UND** behandelt die UI dies als gültigen Zustandswechsel statt als leeren oder fehlerhaften Zustand

#### Scenario: UI erklärt die fachlichen Lebenszykluszustände

- **WENN** der Tab `deletion-rules` dargestellt wird
- **DANN** beschreibt die UI die Zustände `active`, `deactivated`, `pseudonymized` und `deleted`
- **UND** erläutert, dass `deleted` einen finalen Tombstone-Soft-Delete und keine physische Löschung bedeutet
- **UND** erläutert, dass `deactivated` nicht automatisch durch Login aufgehoben wird und eine separate Reaktivierung verlangt
- **UND** macht kenntlich, dass ohne Reaktivierung spätere automatische Lifecycle-Stufen weiterlaufen können
- **UND** weist darauf hin, dass V1 Inaktivität ausschließlich aus dem letzten `login`-Event der aktiven `instanceId` ableitet

#### Scenario: Root- oder plattformweite Administration erhält keinen Tenant-Regeltab

- **WENN** ein Benutzer ohne aktiven Tenant-Scope oder nur mit Root-/Plattformrechten `/admin/iam?tab=deletion-rules` aufruft
- **DANN** zeigt die UI keinen bearbeitbaren Tenant-Regelzustand
- **UND** erhält der Benutzer einen verweigerten oder nicht verfügbaren Zustand ohne Leckage tenantbezogener Konfigurationsdaten

#### Scenario: Ladezustand zeigt wirksame Regelermittlung an

- **WENN** die UI die wirksamen Regeln, Baseline-Defaults oder tenant-spezifischen Werte für `deletion-rules` lädt
- **DANN** zeigt sie einen expliziten Ladezustand
- **UND** vermeidet sie währenddessen irreführende Leer- oder Default-Formulare als vermeintlich bereits geladene Daten

#### Scenario: Fehlerzustand für Laden oder Speichern ist handlungsleitend

- **WENN** das Laden oder Speichern der Löschregeln fehlschlägt
- **DANN** zeigt die UI einen expliziten Fehlerzustand mit verständlicher, handlungsleitender Meldung
- **UND** bleibt erkennbar, ob der Fehler beim Laden oder beim Speichern entstanden ist
- **UND** werden keine unbestätigten Eingaben als erfolgreich übernommen dargestellt

#### Scenario: Unkonfigurierter Tenant erzeugt keinen leeren Admin-Zustand

- **WENN** für einen Tenant noch keine explizite Löschregel-Konfiguration gespeichert ist
- **DANN** zeigt die UI die Baseline-Defaults `90 / 180 / 365`, die geerbte Strategie `beibehalten` und den Override-Default `deaktiviert` als wirksamen Zustand
- **UND** verwendet sie keinen leeren oder mehrdeutigen Empty-State anstelle dieser wirksamen Standardwerte

### Requirement: Self-Service zeigt Löschregeln und Inhaltspräferenz transparent an

Das System MUST in den Account-/Privacy-Oberflächen die tenantweiten Löschregeln transparent darstellen und dem Benutzer einen per-Account-Override für die Behandlung eigener Inhalte im Scope `iam.contents` anbieten.

#### Scenario: Benutzer sieht tenantweite Fristen und eigene Inhaltspräferenz

- **WENN** ein authentifizierter Benutzer `/account/privacy` oder die zugehörige Datenschutzfläche seines Accounts öffnet
- **DANN** sieht er die tenantweiten Fristen für Deaktivierung, Pseudonymisierung und finalen Tombstone-Soft-Delete
- **UND** sieht er bei nicht konfigurierten Tenants die Baseline-Defaults/Fallbacks `90 / 180 / 365` als wirksame Standardwerte
- **UND** sieht er bei nicht konfigurierten Tenants `beibehalten` als geerbte wirksame Default-Inhaltsstrategie
- **UND** wird erklärt, dass die Fristen sich auf den letzten `login`-Zeitpunkt innerhalb der aktiven `instanceId` beziehen
- **UND** wird erklärt, dass Accounts ohne Login-Event in V1 nicht automatisch in den Inaktivitäts-Lifecycle fallen
- **UND** sieht der Benutzer den aktuell wirksamen Strategiewert für eigene Inhalte im Scope `iam.contents`
- **UND** werden die zulässigen Strategiewerte `beibehalten` und `mit Eigentümer-Lifecycle mitbehandeln` verständlich benannt
- **UND** werden die Strategiewirkungen verständlich erklärt: unverändert lassen oder die jeweils erreichte Account-Stufe auf Inhalte spiegeln

#### Scenario: Root- oder Plattform-Accounts ohne Tenant-Scope sehen keine Konten-Löschregeln-Box

- **WENN** ein Root- oder Plattform-Account ohne aktive `instanceId` `/account/privacy` öffnet
- **DANN** zeigt die UI keine Konten-Löschregeln-Box
- **UND** leakt sie keinen tenantbezogenen Regelzustand in diese Oberfläche

#### Scenario: Benutzer überschreibt die tenantweite Default-Inhaltsstrategie für eigene Inhalte

- **WENN** ein Benutzer seine Inhaltspräferenz in der Privacy-Oberfläche ändert und der Tenant Self-Service-Overrides erlaubt
- **DANN** kann er die tenantweite Default-Inhaltsstrategie für seine eigenen Inhalte gezielt überschreiben
- **UND** ist der Override auf den Scope `iam.contents` begrenzt
- **UND** ist der schreibbare Zielaccount serverseitig aus dem Session-/Authentifizierungskontext des Benutzers gebunden
- **UND** kann die Self-Service-Oberfläche keinen Override für andere Benutzerkonten schreiben
- **UND** ist im Auswahlfeld direkt die wirksame Regel vorausgewählt
- **UND** zeigt die UI nach dem Speichern den wirksamen Zustand verständlich und ohne Rohdateninterpretation an

#### Scenario: Tenant deaktiviert Self-Service-Overrides

- **WENN** für den Tenant `allowContentPreferenceOverride = false` gilt
- **DANN** zeigt die UI in der Konten-Löschregeln-Box keinen Überschreibungs- und Speicherbereich
- **UND** bleibt nur die tenantweit wirksame Regel sichtbar

#### Scenario: Self-Service bleibt auch ohne verfügbare Override-Daten verständlich

- **WENN** für einen Benutzer noch kein individueller Override gespeichert ist
- **DANN** zeigt die UI die tenantweite Default-Inhaltsstrategie als wirksamen Zustand
- **UND** erklärt, dass nur eigene Inhalte im Scope `iam.contents` betroffen sind
- **UND** bleibt die Oberfläche tastaturbedienbar, screenreader-tauglich und mit klaren Leer-, Lade- und Fehlerzuständen ausgestattet

### Requirement: Rollenanzeigen nutzen eine kanonische Fachsicht
Das System SHALL in Profil-, Session- und Tenant-Admin-Ansichten eine kanonische Rollen- und Permission-Sicht verwenden, statt rohe Keycloak-Rollenlisten als primäre Benutzerdarstellung auszugeben.

#### Scenario: Account-Seite zeigt fachlich kanonische Rollen
- **WHEN** ein authentifizierter Tenant-Benutzer `/account` aufruft
- **THEN** zeigt die Seite die kanonischen tenantlokalen Rollen aus dem IAM-Modell an
- **AND** umfasst diese kanonische Sicht auch implizite Rollenwirkung aus Gruppenzuordnungen
- **AND** zeigt die Seite rohe Keycloak-Rollen in einer getrennten technischen Ansicht
- **AND** werden technische oder Legacy-Rollen nicht unkommentiert als normale Fachrollen dargestellt

#### Scenario: Admin-Ansicht unterscheidet kanonische Rollen von Rohrollen
- **WHEN** eine Benutzer- oder Rollenansicht Diagnosedaten zu Auth oder Sync einblendet
- **THEN** sind kanonische Tenant-Rollen und rohe Keycloak-Rollen klar getrennt beschriftet
- **AND** bleibt für Administratoren erkennbar, welche Sicht für Autorisierung normativ ist

