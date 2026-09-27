# account-ui Specification

## Purpose

TBD - created by archiving change add-account-user-management-ui. Update Purpose after archive.

## Requirements

### Requirement: Auth-State-Provider

Das System MUST einen zentralen React-Context (`AuthProvider` in `sva-studio-react`) bereitstellen, der Authentifizierung, Session, Identität, Instanz, technische Plattformrollen und fail-closed Modulzuweisungen anwendungsweit verfügbar macht, verteilte `/auth/me`-Aufrufe durch einen einheitlichen `useAuth()`-Hook ersetzt und Auth-Unterbrechungen strukturiert diagnostizierbar macht. Tenantseitige UI-Autorisierung MUST getrennt davon über den scope-gebundenen Effective-Access-State erfolgen; die flache `permissionActions`-Liste aus `/auth/me` darf nach der Migration keine Route oder UI-Aktion freigeben.

#### Scenario: Authentifizierter Nutzer lädt die Anwendung

- **WENN** ein authentifizierter Nutzer die Anwendung öffnet
- **DANN** lädt der `AuthProvider` die User-Daten über `/auth/me`
- **UND** stellt `{ user, isAuthenticated: true, isLoading: false }` über `useAuth()` bereit
- **UND** alle Komponenten, die `useAuth()` nutzen, erhalten denselben State ohne eigene API-Aufrufe
- **UND** werden tenantseitige Permission-Entscheidungen nicht aus einer flachen `/auth/me`-Action-Liste abgeleitet

#### Scenario: Nicht-authentifizierter Nutzer

- **WENN** ein nicht-authentifizierter Nutzer die Anwendung öffnet
- **DANN** gibt der `AuthProvider` `{ user: null, isAuthenticated: false, isLoading: false }` zurück
- **UND** der `/auth/me`-Aufruf wird nicht wiederholt, bis ein expliziter Refetch ausgelöst wird

#### Scenario: Token-Refresh während der Session

- **WENN** der Access-Token während einer aktiven Session abläuft
- **UND** der Refresh-Token noch gültig ist
- **DANN** aktualisiert der `AuthProvider` die User-Daten automatisch nach dem Server-seitigen Token-Refresh
- **UND** erhöht ein Identitäts-, Instanz-, Plattformrollen- oder Modulwechsel die Auth-Generation und invalidiert davon abhängige Effective-Access-Snapshots
- **UND** die Anwendung zeigt keinen globalen Ladeindikator während eines unveränderten stillen Refreshs

#### Scenario: Stale-Permissions-Erkennung

- **WENN** eine Serverantwort ein stabiles Stale-, Scope- oder Snapshot-Versionssignal enthält
- **DANN** wird der zentrale Effective-Access-Snapshot höchstens einmal für seine aktuelle Generation invalidiert
- **UND** wird für tenantseitige UI-Autorisierung `GET /iam/me/permissions` im aktuellen Scope neu geladen
- **UND** wird `/auth/me` nur dann zusätzlich refetcht, wenn das Signal Session-, Instanz-, Plattformrollen- oder Modulkontext betrifft

#### Scenario: Erwartbarer Ressourcen-Denial

- **WENN** eine konkrete Ressourcenmutation ohne Stale-, Scope- oder Versionssignal mit `403 Forbidden` abgewiesen wird
- **DANN** wird die konkrete Ressourcen-Capability als nicht erlaubt behandelt
- **UND** löst die Antwort keine globale Effective-Access-Refetch-Schleife aus

#### Scenario: Session expired notice keeps correlated diagnostics

- **WENN** ein Benutzer nach fehlgeschlagener stiller Session-Recovery auf `/?auth=session-expired` geleitet wird
- **DANN** bleibt ein lokaler, tab-bezogener Auth-Diagnosepfad für den Vorfall erhalten
- **UND** die Oberfläche darf mindestens `requestId` und `authFlowId` sichtbar machen
- **UND** der Diagnosepfad enthält keine Tokens und keine PII

### Requirement: Protected-Route-Guard

Das System MUST einen generischen Route-Guard bereitstellen, der öffentliche, authentifizierte, technische Plattform- und tenantgebundene Routen ausdrücklich unterscheidet. Tenantgebundene Routen MUST denselben scope-gebundenen Effective-Access-State wie Navigation und Seitenaktionen verwenden und erforderliche Modulzuweisungen zusätzlich fail-closed prüfen. Rohe Keycloak-Rollen dürfen nur dort direkt ausgewertet werden, wo eine dokumentierte technische Plattformrolle im Plattform-Scope betroffen ist; sie dürfen keine Tenant-Action freigeben.

#### Scenario: Unauthentifizierter Zugriff auf geschützte Route

- **WHEN** ein nicht-authentifizierter Nutzer eine geschützte Route aufruft
- **THEN** wird der Nutzer zur Login-Seite weitergeleitet
- **AND** nach erfolgreicher Authentifizierung wird er zur ursprünglichen URL zurückgeleitet

#### Scenario: Authentifizierter Nutzer ohne ausreichende fachliche Autorisierung

- **WHEN** ein authentifizierter Nutzer eine tenantgebundene Route aufruft, für die eine bestimmte Permission erforderlich ist
- **AND** der aktuelle Effective-Access-State diese Permission nicht im passenden Instanz- und Organisationskontext erlaubt
- **THEN** wird der Nutzer auf die Startseite weitergeleitet
- **AND** eine verständliche Fehlermeldung wird angezeigt (`t('auth.insufficientRole')`)

#### Scenario: Admin-Route-Schutz folgt kanonischer Tenant-Sicht

- **WHEN** die Route `/admin/users` aufgerufen wird
- **THEN** prüft der Guard über den `routerContext` die dafür vorgesehene tenantgebundene Permission im aktuellen Effective-Access-State
- **AND** verlässt sich diese Entscheidung weder auf rohe Legacy-Keycloak-Rollen wie `app_manager` noch auf eine technische Plattformrolle

#### Scenario: Plattform-Route verwendet nur technischen Plattform-Scope

- **WHEN** eine Root-Host- oder Control-Plane-Route aufgerufen wird
- **THEN** wertet der Guard ausschließlich die dokumentierte technische Plattform-Session-Sicht aus
- **UND** verwendet er keine tenantgebundene Permission oder Organisation als Plattformfreigabe

#### Scenario: Modul ist nicht zugewiesen

- **WHEN** eine tenantgebundene Plugin- oder Fachroute eine Modulzuweisung verlangt
- **UND** das Modul in der fail-closed Session-Sicht nicht zugewiesen ist
- **THEN** verweigert der Guard die Route auch dann, wenn eine gleichnamige Action im Permission-Snapshot vorkommt

### Requirement: Account-Profilseite

Das System MUST eine Account-Profilseite unter `/account` bereitstellen, auf der authentifizierte Nutzer ihre eigenen Basis-Daten einsehen und bearbeiten können. Credential-bezogene Änderungen wie Passwort und E-Mail gehören nicht in dieses Formular, sondern werden über Keycloak-gestützte Self-Service-Flows gestartet.

#### Scenario: Profil anzeigen

- **WENN** ein authentifizierter Nutzer `/account` aufruft
- **DANN** werden Benutzername, Name, E-Mail, Telefon, Position, Abteilung, Sprache und Zeitzone angezeigt
- **UND** die kanonischen Rollen und der Account-Status sind sichtbar (read-only)
- **UND** eine getrennte technische Ansicht für rohe Keycloak-Rollen ist verfügbar
- **UND** ein Avatar oder Platzhalter-Bild wird angezeigt
- **UND** die Seite zeigt einen Loading-State (`aria-busy="true"`) während die Daten geladen werden
- **UND** bei einem Ladefehler wird eine Fehlermeldung mit Retry-Button angezeigt

#### Scenario: Basis-Daten bearbeiten

- **WENN** ein Nutzer seine Basis-Daten wie Name, Telefon, Position, Abteilung, Sprache oder gleichwertige nicht-credential-bezogene Profilfelder ändert
- **UND** das Formular absendet
- **DANN** werden die Änderungen in der IAM-Datenbank gespeichert
- **UND** Keycloak wird nur für die dafür vorgesehenen Profilfelder synchronisiert, sofern der bestehende Profilpfad dies verlangt
- **UND** die Benutzerverwaltung zeigt bei der nächsten Datenladung den aktualisierten Anzeigenamen und die aktualisierten Profilfelder
- **UND** Änderungen an Vor- und Nachname aktualisieren den `displayName`, sofern kein abweichender benutzerdefinierter Anzeigename gepflegt wurde
- **UND** eine Erfolgsbestätigung wird angezeigt (`role="status"`, `aria-live="polite"`)
- **UND** der `AuthProvider`-State wird aktualisiert
- **UND** der Fokus wird nach dem Speichern auf die Erfolgsbestätigung gesetzt

#### Scenario: E-Mail- und Passwortänderung sind nicht Teil des Profilformulars

- **WENN** ein authentifizierter Nutzer `/account` verwendet
- **DANN** bietet das Profilformular keine lokalen Eingabefelder für Passwort oder neue E-Mail-Adresse an
- **UND** werden solche Credential-Änderungen über die dafür vorgesehenen Menü- oder Self-Service-Einstiege des Studios gestartet

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

#### Scenario: Bulk-Reprovision verarbeitet nur markierte Nutzer mit zusammengefasstem Feedback

- **WENN** ein Administrator in `/admin/users` mehrere Nutzer explizit markiert und die Bulk-Aktion „Mainserver-Daten aktualisieren“ bestätigt
- **DANN** sendet die UI nur die markierten Nutzer-IDs an den Server
- **UND** die Oberfläche erklärt vorab das Limit von maximal 50 Nutzern und mögliches Teil-Erfolgsverhalten
- **UND** zeigt die Oberfläche nach Abschluss eine zusammengefasste Erfolg-/Fehler-Rückmeldung als wahrnehmbare Statusmeldung
- **UND** bleiben bestehende Einzelaktionen auf `/admin/users/:userId` unverändert verfügbar

### Requirement: User-Bearbeitungsseite

Das System MUST eine User-Bearbeitungsseite unter `/admin/users/:userId` bereitstellen, die eine detaillierte Bearbeitung eines Benutzer-Accounts in einer Tab-Ansicht ermoeglicht und direkte, gruppenbasierte sowie vererbte Berechtigungsursachen nachvollziehbar darstellt.

