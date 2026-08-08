## MODIFIED Requirements

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

## ADDED Requirements

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
