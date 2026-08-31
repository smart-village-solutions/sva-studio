## ADDED Requirements

### Requirement: Plugins deklarieren einen begrenzten Tenant-Lifecycle

Das System SHALL Plugins erlauben, hostgeführte Beiträge für `provision`, `reconcile`, `suspend`, `reactivate` und `readiness` zu deklarieren. Der Host MUST nur Beiträge eines installierten, kompatiblen und für die Instanz aktivierten Plugins ausführen und darf keine pluginId-spezifische Orchestrierung benötigen.

#### Scenario: Aktives Plugin startet seine Fachprovisionierung

- **GIVEN** ein Plugin ist für eine Instanz aktiv und deklariert `provision`
- **WHEN** der Host die Fachprovisionierung anstößt
- **THEN** startet er den registrierten namespaced Plugin-Operations-Job im gebundenen Instanzkontext
- **AND** enthält die Host-Orchestrierung keine pluginId-spezifische Fachlogik

#### Scenario: Nicht aktives Plugin erhält keinen Lifecycle-Aufruf

- **GIVEN** ein Plugin ist nicht installiert, inkompatibel oder für die Instanz deaktiviert
- **WHEN** ein Lifecycle-Aufruf angefordert wird
- **THEN** lehnt der Host die Operation fail-closed mit einem stabilen Fehlercode ab
- **AND** führt keinen Plugin-Handler aus

### Requirement: Lifecycle-Läufe sind generationsgebunden und idempotent

Das System SHALL jeden tenantbezogenen Lifecycle-Lauf an Plugin, `instanceId`, Sollgeneration und persistenten Claim binden. Ein veralteter oder konkurrierender Lauf MUST daran gehindert werden, einen neueren Sollzustand zu überschreiben.

#### Scenario: Wiederholter Provisionierungsaufruf reconciliiert denselben Sollzustand

- **GIVEN** ein Provisionierungslauf wurde nach einem Teilfehler beendet
- **WHEN** dieselbe oder eine neuere Sollgeneration erneut ausgeführt wird
- **THEN** reconciliert der Plugin-Handler vorhandene Fachartefakte
- **AND** erzeugt keine fachlichen Duplikate

#### Scenario: Veralteter Jobabschluss wird verworfen

- **GIVEN** ein älterer Lauf für Generation 3 arbeitet noch
- **AND** Generation 4 wurde bereits erfolgreich geclaimt
- **WHEN** der ältere Lauf seinen Abschluss persistieren will
- **THEN** lehnt der Host diesen Abschluss deterministisch ab
- **AND** bleibt die Evidenz der neueren Generation unverändert

### Requirement: Plugins melden einen gemeinsamen operationalen Tenantstatus

Das System SHALL pro aktivem Plugin und Instanz einen Status `pending`, `ready`, `degraded` oder `blocked` mit namespaced Einzelprüfungen, Revision, Aktualisierungszeit und optionaler Reparaturaktion bereitstellen.

#### Scenario: Plugin meldet vollständige Readiness

- **GIVEN** alle erforderlichen Fachprüfungen eines Plugins sind erfolgreich
- **WHEN** der Host das Plugin-Readiness-Read-Modell lädt
- **THEN** lautet der Gesamtstatus `ready`
- **AND** sind die zugrunde liegenden namespaced Prüfungen nachvollziehbar

#### Scenario: Teilprüfung blockiert den Fachzugriff

- **GIVEN** eine erforderliche Prüfung meldet `blocked`
- **WHEN** ein tenantbezogener Fachzugriff des Plugins angefordert wird
- **THEN** lehnt der Host den Zugriff fail-closed ab
- **AND** bleibt der Core-/IAM-Betriebszustand der Instanz separat sichtbar

### Requirement: Suspendierung und Reaktivierung erhalten Plugin-Identität und Daten

Das System SHALL Suspendierung und Reaktivierung als reversible Lifecycle-Operationen behandeln. Suspendierung MUST Fachzugriffe sperren, darf aber ohne getrennte Lifecycle-Freigabe weder Plugin-Identität noch Fachdaten löschen.

#### Scenario: Plugin-Tenant wird suspendiert