#### Scenario: Verwaltung zeigt nachvollziehbare Berechtigungsherkunft

- **WENN** ein Administrator den Benutzer-Detailbereich mit Rollen- und Rechteinformationen oeffnet
- **DANN** zeigt die UI direkte Rollen, Gruppenherkuenfte und effektive Berechtigungen in lesbarer Form an
- **UND** markiert sie sichtbar, ob ein Eintrag instanzweit, datensatzbezogen oder organisationskontextbezogen ausgewertet wird
- **UND** bleibt erkennbar, ob ein Eintrag direkt zugewiesen, ueber eine Gruppe wirksam oder ueber Organisations- bzw. Geo-Hierarchien vererbt ist
- **UND** bleiben blockierte oder fachlich unwirksame Eintraege als solche erkennbar statt still ausgeblendet zu werden

#### Scenario: Benutzerbearbeitung loescht fachlich unveraenderte Assignment-Metadaten nicht

- **WENN** ein Administrator einen Benutzer speichert, ohne eine bestehende Rollen- oder Gruppenzuordnung fachlich zu aendern
- **DANN** bleiben vorhandene Metadaten wie Herkunft und Gueltigkeitsfenster erhalten
- **UND** erstellt die UI keinen Bedienfluss, der diese Metadaten implizit zuruecksetzt, nur weil derselbe Benutzer erneut gespeichert wurde

#### Scenario: User-Detailseite zeigt Organisationsmitgliedschaften im eigenen Tab

- **WENN** ein Administrator `/admin/users/:userId` oeffnet
- **DANN** enthaelt die Tab-Navigation einen Tab `Organisationen`
- **UND** zeigt dieser Tab alle bestehenden Organisationsmitgliedschaften des Benutzers mit Organisationsname, Membership-Sichtbarkeit, Default-Kontext-Markierung und Erstellzeitpunkt
- **UND** sind die angezeigten Organisationsdaten aus demselben IAM-Read-Model abgeleitet wie die Organisationsverwaltung

#### Scenario: Administrator weist aus der User-Detailseite weitere Organisationen zu

- **WENN** ein Administrator im Tab `Organisationen` eine weitere Organisation zuweist
- **DANN** erfolgt die Auswahl ueber eine suchbare Liste noch nicht zugewiesener Organisationen derselben Instanz
- **UND** kann der Administrator beim Zuweisen `visibility` und `isDefaultContext` festlegen
- **UND** wird die neue Organisationsmitgliedschaft ohne Seitenwechsel in der Membership-Liste sichtbar

#### Scenario: Administrator pflegt Membership-Attribute direkt im User-Kontext

- **WENN** ein Administrator im Tab `Organisationen` eine bestehende Organisationsmitgliedschaft bearbeitet
- **DANN** kann er `visibility` und `isDefaultContext` direkt fuer diese Membership aktualisieren
- **UND** wird eine Default-Kontext-Aenderung fachlich konsistent gespeichert, ohne parallele Default-Markierungen fuer denselben Account zu hinterlassen

#### Scenario: Administrator entfernt Organisationsmitgliedschaften direkt im User-Kontext

- **WENN** ein Administrator im Tab `Organisationen` eine bestehende Organisationsmitgliedschaft entfernt
- **DANN** wird die Membership aus dem Benutzerkontext geloescht
- **UND** aktualisiert die UI die Liste ohne Seitenwechsel
- **UND** bleibt ein fachlich gueltiger Default-Kontext fuer den Account erhalten oder wird regelkonform neu bestimmt

### Requirement: Rollen-Verwaltungsseite

Das System MUST eine Rollen-Verwaltungsseite unter `/admin/roles` bereitstellen, die das Anzeigen und Bearbeiten von System- und Custom-Rollen ermöglicht, technische Kompatibilitätsfelder aus dem normalen Bedienfluss heraushält und nur fachlich geänderte Teilflächen speicherbar macht.

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
- **DANN** sind mindestens Anzeigename, Beschreibung, `externalRoleName`, `managedBy`, Sync-Zustand und Mitgliederzahl sichtbar, soweit das jeweilige Rollenmodell diese Werte führt
- **UND** das interne Kompatibilitätsfeld `roleLevel` wird in Rollenliste, Rollenanlage und normaler Rollenbearbeitung weder angezeigt noch bearbeitet
- **UND** System-Rollen und extern verwaltete Rollen sind als read-only kenntlich
- **UND** destruktive oder fachlich nicht zulässige Aktionen sind nicht nur deaktiviert, sondern auch verständlich begründet

#### Scenario: Administrator legt eine Rolle ohne technische Doppeleingabe an

- **WENN** ein Administrator einen gültigen Anzeigenamen und optional eine Beschreibung für eine Custom-Rolle eingibt
- **DANN** verlangt die UI weder einen technischen Rollenschlüssel noch ein `roleLevel`
- **UND** sendet sie den Anzeigenamen als fachlich führenden Namen an den serverseitigen Create-Vertrag
- **UND** zeigt sie den erzeugten technischen Schlüssel nach erfolgreicher Anlage nur als nicht bearbeitbare Zusatzinformation unter „Technische Details“

#### Scenario: Rollenrechte werden fachlich lesbarer dargestellt

- **WENN** ein Administrator die Rechte einer Rolle öffnet
- **DANN** priorisiert die UI lokalisierte fachliche Bezeichnungen, Gruppierungen und Beschreibungen der Rechte
- **UND** erklärt sie die Scopes `own`, `organization` und `all` in fachlich verständlichen Begriffen
- **UND** technische Werte wie `permissionKey` bleiben höchstens ergänzende, einklappbare Detailinformation
- **UND** die Oberfläche zwingt Administratoren nicht zur Interpretation roher technischer Schlüssel

#### Scenario: Veröffentlichungs- und Sichtbarkeitsrechte bleiben unterscheidbar

- **WENN** die Rechte `content.publish` und `content.changeStatus` in einer Rolle verfügbar sind
- **DANN** zeigt die UI sie als getrennte positive Rechte „Veröffentlichen“ und „Sichtbarkeitsstatus ändern“
- **UND** erklärt sie deren unterschiedliche fachliche Wirkung
- **UND** leitet sie aus einer Auswahl keine weitergehende Permission ab

#### Scenario: Unveränderte allgemeine Rollendaten sind nicht speicherbar

- **WENN** der normalisierte Entwurf der allgemeinen Rollendaten dem zuletzt bestätigten Serverzustand entspricht
- **DANN** ist die zugehörige Speicheraktion deaktiviert
- **UND** wird sie erst nach einer fachlichen Änderung aktiviert
- **UND** kehrt sie nach erfolgreichem Speichern und Aktualisieren der Vergleichsbasis in den deaktivierten Zustand zurück

#### Scenario: Unveränderte Rollenrechte sind nicht speicherbar

- **WENN** Permission-IDs und Assignment-Scopes fachlich dem zuletzt bestätigten Serverzustand entsprechen
- **DANN** sind beide Positionen der wiederholten Speicheraktion deaktiviert
- **UND** reine Reihenfolgeunterschiede gelten nicht als Änderung
- **UND** bleiben beide Positionen an denselben Dirty-, Saving-, Saved-, Fehler- und Disabled-Zustand gebunden

#### Scenario: Fehlgeschlagene Rollenspeicherung bleibt wiederholbar

- **WENN** eine Speicherung geänderter Rollenmetadaten oder Rollenrechte fehlschlägt
- **DANN** bleibt der Entwurf als geändert erhalten
- **UND** kehrt die Speicheraktion aus dem Saving-Zustand in einen erneut ausführbaren Zustand zurück
- **UND** wird der Fehler gemäß dem gemeinsamen Save-Feedback-Vertrag persistent und verständlich angezeigt

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

Das System MUST eine Organisations-Verwaltungsseite unter `/admin/organizations` bereitstellen, auf der berechtigte Administratoren Organisationen instanzgebunden pflegen und zulässige Blatt-Organisationen endgültig löschen können.

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

#### Scenario: Blatt-Organisation löschen

- **WENN** ein Administrator auf der Organisationsliste oder im Detail eine Organisation ohne Children löscht
- **DANN** ruft die UI den Delete-Endpunkt auf und entfernt die Organisation nach Erfolg aus dem sichtbaren Zustand
- **UND** erklärt der Bestätigungsdialog, dass Memberships und organisationsgebundene Credentials mit entfernt werden

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

Das System MUST heute verdeckte IAM-Metadaten in den bestehenden Benutzer-, Rollen-, Organisations- und Kontextansichten sichtbar machen, soweit dies fachlich sinnvoll und sicher ist. Interne Kompatibilitätsfelder ohne notwendige Bedienwirkung MUST dabei aus normalen Fachansichten herausgehalten werden.

#### Scenario: Benutzerdetail zeigt Profil- und Rollenmetadaten

- **WENN** ein Administrator `/admin/users/:userId` öffnet
- **DANN** wird ein vorhandener Avatar verwendet, andernfalls ein Platzhalter
- **UND** Rollen-Gültigkeitsfenster und andere zuweisungsbezogene Metadaten sind sichtbar
- **UND** die Historie zeigt echte IAM-Aktivitäten statt eines statischen Empty-States, sofern Daten vorhanden sind

#### Scenario: Rollenansicht zeigt externe Abbildung und Sync-Interna

- **WENN** ein Administrator `/admin/roles` öffnet
- **DANN** sind pro Rolle neben Anzeigename und Beschreibung auch `externalRoleName`, `managedBy` sowie relevante Sync-Informationen sichtbar
- **UND** wird das interne Kompatibilitätsfeld `roleLevel` nicht als fachlich zu pflegende Rollenmetadaten dargestellt
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
Bestandsseite bereitstellen. Diagnose- und Reparaturaktionen SHALL im Doctor
über dieselben vorhandenen Instanz-Handler und Guards wie im Einrichtungscockpit
ausgeführt werden. Der Doctor SHALL aktuelle Befunde, zulässige Maßnahme,
tatsächliches Ausführungsergebnis und Folgeprüfung zusammenhängend darstellen.
Die Aktivierung SHALL ausschließlich im vorhandenen geschützten Abschluss des
Einrichtungscockpits ausgeführt werden; der Doctor SHALL dorthin verweisen.

#### Scenario: Doctor-Einstieg ist immer sichtbar

