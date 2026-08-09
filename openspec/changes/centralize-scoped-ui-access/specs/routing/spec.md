## MODIFIED Requirements

### Requirement: Fully-Qualified Plugin-Action-Bindings im Routing und UI

Das Routing-System MUST Plugin-Routen und zugehörige UI-Bindings so integrieren, dass jeder autorisierbare Beitrag seine vollständig qualifizierte Action-ID und gegebenenfalls seine erforderliche Modulzuweisung explizit referenziert. Der Host MUST diese Referenzen vor der Route-Materialisierung gegen denselben validierten Plugin-Registry-Snapshot auflösen, den Navigation und Plugin-UI konsumieren.

#### Scenario: Host-App löst Plugin-Aktionsmetadaten zentral auf

- **WHEN** die Host-App Plugins registriert
- **THEN** baut sie neben Route- und Navigation-Registries auch eine zentrale Plugin-Action-Registry auf
- **AND** UI-Bindings können Titel, Owner, Modulbezug und Access-Anforderung über die fully-qualified Action-ID auflösen
- **AND** wird kein partieller Route- oder Navigations-Snapshot veröffentlicht, wenn eine autorisierbare Referenz unbekannt ist

#### Scenario: Plugin-UI nutzt deklarierte Action-ID statt impliziter String-Konvention

- **WHEN** eine Plugin-Oberfläche eine Aktion wie `news.create` rendert
- **THEN** liest sie den Titel-, Modul- und Access-Bezug aus der deklarierten Plugin-Action-Definition
- **AND** es existiert keine separate, ungebundene UI-Konvention für dieselbe Aktion

#### Scenario: Route ohne erforderlichen Access-Bezug

- **WHEN** eine autorisierbare Plugin-Route nach Abschluss der Migration keine vollständig qualifizierte Action-Anforderung deklariert
- **THEN** weist die gemeinsame Registry-Validierung den Beitrag mit einem deterministischen Diagnosecode ab
- **AND** materialisiert das Routing die Route nicht

## ADDED Requirements

### Requirement: Route-Guards verwenden denselben scope-gebundenen Access-State wie die UI

Das Routing-System MUST öffentliche, authentifizierte, technische Plattform- und tenantgebundene Routen ausdrücklich unterscheiden. Tenantgebundene Permission-Guards MUST denselben Effective-Access-State auswerten, den Navigation und Seitenaktionen für die aktive Instanz und aktive Organisation beziehungsweise den organisationslosen Kontext verwenden, und erforderliche Modulzuweisungen zusätzlich prüfen. Ein unaufgelöster, veralteter oder fehlerhafter Snapshot SHALL keine geschützte Route freigeben. Technische Plattformrollen SHALL ausschließlich dokumentierte Root-/Control-Plane-Routen freigeben und keine Tenant-Action erweitern.

#### Scenario: Guard wartet auf den aktuellen Scope

- **WENN** eine geschützte Route während eines Organisationswechsels aufgerufen wird
- **DANN** verwendet der Guard keine Entscheidung des vorherigen Organisationskontexts
- **UND** materialisiert er die geschützte Seite erst nach einer belastbaren Entscheidung für den aktuellen Scope
- **UND** behandelt er `error` nicht als erlaubten Zugriff

#### Scenario: Navigation und direkter URL-Aufruf stimmen überein

- **WENN** eine Permission für eine geschützte Route im aktuellen Scope fehlt
- **DANN** zeigt die Navigation keinen ausführbaren Einstieg
- **UND** verweigert der Route-Guard auch einen direkten URL-Aufruf
- **UND** bleibt die serverseitige API-Prüfung unabhängig davon bestehen

#### Scenario: Read-Guard erteilt kein Mutationsrecht

- **WENN** ein Detailrouten-Guard nur die passende Read-Permission verlangt
- **DANN** erlaubt dies ausschließlich das Betreten der lesbaren Seite
- **UND** müssen Create-, Update-, Delete- und Sonderaktionen innerhalb der Seite ihre jeweils eigene Access-Entscheidung verwenden

#### Scenario: Modulzuweisung und Permission sind additive Gates

- **WENN** eine Plugin- oder Fachroute sowohl ein Modul als auch eine Permission verlangt
- **DANN** materialisiert der Guard die Route nur, wenn das Modul im aktuellen Tenant-Scope zugewiesen und die Permission erlaubt ist
- **UND** ersetzt keines der beiden Gates das jeweils andere

#### Scenario: Plattform-Route bleibt vom Tenant-Scope getrennt

- **WENN** eine dokumentierte Root-Host- oder Control-Plane-Route aufgerufen wird
- **DANN** verwendet der Guard die technische Plattform-Session-Sicht
- **UND** darf weder eine Tenant-Permission noch eine aktive Organisation diese Route freigeben

### Requirement: Dev-Auth-Verfügbarkeit ist kein Routing- oder UI-Authorization-Bypass

Das Routing-System und die Host-Navigation MUST zwischen konfigurierter Dev-Auth-Verfügbarkeit und einer nachweislich aktiven Dev-Auth-Testsession unterscheiden. Die bloße Verfügbarkeit SHALL keine Permission-, Modul- oder Route-Prüfung umgehen.

#### Scenario: Normale eingeschränkte Session in Dev-Auth-fähiger Umgebung

- **WENN** Dev-Auth in einer Umgebung konfiguriert ist
- **UND** die aktuelle Session keine aktive Dev-Auth-Testsession ist
- **DANN** werden Route, Navigation und Aktionen ausschließlich nach den effektiven Permissions dieser normalen Session ausgewertet
- **UND** erzeugt `isDevAuthAvailable` keine zusätzliche Freigabe

#### Scenario: Aktive Dev-Auth-Testsession

- **WENN** eine explizit aktive Dev-Auth-Testsession verwendet wird
- **DANN** folgt ihre Autorisierung dem dokumentierten Dev-Auth-Testvertrag
- **UND** bleibt der Sonderpfad auf lokale beziehungsweise ausdrücklich freigegebene Testumgebungen begrenzt