- **GIVEN** ein Plugin-Tenant ist aktiv und fachlich bereit
- **WHEN** eine autorisierte Suspendierung ausgeführt wird
- **THEN** sperrt der Host Routen, Jobs und interne Fachzugriffe dieses Tenantkontexts
- **AND** bleiben Aktivierungsevidenz, Fachdaten und Audit erhalten

#### Scenario: Plugin-Tenant wird reaktiviert

- **GIVEN** ein zuvor suspendierter Plugin-Tenant wird autorisiert reaktiviert
- **WHEN** der Reaktivierungslauf ausgeführt wird
- **THEN** verwendet er dieselbe Plugin- und Instanzidentität
- **AND** reconciliiert den aktuellen Sollzustand vor erneuter Freigabe

### Requirement: Persistenzdetails bleiben unter Plugin-Ownership

Das System MUST Datenbanktopologie, Fachschema, Migrationen, Repositories und fachliche Readiness-Prüfungen beim jeweiligen Plugin belassen. Der generische Lifecycle darf weder eine Datenbank pro Tenant noch eine gemeinsame Datenbank erzwingen.

#### Scenario: Zwei Plugins verwenden unterschiedliche Datenbanktopologien

- **GIVEN** Plugin A verwendet eine Datenbank pro Tenant und Plugin B eine gemeinsame RLS-geschützte Datenbank
- **WHEN** beide den Tenant-Lifecycle ausführen
- **THEN** verwenden sie denselben Hostvertrag für Job, Claim, Audit und Readiness
- **AND** implementiert jedes Plugin seine eigene Topologie, Migration und Isolation

### Requirement: Kritische Lifecycle-Invarianten besitzen direkte System-Evidenz

Das System MUST die stabilen Invarianten `AUTH-01` bis `OBS-01` aus dem
System-Assurance-Vertrag erfüllen. Jeder nicht terminale Zustand MUST einen
persistenten Recovery-Pfad besitzen; Lifecycle-Ledger, Studio-Job und
Terminalevent MUST eine gemeinsame Commit-Entscheidung teilen. Ein grüner
Gesamt-PR ohne die jeweils führende direkte Evidenzklasse genügt nicht als
Nachweis.

#### Scenario: Prozessabbruch nach einem Lifecycle-Request

- **GIVEN** ein Lifecycle-Request wird während Jobanlage, Claim oder Queueing unterbrochen
- **WHEN** die Transaktion abbricht oder der Prozess endet
- **THEN** bleiben entweder alle Lifecycle-, Job- und Wake-up-Daten unsichtbar
- **OR** ein vollständig geclaimter Owner-Job besitzt einen persistenten Execution- und Recovery-Wake-up
- **AND** benötigt die Konvergenz keinen neuen HTTP-Request und kein UI-Polling

#### Scenario: Terminaler Abschluss wird gemeinsam persistiert

- **GIVEN** ein aktueller generationsgebundener Lifecycle-Job endet erfolgreich, permanent fehlerhaft oder abgebrochen
- **WHEN** der Host den Abschluss persistiert
- **THEN** werden Lifecycle-Ledger, terminaler Studio-Jobstatus und korrespondierendes Terminalevent gemeinsam committet
- **AND** kann eine Redelivery keinen anderen Terminalzustand erzeugen

#### Scenario: Vertragsdrift wird vor historischer Klassifikation bewertet

- **GIVEN** Lifecycle-Operation, Readiness-Checks oder deren Revision haben sich seit Jobanlage geändert
- **WHEN** ein historischer Retry oder Abschluss verarbeitet wird
- **THEN** bewertet der Host zuerst den aktuellen hostvalidierten Vertrag
- **AND** erzeugt Reconcile oder einen explizit reparierbaren Konflikt statt historischer Freigabe

#### Scenario: Worker-Ausfall wird ohne Request-Traffic repariert

- **GIVEN** eine Default- oder privilegierte Worker-Lane fällt mit dauerhaft gespeicherter Arbeit aus
- **WHEN** die zuständige Lane wieder verfügbar ist
- **THEN** nimmt sie den durch Lane, Claim und Generation gefenceten Task selbstständig wieder auf
- **AND** bleibt die Runtime bis zur nachgewiesenen Erholung fail-closed diagnostizierbar