- **WHEN** ein berechtigter Operator eine Bestandsinstanz öffnet
- **THEN** ist `Doctor öffnen` immer an derselben Stelle sichtbar
- **AND** bleibt der Einstieg auch ohne automatisch erkannten Befund nutzbar

#### Scenario: Erkanntes Problem verstaerkt denselben Doctor-Einstieg

- **WHEN** ein degradierter oder blockierter Befund vorliegt
- **THEN** verstärkt ein kurzer Hinweis denselben Doctor-Einstieg
- **AND** bleibt dessen Position unverändert
- **AND** zeigt der Hinweis den betroffenen Bereich statt einer zweiten Vollanalyse

#### Scenario: Doctor fuehrt durch Diagnose und Reparatur

- **WHEN** der Operator den Doctor öffnet
- **THEN** folgt die Oberfläche `Überblick`, `Empfohlene Maßnahme`, `Reparatur ausführen` und `Validieren`
- **AND** sind erfolgreiche Prüfungen im Überblick zusammengefasst sichtbar und im Detail aufklappbar
- **AND** folgen technische Historie und ausführlicher Audit auf die aktuellen Befunde

#### Scenario: Empfohlene Maßnahme ist vor Ort ausführbar

- **GIVEN** die vorhandenen Verträge erlauben eine konkrete Diagnose- oder Reparaturaktion für die Instanz
- **WHEN** diese als nächste Maßnahme im Doctor angezeigt wird
- **THEN** kann der Operator sie dort über denselben Handler auslösen
- **AND** gelten Instanz-/Run-Bezug, Planbindung, Reauth, Bestätigung und Retry-Bedingungen unverändert
- **AND** wird keine zweite hervorgehobene Cockpit-Aktion gleichzeitig angezeigt

#### Scenario: Doctor verweist zur Aktivierung in das Einrichtungscockpit

- **GIVEN** die serverseitige nächste Aktion lautet `instance.status.activate`
- **WHEN** der Operator die empfohlene Maßnahme im Doctor auswählt
- **THEN** öffnet die UI den bestehenden Aktivierungsabschnitt im Einrichtungscockpit und fokussiert dessen Überschrift
- **AND** löst diese Navigation keine Mutation aus
- **AND** bleiben aktuelle Betriebsnachweise, manuelle Hinweise, Fresh-Reauth und revisionsgebundene Bestätigung Voraussetzung der dortigen Aktivierung
- **AND** entsteht kein zweiter ausführbarer Aktivierungspfad im Doctor

#### Scenario: Fehlende oder veraltete Freigabe erlaubt keine Reparatur

- **WHEN** die nächste mutierende Aktion fehlt oder der erforderliche Plan nicht mehr aktuell ist
- **THEN** ist die Mutation nicht ausführbar
- **AND** führt die UI zur vorhandenen lesenden Prüfung oder Planaktualisierung
- **AND** ersetzt sie die Freigabe nicht durch einen lokalen Erfolgsbadge

#### Scenario: Maßnahmenerfolg ersetzt keine Folgeprüfung

- **WHEN** ein Auftrag angenommen oder eine Reparaturmutation erfolgreich beantwortet wird
- **THEN** zeigt der Doctor genau dieses Ergebnis und die verfügbare Folgeprüfung
- **AND** behauptet er vollständige Betriebsbereitschaft erst auf entsprechender aktueller Evidenz
- **AND** bleibt frühere fehlgeschlagene Evidenz als Historie erkennbar

### Requirement: Progressive Informationsarchitektur auf der Instanz-Detailseite

Das System MUST die Instanz-Detailoberfläche entlang von Lebensphase und
Arbeitsmodus strukturieren. Die bestehende Detailroute SHALL einen kompakten
Kopf mit Instanzidentität, Lifecycle, davon getrenntem Betriebszustand und dem
festen Einstieg `Doctor öffnen` zeigen. Setup-Hinweise SHALL sich auf vorhandene
fachliche Evidenz beziehen. Die drei Modi `Betrieb`, `Doctor` und `Einstellungen`
SHALL ohne vorgeschaltete Sammel-Disclosure erreichbar sein. Wiederholte
Identitäts-, Lifecycle- und Gesamtstatuskarten SHALL entfallen.

#### Scenario: Bestandsinstanz oeffnet standardmaessig im Betrieb

- **WHEN** ein berechtigter Operator eine fertig eingerichtete Instanz öffnet
- **THEN** öffnet die Seite im Modus `Betrieb` mit Modulverwaltung als Hauptaufgabe
- **AND** konkurrieren Formular, Vollhistorie und abgeschlossener Setup-Fortschritt nicht im Erstblick

#### Scenario: Bestandsseite besitzt dauerhafte Modi statt gemischter Langseite

- **WHEN** ein Operator die Detailseite öffnet
- **THEN** zeigt der kompakte Kopf Identität, Lifecycle, Betriebszustand und den festen Doctor-Einstieg
- **AND** sind alle drei Modi unmittelbar und per Tastatur erreichbar
- **AND** bleibt die technische Historie innerhalb des Doctors

#### Scenario: Betrieb bleibt ruhig und fokussiert

- **WHEN** der Modus `Betrieb` sichtbar ist
- **THEN** priorisiert er Modulzuweisung, Modulentzug und laufende Verwaltungsaufgaben
- **AND** führt ein kurzer aktueller Befund zum gleichen dauerhaft erreichbaren Doctor
- **AND** wird der vollständige Audit nicht zusätzlich neben der Modulverwaltung gerendert

#### Scenario: Aktive Instanz mit Störung bleibt im Bestand

- **GIVEN** der Lifecycle lautet `active`
- **WHEN** Tenant-IAM oder ein erforderliches Plugin nicht bereit oder nicht verifiziert ist
- **THEN** bleiben Lifecycle und Betriebsbefund getrennt sichtbar
- **AND** bleibt `Betrieb` die Standardansicht, ohne automatischen Rücksprung zur Neuanlage
- **AND** wird aus `active` weder eine erfolgreiche aktuelle Prüfung noch eine neue Mutationsfreigabe abgeleitet

#### Scenario: Suspendierte oder archivierte Instanz startet keine Ersteinrichtung

- **WHEN** ein berechtigter Operator eine suspendierte oder archivierte Instanz öffnet
- **THEN** zeigt die Seite deren Lifecycle und vorhandene Diagnose im Bestandskontext
- **AND** bietet sie ausschließlich die vorhandenen zulässigen Verwaltungsaktionen an

### Requirement: Zentraler Admin-Bereich fuer instanzbezogene Modulzuweisung auf Studio-Root-Ebene

Das System SHALL einen zentralen Bereich `Module` auf Studio-Root-Ebene bereitstellen, der ausschließlich für den Studio-Admin zugänglich ist und über den Module Instanzen zugewiesen oder entzogen werden. Dieselbe fachliche Modulverwaltung darf zusätzlich in der instanzgebundenen Root-Admin-Betriebsansicht der Instanz-Detailseite wiederverwendet werden, solange keine zweite Mutationslogik entsteht.

#### Scenario: Studio-Admin weist einer Instanz ein Modul über die Sammelseite zu

- **GIVEN** ein Studio-Admin oeffnet den zentralen Bereich `Module` auf Studio-Root-Ebene
- **WHEN** er eine konkrete Instanz auswaehlt und ein Modul zuweist
- **THEN** zeigt die UI verfuegbare und bereits zugewiesene Module getrennt oder gleichwertig filterbar an
- **AND** bietet sie pro Modul eine explizite Aktion zum Zuweisen oder Entziehen an
- **AND** bleibt dieser Bereich als rootweiter Sammelarbeitsplatz erreichbar
- **AND** haben Instanz-Operatoren keinen Zugriff auf diese Verwaltung

#### Scenario: Sammelseite und Betriebsansicht verwenden denselben Fach-Workspace

- **GIVEN** die Modulverwaltung ist sowohl auf `/admin/modules` als auch in `/admin/instances/:instanceId` verfügbar
- **WHEN** ein Root-Admin dieselbe Modulmutation in einem der beiden Einstiege auslöst
- **THEN** verwenden beide Oberflächen dieselben Root-only-Mutationen und dieselbe fachliche Zustandsdarstellung
- **AND** führt die Betriebsansicht keine abweichende zweite Aktivierungslogik ein

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

Das System SHALL auf der Instanz-Detailseite einen expliziten Befund für die
IAM-Basis aktiver Module anzeigen und dem berechtigten Studio-Admin die
vorhandene direkte Reparaturaktion anbieten. Der Befund SHALL in die aktuelle
Aufgabe beziehungsweise den Modul-Workspace integriert werden und SHALL keine
zusätzliche dauerhaft gleichrangige Diagnosekarte erzeugen.

#### Scenario: Cockpit zeigt Reparaturpfad fuer IAM-Basis-Drift

- **GIVEN** aktive Module besitzen eine unvollständige IAM-Basis
- **WHEN** der Studio-Admin die Instanz-Detailseite öffnet
- **THEN** zeigt sie einen degradierten Befund mit verständlicher Klartextzeile und operativer Auswirkung
- **AND** bietet sie die bestehende direkte Aktion zum Neu-Seeden von Berechtigungen und Systemrollen an
- **AND** bleibt diese Aktion ausschließlich für berechtigte Studio-Admins verfügbar

#### Scenario: Cockpit zeigt Empty-State fuer Bestandsinstanz ohne zugewiesene Module

- **GIVEN** die Bestandsinstanz besitzt keine zugewiesenen Module
- **WHEN** der Studio-Admin die Detailseite öffnet
- **THEN** erklärt der Betriebsbereich diesen erwarteten Ausgangszustand und die Zuweisung im selben Workspace
- **AND** bleibt alternativ `/admin/modules` als Sammelarbeitsplatz erreichbar
- **AND** wird der leere Modulsatz nicht als Fehler oder neuer Setup-Pflichtschritt gewertet

### Requirement: Instanz-Detailseite zeigt Modultransparenz fuer alle global bekannten Module

Das System SHALL auf der Instanz-Detailseite alle global bekannten sowie noch
gespeicherten, aktuell nicht verfügbaren Module in einer gemeinsamen
Root-Admin-Modulansicht darstellen. Zuweisung, effektive Aktivierung und
technische Bereitschaft SHALL unterscheidbar bleiben und ausschließlich aus
ihren vorhandenen Verträgen stammen. Beschreibung und vorhandener Anzeigename
SHALL aus den Plugin-Metadaten stammen; technische IDs bleiben nachvollziehbar.

