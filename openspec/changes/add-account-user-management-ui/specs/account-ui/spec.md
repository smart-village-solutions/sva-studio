# Account-UI Spezifikation

## ADDED Requirements

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
- **DANN** werden Name, E-Mail, Telefon, Position, Abteilung, Sprache und Zeitzone angezeigt
- **UND** die aktuelle Rolle und der Account-Status sind sichtbar (read-only)
- **UND** ein Avatar oder Platzhalter-Bild wird angezeigt
- **UND** die Seite zeigt einen Loading-State (`aria-busy="true"`) während die Daten geladen werden
- **UND** bei einem Ladefehler wird eine Fehlermeldung mit Retry-Button angezeigt

#### Scenario: Basis-Daten bearbeiten

- **WENN** ein Nutzer seine Basis-Daten (Name, Telefon, Position, Abteilung, Sprache, Zeitzone) ändert
- **UND** das Formular absendet
- **DANN** werden die Änderungen in der IAM-Datenbank und in Keycloak gespeichert
- **UND** eine Erfolgsbestätigung wird angezeigt (`role="status"`, `aria-live="polite"`)
- **UND** der `AuthProvider`-State wird aktualisiert
- **UND** der Fokus wird nach dem Speichern auf die Erfolgsbestätigung gesetzt

#### Scenario: Sicherheits-Einstellungen ändern (Keycloak-Redirect)