#### Scenario: Instanz zeigt aktive und deaktivierte Module in der Betriebsansicht

- **WHEN** der Studio-Admin `Betrieb` öffnet
- **THEN** zeigt die UI alle global bekannten Module in einer gemeinsamen Tabelle oder gleichwertigen Liste
- **AND** unterscheidet sie anhand des vorhandenen Root-Vertrags zugewiesene und nicht zugewiesene Module
- **AND** zeigt sie Beschreibung und vorhandene Aktivierungsrichtlinie, Herkunft und Overrides auf Anforderung
- **AND** erscheint technische Readiness getrennt von Zuweisung und effektiver Aktivierung

#### Scenario: Fehlende Modulbeschreibung nutzt Fallback ohne die Tabelle zu verbergen

- **GIVEN** ein Modul liefert keine auflösbare Beschreibung
- **WHEN** seine Zeile angezeigt wird
- **THEN** bleibt das Modul mit definiertem Fallbacktext sichtbar
- **AND** bleibt die Übersicht der übrigen Module unverändert bedienbar

#### Scenario: Zugewiesenes Modul wartet auf technische Bereitstellung

- **GIVEN** ein Modul ist zugewiesen, seine aktuelle technische Readiness aber noch nicht bereit
- **WHEN** der Betriebsbereich angezeigt wird
- **THEN** bleiben Zuweisung und ausstehende oder blockierte Bereitschaft gleichzeitig sichtbar
- **AND** führt die passende Aktion zum Befund oder vorhandenen aktiven Job
- **AND** wird das Modul nicht aufgrund seiner Zuweisung als technisch bereit bezeichnet

#### Scenario: Fehlende und nicht vorgesehene Readiness sind verschieden

- **WHEN** ein Modul keinen Lifecycle-Vertrag hat
- **THEN** zeigt die UI, dass keine technische Prüfung vorgesehen ist
- **AND** zeigt sie bei einem erwarteten, aber fehlenden oder fehlerhaft geladenen Readiness-Datensatz stattdessen `Nicht verifiziert`
- **AND** wird keiner dieser Zustände als erfolgreich geprüfte Bereitschaft behandelt

#### Scenario: Nicht mehr verfügbares Modul bleibt nachvollziehbar

- **GIVEN** eine gespeicherte Modulzuweisung oder Aktivierung hat aktuell keinen verfügbaren Plugin-Vertrag
- **WHEN** die Modulansicht aufgebaut wird
- **THEN** bleibt die technische ID mit dem Zustand `Nicht verfügbar` sichtbar
- **AND** wird weder eine neue Zuordnung noch eine Reparaturoperation aus ähnlichen Namen geraten

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
- **UND** zeigt die UI die Baseline-Defaults/Fallbacks `365 / 730 / 1.095` getrennt von tenant-spezifischen Werten an
- **UND** zeigt die UI bei unkonfigurierten Tenants die Baseline-Defaults `365 / 730 / 1.095`, die geerbte Default-Inhaltsstrategie `beibehalten` und den Override-Schalter standardmäßig deaktiviert als wirksamen Zustand
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
- **DANN** zeigt die UI wieder die wirksamen Baseline-Defaults `365 / 730 / 1.095` und die geerbte Strategie `beibehalten`
- **UND** behandelt die UI dies als gültigen Zustandswechsel statt als leeren oder fehlerhaften Zustand

#### Scenario: UI erklärt die fachlichen Lebenszykluszustände

- **WENN** der Tab `deletion-rules` dargestellt wird
- **DANN** beschreibt die UI die Zustände `active`, `deactivated`, `pseudonymized` und `deleted`
- **UND** erläutert, dass `deleted` einen finalen Tombstone-Soft-Delete und keine physische Löschung bedeutet
- **UND** erläutert, dass `deactivated` nicht automatisch durch Login aufgehoben wird und eine separate Reaktivierung verlangt
- **UND** macht kenntlich, dass ohne Reaktivierung spätere automatische Lifecycle-Stufen weiterlaufen können
- **UND** weist darauf hin, dass V1 Inaktivität ausschließlich aus dem letzten erfolgreichen `login`-Event der aktiven `instanceId` ableitet

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
- **DANN** zeigt die UI die Baseline-Defaults `365 / 730 / 1.095`, die geerbte Strategie `beibehalten` und den Override-Default `deaktiviert` als wirksamen Zustand
- **UND** verwendet sie keinen leeren oder mehrdeutigen Empty-State anstelle dieser wirksamen Standardwerte

### Requirement: Self-Service zeigt Löschregeln und Inhaltspräferenz transparent an

Das System MUST in den Account-/Privacy-Oberflächen die tenantweiten Löschregeln transparent darstellen und dem Benutzer einen per-Account-Override für die Behandlung eigener Inhalte im Scope `iam.contents` anbieten.

#### Scenario: Benutzer sieht tenantweite Fristen und eigene Inhaltspräferenz

- **WENN** ein authentifizierter Benutzer `/account/privacy` oder die zugehörige Datenschutzfläche seines Accounts öffnet
- **DANN** sieht er die tenantweiten Fristen für Deaktivierung, Pseudonymisierung und finalen Tombstone-Soft-Delete
- **UND** sieht er bei nicht konfigurierten Tenants die Baseline-Defaults/Fallbacks `365 / 730 / 1.095` als wirksame Standardwerte
- **UND** sieht er bei nicht konfigurierten Tenants `beibehalten` als geerbte wirksame Default-Inhaltsstrategie
- **UND** wird erklärt, dass jede der drei Fristen ein absoluter Schwellwert seit dem letzten erfolgreichen `login`-Event innerhalb der aktiven `instanceId` ist und nicht auf der vorherigen Lifecycle-Stufe aufbaut
- **UND** wird erklärt, dass Accounts ohne erfolgreiches Login-Event in V1 nicht automatisch in den Inaktivitäts-Lifecycle fallen
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

### Requirement: Benutzerverwaltung bietet eine privilegierte Löschaktion für Tenant-Accounts

Das System MUST in der Tenant-Benutzerverwaltung eine explizite Löschaktion für Tenant-Accounts bereitstellen, wenn der aktuelle Actor die Permission `iam.accounts.delete` effektiv besitzt.

#### Scenario: Löschaktion ist für berechtigte Administratoren verfügbar

- **WENN** ein berechtigter Tenant-Administrator einen löschbaren Tenant-Account in der Benutzerverwaltung betrachtet
- **DANN** zeigt die UI eine explizite Löschaktion
- **UND** erklärt ein Bestätigungsdialog die physische Löschung des Tenant-Accounts, die Entfernung in Keycloak und die inhaltsbezogene Behandlung nach wirksamer Tenant-/Account-Regel

#### Scenario: Geschützte Zielaccounts zeigen keinen irreführenden Delete-Flow

- **WENN** ein Zielaccount aktuell die Rolle `system_admin` besitzt
- **DANN** blendet die UI die Löschaktion aus oder deaktiviert sie mit klarer Begründung
- **UND** suggeriert die Oberfläche keinen unmittelbar ausführbaren Delete-Flow

#### Scenario: Unberechtigter Administrator sieht keine Löschaktion

- **WENN** ein Administrator die Permission `iam.accounts.delete` nicht effektiv besitzt
- **DANN** zeigt die UI keine ausführbare Löschaktion für Tenant-Accounts
- **UND** werden keine sensitiven Delete-Folgen oder Bestätigungsdialoge unnötig exponiert

### Requirement: Wiederholte Primäraktion in Benutzer- und Rechtstextbearbeitung

Das System SHALL bei langen Benutzer- und Rechtstextformularen dieselbe formularweite Speichern- beziehungsweise Anlegen-Aktion oberhalb und unterhalb der bearbeitbaren Inhalte anbieten.

#### Scenario: Administrator bearbeitet einen Benutzer über mehrere Tabs

- **GIVEN** ein berechtigter Administrator bearbeitet einen Benutzer in der tab-basierten Benutzerbearbeitung
- **WHEN** die Bearbeitungsseite gerendert wird
- **THEN** steht dieselbe Speichern-Aktion oberhalb der Tabs und am Formularende bereit
- **AND** beide Positionen verwenden denselben Submit-, Lade- und Disabled-Zustand

#### Scenario: Administrator erstellt oder bearbeitet einen Rechtstext

- **GIVEN** ein berechtigter Administrator öffnet die lange Rechtstexterstellung oder Rechtstextbearbeitung
- **WHEN** die Eingabefläche einschließlich Rich-Text-Editor gerendert wird
- **THEN** steht dieselbe Primäraktion oberhalb der Felder und unterhalb des Rich-Text-Editors bereit
- **AND** beide Positionen speichern dasselbe vollständige Rechtstextformular

### Requirement: Zentraler scope-gebundener Effective-Access-State

Das System MUST für die angemeldete Session genau einen gemeinsam konsumierten aktuellen Effective-Access-State pro Auth-Generation und diskriminiertem Plattform- oder Tenant-Scope bereitstellen. Ein Tenant-State MUST an die aktive `instanceId`, die aktive `organizationId` beziehungsweise einen ausdrücklich organisationslosen Kontext und die aktuelle Modulzuweisungs-Generation gebunden sein und SHALL strukturierte effektive Permissions statt einer unscoped Action-Liste als Entscheidungsbasis verwenden. Ein Plattform-State MUST auf dokumentierte technische Root-/Control-Plane-Flächen begrenzt bleiben.

#### Scenario: Mehrere UI-Verbraucher verwenden denselben Scope-Snapshot

- **WENN** Sidebar, Route-Bindings, Host-Seite und Plugin-Fläche im selben Instanz- und Organisationskontext gerendert werden
- **DANN** beziehen sie ihre Access-Entscheidungen aus derselben Snapshot-Generation
- **UND** führt keiner dieser Verbraucher einen unabhängigen Permission-Read mit eigenem aktivem Organisationszustand aus

#### Scenario: Plattform- und Tenant-State sind getrennt

- **WENN** dieselbe Session technische Plattformflächen und tenantgebundene Flächen erreichen kann
- **DANN** besitzen beide Flächen diskriminierte Scope-Schlüssel und getrennte Entscheidungsquellen
- **UND** erweitert eine technische Plattformrolle keine tenantgebundene Action
- **UND** erweitert eine tenantgebundene Permission keine Root- oder Control-Plane-Aktion

#### Scenario: Organisation wird gewechselt

- **WENN** ein Benutzer den aktiven Organisationskontext wechselt
- **DANN** verwirft der Host alle Entscheidungen des vorherigen Scope-Schlüssels vor einer Freigabe im neuen Kontext
- **UND** darf eine verspätete Antwort des alten Scopes den neuen Effective-Access-State nicht überschreiben
- **UND** werden Navigation, Route-Guards und Aktionsflächen atomar aus derselben neuen Snapshot-Generation aktualisiert

#### Scenario: Permission-Read ist nicht belastbar

- **WENN** der Effective-Access-State `unresolved`, `loading` oder `error` ist
- **DANN** wird keine geschützte UI-Aktion als erlaubt behandelt
- **UND** übernimmt die UI keine Permissions aus einem früheren Scope oder einer früheren Generation
- **UND** zeigt eine weiterhin lesbare Fläche einen lokalisierten und zugänglichen Lade-, Fehler- oder Retry-Zustand

#### Scenario: Stabiles Stale-Signal invalidiert den Snapshot

- **WENN** eine Serverantwort ein stabiles Stale-, Scope- oder Snapshot-Versionssignal enthält
- **DANN** zeigt die UI einen verständlichen autorisierungsbezogenen Fehlerzustand
- **UND** invalidiert sie den Effective-Access-State höchstens einmal für die aktuelle Generation über den zentralen Invalidation-Pfad
- **UND** aktualisiert sie sichtbare Aktionen erst nach einer neuen scope-korrekten Entscheidung

#### Scenario: Modul wird entzogen

- **WENN** ein Modul im aktiven Tenant-Scope entzogen wird
- **DANN** invalidiert der Host die betroffene Effective-Access-Generation
- **UND** verweigern Navigation, Routen und Aktionen das Modul fail-closed, bevor ein neuer Tenant-Snapshot Freigaben liefern darf

### Requirement: UI trennt Seitenzugriff von Mutationsaktionen

Das System MUST den lesenden Zugriff auf eine Route oder Detailseite getrennt von Create-, Update-, Delete- und sonstigen Mutationsaktionen auswerten. Ein Read-Recht SHALL niemals implizit eine Mutation in derselben Oberfläche freigeben.

#### Scenario: Benutzer besitzt nur Read-Recht

- **WENN** ein Benutzer eine Listen- oder Detailseite mit dem passenden Read-Recht öffnet
- **UND** keine passende Create-, Update- oder Delete-Permission besitzt
- **DANN** bleibt die lesbare Fachinformation verfügbar
- **UND** zeigt die UI keine ausführbaren Create-, Submit-, Delete- oder vergleichbaren Mutationscontrols
- **UND** kann keine Mutation über Tastatur, impliziten Formular-Submit oder fokussierbare Rest-Controls ausgelöst werden

#### Scenario: Scope-beschränktes Read-Recht öffnet eine gefilterte Sammlung

- **WENN** ein Benutzer ein `own`- oder organisationsgebundenes Read-Recht für einen Content-Typ besitzt
- **DANN** bleiben Navigation und Listenroute für die serverseitig gefilterte Sammlung erreichbar
- **UND** wird daraus keine Capability für einen konkreten Datensatz oder eine Mutation abgeleitet

#### Scenario: Permission fehlt für eine sensitive Aktion

- **WENN** die effektive Permission für Löschen, Reprovisionierung, Import, Reset, Seed oder eine andere sensitive Mutation fehlt
- **DANN** blendet die UI die ausführbare Aktion und ihren Bestätigungsflow aus
- **UND** exponiert sie keine unnötigen sensitiven Aktionsdetails

#### Scenario: Aktion ist fachlich statt autorisierungsbedingt nicht verfügbar

- **WENN** ein Benutzer die erforderliche Permission besitzt
- **UND** ein fachlicher Zustand die Aktion verhindert, beispielsweise ein geschütztes Zielobjekt oder ein laufender Prozess
- **DANN** darf die UI die Aktion deaktiviert darstellen
- **UND** kommuniziert sie die fachliche Begründung lokalisiert und für assistive Technologien verständlich

### Requirement: UI-Access-Entscheidungen sind systematisch verifizierbar

Das System MUST Host- und Plugin-Oberflächen gegen eine gemeinsame negative und positive Access-Matrix testen.

#### Scenario: Persona-Matrix wird geprüft

- **WENN** eine Oberfläche Create-, Update-, Delete- oder Sonderaktionen anbietet
- **DANN** prüfen automatisierte Tests mindestens read-only, passende Einzelfreigabe, fehlende Freigabe sowie `unresolved`/`loading` und `error`
- **UND** verifizieren sie sowohl sichtbare Controls als auch Tastatur- und Formularauslösung

#### Scenario: Scope-Wechsel wird geprüft

- **WENN** ein Benutzer zwischen zwei Organisationen mit unterschiedlichen effektiven Permissions wechselt
- **DANN** verifiziert ein Integrationstest, dass keine Aktion aus dem alten Scope sichtbar oder ausführbar bleibt
- **UND** wird kein Permission-Flash als positive Freigabe gerendert

### Requirement: Benutzerverwaltung kann technische Accounts bearbeiten und filtern

Die Account-UI SHALL die technische Account-Klassifikation in Erstellung und Detailbearbeitung anbieten. Die Benutzerliste SHALL technische Accounts standardmäßig ausblenden und eine explizite Filteroption „Auch technische Accounts anzeigen“ anbieten. Filterung und Pagination SHALL auf demselben serverseitigen Sichtbarkeitsvertrag beruhen.

#### Scenario: Accountliste startet ohne technische Accounts

- **WHEN** ein berechtigter Administrator die Accountliste ohne expliziten technischen Filter öffnet
- **THEN** sendet die UI `includeTechnicalAccounts = false` oder verlässt sich auf den gleichwertigen Serverstandard
- **AND** enthält die Liste keine Accounts mit `isTechnicalAccount = true`
- **AND** entsprechen Gesamtzahl und Seitenanzahl der sichtbaren Treffermenge

#### Scenario: Administrator blendet technische Accounts ein

- **WHEN** der Administrator „Auch technische Accounts anzeigen“ aktiviert
- **THEN** lädt die UI die Liste mit `includeTechnicalAccounts = true` neu
- **AND** setzt sie die aktuelle Seite auf 1 zurück
- **AND** kennzeichnet technische Accounts mit einem lokalisierten Badge
- **AND** bleiben Suche, Status- und Rollenfilter kombinierbar

#### Scenario: Administrator bearbeitet die technische Eigenschaft

- **WHEN** ein zur Account-Bearbeitung berechtigter Administrator die Account-Erstellung oder Account-Detailseite öffnet
- **THEN** bietet die UI das boolesche Feld „Ist ein technischer Account“ an
- **AND** erläutert sie, dass das Merkmal den Account von Kontolöschungsregeln ausnimmt
- **AND** behauptet sie keine automatische Sperrung von Login, Rollen oder anderen Accountfunktionen

#### Scenario: Technisches Flag verändert Accountaktionen nicht automatisch

- **WHEN** ein technischer Account in der eingeblendeten Liste oder im Detail angezeigt wird
- **THEN** richten sich vorhandene Aktionen weiterhin nach ihren bestehenden Permissions und Accountzuständen
- **AND** sperrt oder aktiviert die UI keine Aktion allein aufgrund von `isTechnicalAccount`

#### Scenario: Entfernen des Flags warnt vor erneuter Lifecycle-Teilnahme

- **GIVEN** ein Account ist aktuell als technisch klassifiziert
- **WHEN** ein Administrator das Flag im Accountdetail entfernt
- **THEN** weist die UI verständlich darauf hin, dass der Account ab dem nächsten Lauf wieder den unveränderten Inaktivitätsregeln unterliegt
- **AND** behauptet sie weder eine sofortige Reaktivierung noch eine automatische Änderung anderer Accountmerkmale

### Requirement: Paginierte Benutzerlisten täuschen keine globale Sortierung vor

Das System MUST Sortieraktionen in paginierten Tenant- und Plattform-Benutzerlisten nur anbieten, wenn die führende Benutzerquelle die vollständige gefilterte Ergebnismenge für das jeweilige Feld korrekt sortieren kann.

#### Scenario: Keycloak unterstützt die dargestellten Sortierfelder nicht global

- **GIVEN** eine Tenant- oder Plattform-Benutzerliste wird seitenweise aus Keycloak und lokalen Projektionen zusammengesetzt
- **AND** die führende Quelle unterstützt keine globale Sortierung für eine dargestellte Spalte
- **WHEN** ein Administrator die paginierte Benutzerliste öffnet
- **THEN** zeigt die Spalte keine Sortieraktion
- **AND** sortiert der Browser nicht ausschließlich die aktuell geladene Benutzerseite

#### Scenario: Unpaginierte Benutzer-Teilansicht besitzt einen Vollbestand

- **GIVEN** eine getrennte Benutzer-Teilansicht enthält nachweislich den vollständigen gefilterten Datenbestand
- **WHEN** sie eine fachlich korrekte clientseitige Sortierung anbietet
- **THEN** darf sie den expliziten Tabellenmodus `client` verwenden
- **AND** wird diese Sortierung nicht allein wegen der deaktivierten paginierten Hauptlisten entfernt

### Requirement: Interne Entflechtung bewahrt den Vertrag der Account-Profilseite

Das System SHALL die Account-Profilseite so strukturieren, dass framework-unabhängige Formularregeln, asynchroner Seitenzustand und zugängliche Präsentation getrennt weiterentwickelt werden können, ohne den bestehenden Profil-, IAM- oder Credential-Self-Service-Vertrag zu verändern.

#### Scenario: Seitenzustände bleiben vollständig

- **WENN** die Account-Profilseite lädt, eine Anfrage fehlschlägt oder ein Nutzer nicht angemeldet ist
- **DANN** bleiben die bestehenden Lade-, Fehler-, Diagnose-, Retry- und Anmeldepfade erhalten
- **UND** die Zustände behalten ihre zugänglichen Status- und Fokusmerkmale

#### Scenario: Editierbarkeit und Mutation bleiben unverändert

- **WENN** ein Tenant-Nutzer Profildaten bearbeitet oder ein Plattformprofil die Seite read-only verwendet
- **DANN** bleiben Formularfelder, Validierung, normalisierte Mutation und IAM-seitige Editierbarkeit unverändert
- **UND** Erfolg, Fehler, Fokusführung und Fehlerzuordnung bleiben zugänglich wahrnehmbar