- **WENN** ein Nutzer auf „Passwort ändern", „E-Mail ändern" oder „Zwei-Faktor-Authentifizierung" klickt
- **DANN** wird ein Hinweis angezeigt: „Sie werden zur Keycloak-Kontoverwaltung weitergeleitet" (`t('account.keycloakRedirectHint')`)
- **UND** der Link zeigt ein externes-Link-Icon mit `aria-label` (z. B. „Passwort ändern – öffnet Keycloak-Kontoverwaltung")
- **UND** nach Abschluss kehrt der Nutzer über `redirect_uri` → `/account?returnedFromKeycloak=true` zurück
- **UND** die Weiterleitung öffnet im selben Tab (konsistente Navigation)

#### Scenario: Validierungsfehler bei Profilbearbeitung

- **WENN** ein Nutzer ungültige Daten eingibt (z. B. leerer Name, ungültiges Telefonnummerformat)
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
- **UND** ein Activity-Log-Eintrag (`user.bulk_deactivated`) wird pro betroffenem Nutzer erstellt- **UND** die „Alle auswählen“-Checkbox zeigt den `indeterminate`-Zustand, wenn nur ein Teil der Nutzer ausgewählt ist

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

#### Scenario: Tab-Navigation (WAI-ARIA Tabs Pattern)

- **WENN** ein Administrator die User-Bearbeitungsseite aufruft
- **DANN** werden 4 Tabs angezeigt: „Persönliche Daten", „Verwaltung", „Berechtigungen", „Historie"
- **UND** die Tabs implementieren das WAI-ARIA Tabs Pattern:
  - `role="tablist"` auf dem Container, `role="tab"` auf jedem Tab, `role="tabpanel"` auf dem Inhaltsbereich
  - `aria-selected="true"` für den aktiven Tab
  - `aria-controls` verknüpft jeden Tab mit seinem Panel
  - Arrow-Keys (Links/Rechts) wechseln den Fokus zwischen Tabs
  - `Home`/`End` springen zum ersten/letzten Tab
- **UND** der erste Tab ist standardmäßig ausgewählt
- **UND** der Tab-Wechsel erfolgt ohne Seitenneuladung

#### Scenario: Persönliche Daten bearbeiten

- **WENN** ein Administrator den Tab „Persönliche Daten" öffnet
- **DANN** kann er Name, E-Mail, Telefon, Position, Abteilung und Adresse des Nutzers bearbeiten
- **UND** alle Pflichtfelder sind mit `aria-required="true"` markiert
- **UND** Änderungen werden in IAM-DB und Keycloak synchronisiert

#### Scenario: Verwaltung – Status und Rollen

- **WENN** ein Administrator den Tab „Verwaltung" öffnet
- **DANN** kann er den Account-Status ändern (aktiv/inaktiv/ausstehend)
- **UND** Rollen zuweisen oder entfernen (unter Beachtung des Privilege-Escalation-Schutzes)
- **UND** Sprach- und Zeitzone-Präferenzen setzen
- **UND** administrative Notizen hinterlegen (max. 2000 Zeichen)

#### Scenario: Berechtigungen einsehen

- **WENN** ein Administrator den Tab „Berechtigungen" öffnet
- **DANN** werden die effektiven Berechtigungen des Nutzers angezeigt (aggregiert aus allen zugewiesenen Rollen)
- **UND** die Anzeige ist gruppiert nach Ressourcentyp (Inhalte, Medien, Benutzer, Module, Design, Einstellungen)

#### Scenario: Historie einsehen

- **WENN** ein Administrator den Tab „Historie" öffnet
- **DANN** werden die letzten Activity-Log-Einträge des Nutzers chronologisch angezeigt
- **UND** jeder Eintrag zeigt: Datum, Aktion, Beschreibung, Ausführender
- **UND** die Liste ist scrollbar und paginiert
- **UND** bei leerem Verlauf wird ein Empty-State angezeigt (`t('admin.users.history.empty')`)

#### Scenario: Warnung bei ungespeicherten Änderungen

- **WENN** ein Administrator ungespeicherte Änderungen hat
- **UND** versucht, die Seite zu verlassen oder den Tab zu wechseln
- **DANN** wird eine Warnmeldung in einem `role="alertdialog"` angezeigt
- **UND** der Nutzer kann wählen, ob er speichern, verwerfen oder abbrechen möchte
- **UND** der Dialog ist per Tastatur bedienbar (Focus-Trap, Escape zum Abbrechen)

### Requirement: Rollen-Verwaltungsseite

Das System MUST eine Rollen-Verwaltungsseite unter `/admin/roles` bereitstellen, die das Anzeigen und Bearbeiten von System- und Custom-Rollen ermöglicht.

#### Scenario: Rollen-Übersicht

- **WENN** ein Administrator `/admin/roles` aufruft
- **DANN** werden alle Rollen in einer semantischen Tabelle angezeigt mit: Name, Typ (System/Custom), Beschreibung, Anzahl zugewiesener Nutzer
- **UND** System-Rollen sind als nicht-löschbar gekennzeichnet
- **UND** die Rollennamen sind vorläufig und können sich im Laufe der Entwicklung ändern
- **UND** ein Loading-State wird angezeigt, bis die Daten geladen sind

#### Scenario: Berechtigungs-Matrix einer Rolle

- **WENN** ein Administrator eine Rolle expandiert oder anklickt
- **DANN** wird eine Berechtigungs-Matrix angezeigt
- **UND** die expandierbare Zeile hat `aria-expanded` und `aria-controls`
- **UND** die Matrix zeigt pro Ressourcentyp die Aktionen: Lesen, Erstellen, Bearbeiten, Löschen, Konfigurieren
- **UND** für System-Rollen ist die Matrix read-only

#### Scenario: Custom-Rolle erstellen

- **WENN** ein Administrator eine neue Custom-Rolle erstellt
- **DANN** kann er einen Namen, eine Beschreibung und Berechtigungen aus der Matrix auswählen
- **UND** die Rolle wird in der IAM-DB gespeichert
- **UND** die Rolle ist sofort für User-Zuweisungen verfügbar

#### Scenario: Custom-Rolle löschen

- **WENN** ein Administrator eine Custom-Rolle löschen möchte
- **UND** die Rolle noch Nutzern zugewiesen ist
- **DANN** wird eine Warnung in einem `role="alertdialog"` angezeigt mit der Anzahl betroffener Nutzer
- **UND** der Administrator muss die Löschung explizit bestätigen
- **UND** die Rollenzuweisung wird von allen betroffenen Nutzern entfernt
- **UND** ein `role.deleted`-Audit-Event wird geloggt

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

#### Scenario: User auflisten

- **WENN** ein authentifizierter Administrator `GET /api/v1/iam/users` aufruft
- **DANN** werden alle User-Accounts aus der IAM-DB zurückgegeben
- **UND** die Antwort enthält Pagination-Metadaten (`total`, `page`, `pageSize`)
- **UND** Query-Parameter für Filter (`status`, `role`, `search`) werden unterstützt
- **UND** die Ergebnisse sind auf den aktuellen `instance_id`-Scope beschränkt (RLS)

#### Scenario: User erstellen mit Keycloak-Sync

- **WENN** ein Administrator `POST /api/v1/iam/users` aufruft
- **DANN** wird der Nutzer zunächst in Keycloak erstellt (über `IdentityProviderPort`)
- **UND** anschließend in der IAM-DB mit `keycloak_subject` als Referenz gespeichert
- **UND** bei einem Keycloak-Fehler wird kein DB-Eintrag erstellt
- **UND** bei einem DB-Fehler nach erfolgreichem Keycloak-Call wird der Keycloak-User entfernt (Compensation)

#### Scenario: Profil-Self-Service-Update

- **WENN** ein Nutzer `PATCH /api/v1/iam/users/me/profile` aufruft
- **DANN** werden nur die erlaubten Felder aktualisiert (Name, Telefon, Position, Abteilung, Sprache, Zeitzone)
- **UND** PII-Felder werden als `*_ciphertext` verschlüsselt gespeichert
- **UND** die Änderungen werden in IAM-DB und Keycloak User Attributes synchronisiert
- **UND** Felder wie E-Mail, Status oder Rollen können über diesen Endpunkt NICHT geändert werden

#### Scenario: JIT-Account-Erstellung beim Erst-Login

- **WENN** ein Nutzer sich erstmals über Keycloak authentifiziert
- **UND** kein Eintrag in `iam.accounts` für den `keycloak_subject` existiert
- **DANN** wird automatisch ein Account erstellt via `INSERT ... ON CONFLICT (keycloak_subject, instance_id) DO UPDATE` (Race-Condition-sicher)
- **UND** der Account erhält den Status `pending` bis ein Administrator ihn aktiviert
- **UND** ein `user.jit_provisioned`-Activity-Log-Eintrag wird geschrieben