#### Scenario: Credential-Rückkehrstatus bleibt orthogonal erhalten

- **WENN** `/account` mit einem bekannten, fehlenden oder ungültigen `accountAction`-Parameter aufgerufen wird
- **DANN** bleibt das Verhalten des bestehenden Changes `add-account-credential-self-service` unverändert
- **UND** das interne Refactoring definiert oder überschreibt keinen Credential-Self-Service-Vertrag

### Requirement: Studio benennt erforderliche Berechtigungen verständlich und technisch eindeutig

Die Account- und Fach-UI MUST strukturierte Berechtigungsablehnungen über einen gemeinsamen lokalisierten Darstellungspfad ausgeben. Jede belastbar bekannte Permission MUST mit ihrem verständlichen lokalisierten Namen und ihrer technischen Action-ID erscheinen; fehlt ein Name, MUST die validierte Action-ID als sicherer Fallback sichtbar bleiben.

#### Scenario: Einzelne Permission fehlt

- **WHEN** die UI einen validierten Denial mit `permission_missing` und `iam.user.write` erhält
- **THEN** zeigt sie sinngemäß „Fehlende Berechtigung: Benutzer bearbeiten (`iam.user.write`)“
- **AND** verwendet sie den zentral registrierten deutschen oder englischen Berechtigungsnamen

#### Scenario: Lokalisierter Name ist nicht verfügbar

- **WHEN** eine validierte Action-ID keinen auflösbaren lokalisierten Namen besitzt
- **THEN** zeigt die UI mindestens die technische Action-ID
- **AND** fällt die gesamte Fehleranzeige nicht aus

#### Scenario: Alle aufgeführten Permissions sind erforderlich

- **WHEN** ein Denial mehrere Permissions mit `requirement_mode = allOf` enthält
- **THEN** benennt die UI alle tatsächlich fehlenden Permissions als gemeinsam erforderlich
- **AND** zeigt sie für jede Permission Name und Action-ID beziehungsweise den Action-ID-Fallback

#### Scenario: Eine alternative Permission ist ausreichend

- **WHEN** ein Denial mehrere Permissions mit `requirement_mode = anyOf` enthält
- **THEN** kommuniziert die UI, dass eine der aufgeführten Berechtigungen erforderlich ist
- **AND** behauptet sie nicht, dass sämtliche Alternativen gleichzeitig vergeben werden müssen

#### Scenario: Permission ist im aktuellen Kontext nicht ausreichend

- **WHEN** der Denial-Grund einen Scope-, Hierarchie- oder ABAC-Konflikt beschreibt
- **THEN** benennt die UI die erforderliche Action
- **AND** erklärt sie, dass die Berechtigung im aktuellen Kontext nicht ausreicht
- **AND** bezeichnet sie die Action nicht fälschlich als vollständig fehlend

#### Scenario: Permission-Zustand ist technisch nicht verfügbar

- **WHEN** die Berechtigungsauflösung degradiert oder technisch fehlgeschlagen ist
- **THEN** zeigt die UI einen lokalisierten Verfügbarkeits- oder Retry-Zustand
- **AND** nennt sie keine spekulativ fehlende Permission

#### Scenario: Berechtigungsfehler ist barrierefrei wahrnehmbar

- **WHEN** eine Berechtigungsablehnung nach Navigation oder Fachaktion dargestellt wird
- **THEN** verwendet die UI einen bestehenden persistenten und semantisch geeigneten Alert-Zustand
- **AND** ist die vollständige Information ohne Farbe verständlich
- **AND** kann die technische Action-ID als Text ausgewählt und kopiert werden

### Requirement: Host und Plugins teilen denselben Permission-Anzeigekatalog

Das Studio MUST lokalisierte Permission-Namen aus einem gemeinsamen Hostvertrag auflösen, der Core-/Host-Permissions und registrierte Plugin-Permissions umfasst. Plugins dürfen für Berechtigungsablehnungen keinen parallelen Formatter oder abweichenden technischen Fehlervertrag benötigen.

#### Scenario: Registrierte Plugin-Permission wird verweigert

- **WHEN** eine registrierte Plugin-Action wie `news.update` serverseitig verweigert wird
- **THEN** löst der Host den Namen über die registrierte Plugin-Permission-Definition auf
- **AND** zeigt die gemeinsame Fehlerdarstellung Name und `news.update`

#### Scenario: Übersetzungsvollständigkeit wird geprüft

- **WHEN** Host- oder Plugin-Permissions für die produktive Registry registriert werden
- **THEN** prüft ein automatisierter Katalogtest die vorgesehenen deutschen und englischen Namen
- **AND** bleibt die technische Action-ID der Laufzeit-Fallback für kompatible oder unbekannte Erweiterungen

### Requirement: Header-Kontomenü bietet Credential-Self-Service-Einstiege

Das System SHALL den vorgesehenen Menüeintrag für die Passwort-Änderung im Header-Kontomenü aktivieren und direkt an den serverseitigen Account-Action-Pfad anbinden. Die E-Mail-Änderung SHALL erst exponiert werden, nachdem `UPDATE_EMAIL` im Ziel-Keycloak bestätigt verfügbar ist; der serverseitige Pfad bleibt zusätzlich fail-closed.

#### Scenario: Passwort-Menüeintrag ist aktiv

- **WENN** ein authentifizierter Nutzer das Kontomenü in der Kopfzeile öffnet
- **DANN** ist der Eintrag `Passwort ändern` aktiv und nicht deaktiviert
- **UND** führt direkt auf einen klaren Self-Service-Pfad des Studios, der die Keycloak-Aktion serverseitig initialisiert

#### Scenario: E-Mail-Menüeintrag bleibt ohne bestätigte Keycloak-Unterstützung ausgeblendet

- **GIVEN** `UPDATE_EMAIL` ist im Ziel-Keycloak noch nicht bestätigt verfügbar
- **WENN** ein authentifizierter Nutzer das Kontomenü in der Kopfzeile öffnet
- **DANN** wird der Eintrag `E-Mail ändern` nicht angeboten
- **UND** lehnt der serverseitige Account-Action-Pfad einen direkten Start kontrolliert mit einem Studio-eigenen Status ab

#### Scenario: E-Mail-Menüeintrag darf nach bestätigter Unterstützung aktiviert werden

- **GIVEN** `UPDATE_EMAIL` ist im Ziel-Keycloak bestätigt verfügbar
- **WENN** das Studio den Eintrag `E-Mail ändern` exponiert
- **DANN** führt er auf den serverseitigen Account-Action-Pfad des Studios
- **UND** initialisiert dieser die Keycloak-Aktion nur nach erneuter serverseitiger Capability-Prüfung

### Requirement: Rückkehrstatus wird auf der Account-Seite angezeigt

Das System SHALL nach Rückkehr aus einem über das Studio gestarteten Keycloak-Credential-Flow auf `/account` eine verständliche Statusmeldung für Erfolg oder Abbruch anzeigen.

#### Scenario: Passwortänderung war erfolgreich

- **WENN** ein Nutzer nach erfolgreicher Passwortänderung zu `/account` zurückkehrt
- **DANN** zeigt die Seite eine verständliche Erfolgsbestätigung
- **UND** bleibt das Profilformular normal nutzbar

#### Scenario: E-Mail-Änderung war erfolgreich

- **WENN** ein Nutzer nach erfolgreicher E-Mail-Änderung zu `/account` zurückkehrt
- **DANN** zeigt die Seite eine verständliche Erfolgsbestätigung
- **UND** bleibt das Profilformular normal nutzbar

#### Scenario: Nutzer hat die Aktion abgebrochen

- **WENN** ein Nutzer einen über das Studio gestarteten Credential-Flow in Keycloak abbricht und zu `/account` zurückkehrt
- **DANN** zeigt die Seite eine neutrale Abbruchmeldung
- **UND** bleibt das Profilformular normal nutzbar

### Requirement: Instanz-Detailseite bietet einen Root-Admin-Modul-Workspace in der Betriebsansicht

Das System SHALL unter `/admin/instances/:instanceId` im Tab `Betrieb` die
gemeinsame Modulverwaltung für genau diese Instanz bereitstellen. Der bestehende
Workspace SHALL Zuweisung, Transparenz und verfügbare Readiness pro Modul
zusammenführen. `/admin/modules` SHALL als rootweiter Sammelarbeitsplatz dieselbe
fachliche Mutationslogik und unveränderte Zugriffskontrolle verwenden.

#### Scenario: Root-Admin verwaltet Module direkt im Instanz-Detail

- **WHEN** der Root-Admin den Tab `Betrieb` einer Instanz öffnet
- **THEN** sind zugewiesene und verfügbare Module innerhalb derselben Ansicht gruppiert oder gleichwertig filterbar
- **AND** stehen die bisherigen fachlichen Aktionen ohne erneute Instanzauswahl zur Verfügung
- **AND** ersetzen Zeilendetails die bisher getrennten Transparenz- und Readiness-Flächen

#### Scenario: Modulzuweisung und IAM-Baseline laufen ohne zusätzlichen Confirm-Schritt

- **WHEN** der Root-Admin ein Modul zuweist oder die IAM-Basis neu aufbaut
- **THEN** führt die UI die bestehende Root-only-Mutation direkt aus
- **AND** zeigt sie danach eine verständliche Ergebnisrückmeldung und die tatsächliche Bereitschaft
- **AND** wird aus dieser Rückmeldung keine neue Aktivierungsfreigabe abgeleitet

#### Scenario: Entzug und Admin-Struktur-Initialisierung verlangen eine explizite Bestätigung

- **WHEN** ein Root-Admin einen angebotenen Modulentzug oder die vorhandene Admin-Struktur-Initialisierung auslöst
- **THEN** verlangt die UI die bestehende explizite, instanzbezogene Bestätigung
- **AND** bleiben beim Entzug Systemrollen, Permissions-Anzahl und Folgen für Rollenbeziehungen/Nutzersitzungen in der Vorschau sichtbar
- **AND** wird ohne Bestätigung keine Mutation ausgeführt und durch das Redesign kein neuer Bootstrap-Pflichtschritt eingeführt

#### Scenario: Plugin-Reparatur respektiert laufenden Job und Policy

- **WHEN** die UI eine vorhandene Lifecycle-Reparatur anbietet
- **THEN** verwendet sie nur die im bestehenden Vertrag angebotene Operation für dieses Plugin und diese Instanz
- **AND** bleiben laufende Jobs, Policy-Vorgaben und Berechtigungen für die Bedienbarkeit maßgeblich
- **AND** bewirkt mehrfaches Betätigen während einer ausstehenden Aktion keine zusätzliche Mutation

### Requirement: Benutzer-Detailansicht erklärt Mainserver-Identitätskonflikte als Betriebsfall

Das System SHALL `mainserver_user_conflict` in der Benutzer-Detailansicht als Identitätskonflikt anzeigen, der vor einer erneuten Reprovisionierung durch den Mainserver-Betrieb korrigiert werden muss. Die Ansicht SHALL keine automatische Auflösung oder wiederholte Provisionierung als Abhilfe empfehlen und SHALL die vorhandene Request-ID als sichere Referenz für den Support anzeigen, sofern sie in der Fehlerantwort enthalten ist.

#### Scenario: Reprovisionierung trifft auf einen Identitätskonflikt

- **GIVEN** der Mainserver meldet für den Zielbenutzer `local_user_conflict`
- **WHEN** Studio den Fehler als `mainserver_user_conflict` anzeigt
- **THEN** erklärt die Detailansicht, dass eine Wiederholung den Konflikt nicht löst
- **AND** verweist sie auf den Mainserver-Betrieb
- **AND** zeigt sie eine vorhandene Request-ID ohne Credentials oder fremde Identitätsdaten an

#### Scenario: Operative Korrektur wurde abgeschlossen

- **GIVEN** der Mainserver-Betrieb hat die Zuordnung anhand derselben normalisierten E-Mail-Adresse korrigiert
- **WHEN** ein berechtigter Administrator die bestehende Reprovisionierung erneut ausführt
- **THEN** verwendet die Detailansicht unverändert den bestehenden Erfolgs- oder Fehlerpfad

### Requirement: Instanzliste priorisiert Orientierung und belegten Handlungsbedarf

Die Instanzliste SHALL Name, ID, Adresse, Lifecycle, Suche und Statusfilter
beibehalten, Parent-Domain als ergänzende Information zugänglich halten und
seltene Lifecycle-Aktionen unter `Weitere Aktionen` anbieten. Handlungsbedarf
SHALL nur aus tatsächlich verfügbaren Listendaten oder ausdrücklich gestarteten
Audit-Ergebnissen stammen. Zusätzliche Detailabfragen pro Zeile sind dafür
nicht zulässig.

#### Scenario: Liste öffnet die passende Instanz ohne technische Überlastung

- **WHEN** die Instanzliste geladen wird
- **THEN** öffnet der Instanzname die vorhandene Detailroute und bleibt die Adresse als externer Link erkennbar
- **AND** ist `Instanz anlegen` die hervorgehobene Seitenaktion
- **AND** bleiben Suspendieren und Archivieren im beschrifteten Zeilenmenü mit bestehenden Guards erreichbar
- **AND** wird keine direkte ungeprüfte Aktivierung ergänzt

#### Scenario: Unbekannter Betriebszustand wird nicht als gesund angezeigt

- **GIVEN** für einen Listeneintrag liegen keine hinreichenden aktuellen Betriebsprüfungen vor
- **WHEN** die Liste den Lifecycle darstellt
- **THEN** behauptet sie keinen erfolgreichen Tenant-IAM- oder Plugin-Check
- **AND** kann sie anhand vorhandener Evidenz zur Einrichtung oder Diagnose führen
- **AND** erzeugt das Rendering keine Detailabfrage für jede Tabellenzeile

#### Scenario: Gesamt-Audit bleibt auf Anforderung vollständig lesbar

- **WHEN** der Benutzer den bestehenden Gesamt-Audit startet
- **THEN** bleiben Laufstatus, Zeitpunkt, Zielinstanzen und sämtliche Prüfergebnisse an einer aufklappbaren Stelle zugänglich
- **AND** gibt es keine zweite Darstellung desselben vollständigen Berichts

### Requirement: Instanzanlage bündelt Entscheidungen und bietet vollständige Korrekturprüfung

Der vorhandene vierstufige Assistent SHALL die Realm-Modus-Entscheidung im Schritt
`Nutzer-Datenbank (Keycloak-Realm)` bündeln und eine vollständige fachliche Review
mit direkter Korrekturrückkehr anbieten. Pflichtfelder, Defaults, Ableitungen,
Secret-Vertrag, Realm-Katalog und serverseitige Create-Readiness SHALL erhalten
bleiben. Technische Standardwerte SHALL read-only auf Anforderung zugänglich sein.

#### Scenario: Neuer Realm ist ohne technische Details anlegbar

- **WHEN** der Benutzer Instanzdaten und alle vier Admin-Angaben gültig erfasst und `Neu einrichten` wählt
- **THEN** kann er den bestehenden Standardpfad ohne Öffnen technischer Details durchlaufen
- **AND** bleiben Instanz-ID, Anzeigename und Parent-Domain im ersten Schritt
- **AND** werden Standard-Clients und Realm-/Issuer-Ableitungen nicht zu zusätzlichen Pflichtfragen
- **AND** bleibt die technische Anlage von der nachfolgenden Einrichtung und manuellen Aktivierung getrennt

#### Scenario: Review zeigt alle fachlichen Eingaben mit gezielter Korrektur

- **WHEN** der Benutzer `Prüfen und anlegen` erreicht
- **THEN** zeigt die Seite Instanzdaten, Realm-Entscheidung und Benutzername, E-Mail, Vorname und Nachname des initialen Administrators
- **AND** öffnet `Ändern` den zugehörigen Schritt mit erhaltenen Werten
- **AND** führt `Weiter` nach gültiger Korrektur direkt zum Review zurück, soweit keine neue abhängige Eingabe erforderlich ist
- **AND** bleibt der gesamte Submit einschließlich übersprungener Schritte validiert

#### Scenario: Geänderter Entwurf benötigt passende Readiness

- **WHEN** der Benutzer nach einer erfolgreichen Prüfung relevante Eingaben verändert
- **THEN** gilt das vorherige Ergebnis nicht mehr als Freigabe für den neuen Entwurf
- **AND** kann eine verspätete Antwort auf den alten Entwurf die Anlage nicht freigeben
- **AND** bleibt `Instanz anlegen` bis zum passenden aktuellen Ergebnis ohne Anlageblocker gesperrt

#### Scenario: Blockergruppen bleiben trotz kompakter Darstellung unterscheidbar

- **WHEN** die Draft-Readiness Anlage-, Bereitstellungs- oder Aktivierungsbefunde liefert
- **THEN** bleiben alle Anlageblocker und notwendigen Nutzerhandlungen offen sichtbar
- **AND** können gewöhnliche automatisch auszuführende Arbeiten kompakt zusammengefasst werden
- **AND** sind wartende oder blockierte Fähigkeiten mit ihrer Auswirkung sichtbar
- **AND** wird ein ausschließlich nachgelagerter Blocker nicht zur zusätzlichen Create-Sperre

### Requirement: Einrichtung zeigt eine aktuelle Aufgabe mit bestehenden Freigaben

Das gemeinsame Einrichtungscockpit SHALL die fünf bestehenden Schritte kompakt
darstellen und nur die aktuelle Aufgabe ausführlich zeigen. Ergebnis, Auswirkung
und höchstens eine hervorgehobene nächste Aktion SHALL sichtbar sein. Die UI SHALL
die vorhandenen serverseitigen Aktions-, Plan-, Retry- und Aktivierungsverträge
verwenden und keine zusätzliche Browserabnahme oder lokale Freigabe einführen.

#### Scenario: Planfreigabe zeigt die wirklichen Änderungen

- **GIVEN** ein aktueller bestätigbarer Plan liegt vor
- **WHEN** die UI dessen Ausführung anbietet
- **THEN** zeigt sie die relevanten Create-/Update-Auswirkungen bereits vor der Bestätigung verständlich an
- **AND** sind vollständige Planschritte und Fingerprint aufklappbar
- **AND** wird genau dieser Stand mit dem vorhandenen Bestätigungs- und Ausführungspfad verbunden

#### Scenario: Gemischter Zustand erhält Teilerfolge und zeigt den Blocker

- **GIVEN** Keycloak-Schritte waren erfolgreich, der lokale IAM-/Administrator-Abgleich ist fehlgeschlagen
- **WHEN** das Cockpit die Instanz darstellt
- **THEN** sind die Keycloak-Teilerfolge, die fehlgeschlagene Phase und die blockierte Aktivierung gleichzeitig verständlich
- **AND** gibt es höchstens eine serverseitig zulässige nächste Hauptaktion
- **AND** führt diese weder einen erneuten Create noch eine unbegründete Wiederholung erfolgreicher Schritte aus

#### Scenario: Laufende Verarbeitung und Aktualisierungsfehler bleiben wahrheitsgemäß

- **WHEN** ein vorhandener Auftrag läuft oder auf Verarbeitung wartet
- **THEN** zeigt die UI den belegten Zustand, Schritt und verfügbaren Zeitstempel ohne erfundene Fortschrittsprozente
- **AND** verändern Refreshes nicht den aktuellen Fokus oder offene Formularentwürfe
- **AND** bleibt bei fehlgeschlagenem Refresh der letzte bekannte Zustand als solcher mit Aktualisierungshinweis sichtbar

#### Scenario: Manuelle Aktivierung bleibt eigener Abschluss

- **WHEN** die vorhandene Serverfreigabe die Aktivierung zulässt
- **THEN** bietet das Cockpit die ausdrücklich bestätigte Aktivierung mit den bestehenden Schutzbedingungen an
- **AND** behauptet die UI vor deren Erfolg keinen aktiven Lifecycle
- **AND** führt ihr Erfolg in den Betriebsbereich, ohne einen neuen Pflichtschritt zur Browserabnahme zu erzeugen

### Requirement: Instanzbefunde bleiben sichtbar und führen zur belegten Handlung

Die Instanzoberfläche SHALL aktuelle Fehler mit belegter Ursache oder ausdrücklich
unklarer Ursache, betroffener Funktion, Auswirkung und zulässiger Folgehandlung
darstellen. Blocker SHALL unabhängig vom Zustand technischer Disclosures sichtbar
bleiben. Freigegebene Diagnoseinformationen SHALL vollständig erreichbar sein;
Secrets, Tokens, Rohantworten und unzulässige personenbezogene Diagnosedaten
SHALL weder angezeigt noch in Diagnosetexte übernommen werden.
Vorhandene strukturierte Fehler SHALL über den bestehenden Hook-/API-Pfad bis
zur zuständigen Darstellung erhalten bleiben; unbekannte Codes SHALL einen
sicheren übersetzten Fallback ohne erfundene Ursache erhalten.

#### Scenario: Fehlerverweis öffnet den betroffenen Bereich

- **GIVEN** ein ungültiges Feld liegt in einem anderen Schritt, Tab oder eingeklappten Abschnitt
- **WHEN** der Benutzer nach einem Submit-Fehler den verlinkten Eintrag der fokussierten Fehlerübersicht auswählt
- **THEN** öffnet die UI den Zielbereich und fokussiert anschließend das Feld
- **AND** bleiben andere Eingaben, Dirty-State und weitere Fehler erhalten
- **AND** sind Inline-Fehler über `aria-invalid` und `aria-describedby` verbunden

#### Scenario: Unterschiedliche Ursachen erhalten passende Folgehandlungen

- **WHEN** ein Befund eine fehlende Berechtigung, einen Realm-Konflikt, eine nicht erreichbare Abhängigkeit oder einen unbekannten Fehler beschreibt
- **THEN** benennt die UI den belegten Fall und eine passende Korrektur, lesende Prüfung oder Diagnose
- **AND** wird eine mutierende Wiederholung ausschließlich bei bestehender sicherer Freigabe angeboten
- **AND** erfindet die UI keine konkrete Ursache, Serviceidentität oder Aktualität

#### Scenario: Workflowfehler behalten ihre belegte Klassifikation

- **GIVEN** Detail-Laden, Preflight oder Planung liefert einen strukturierten Fehler
- **WHEN** der vorhandene Hook diesen an die Oberfläche weitergibt
- **THEN** bleiben Status, Code, Request-ID, Klassifikation, Diagnosestatus, Handlungsempfehlung, sichere Details und Berechtigungsbefund soweit vorhanden erhalten
- **AND** wird etwa `database_unavailable` nicht zu `keycloak_unavailable` umgedeutet
- **AND** verwendet die Anzeige die bestehenden übersetzten Fehlermeldungen und freigegebenen Diagnosedetails

#### Scenario: Unbekannter Fehlercode behauptet keinen Dienstausfall

- **GIVEN** ein Workflow liefert einen bisher unbekannten Fehlercode ohne belegte Ursache
- **WHEN** die Oberfläche den Fehler darstellt
- **THEN** zeigt sie einen sicheren übersetzten Fallback mit vorhandener Korrelation und ausdrücklich unklarer Ursache
- **AND** behauptet sie keinen Keycloak-Ausfall und zeigt weder Rohantworten noch ungeprüfte Fehlermeldungstexte
- **AND** bietet sie keinen generischen mutierenden Retry an

#### Scenario: Zusammengefasste Befunde verlieren keine fachliche Achse

- **WHEN** mehrere Meldungen zusammengefasst werden
- **THEN** beziehen sie sich auf dieselbe Instanz, Achse beziehungsweise dasselbe Artefakt, dieselbe Ursache, Aktualität und Folgehandlung
- **AND** bleiben Konfiguration, Rechteprobe und Reconcile sowie deren Serviceidentitäten unterscheidbar
- **AND** führt der knappe Kopfhinweis zum vollständigen Befund statt denselben Volltext mehrfach zu rendern

#### Scenario: Blocker bleibt bis zur belegten Behebung sichtbar

- **WHEN** eine Aktion fehlschlägt oder aktuelle Evidenz weiter einen Blocker meldet
- **THEN** wird der Befund nicht zeitgesteuert ausgeblendet
- **AND** beseitigt eine reine Queue-Annahme oder vorübergehende Erfolgsmeldung ihn nicht
- **AND** erzeugt eine nicht blockierende Warnung keine zusätzliche fachliche Sperre

### Requirement: Instanzeinstellungen trennen fachliche Gruppen und lokale Speicherbereiche

Die Einstellungen SHALL die Gruppen `Allgemein`, `Erster Administrator`,
`Account-Einladung`, `Nutzer-Datenbank und Clients` und `Zugangsdaten` anbieten.
Technische Gruppen SHALL mit verständlicher Zusammenfassung aufklappbar sein;
notwendiger Handlungsbedarf bleibt außen sichtbar. Instanzeinstellungen und
Einladungsvorlage SHALL getrennte lokale Entwürfe und Speicherzustände besitzen
und ausschließlich über die vorhandenen Mutationsverträge gespeichert werden.

#### Scenario: Technische Felder bleiben auffindbar und werden nicht automatisch gespeichert

- **WHEN** ein Benutzer einen technischen Einstellungsbereich öffnet, bearbeitet oder schließt
- **THEN** bleiben alle bisherigen zulässigen Felder erreichbar und lokale Änderungen erhalten
- **AND** löst der Bereichswechsel keine Mutation aus
- **AND** persistiert erst die ausdrücklich benannte Aktion die Instanzeinstellungen

#### Scenario: Secret-Zustand und Secret-Wert bleiben getrennt

- **WHEN** die Einstellungen Zugangsdaten darstellen
- **THEN** zeigt die UI konfiguriert/fehlend/automatisch erzeugt ohne bestehende Secret-Werte auszugeben
- **AND** bleiben die bisherigen Bedingungen für manuelle Eingabe erhalten
- **AND** bedeutet leer lassen weiterhin unverändert und werden neue Secret-Eingaben erst nach erfolgreichem Save geleert

#### Scenario: Vorlage übernimmt keinen ungespeicherten Einstellungsentwurf

- **GIVEN** Name, Realm oder Secret wurden lokal geändert, aber nicht gespeichert
- **WHEN** der Benutzer die Einladungsvorlage speichert oder zurücksetzt
- **THEN** enthält der Vorlagen-Update-Payload keine dieser lokalen Änderungen
- **AND** stammen vom bestehenden Vollupdate benötigte übrige Werte aus dem gespeicherten Instanzsnapshot
- **AND** bleiben Einstellungsentwurf und Dirty-State nach erfolgreichem Vorlagen-Save erhalten
- **AND** laufen Instanz-Save und Vorlagen-Save nicht gleichzeitig

#### Scenario: Vorlagenkonflikt bleibt konkret korrigierbar

- **WHEN** die bestehende Vorlagenrevision beim Speichern nicht mehr aktuell ist
- **THEN** zeigt der Editor einen wahrnehmbaren Revisionskonflikt mit Möglichkeit zum erneuten Laden
- **AND** wird der Konflikt nicht als generischer Speicherfehler oder Erfolg dargestellt
- **AND** bleiben Vorlagenentwurf und fremde lokale Einstellungen bis zur bewussten Korrektur erhalten

### Requirement: Instanzarbeitsbereiche bewahren zugängliche Form- und Navigationszustände

Die neu geordneten Instanzformulare SHALL die vorhandenen Studio-Form-Primitiven
mit dem RHF-/Zod-Standard verwenden und deutsche/englische Texte über das
Translationssystem beziehen. Tastaturbedienung, Fokus, Entwürfe und Fehler SHALL
über Schritte, Tabs, Dialoge und Hintergrundaktualisierungen hinweg konsistent
bleiben. Status SHALL zusätzlich zur Farbe textlich erkennbar sein.
Der Entwurferhalt SHALL für die geöffnete Oberfläche gelten; für vollständige
Seitenwechsel zur Anmeldung wird keine Wiederherstellung zugesagt. Der Change
SHALL keine zusätzliche Entwurfspersistenz einführen.

#### Scenario: Bereichswechsel und Refresh erhalten den Entwurf

- **WHEN** ein Benutzer zwischen Bereichen wechselt oder Statusdaten im Hintergrund aktualisiert werden
- **THEN** bleiben seine Werte, Fehler und Dirty-State erhalten
- **AND** stiehlt das Refresh keinen Fokus
- **AND** werden verspätete Antworten für eine vorherige Instanz nicht in die aktuell geöffnete Instanz übernommen

#### Scenario: Lokaler Fehler erhält den Entwurf innerhalb der geöffneten Oberfläche

- **WHEN** ein Fehler oder eine bestehende Reauth-Interaktion ohne vollständigen Seitenwechsel auftritt
- **THEN** bleiben lokale Eingaben, Fehler und Dirty-State erhalten
- **AND** gilt dies auch für noch nicht gespeicherte Secret-Eingaben im lokalen Formularzustand

#### Scenario: Vollständige Neuanmeldung folgt dem bestehenden Session-Vertrag

- **WHEN** der bestehende AuthProvider wegen abgelaufener Session vollständig zur Anmeldung navigiert
- **THEN** bleibt dieser Anmelde- und Session-Recovery-Pfad unverändert
- **AND** wird keine Wiederherstellung des lokalen Entwurfs nach dem Seitenwechsel vorausgesetzt
- **AND** werden Entwürfe dafür nicht zusätzlich persistiert und Secret-Eingaben weder in Browser-Storage noch URLs oder Logs übernommen

#### Scenario: Tastatur und schmaler Viewport behalten alle Aufgaben bei

- **WHEN** der Benutzer die Oberfläche per Tastatur, bei 320 CSS-Pixeln Breite oder mit 200 Prozent Zoom bedient
- **THEN** bleiben Hauptaktion, Fehler, Fachbereiche und Experten-Details ohne horizontales Seiten-Scrolling erreichbar
- **AND** besitzen Menüs und Disclosures verständliche Namen und Zustände
- **AND** gibt ein geschlossener Dialog den Fokus an seinen Auslöser zurück
- **AND** werden wesentliche Statusänderungen zugänglich angekündigt

#### Scenario: Neue Anordnung erhält Sprache und Komponentenstandard

- **WHEN** neue Labels, Hilfen, Fehler oder Bedienelemente im Instanzbereich entstehen
- **THEN** verwenden sie vorhandene native, shadcn- oder Studio-Primitiven und vollständige de/en-Ressourcen
- **AND** bleibt die Bezeichnung `Nutzer-Datenbank (Keycloak-Realm)` im Standardablauf erhalten
- **AND** ist der read-only Studio-Kontext weiterhin `Smart Village App` oder `KasselDIALOG`
- **AND** entsteht keine parallele allgemeine Formular- oder Diagnoseplattform
